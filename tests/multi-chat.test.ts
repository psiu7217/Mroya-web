import test from 'node:test';
import assert from 'node:assert/strict';
import {MroyaApi} from '../src/api/client.ts';
import {ApiError,StreamInterruptedError} from '../src/api/errors.ts';
import {LiveWorkspaceController} from '../src/hooks/LiveWorkspaceController.ts';
import {conversationListPresentation} from '../src/hooks/conversationPresentation.ts';
import type {ConversationSummary,ApiMessage,ChatStreamEvent,SendOptions} from '../src/types/api.ts';
import type {WorkspaceSource} from '../src/types/source.ts';
const a='00000000-0000-4000-8000-000000000001',b='00000000-0000-4000-8000-000000000002',c='00000000-0000-4000-8000-000000000003';
const at='2026-10-18T12:00:00Z';
const summary=(id:string,title=id):ConversationSummary=>({id,title,created_at:at,updated_at:at});
const message=(id:string,sequence=1):ApiMessage=>({id,sequence,role:'user',content:id,status:'completed',created_at:at,completed_at:at});
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
const gate=<T>()=>{let resolve!:(v:T)=>void;const promise=new Promise<T>(r=>{resolve=r;});return {promise,resolve};};
function server(){
 let rows=[summary(a,'Chat A'),summary(b,'Chat B')];
 const histories=new Map([[a,[message(a)]],[b,[] as ApiMessage[]]]);
 const calls:{kind:string;id?:string;before?:number}[]=[];
 const source={kind:'live',capabilities:async()=>({chat:true,memory_read:false}),
 conversations:async()=>{calls.push({kind:'list'});return {conversations:[...rows],next_offset:null};},
 createConversation:async()=>{calls.push({kind:'create'});const row=summary(c,'');rows=[row,...rows];histories.set(c,[]);return row;},
 renameConversation:async(id:string,title:string)=>{calls.push({kind:'rename',id});const row={...rows.find(v=>v.id===id)!,title:title.trim()};rows=rows.map(v=>v.id===id?row:v);return row;},
 deleteConversation:async(id:string)=>{calls.push({kind:'delete',id});rows=rows.filter(v=>v.id!==id);histories.delete(id);},
 conversationHistory:async(id:string,before?:number)=>{calls.push({kind:'history',id,before});return {conversation_id:id,messages:histories.get(id)??[],next_before:null};},
 sendConversation:async(id:string,_text:string,_submission:string,emit:(e:ChatStreamEvent)=>void,_opts?:SendOptions)=>{calls.push({kind:'send',id});emit({event:'delta',data:{text:'Reply'}});emit({event:'done',data:{}});},
 history:async()=>assert.fail('legacy history must not be used'),send:async()=>assert.fail('legacy send must not be used'),
 } as unknown as WorkspaceSource;
 return {source,calls,histories,get rows(){return rows;}};
}
test('scoped API validates DTO/status/IDs, uses CSRF, preserves replay/SSE and accepts empty 204',async()=>{
 const calls:{url:string;init:RequestInit}[]=[];let transport='json';
 const api=new MroyaApi((async(input,init={})=>{
  const url=String(input);calls.push({url,init});
  if(url.endsWith('csrf/'))return json({csrf_token:'synthetic'});
  if(init.method==='DELETE')return new Response(null,{status:204});
  if(url.includes('/send/'))return transport==='json'?json({state:'completed',turn_id:c,content:'Replay'}):new Response('event: delta\ndata: {"text":"Reply"}\n\nevent: done\ndata: {}\n\n',{headers:{'Content-Type':'text/event-stream','X-Chat-Turn-ID':c}});
  if(url.includes('/messages/'))return json({conversation_id:a,messages:[{...message(b),reasoning:'Not canonical',timeline:[{kind:'reasoning',text:'Not canonical'}]}],next_before:1});
  if(init.method==='POST')return json({conversation:summary(a,'')},201);
  if(init.method==='PATCH')return json({conversation:summary(a,JSON.parse(init.body as string).title)});
  return json({conversations:[summary(a)],next_offset:null});
 }) as typeof fetch);
 assert.equal((await api.conversations()).conversations[0].id,a);
 assert.equal((await api.createConversation()).title,'');
 assert.equal((await api.renameConversation(a,'  Renamed 😀  ')).title,'Renamed 😀');
 const history=await api.conversationHistory(a,2);assert.equal(history.conversation_id,a);assert.equal(history.messages[0].reasoning,undefined);assert.equal(history.messages[0].timeline,undefined);
 const events:string[]=[],turns:string[]=[];await api.sendConversation(a,'Question',b,e=>events.push(e.event),{retry:true,onTurn:id=>turns.push(id)});
 transport='sse';await api.sendConversation(a,'Question',b,e=>events.push(e.event),{onTurn:id=>turns.push(id)});
 assert.deepEqual(events,['replay','delta','done']);assert.deepEqual(turns,[c]);
 await api.deleteConversation(a);
 for(const {url,init} of calls){assert.ok(url.startsWith('/api/v1/'));assert.equal(init.credentials,'same-origin');if(['POST','PATCH','DELETE'].includes(init.method!))assert.equal((init.headers as Record<string,string>)['X-CSRFToken'],'synthetic');}
 assert.ok(calls.some(v=>v.url.endsWith('/'+a+'/messages/?before=2')));
 assert.equal(calls.at(-1)!.init.body,undefined);
 await assert.rejects(api.renameConversation(a,'x'.repeat(101)),ApiError);await assert.rejects(api.renameConversation(a,'bad<name'),ApiError);
 await assert.rejects(api.conversationHistory('../other'),ApiError);
});
test('scoped API rejects invalid JSON/schema/content-type/status and preserves 401/403/404/409',async()=>{
 const bad=[json({conversations:[summary('not-uuid')],next_offset:null}),json({conversations:[{...summary(a),updated_at:'no-date'}],next_offset:null}),json({conversations:[],next_offset:0}),json({conversations:[]}),new Response('{',{headers:{'Content-Type':'application/json'}}),new Response('{}',{headers:{'Content-Type':'text/html'}}),json({conversations:[],next_offset:null},201)];
 for(const response of bad){const api=new MroyaApi((async()=>response) as typeof fetch);await assert.rejects(api.conversations(),ApiError);}
 for(const status of [401,403,404,409]){const api=new MroyaApi((async(input)=>String(input).endsWith('csrf/')?json({csrf_token:'s'}):json({error:{code:'synthetic',message:'Denied'}},status)) as typeof fetch);await assert.rejects(api.deleteConversation(a),(e:ApiError)=>e.status===status);}
 const wrong=new MroyaApi((async()=>json({conversation_id:b,messages:[],next_before:null})) as typeof fetch);await assert.rejects(wrong.conversationHistory(a),ApiError);
});
test('list pagination deduplicates IDs, selects server first, and A/B/A histories and older pages stay scoped',async()=>{
 const s=server();s.source.conversations=async(offset=0)=>({conversations:offset?[summary(a),summary(b)]:[summary(a)],next_offset:offset?null:1});
 const ctrl=new LiveWorkspaceController(s.source,()=>{});await ctrl.load();assert.equal(ctrl.snapshot().conversations.length,2);assert.equal(ctrl.snapshot().activeConversationId,a);
 assert.equal(ctrl.snapshot().history.messages[0].content,a);await ctrl.selectConversation(b);assert.deepEqual(ctrl.snapshot().history.messages,[]);await ctrl.selectConversation(a);
 s.source.conversationHistory=async(id,before)=>({conversation_id:id,messages:before?[message(c,1)]:[message(a,2)],next_before:before?null:2});
 await ctrl.load();await ctrl.older();assert.deepEqual(ctrl.snapshot().history.messages.map(m=>m.id),[c,a]);assert.equal(ctrl.snapshot().history.conversation_id,a);ctrl.stop();
});
test('create is server-confirmed, duplicate click makes one POST, and unknown outcomes reconcile without repost',async()=>{
 const s=server(),ctrl=new LiveWorkspaceController(s.source,()=>{});await ctrl.load();const pending=gate<ConversationSummary>();let writes=0;
 s.source.createConversation=async()=>{writes++;return pending.promise;};const creating=ctrl.createConversation();assert.equal(await ctrl.createConversation(),false);assert.equal(ctrl.snapshot().activeConversationId,a);
 pending.resolve(summary(c,''));assert.equal(await creating,true);assert.equal(writes,1);assert.equal(ctrl.snapshot().activeConversationId,c);assert.deepEqual(ctrl.snapshot().history.messages,[]);
 s.source.createConversation=async()=>{writes++;throw new TypeError('Network lost');};assert.equal(await ctrl.createConversation(),false);assert.equal(writes,2);assert.ok(ctrl.snapshot().error?.includes('not confirmed'));assert.ok(s.calls.some(v=>v.kind==='list'));ctrl.stop();
});
test('rename waits for confirmation; errors retain old title; delete active/last never creates a replacement',async()=>{
 const s=server(),ctrl=new LiveWorkspaceController(s.source,()=>{});await ctrl.load();const pending=gate<ConversationSummary>();s.source.renameConversation=async()=>pending.promise;
 const renaming=ctrl.renameConversation(a,'Manual');assert.equal(ctrl.snapshot().conversations[0].title,'Chat A');pending.resolve(summary(a,'Manual'));assert.equal(await renaming,true);assert.equal(ctrl.snapshot().conversations[0].title,'Manual');
 for(const status of [400,403,409]){s.source.renameConversation=async()=>{throw new ApiError(status,'synthetic','Rejected');};assert.equal(await ctrl.renameConversation(a,'Bad'),false);assert.equal(ctrl.snapshot().conversations[0].title,'Manual');}
 await ctrl.deleteConversation(a);assert.equal(ctrl.snapshot().activeConversationId,b);await ctrl.deleteConversation(b);assert.equal(ctrl.snapshot().activeConversationId,null);assert.deepEqual(ctrl.snapshot().conversations,[]);assert.deepEqual(ctrl.snapshot().history.messages,[]);
 await ctrl.send('Not allowed');assert.ok(ctrl.snapshot().error?.includes('Create'));assert.ok(!s.calls.some(v=>v.kind==='create'||v.kind==='send'));ctrl.stop();
});
test('late A history cannot overwrite B; logout drops late responses and another account starts empty',async()=>{
 const s=server(),ctrl=new LiveWorkspaceController(s.source,()=>{});await ctrl.load();await ctrl.selectConversation(b);
 const late=gate<{conversation_id:string;messages:ApiMessage[];next_before:null}>();const normal=s.source.conversationHistory!;s.source.conversationHistory=(id,before,signal)=>id===a?late.promise:normal(id,before,signal);
 const selecting=ctrl.selectConversation(a);await ctrl.selectConversation(b);late.resolve({conversation_id:a,messages:[message(a)],next_before:null});await selecting;assert.equal(ctrl.snapshot().history.conversation_id,b);assert.deepEqual(ctrl.snapshot().history.messages,[]);
 const late2=gate<any>();s.source.conversationHistory=()=>late2.promise;const closing=ctrl.selectConversation(a);ctrl.stop();late2.resolve({conversation_id:a,messages:[message(a)],next_before:null});await closing;assert.deepEqual(ctrl.snapshot().history.messages,[]);
 const other=new LiveWorkspaceController(server().source,()=>{});assert.deepEqual(other.snapshot().history.messages,[]);other.stop();
});
test('send is pinned to UUID; busy/uncertain block management, recovery unlocks, and late SSE cannot enter B',async()=>{
 const s=server(),ctrl=new LiveWorkspaceController(s.source,()=>{},()=>c);await ctrl.load();const pending=gate<void>();let late!:(e:ChatStreamEvent)=>void,chat='';
 s.source.sendConversation=async(id,_text,_submission,emit,options)=>{chat=id;late=emit;options?.onTurn?.(c);emit({event:'reasoning_delta',data:{sequence:1,turn_number:1,text:'Private A'}});await pending.promise;throw new StreamInterruptedError();};
 const sending=ctrl.send('Question');assert.equal(chat,a);assert.equal(await ctrl.selectConversation(b),false);assert.equal(await ctrl.createConversation(),false);assert.equal(await ctrl.deleteConversation(a),false);
 pending.resolve();await sending;assert.equal(ctrl.snapshot().uncertain,true);assert.equal(await ctrl.selectConversation(b),false);
 s.source.turn=async()=>({turn_status:'running',summary:'',events:[]});await ctrl.recover();assert.equal(ctrl.snapshot().uncertain,true);
 s.source.turn=async()=>({turn_status:'completed',summary:'',events:[]});await ctrl.recover();assert.equal(ctrl.snapshot().uncertain,false);await ctrl.selectConversation(b);late({event:'delta',data:{text:'Late A'}});assert.deepEqual(ctrl.snapshot().history.messages,[]);ctrl.stop();
});
test('failed attempt reasoning/tools/context reconcile only within A and never appear in B or after returning',async()=>{
 const s=server(),ctrl=new LiveWorkspaceController(s.source,()=>{},()=>c);await ctrl.load();const context={turn_id:c,request_trace_id:11,report_url:'/api/v1/chat/turns/'+c+'/report/'};
 let old!:(e:ChatStreamEvent)=>void;
 s.source.sendConversation=async(_id,_content,_submission,emit,options)=>{old=emit;options?.onTurn?.(c);emit({event:'reasoning_delta',data:{sequence:1,turn_number:1,text:'Only A'}});emit({event:'tool_activity',data:{sequence:2,activity:{kind:'memory_search',title:'Search',status:'success'}}});emit({event:'trace',data:{turn_status:'failed',assistant_content:'Failed',report_context:context}});s.histories.set(a,[message(a),{...message(c,2),role:'assistant',content:'Failed',status:'failed',report_context:context}]);throw new ApiError(502,'chat_failed','Failed');};
 await ctrl.send('Question');assert.equal(ctrl.snapshot().history.messages.at(-1)!.reasoning,'Only A');assert.equal(ctrl.snapshot().history.messages.at(-1)!.timeline!.length,2);
 await ctrl.selectConversation(b);old({event:'delta',data:{text:'Wrong'}});assert.deepEqual(ctrl.snapshot().history.messages,[]);await ctrl.selectConversation(a);const final=ctrl.snapshot().history.messages.at(-1)!;assert.equal(final.reasoning,undefined);assert.equal(final.timeline,undefined);assert.deepEqual(final.report_context,context);ctrl.stop();
});
test('401 expires session, missing chats reconcile, and rejected deletion never reports success',async()=>{
 const s=server();let expired=0;const ctrl=new LiveWorkspaceController(s.source,()=>expired++);await ctrl.load();
 s.source.deleteConversation=async()=>{throw new ApiError(404,'not_found','Not found');};assert.equal(await ctrl.deleteConversation(a),false);assert.equal(ctrl.snapshot().conversations.length,2);
 s.source.renameConversation=async()=>{throw new ApiError(401,'authentication_required','Expired');};assert.equal(await ctrl.renameConversation(a,'Title'),false);assert.equal(expired,1);
});
test('grouping uses profile timezone across midnight/month/year and retains server order',()=>{
 const rows=[{...summary(a,''),updated_at:'2027-01-01T00:30:00Z'},{...summary(b,'B'),updated_at:'2026-12-28T12:00:00Z'},{...summary(c,'C'),updated_at:'2025-11-01T12:00:00Z'}];
 const view=conversationListPresentation(rows,'America/New_York',new Date('2027-01-01T01:00:00Z'));assert.deepEqual(view.map(v=>v.group),['Today','Previous 7 Days','November 2025']);assert.equal(view[0].title,'New chat');assert.deepEqual(view.map(v=>v.id),[a,b,c]);
});

test('lost DELETE response closes only after fresh absence confirmation; failed GET stays uncertain without another DELETE',async()=>{
 const s=server(),ctrl=new LiveWorkspaceController(s.source,()=>{});await ctrl.load();
 const remove=s.source.deleteConversation!;
 s.source.deleteConversation=async(id,signal)=>{await remove(id,signal);throw new TypeError('Response lost');};
 // A replacement history error must not conceal the confirmed deletion.
 const history=s.source.conversationHistory!;
 s.source.conversationHistory=async(id,before,signal)=>{if(id===b)throw new ApiError(503,'unavailable','History unavailable');return history(id,before,signal);};
 assert.equal(await ctrl.deleteConversation(a),true);assert.equal(ctrl.snapshot().activeConversationId,b);
 assert.deepEqual(ctrl.snapshot().conversations.map(row=>row.id),[b]);assert.equal(ctrl.snapshot().error,'History unavailable');
 const list=s.source.conversations!;
 s.source.conversations=async()=>{throw new TypeError('GET lost');};
 assert.equal(await ctrl.deleteConversation(b),false);assert.equal(ctrl.snapshot().operationUncertain,true);
 assert.equal(s.calls.filter(call=>call.kind==='delete').length,2);
 assert.equal(await ctrl.deleteConversation(b),false);assert.equal(s.calls.filter(call=>call.kind==='delete').length,2);
 s.source.conversations=list;await ctrl.recover();assert.deepEqual(ctrl.snapshot().conversations,[]);assert.equal(ctrl.snapshot().activeConversationId,null);
 assert.equal(s.calls.filter(call=>call.kind==='delete').length,2);ctrl.stop();
});
test('lost PATCH response uses confirmed server metadata, never a guessed title or automatic PATCH retry',async()=>{
 const s=server(),ctrl=new LiveWorkspaceController(s.source,()=>{});await ctrl.load();const rename=s.source.renameConversation!;let patches=0;
 s.source.renameConversation=async(id,title,signal)=>{patches++;await rename(id,title,signal);throw new TypeError('Response lost');};
 assert.equal(await ctrl.renameConversation(a,'  Confirmed title  '),true);
 assert.equal(ctrl.snapshot().conversations.find(row=>row.id===a)!.title,'Confirmed title');assert.equal(ctrl.snapshot().error,null);
 s.source.renameConversation=async(id,_title,signal)=>{patches++;await rename(id,'Different server title',signal);throw new TypeError('Unknown outcome');};
 assert.equal(await ctrl.renameConversation(a,'Unconfirmed draft'),false);
 assert.equal(ctrl.snapshot().conversations.find(row=>row.id===a)!.title,'Different server title');assert.equal(patches,2);
 for(const status of [403,409]){
  const reads=s.calls.filter(call=>call.kind==='list').length;
  s.source.renameConversation=async()=>{patches++;throw new ApiError(status,'rejected','Rejected');};
  assert.equal(await ctrl.renameConversation(a,'Rejected title'),false);
  assert.equal(s.calls.filter(call=>call.kind==='list').length,reads);
  assert.equal(ctrl.snapshot().conversations.find(row=>row.id===a)!.title,'Different server title');
 }
 assert.equal(patches,4);ctrl.stop();
});
test('offset traversal refreshes the first page once, preferring fresh metadata/order and deduplicating UUIDs without loading all histories',async()=>{
 const s=server(),offsets:number[]=[],fresh={...summary(b,'Updated B'),updated_at:'2026-10-19T00:00:00Z'};
 s.source.conversations=async(offset=0)=>{
  offsets.push(offset);
  if(offset>0)return {conversations:[summary(a),summary(c)],next_offset:null};
  if(offsets.length===1)return {conversations:[summary(a),summary(b,'Stale B')],next_offset:2};
  return {conversations:[fresh,summary(a)],next_offset:2};
 };
 const ctrl=new LiveWorkspaceController(s.source,()=>{});await ctrl.load();
 assert.deepEqual(offsets,[0,2,0]);assert.deepEqual(ctrl.snapshot().conversations,[fresh,summary(a),summary(c)]);
 assert.deepEqual(s.calls.filter(call=>call.kind==='history').map(call=>call.id),[b]);
 // A refreshed head that is now a complete list replaces stale tail entries.
 offsets.length=0;
 s.source.conversations=async(offset=0)=>{offsets.push(offset);return offsets.length===3?{conversations:[],next_offset:null}:offset?{conversations:[summary(c)],next_offset:null}:{conversations:[summary(a)],next_offset:1};};
 await ctrl.load();assert.deepEqual(offsets,[0,1,0]);assert.deepEqual(ctrl.snapshot().conversations,[]);assert.equal(ctrl.snapshot().activeConversationId,null);ctrl.stop();
});
