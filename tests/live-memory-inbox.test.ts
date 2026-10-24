import test from 'node:test';
import assert from 'node:assert/strict';
import {MroyaApi} from '../src/api/client.ts';
import {createLiveSource} from '../src/providers/liveSource.ts';
import {ApiError} from '../src/api/errors.ts';
import {readIntelligenceProposal} from '../src/api/intelligence.ts';
import {LiveMemoryInboxController} from '../src/hooks/useLiveMemoryInbox.ts';
import {proposalPresentation,inboxActions,receiptMessage} from '../src/hooks/inboxAdapters.ts';
import {INBOX_STATUSES} from '../src/types/intelligenceApi.ts';
import type {WorkspaceSource} from '../src/types/source.ts';
import type {IntelligenceProposal,DecisionBody,ProposalDecision} from '../src/types/intelligenceApi.ts';
import {proposal,proposalId,capabilities,runtime,operation} from './intelligence-fixture.ts';
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
const gate=()=>{let resolve!:(value:any)=>void;const promise=new Promise<any>(done=>resolve=done);return {promise,resolve};};
const settle=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
function setup(t:any,patch:Partial<WorkspaceSource>={}){
 let expired=0;
 const source={kind:'live',intelligenceSettings:async()=>capabilities,intelligenceStatus:async()=>runtime,
  inboxProposals:async()=>({proposals:[proposal()],next_offset:null}),inboxProposal:async()=>proposal(),
  inboxHistory:async()=>({history:[],next_offset:null}),inboxDecision:async()=>({proposal:proposal({version:2,status:'pending_apply',apply:operation()}),replayed:false}),...patch} as WorkspaceSource;
 const controller=new LiveMemoryInboxController(source,1,()=>expired++);controller.start();controller.setVisible(true);t.after(()=>controller.stop());
 return {controller,source,get expired(){return expired;}};
}

test('existing API transport uses session+CSRF for all five decisions and owner-scoped list/detail/history/settings/status paths',async()=>{
 const calls:{url:string;init:RequestInit|undefined}[]=[];
 const api=new MroyaApi((async(url,init)=>{calls.push({url:String(url),init});const path=String(url);
  if(path.endsWith('/csrf/'))return json({csrf_token:'synthetic-token'});
  if(path.includes('/settings/'))return json({settings:{autonomy:'auto_link'},capabilities});
  if(path.endsWith('/status/'))return json(runtime);
  if(path.includes('/history/'))return json({history:[{version:1,kind:'analysis',snapshot:{status:'pending',plan:proposal().plan,apply:{}},comment:'',created_at:proposal().created_at}],next_offset:null});
  if(path.includes('/proposals/?'))return json({proposals:[proposal()],next_offset:null});
  return json(init?.method==='POST'?{proposal:proposal(),replayed:true}:{proposal:proposal()});
 }) as typeof fetch);
 const live=createLiveSource(api);
 await live.intelligenceSettings!();await live.intelligenceStatus!();await live.inboxProposals!(0);await live.inboxProposal!(proposalId);await live.inboxHistory!(proposalId,0);
 const body={version:1,request_id:'20000000-0000-4000-8000-000000000001'};
 for(const action of ['accept','reject','comment','reconsider','retry'] as ProposalDecision[]){const out=await live.inboxDecision!(proposalId,action,{...body,...(action==='comment'?{comment:'Synthetic comment'}:{})});assert.equal(out.replayed,true);}
 for(const {url,init} of calls){assert.ok(url.startsWith('/api/v1/'));assert.equal(init?.credentials,'same-origin');assert.equal(init?.cache,'no-store');if(init?.method==='POST'){assert.equal((init.headers as Record<string,string>)['X-CSRFToken'],'synthetic-token');assert.equal(JSON.parse(String(init.body)).version,1);}}
 assert.equal(calls.filter(c=>c.url.endsWith('/csrf/')).length,1);
 await assert.rejects(live.inboxDecision!(proposalId,'accept',{...body,plan:{}} as DecisionBody),/Invalid proposal decision/);
});

test('parser validates DTO identities, statuses and receipt consistency; all statuses map without fictional confidence',()=>{
 for(const status of INBOX_STATUSES){const row=readIntelligenceProposal(proposal({status}),proposalId);const view=proposalPresentation(row,capabilities,runtime);assert.equal(view.status,status);assert.ok(view.statusLabel);assert.equal(view.memoryMatches[0].similarity,undefined);assert.ok(view.sourceResourceTitle.includes('Synthetic calendar'));}
 for(const bad of [{id:'bad'},{version:0},{status:'invented'},{canonical_saved:true},{source_preview:{available:'yes'}},{plan:{rationale:'x',matches:[],actions:[{type:'execute_raw'}]}}])assert.throws(()=>readIntelligenceProposal({...proposal(),...bad}));
 assert.throws(()=>readIntelligenceProposal(proposal(),'20000000-0000-4000-8000-000000000099'));
 const missing=proposalPresentation(proposal({source_preview:{available:false}}),capabilities,runtime);assert.equal(missing.sourceAvailable,false);assert.equal(missing.actions?.accept,false);assert.match(missing.title,/недоступен/);
});

test('link-only, confirmed canonical write and pending Retrieval are distinct; partial conflict never loses a confirmed receipt',()=>{
 const linked=proposal({status:'applied',apply:operation({links_saved:true,canonical_saved:false,memory_applied:false,search_ready:false},'applied')});assert.match(receiptMessage(linked)!,/Событие связано/);assert.equal(proposalPresentation(linked,capabilities,runtime).isConfirmed,true);
 const saved=proposal({status:'search_pending',canonical_saved:true,memory_applied:true,search_ready:false,apply:operation({links_saved:true,canonical_saved:true,memory_applied:true,search_ready:false},'search_pending')});assert.match(receiptMessage(saved)!,/Поисковый индекс обновляется/);assert.equal(readIntelligenceProposal(saved).canonical_saved,true);
 const conflict=proposal({...saved,status:'apply_conflict',apply:{...saved.apply!,code:'canonical_saved_source_unavailable'}});assert.match(receiptMessage(conflict)!,/Память сохранена/);assert.equal(inboxActions(conflict,capabilities,runtime).accept,false);
 assert.equal(receiptMessage(proposal({status:'pending_apply'})),undefined);
});

test('double accept serializes; lost response replays identical request_id/version/body and never marks Saved before confirmation',async t=>{
 const pending=gate();const calls:any[]=[];let count=0;
 const {controller}=setup(t,{inboxDecision:async(id,action,body)=>{calls.push({id,action,body});if(++count===1){await pending.promise;throw new TypeError('Lost response');}return {proposal:proposal({version:2,status:'pending_apply',apply:operation()}),replayed:true};}});await settle();
 const first=controller.decide(proposalId,'accept');assert.equal(await controller.decide(proposalId,'accept'),false);assert.equal(calls.length,1);assert.equal(controller.snapshot().proposals[0].status,'pending');
 pending.resolve(null);assert.equal(await first,false);assert.ok(controller.snapshot().uncertain.has(proposalId));assert.equal(await controller.decide(proposalId,'reject'),false);
 assert.equal(await controller.retry(proposalId),true);assert.deepEqual(calls[0],calls[1]);assert.equal(controller.snapshot().proposals[0].status,'pending_apply');assert.equal(controller.snapshot().uncertain.size,0);assert.equal(controller.presentation().proposals[0].resultMessage,undefined);
});

test('409 refetches latest version with an explicit conflict; only a new deliberate action gets a new idempotency key',async t=>{
 const calls:any[]=[];
 const {controller}=setup(t,{inboxDecision:async(id,action,body)=>{calls.push(body);if(calls.length===1)throw new ApiError(409,'proposal_version_conflict','Conflict');return {proposal:proposal({version:5,status:'rejected'}),replayed:false};},inboxProposal:async()=>proposal({version:4})});await settle();
 assert.equal(await controller.decide(proposalId,'accept'),false);assert.equal(calls.length,1);assert.equal(controller.snapshot().proposals[0].version,4);assert.match(controller.presentation().proposals[0].errorMessage!,/изменилось/);assert.equal(controller.snapshot().uncertain.size,0);
 assert.equal(await controller.decide(proposalId,'reject'),true);assert.equal(calls[1].version,4);assert.notEqual(calls[0].request_id,calls[1].request_id);
});

test('comment preserves trimmed text/key on uncertainty; reject/reconsider/retry use only Backend-permitted transitions',async t=>{
 let row=proposal();const calls:any[]=[];let lose=true;
 const {controller}=setup(t,{inboxProposal:async()=>row,inboxHistory:async()=>({history:[{version:row.version,kind:'comment',snapshot:{status:row.status},comment:'Sanitized clarification',created_at:row.updated_at}],next_offset:null}),inboxDecision:async(id,action,body)=>{
  calls.push({action,body});if(action==='comment'&&lose){lose=false;throw Error('Lost');}
  row=proposal({version:row.version+1,status:action==='reject'?'rejected':action==='reconsider'||action==='comment'?'reanalyzing':'pending_apply'});return {proposal:row,replayed:action==='comment'};
 }});await settle();
 assert.equal(await controller.decide(proposalId,'comment',' Synthetic clarification '),false);assert.equal(await controller.retry(proposalId),true);assert.deepEqual(calls[0],calls[1]);await settle();assert.equal(controller.presentation().proposals[0].comment,'Sanitized clarification');
 assert.equal(await controller.decide(proposalId,'reject'),true);assert.equal(await controller.decide(proposalId,'comment','cannot bypass rejection'),false);assert.equal(await controller.decide(proposalId,'reconsider'),true);
 assert.equal(calls.at(-1).action,'reconsider');assert.equal(await controller.decide(proposalId,'retry'),false);
});

test('pagination deduplicates UUIDs, refreshes first page after offset and preserves server updated_at/id order',async t=>{
 const calls:number[]=[];let firstCount=0;
 const a=proposal(),b=proposal({id:'10000000-0000-4000-8000-000000000009'}),c=proposal({id:'10000000-0000-4000-8000-000000000008'});
 const {controller}=setup(t,{inboxProposals:async(offset=0)=>{calls.push(offset);if(offset===0)return {proposals:++firstCount===1?[a]:[b,a],next_offset:50};return {proposals:[c,a],next_offset:null};}});await settle();await controller.refresh(true);
 assert.deepEqual(calls,[0,50,0]);assert.deepEqual(controller.snapshot().proposals.map(p=>p.id),[b.id,c.id,a.id]);assert.equal(controller.snapshot().next,null);
});

test('detail and history pagination stay bound to original UUID; lower-version late reads cannot replace a decision',async t=>{
 const list=gate();let historyCalls=0,readCalls=0;
 const {controller}=setup(t,{inboxProposals:async()=>{if(++readCalls===2)return list.promise;return {proposals:[proposal()],next_offset:null};},inboxProposal:async()=>proposal({version:1}),inboxHistory:async(id,offset=0)=>{historyCalls++;return {history:[{version:offset?1:2,kind:'analysis',snapshot:{status:'pending'},comment:'',created_at:proposal().created_at}],next_offset:offset?null:50};}});await settle();
 const refresh=controller.refresh();await settle();await controller.decide(proposalId,'accept');list.resolve({proposals:[proposal()],next_offset:null});await refresh;assert.equal(controller.snapshot().proposals[0].version,2);
 await controller.open(proposalId);await controller.open(proposalId,true);assert.equal(historyCalls,2);assert.deepEqual(controller.snapshot().histories[proposalId].entries.map(e=>e.version),[2,1]);assert.equal(controller.snapshot().proposals[0].version,2);
});

test('bounded polling updates pending_apply to search_pending/applied; worker-off never invents progress and stops timers outside Memory',async t=>{
 let reads=0;let enabled=true;
 const {controller}=setup(t,{intelligenceStatus:async()=>({...runtime,worker_enabled:enabled,apply_enabled:enabled}),inboxProposals:async()=>({proposals:[proposal({status:'pending_apply',apply:operation()})],next_offset:null}),inboxProposal:async()=>{reads++;return proposal({version:2,status:'search_pending',canonical_saved:true,memory_applied:true,apply:operation({canonical_saved:true,memory_applied:true,search_ready:false},'search_pending')});}});await settle();
 await controller.poll();assert.equal(controller.snapshot().proposals[0].status,'search_pending');assert.match(controller.presentation().proposals[0].resultMessage!,/индекс обновляется/);
 enabled=false;const before=reads;await controller.poll();assert.equal(reads,before);assert.equal(controller.presentation().proposals[0].processingEnabled,false);
 controller.setVisible(false);await controller.poll();assert.equal(reads,before);
});

test('polling has a finite budget and apply retry keeps Backend operation identity',async t=>{
 let reads=0,body:DecisionBody|undefined;
 const apply=operation();
 const {controller}=setup(t,{inboxProposals:async()=>({proposals:[proposal({status:'apply_retry',apply})],next_offset:null}),inboxProposal:async()=>{reads++;return proposal({status:'pending_apply',version:2,apply});},inboxDecision:async(id,action,input)=>{assert.equal(action,'retry');body=input;return {proposal:proposal({status:'pending_apply',version:2,apply}),replayed:false};}});await settle();
 assert.equal(await controller.retry(proposalId),true);assert.equal(body!.version,1);assert.equal(controller.snapshot().proposals[0].apply!.operation_id,apply.operation_id);
 for(let i=0;i<20;i++)await controller.poll();assert.equal(reads,12);assert.match(controller.snapshot().notice,/приостановлено/);
});

test('missing capability/routes, disabled workers and backend errors never inject fixtures or fake success',async t=>{
 const hidden=setup(t,{intelligenceSettings:async()=>({...capabilities,inbox:false}),inboxProposals:async()=>assert.fail('No list without capability')});await settle();assert.equal(hidden.controller.snapshot().available,false);
 const missing=setup(t,{intelligenceSettings:async()=>{throw new ApiError(404,'not_found','Not found');}});await settle();assert.equal(missing.controller.snapshot().available,false);assert.equal(missing.controller.snapshot().proposals.length,0);
 const disabled=setup(t,{intelligenceStatus:async()=>({...runtime,worker_enabled:false,deep_enabled:false,apply_enabled:false})});await settle();assert.equal(await disabled.controller.decide(proposalId,'accept'),false);assert.equal(await disabled.controller.decide(proposalId,'comment','text'),false);assert.match(disabled.controller.snapshot().notice,/выключена/);
});

test('logout/account/controller replacement aborts reads/writes and discards late proposal/comment/history data; 401 expires session',async t=>{
 const pending=gate();let signal:AbortSignal|undefined;
 const original=setup(t,{inboxDecision:async(id,action,body,s)=>{signal=s;return pending.promise;}});await settle();
 const action=original.controller.decide(proposalId,'comment','Private comment');original.controller.stop();assert.equal(signal!.aborted,true);
 const next=setup(t,{inboxProposals:async()=>({proposals:[],next_offset:null})});await settle();pending.resolve({proposal:proposal({version:4,status:'applied'}),replayed:false});await action;
 assert.equal(original.controller.snapshot().proposals.length,0);assert.equal(original.controller.snapshot().uncertain.size,0);assert.equal(next.controller.snapshot().proposals.length,0);
 const expired=setup(t,{inboxDecision:async()=>{throw new ApiError(401,'authentication_required','Expired');}});await settle();await expired.controller.decide(proposalId,'accept');assert.equal(expired.expired,1);assert.equal(expired.controller.snapshot().proposals.length,0);
});

test('403 never auto-replays a decision; explicit retry refreshes CSRF while preserving the operation body',async()=>{
 let posts=0,csrf=0;const bodies:string[]=[];
 const api=new MroyaApi((async(url,init)=>{
  if(String(url).endsWith('/csrf/'))return json({csrf_token:'csrf-'+(++csrf)});
  bodies.push(String(init?.body));posts++;
  if(posts===1)return json({error:{code:'csrf_failed',message:'Denied'}},403);
  assert.equal((init!.headers as Record<string,string>)['X-CSRFToken'],'csrf-2');return json({proposal:proposal({version:2,status:'rejected'}),replayed:false});
 }) as typeof fetch);
 const body={version:1,request_id:'20000000-0000-4000-8000-000000000012'};
 await assert.rejects(api.inboxDecision(proposalId,'reject',body),e=>e instanceof ApiError&&e.status===403);assert.equal(posts,1);
 await api.inboxDecision(proposalId,'reject',body);assert.equal(csrf,2);assert.equal(bodies[0],bodies[1]);
});

test('logout invalidates late detail/history reads as well as in-flight list results',async t=>{
 const history=gate();let historySignal:AbortSignal|undefined;
 const first=setup(t,{inboxHistory:async(id,offset,signal)=>{historySignal=signal;return history.promise;}});await settle();const loading=first.controller.open(proposalId);await settle();first.controller.stop();assert.equal(historySignal!.aborted,true);
 history.resolve({history:[{version:1,kind:'comment',snapshot:{status:'pending'},comment:'Account A only',created_at:proposal().created_at}],next_offset:null});await loading;assert.deepEqual(first.controller.snapshot().histories,{});
 const list=gate();const second=setup(t,{inboxProposals:async()=>list.promise});await settle();second.controller.stop();list.resolve({proposals:[proposal()],next_offset:null});await settle();assert.equal(second.controller.snapshot().proposals.length,0);
});

test('slow polling is single-flight and cannot start overlapping rounds',async t=>{
 const wait=gate();let statusCalls=0;
 const {controller}=setup(t,{inboxProposals:async()=>({proposals:[proposal({status:'pending_apply'})],next_offset:null}),intelligenceStatus:async()=>{if(++statusCalls===2)return wait.promise;return runtime;}});await settle();
 const first=controller.poll();await controller.poll();assert.equal(statusCalls,2);wait.resolve(runtime);await first;
});

test('confirmed canonical transitions refresh Saved Memory/Map from existing readers without reloading Chat or trusting a proposal plan',async t=>{
 const {LiveWorkspaceController}=await import('../src/hooks/LiveWorkspaceController.ts');
 let reads=0,maps=0;let change!:()=>void;
 const source={kind:'live',capabilities:async()=>({chat:false,memory_read:true}),memories:async()=>{reads++;return {memories:[],total:reads};},map:async()=>{maps++;return {nodes:[],edges:[]};},history:async()=>assert.fail('No Chat read during memory refresh')} as unknown as WorkspaceSource;
 const workspace=new LiveWorkspaceController(source,()=>{});await workspace.load();t.after(()=>workspace.stop());
 change=()=>void workspace.refreshMemory();
 const inboxSource={...source,intelligenceSettings:async()=>capabilities,intelligenceStatus:async()=>runtime,inboxProposals:async()=>({proposals:[proposal({status:'pending_apply'})],next_offset:null}),inboxProposal:async()=>proposal({version:2,status:'search_pending',canonical_saved:true,memory_applied:true,apply:operation({canonical_saved:true,search_ready:false})}),inboxHistory:async()=>({history:[],next_offset:null}),inboxDecision:async()=>({proposal:proposal(),replayed:false})} as WorkspaceSource;
 const controller=new LiveMemoryInboxController(inboxSource,1,()=>{},change);controller.start();controller.setVisible(true);t.after(()=>controller.stop());await settle();assert.equal(reads,1);
 await controller.poll();await settle();assert.equal(reads,2);assert.equal(maps,2);assert.equal(workspace.snapshot().history.messages.length,0);
 await controller.poll();await settle();assert.equal(reads,2,'Same receipt does not refresh repeatedly');
});


const calendarId='30000000-0000-4000-8000-000000000001';
const scanningPage=()=>({worker:{enabled:true,state:'recent' as const,last_seen_at:'2026-10-24T00:00:00Z'},sources:[{id:calendarId,name:'Synthetic calendar',enabled:true,last_scanned_at:null,quota_blocked:false,scan:null}],next_offset:null});
test('empty Inbox discovers new proposals on bounded polling without a pending card',async t=>{
 let calls=0;
 const {controller}=setup(t,{inboxProposals:async()=>({proposals:++calls===1?[]:[proposal()],next_offset:null}),intelligenceScans:async()=>scanningPage()});
 await settle();assert.equal(controller.snapshot().proposals.length,0);
 await controller.poll();assert.equal(controller.snapshot().proposals.length,1);assert.equal(calls,2);
});
test('scan writes use session+CSRF and the existing same-origin client',async()=>{
 const calls:{url:string;init?:RequestInit}[]=[];
 const api=new MroyaApi((async(url,init)=>{calls.push({url:String(url),init});return json(String(url).endsWith('/csrf/')?{csrf_token:'synthetic-token'}:scanningPage());}) as typeof fetch);
 await api.scanIntelligence([calendarId]);
 const write=calls.find(c=>c.init?.method==='POST')!;
 assert.equal(write.url,'/api/v1/memory-intelligence/scans/');
 assert.equal(write.init?.credentials,'same-origin');assert.equal((write.init?.headers as Record<string,string>)['X-CSRFToken'],'synthetic-token');
 assert.deepEqual(JSON.parse(String(write.init?.body)),{calendar_ids:[calendarId]});
 await assert.rejects(api.scanIntelligence([]));await assert.rejects(api.scanIntelligence([calendarId,calendarId]));
});
test('manual scan prevents overlapping writes; failures do not report success or create proposals',async t=>{
 const pending=gate();let writes=0;
 const {controller}=setup(t,{intelligenceScans:async()=>scanningPage(),scanIntelligence:async()=>{writes++;return pending.promise;},inboxProposals:async()=>({proposals:[],next_offset:null})});await settle();
 const first=controller.scanNow();await controller.scanNow();assert.equal(writes,1);
 pending.resolve(scanningPage());await first;assert.equal(controller.snapshot().scanBusy,false);assert.equal(controller.snapshot().proposals.length,0);
});
test('leaving Memory aborts scan reads and late results cannot enter the next visible session',async t=>{
 let signal:AbortSignal|undefined;const pending=gate();
 const {controller}=setup(t,{intelligenceScans:async(offset,s)=>{signal=s;return pending.promise;}});await settle();
 controller.setVisible(false);assert.equal(signal?.aborted,true);pending.resolve(scanningPage());await settle();assert.equal(controller.snapshot().scanning,null);
});
test('scan progress parser rejects fictional counters and preserves quota/worker failure states',async()=>{
 const {readScanning}=await import('../src/api/intelligence.ts');
 assert.equal(readScanning(scanningPage()).worker.state,'recent');
 assert.throws(()=>readScanning({...scanningPage(),worker:{enabled:true,state:'invented',last_seen_at:null}}));
 const page=scanningPage();page.worker.state='unavailable' as 'recent';page.sources[0].quota_blocked=true;
 assert.equal(readScanning(page).worker.state,'unavailable');assert.equal(readScanning(page).sources[0].quota_blocked,true);
});
