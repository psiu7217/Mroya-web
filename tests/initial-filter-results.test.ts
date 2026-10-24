import test from 'node:test';
import assert from 'node:assert/strict';
import {MroyaApi} from '../src/api/client.ts';
import {createLiveSource} from '../src/providers/liveSource.ts';
import {InitialFilterResultsController} from '../src/hooks/InitialFilterResultsController.ts';
import {InitialFilterQueueController} from '../src/hooks/useInitialFilterQueue.ts';
import {ApiError} from '../src/api/errors.ts';
import type {WorkspaceSource} from '../src/types/source.ts';
import type {InitialFilterResults} from '../src/types/initialResults.ts';
const id='11111111-1111-4111-8111-111111111111';
const tick=async()=>{for(let i=0;i<50;i++)await Promise.resolve();};
const page=(patch:Partial<InitialFilterResults>={}):InitialFilterResults=>({summary:{total:4,pending:1,processing:1,approved:1,rejected:0,errors:1},is_complete:false,processing_enabled:true,results:[{event_id:id,title:'Synthetic event',calendar_name:'Synthetic calendar',date:'2027-03-12',decision:'APPROVE',probability:0.97,model:'synthetic-model',processed_at:'2026-10-24T18:45:00Z'}],next_offset:null,...patch});
const json=(v:unknown,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json'}});
const source=(v:Partial<WorkspaceSource>)=>({kind:'live',...v}) as WorkspaceSource;

test('results API: same-origin GET, filter/page parameters, bounded DTO and error validation',async()=>{
 const calls:string[]=[];
 const api=new MroyaApi(async(input,init)=>{calls.push(String(input));assert.equal(init?.credentials,'same-origin');assert.equal(init?.method??'GET','GET');return json(page());});
 const live=createLiveSource(api);assert.equal((await live.initialFilterResults!('APPROVE',0)).summary.errors,1);
 assert.equal(calls[0],'/api/v1/memory-intelligence/initial-filter-results/?decision=APPROVE&limit=50&offset=0');
 const rejected=page({results:[{...page().results[0],decision:'REJECT',probability:0.79}]});
 assert.equal((await new MroyaApi(async input=>{assert.ok(String(input).endsWith('decision=REJECT&limit=50&offset=50'));return json(rejected);}).initialFilterResults('REJECT',50)).results[0].probability,0.79);
 for(const invalid of [page({summary:{...page().summary,total:99}}),page({is_complete:true}),page({next_offset:0}),page({results:[{...page().results[0],probability:0.5}]}),page({results:[{...page().results[0],probability:NaN}]})])await assert.rejects(new MroyaApi(async()=>json(invalid)).initialFilterResults(),(e:any)=>e.code==='invalid_response');
 await assert.rejects(new MroyaApi(async()=>json({error:{code:'unavailable'}},404)).initialFilterResults(),(e:any)=>e.status===404);
 assert.equal(calls.length,1);
});

test('poll every 5s; stop at complete/errors, disabled, API error and close; filter and pagination retain global summary',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 let calls=0,lastOffset=0,complete=false;
 const c=new InitialFilterResultsController(source({initialFilterResults:async(decision,offset)=>{calls++;lastOffset=offset??0;return page({summary:complete?{total:4,pending:0,processing:0,approved:2,rejected:1,errors:1}:page().summary,is_complete:complete,next_offset:offset===0?50:null,results:decision==='REJECT'?[]:page().results});}}),()=>{});
 c.start();await tick();assert.equal(calls,1);t.mock.timers.tick(4999);await tick();assert.equal(calls,1);t.mock.timers.tick(1);await tick();assert.equal(calls,2);
 c.next();await tick();assert.equal(lastOffset,50);assert.equal(c.snapshot().data?.summary.total,4);c.select('REJECT');await tick();assert.equal(lastOffset,0);assert.deepEqual(c.snapshot().data?.results,[]);
 complete=true;t.mock.timers.tick(5000);await tick();const done:number=calls;t.mock.timers.tick(15000);await tick();assert.equal(calls,done);assert.equal(c.snapshot().data?.summary.errors,1);c.stop();assert.equal(c.snapshot().data,null);
 for(const response of [page({processing_enabled:false}),new ApiError(404,'unavailable','Unavailable')]){
  let n=0;const x=new InitialFilterResultsController(source({initialFilterResults:async()=>{n++;if(response instanceof Error)throw response;return response;}}),()=>{});x.start();await tick();t.mock.timers.tick(15000);await tick();assert.equal(n,1);if(response instanceof Error)assert.ok(x.snapshot().error);x.stop();
 }
 let n=0;const x=new InitialFilterResultsController(source({initialFilterResults:async()=>{n++;return page();}}),()=>{});x.start();await tick();x.stop();t.mock.timers.tick(10000);await tick();assert.equal(n,1);
});

test('confirmed enqueue wakes results; stale/account responses and 401 cannot restore results; Design has no requests',async()=>{
 let calls=0,resolve!:(v:InitialFilterResults)=>void;
 const s=source({initialFilterResults:async()=>{calls++;return page({processing_enabled:false});},intelligenceSources:async()=>({sources:[{id,kind:'calendar',name:'Synthetic calendar',enabled:true}],next_offset:null}),initialFilterQueue:async()=>({queue_total:0,calendars:[]}),enqueueInitialFilter:async()=>({added:0,already_queued:0,queue_total:0})});
 const r=new InitialFilterResultsController(s,()=>{});r.start();await tick();const q=new InitialFilterQueueController(s,()=>{},()=>void r.refresh());q.start();await tick();q.select(id);await q.enqueue();await tick();assert.equal(calls,2);q.stop();r.stop();
 const late=new InitialFilterResultsController(source({initialFilterResults:()=>new Promise(res=>resolve=res)}),()=>{});late.start();late.stop();resolve(page());await tick();assert.equal(late.snapshot().data,null);
 let expired=0;const unauth=new InitialFilterResultsController(source({initialFilterResults:async()=>{throw new ApiError(401,'unauthenticated','Expired');}}),()=>expired++);unauth.start();await tick();assert.equal(expired,1);assert.equal(unauth.snapshot().data,null);
 const design=new InitialFilterResultsController({...s,kind:'design',initialFilterResults:async()=>{throw Error('must not request');}},()=>{});design.start();await tick();assert.equal(design.snapshot().data,null);assert.equal(design.snapshot().error,null);design.stop();
});
