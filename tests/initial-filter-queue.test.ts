import test from 'node:test';
import assert from 'node:assert/strict';
import {MroyaApi} from '../src/api/client.ts';
import {createLiveSource} from '../src/providers/liveSource.ts';
import {InitialFilterQueueController} from '../src/hooks/useInitialFilterQueue.ts';
import {ApiError} from '../src/api/errors.ts';
import type {WorkspaceSource} from '../src/types/source.ts';
const a='00000000-0000-4000-8000-000000000001',b='00000000-0000-4000-8000-000000000002';
const sources=[{kind:'calendar' as const,id:a,name:'Calendar A',enabled:true},{kind:'calendar' as const,id:b,name:'Calendar B',enabled:true}];
const tick=async()=>{for(let i=0;i<40;i++)await Promise.resolve();};
const json=(v:unknown,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json'}});
const source=(v:Partial<WorkspaceSource>)=>({kind:'live',...v}) as WorkspaceSource;

test('A + B, duplicate A and reloaded controller use only parked queue API + GET counters, session and CSRF',async()=>{
 const parked=new Set<string>(),calls:{url:string;method:string}[]=[];
 const totals=()=>({queue_total:parked.size*2,calendars:[...parked].map(calendar_id=>({calendar_id,pending:2}))});
 const api=new MroyaApi(async(input,init)=>{const url=String(input),method=init?.method??'GET';calls.push({url,method});assert.equal(init?.credentials,'same-origin');
  if(url.endsWith('csrf/'))return json({csrf_token:'synthetic'});
  if(url.includes('sources/?'))return json({sources,next_offset:null});
  assert.equal(url,'/api/v1/memory-intelligence/initial-filter-queue/');
  if(method==='GET')return json(totals());
  assert.equal(method,'POST');assert.equal(new Headers(init?.headers).get('X-CSRFToken'),'synthetic');const id=JSON.parse(String(init?.body)).calendar_id,added=parked.has(id)?0:2;parked.add(id);return json({added,already_queued:added?0:2,queue_total:totals().queue_total});
 });
 const s=createLiveSource(api),c=new InitialFilterQueueController(s,()=>{});c.start();await tick();c.select(a);await c.enqueue();assert.equal(c.snapshot().receipt?.added,2);assert.equal(c.snapshot().totals?.queue_total,2);c.select(b);await c.enqueue();assert.equal(c.snapshot().totals?.queue_total,4);c.select(a);await c.enqueue();assert.equal(c.snapshot().receipt?.added,0);assert.equal(c.snapshot().totals?.queue_total,4);
 for(let i=0;i<calls.length;i++)if(calls[i].method==='POST')assert.equal(calls[i+1].method,'GET');c.stop();const restored=new InitialFilterQueueController(s,()=>{});restored.start();await tick();assert.equal(restored.snapshot().totals?.queue_total,4);restored.stop();assert.ok(calls.every(c=>!c.url.includes('scans/')&&!c.url.includes('settings/')&&!c.url.includes('accept')));
});

test('no implicit consent, double click is one POST; rejected/unknown requests never claim success or retry automatically',async()=>{
 let writes=0,resolve!:(v:any)=>void;const pending=new Promise<any>(r=>resolve=r);
 const c=new InitialFilterQueueController(source({intelligenceSources:async()=>({sources:[...sources,{kind:'calendar',id:'disabled',name:'Disabled',enabled:false}],next_offset:null}),initialFilterQueue:async()=>({queue_total:0,calendars:[]}),enqueueInitialFilter:async()=>{writes++;return pending;}}),()=>{});c.start();await tick();c.select('disabled');await c.enqueue();assert.equal(writes,0);assert.ok(c.snapshot().error);c.select(a);const one=c.enqueue();void c.enqueue();assert.equal(writes,1);resolve({added:0,already_queued:0,queue_total:0});await one;c.stop();
 for(const error of [Error('lost reply'),new ApiError(409,'source_unavailable','No consent'),new ApiError(403,'csrf_failed','Denied')]){const x=new InitialFilterQueueController(source({intelligenceSources:async()=>({sources,next_offset:null}),initialFilterQueue:async()=>({queue_total:0,calendars:[]}),enqueueInitialFilter:async()=>{writes++;throw error;}}),()=>{});x.start();await tick();x.select(a);await x.enqueue();assert.equal(x.snapshot().receipt,null);assert.ok(x.snapshot().error);const n:number=writes;await x.refresh();assert.equal(writes,n);x.stop();}
});

test('logout clears private counters and late POST results; malformed or unacknowledged responses are rejected',async()=>{
 let resolve!:(v:any)=>void,expired=0;const pending=new Promise<any>(r=>resolve=r);
 const c=new InitialFilterQueueController(source({intelligenceSources:async()=>({sources,next_offset:null}),initialFilterQueue:async()=>({queue_total:0,calendars:[]}),enqueueInitialFilter:async()=>pending}),()=>expired++);c.start();await tick();c.select(a);const write=c.enqueue();c.stop();resolve({added:2,already_queued:0,queue_total:2});await write;assert.equal(c.snapshot().totals,null);assert.equal(c.snapshot().receipt,null);
 await assert.rejects(new MroyaApi(async()=>json({queue_total:2,calendars:[]})).initialFilterQueue(),(e:any)=>e.code==='invalid_response');
 const x=new InitialFilterQueueController(source({intelligenceSources:async()=>({sources,next_offset:null}),initialFilterQueue:async()=>{throw new ApiError(401,'unauthenticated','Expired');}}),()=>expired++);x.start();await tick();assert.equal(expired,1);assert.equal(x.snapshot().totals,null);x.stop();
});
