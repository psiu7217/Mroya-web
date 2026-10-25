import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryReviewController} from '../src/hooks/MemoryReviewController.ts';
import {MroyaApi} from '../src/api/client.ts';
import {ApiError} from '../src/api/errors.ts';
import {readReviewPage} from '../src/api/memoryReview.ts';
import type {ReviewJob,ReviewPage} from '../src/types/memoryReview.ts';
import type {WorkspaceSource} from '../src/types/source.ts';
const id='11111111-1111-4111-8111-111111111111';
const tick=async()=>{for(let i=0;i<60;i++)await Promise.resolve();};
const source=(v:Partial<WorkspaceSource>)=>({kind:'live',...v}) as WorkspaceSource;
const job=(count=1):ReviewJob=>({id,initial_filter_job_id:id,event_id:id,revision:'synthetic-revision',pipeline_version:'memory-review-v1',status:'completed',attempts:1,error_code:null,
 source_preview:{title:'Synthetic birthday',calendar_name:'Synthetic calendar',date:'2026-04-18'},
 result:{decision:count?'KEEP':'DISCARD',explanation:'Synthetic explanation',schema_version:'memory-review-schema-v1',model:'synthetic/review',processed_at:'2026-10-25T10:00:00Z',
 proposals:Array.from({length:count},()=>({formulation:'Possible birthday',information_type:'anniversary',memory_placement:'Object → Statement',usefulness:'Recurring date',entities:[{local_id:'local_1',description:'Person identity unverified',desired_match_unverified:true}],relations:[],evidence:[{field:'title',quote:'birthday'}],uncertainties:['No birth year']}))}});
const page=(patch:Partial<ReviewPage>={}):ReviewPage=>({summary:{total:1,pending:0,processing:0,completed:1,error:0,stale:0},eligible_count:1,processing_enabled:true,worker_available:true,is_complete:true,results:[job()],next_offset:null,...patch});
const pending=()=>page({summary:{total:1,pending:1,processing:0,completed:0,error:0,stale:0},is_complete:false,results:[{...job(),status:'pending',result:null}]});
const json=(v:unknown,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json'}});

test('Stage 2 bounded DTO supports zero/one/multiple proposals; rejects contradictory and executable-shaped responses',()=>{
 for(const n of [0,1,3])assert.equal(readReviewPage(page({results:[job(n)]})).results[0].result?.proposals.length,n);
 for(const invalid of [page({is_complete:false}),page({summary:{...page().summary,total:99}}),page({results:[{...job(),status:'stale'}]}),page({results:[job(9)]}),page({next_offset:0})])assert.throws(()=>readReviewPage(invalid),ApiError);
});

test('existing API client uses session + CSRF, exact empty enqueue, owner job retry; no arbitrary event/text input',async()=>{
 const calls:{url:string;init?:RequestInit}[]=[];
 const api=new MroyaApi(async(input,init)=>{const url=String(input);calls.push({url,init});
  if(url.endsWith('auth/csrf/'))return json({csrf_token:'synthetic-token'});
  if(url.includes('/results/'))return json(page());
  assert.equal(init?.method,'POST');assert.equal(init?.credentials,'same-origin');assert.equal(init?.body,'{}');
  assert.equal((init?.headers as Record<string,string>)['X-CSRFToken'],'synthetic-token');
  return url.includes('/retry/')?json({job:{...job(),status:'pending',result:null}},202):json({added:1,already_queued:0},202);
 });
 assert.equal((await api.memoryReviewResults()).eligible_count,1);
 assert.equal((await api.enqueueMemoryReview()).added,1);assert.equal((await api.retryMemoryReview(id)).status,'pending');
 assert.ok(calls.every(c=>c.url.startsWith('/api/v1/')));
 await assert.rejects(api.retryMemoryReview('foreign/not-a-uuid'),ApiError);
});

test('explicit enqueue only, double click is single POST, independent polling, stop clears user state',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});let reads=0,writes=0,resolve!:(v:{added:number;already_queued:number})=>void;
 const c=new MemoryReviewController(source({memoryReviewResults:async()=>{reads++;return pending();},enqueueMemoryReview:()=>{writes++;return new Promise(res=>resolve=res);}}),()=>{});
 c.start();await tick();assert.equal(writes,0);assert.equal(reads,1);
 const first=c.enqueue();void c.enqueue();assert.equal(writes,1);resolve({added:1,already_queued:0});await first;assert.equal(reads,2);
 t.mock.timers.tick(5000);await tick();assert.equal(reads,3);c.stop();assert.equal(c.snapshot().data,null);assert.equal(c.snapshot().receipt,null);
 t.mock.timers.tick(10000);await tick();assert.equal(reads,3);
});

test('no overlapping reads, late account response ignored, disabled/stopped worker does not poll, Design offline',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});let resolve!:(v:ReviewPage)=>void,reads=0;
 const c=new MemoryReviewController(source({memoryReviewResults:()=>{reads++;return new Promise(res=>resolve=res);}}),()=>{});
 c.start();void c.refresh();assert.equal(reads,1);c.stop();resolve(page());await tick();assert.equal(c.snapshot().data,null);
 for(const data of [page(),page({processing_enabled:false}),pending(),pending()]){
  const response={...data,worker_available:false};let n=0;
  const x=new MemoryReviewController(source({memoryReviewResults:async()=>{n++;return response;}}),()=>{});x.start();await tick();t.mock.timers.tick(20000);await tick();assert.equal(n,1);x.stop();
 }
 const d=new MemoryReviewController({...source({memoryReviewResults:async()=>{throw Error('no Design HTTP');}}),kind:'design'},()=>{});d.start();await tick();assert.equal(d.snapshot().data,null);d.stop();
});

test('401 expires session, malformed/provider errors remain errors, mutation is never retried automatically',async()=>{
 let expired=0,writes=0;
 const unauth=new MemoryReviewController(source({memoryReviewResults:async()=>{throw new ApiError(401,'unauthenticated','Expired');}}),()=>expired++);unauth.start();await tick();assert.equal(expired,1);assert.equal(unauth.snapshot().data,null);
 const c=new MemoryReviewController(source({memoryReviewResults:async()=>page(),enqueueMemoryReview:async()=>{writes++;throw new ApiError(502,'provider_unavailable','No success');}}),()=>{});
 c.start();await tick();await c.enqueue();assert.equal(writes,1);assert.ok(c.snapshot().error);assert.equal(c.snapshot().receipt,null);c.stop();
});

test('Initial Filter update during a review read schedules one follow-up without overlap',async()=>{
 let resolve!:(v:ReviewPage)=>void,reads=0;
 const c=new MemoryReviewController(source({memoryReviewResults:async()=>{reads++;if(reads===1)return new Promise(res=>resolve=res);return page({eligible_count:2});}}),()=>{});
 c.start();c.invalidate();c.invalidate();assert.equal(reads,1);
 resolve(page({eligible_count:0}));await tick();assert.equal(reads,2);assert.equal(c.snapshot().data?.eligible_count,2);c.stop();
});
