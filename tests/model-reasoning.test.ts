import test from 'node:test';
import assert from 'node:assert/strict';
import {readChatStream} from '../src/api/sse.ts';
import {MroyaApi} from '../src/api/client.ts';
import {ApiError,StreamInterruptedError} from '../src/api/errors.ts';
import {UserPreferenceStore} from '../src/hooks/useUserPreferences.ts';
import {LiveWorkspaceController} from '../src/hooks/LiveWorkspaceController.ts';
import {chatPresentation} from '../src/hooks/liveAdapters.ts';
import type {ApiUser,PreferencesPatch,ChatStreamEvent,ApiMessage} from '../src/types/api.ts';
import type {WorkspaceSource} from '../src/types/source.ts';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const user:ApiUser={id:7,username:'synthetic',email:'',first_name:'',last_name:'',timezone:'UTC',nickname:'',preferences:{theme:'system',show_model_reasoning:false}};
const history={conversation_id:'conversation',messages:[] as ApiMessage[],next_before:null};
const turn='00000000-0000-4000-8000-000000000001';
const caps={api_version:'v1' as const,chat:true,memory_read:false,memory_mutations_via_chat:true,memory_mutations_rest:false,calendar_rest:false,connections_rest:false,reminders:false,local_recurrence:false,sse_token_streaming:false};
const source=(patch:Partial<WorkspaceSource>={}):WorkspaceSource=>({kind:'live',session:async()=>({status:'authenticated',user}),login:async()=>user,logout:async()=>{},history:async()=>history,capabilities:async()=>caps,memories:async()=>({memories:[],total:0}),map:async()=>({nodes:[],edges:[]}),turn:async()=>({turn_status:'completed',summary:'',events:[]}),send:async()=>{},...patch});
const tick=()=>new Promise<void>(resolve=>setImmediate(resolve));
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
const fetcher=(fn:(url:string,init:RequestInit)=>Response|Promise<Response>):typeof fetch=>((url,init={})=>Promise.resolve(fn(String(url),init))) as typeof fetch;
const frame=(event:string,data:unknown)=>'event: '+event+'\ndata: '+JSON.stringify(data)+'\n\n';
const reasoning=(sequence=1,text='Real synthetic reasoning',turn_number=1):ChatStreamEvent=>({event:'reasoning_delta',data:{sequence,text,turn_number}});
const canonical=(answer='Accepted'):ApiMessage[]=>[
 {id:'server-user',sequence:1,role:'user',content:'Question',status:'completed',created_at:'2026-10-15T00:00:00Z',completed_at:null},
 {id:'server-assistant',sequence:2,role:'assistant',content:answer,status:'completed',created_at:'2026-10-15T00:00:01Z',completed_at:null}
];
test('reasoning checkbox preferences PATCH true/false uses CSRF, response confirmation and /me reload/login',async()=>{
 let current=user;const writes:RequestInit[]=[];
 const api=new MroyaApi(fetcher((url,init)=>{
  if(url.endsWith('csrf/'))return json({csrf_token:'synthetic'});
  if(url.endsWith('preferences/')){
   writes.push(init);const patch=JSON.parse(init.body as string) as PreferencesPatch;
   current={...current,preferences:{...current.preferences,...patch}};return json({user:current});
  }
  return json({user:current,csrf_token:'rotated'});
 }));
 for(const enabled of [true,false]){
  const saved=await api.savePreferences({show_model_reasoning:enabled});
  assert.equal(saved.preferences.show_model_reasoning,enabled);
  assert.equal((await api.me()).user.preferences.show_model_reasoning,enabled);
  assert.equal((await api.login('synthetic','not-real')).preferences.show_model_reasoning,enabled);
  const request=writes.at(-1)!;assert.equal(request.method,'PATCH');assert.equal(request.credentials,'same-origin');
  assert.equal(JSON.parse(request.body as string).show_model_reasoning,enabled);
  assert.ok((request.headers as Record<string,string>)['X-CSRFToken']);
  const reloaded=new UserPreferenceStore(source(),7,saved,()=>{});assert.equal(reloaded.snapshot().show_model_reasoning,enabled);reloaded.dispose();
 }
});
test('reasoning preferences share theme/nickname queue, preserve rapid edits and only show saved after confirmation',async()=>{
 let finish!:(u:ApiUser)=>void;const sent:PreferencesPatch[]=[];
 let saved=user;const store=new UserPreferenceStore(source({savePreferences:async p=>{sent.push(p);return new Promise(resolve=>{finish=resolve;});}}),7,user,()=>{});
 store.setShowModelReasoning(true);assert.equal(store.snapshot().status,'saving');
 store.setShowModelReasoning(false);store.setTheme('dark');store.setNickname('Name');
 saved={...saved,preferences:{...saved.preferences,show_model_reasoning:true}};finish(saved);await tick();
 assert.equal(store.snapshot().show_model_reasoning,false);assert.equal(store.snapshot().status,'saving');
 assert.deepEqual(sent,[{show_model_reasoning:true},{theme:'dark',nickname:'Name',show_model_reasoning:false}]);
 finish({...saved,nickname:'Name',preferences:{theme:'dark',show_model_reasoning:false}});await tick();
 assert.equal(store.snapshot().status,'saved');assert.equal(store.snapshot().show_model_reasoning,false);store.dispose();
});
test('PATCH failures remain unsaved, manual retry reconciles /me; false is not dropped',async()=>{
 let writes=0,reads=0;
 const initial={...user,preferences:{...user.preferences,show_model_reasoning:true}};
 const store=new UserPreferenceStore(source({
  savePreferences:async p=>{writes++;assert.deepEqual(p,{show_model_reasoning:false});if(writes===1)throw new ApiError(503,'unavailable','Unavailable');return user;},
  session:async()=>{reads++;return {status:'authenticated',user:initial};}
 }),7,initial,()=>{});
 store.setShowModelReasoning(false);await tick();assert.equal(store.snapshot().status,'unsaved');
 await store.retry();await tick();assert.equal(reads,1);assert.equal(writes,2);assert.equal(store.snapshot().status,'saved');store.dispose();
 const api=new MroyaApi(fetcher(url=>url.endsWith('csrf/')?json({csrf_token:'x'}):json({user})));
 await assert.rejects(api.savePreferences({show_model_reasoning:true}),ApiError);
 const invalid={...user,preferences:{theme:'system',show_model_reasoning:'true'}};
 await assert.rejects(new MroyaApi(fetcher(()=>json({user:invalid}))).me(),ApiError);
});
test('SSE new events parse split UTF-8; tool activity stays separate and sequence spans provider turns',async()=>{
 const text=frame('reasoning_delta',{turn_number:1,sequence:1,text:'Привет 😀'})+
 frame('tool_activity',{sequence:2,activity:{kind:'memory_search',status:'success',title:'Checked memory'}})+
 frame('reasoning_delta',{turn_number:2,sequence:3,text:'Next'})+frame('delta',{text:'Accepted'})+frame('done',{});
 const bytes=new TextEncoder().encode(text),events:ChatStreamEvent[]=[];
 await readChatStream(new ReadableStream({start(c){for(const b of bytes)c.enqueue(new Uint8Array([b]));c.close();}}),e=>events.push(e));
 assert.deepEqual(events.map(e=>e.event),['reasoning_delta','tool_activity','reasoning_delta','delta','done']);
 assert.equal(events[0].data.text,'Привет 😀');
});
test('malformed/out-of-order/truncated/error SSE never resolves as completed',async()=>{
 const bad=[
 frame('reasoning_delta',{turn_number:0,sequence:1,text:'x'}),
 frame('reasoning_delta',{turn_number:1,sequence:1,text:42}),
 frame('tool_activity',{sequence:1,activity:'bad'}),
 frame('reasoning_delta',{turn_number:1,sequence:1,text:'x'})+frame('tool_activity',{sequence:1,activity:{kind:'x',status:'x',title:'x'}}),
 frame('reasoning_delta',{turn_number:2,sequence:1,text:'x'})+frame('reasoning_delta',{turn_number:1,sequence:2,text:'x'}),
 frame('reasoning_delta',{turn_number:1,sequence:1,text:'x'}),
 frame('reasoning_delta',{turn_number:1,sequence:1,text:'x'})+frame('error',{message:'Failure'}),
 frame('done',{})+frame('reasoning_delta',{turn_number:1,sequence:1,text:'x'}),
 frame('delta',{text:123})+frame('done',{}),
 'event: reasoning_delta\ndata: broken\n\n'
 ];
 for(const text of bad){
  await assert.rejects(readChatStream(new Response(text).body!,()=>{}));
 }
});
test('reasoning appears before final answer and survives authoritative refresh only on its canonical message',async()=>{
 let emit!:(e:ChatStreamEvent)=>void,release!:()=>void,reads=0;
 const gate=new Promise<void>(r=>{release=r;});
 const c=new LiveWorkspaceController(source({
  history:async()=>({...history,messages:++reads===1?[]:canonical()}),
  send:async(_text,_id,onEvent,options)=>{options?.onTurn?.(turn);emit=onEvent;onEvent(reasoning(1,'First '));await gate;onEvent(reasoning(3,'second',2));onEvent({event:'delta',data:{text:'Accepted'}});onEvent({event:'done',data:{}});}
 }),()=>{},()=>turn);
 await c.load();const sending=c.send(' Question ');
 assert.equal(c.snapshot().history.messages.at(-1)!.role,'assistant');assert.equal(c.snapshot().history.messages.at(-1)!.content,'');
 assert.equal(chatPresentation('conversation',c.snapshot().history.messages).messages.at(-1)!.reasoning,'First ');
 emit({event:'tool_activity',data:{sequence:2,activity:{kind:'memory_search',status:'success',title:'Do not include'}}});
 assert.equal(c.snapshot().history.messages.at(-1)!.reasoning,'First ');
 release();await sending;
 assert.equal(c.snapshot().history.messages.at(-1)!.id,'server-assistant');
 assert.equal(c.snapshot().history.messages.at(-1)!.reasoning,'First second');
 assert.equal(c.snapshot().history.messages.at(-1)!.status,'completed');
 await c.load();assert.equal(c.snapshot().history.messages.at(-1)!.reasoning,'First second');
 const reloaded=new LiveWorkspaceController(source({history:async()=>({...history,messages:canonical()})}),()=>{});
 await reloaded.load();assert.equal(reloaded.snapshot().history.messages.at(-1)!.reasoning,undefined);reloaded.stop();c.stop();
});
test('failed/interrupted reasoning is provisional, has no successful/Thinking status and does not leak into next turn',async()=>{
 for(const failure of [new StreamInterruptedError(),new ApiError(502,'chat_failed','Failed')]){
  let sends=0;const c=new LiveWorkspaceController(source({send:async(_t,_id,emit,options)=>{
   options?.onTurn?.(turn);if(++sends===1){emit(reasoning());throw failure;}
   emit({event:'delta',data:{text:'No reasoning'}});emit({event:'done',data:{}});
  }}),()=>{},()=>turn);
  await c.load();await c.send('Question');assert.equal(c.snapshot().history.messages.some(m=>m.reasoning),false);
  assert.equal(c.snapshot().history.messages.some(m=>m.status==='streaming'||m.status==='completed'),false);
  if(c.snapshot().uncertain)await c.recover();
  await c.send('Next');assert.equal(c.snapshot().history.messages.some(m=>m.reasoning),false);c.stop();
 }
});
test('logout/account switch invalidates old reasoning callbacks and clears memory',async()=>{
 let emit!:(e:ChatStreamEvent)=>void,release!:()=>void;
 const gate=new Promise<void>(r=>{release=r;});
 const c=new LiveWorkspaceController(source({send:async(_t,_id,onEvent)=>{emit=onEvent;onEvent(reasoning());await gate;onEvent(reasoning(2,'Late'));}}),()=>{},()=>turn);
 await c.load();const sending=c.send('Question');c.stop();emit(reasoning(3,'Old session'));release();await sending;
 assert.equal(c.snapshot().history.messages.some(m=>m.reasoning),false);
 const next=new LiveWorkspaceController(source(),()=>{});await next.load();assert.deepEqual(next.snapshot().history.messages,[]);next.stop();
});
test('ambiguous canonical matches never transfer reasoning between messages',async()=>{
 let reads=0;const pair=canonical(),duplicates=pair.concat(pair.map(m=>({...m,id:'other-'+m.id,sequence:m.sequence+2})));
 const c=new LiveWorkspaceController(source({history:async()=>({...history,messages:++reads===1?[]:duplicates}),send:async(_t,_id,emit)=>{emit(reasoning());emit({event:'delta',data:{text:'Accepted'}});emit({event:'done',data:{}});}}),()=>{},()=>turn);
 await c.load();await c.send('Question');assert.equal(c.snapshot().history.messages.some(m=>m.reasoning),false);c.stop();
});
test('Studio components and all styles stay byte-identical; only existing controlled props are wired',()=>{
 for(const path of ['src/components/ConnectionsSettingsView.tsx','src/components/ModelReasoningBlock.tsx','src/components/ChatWorkspace.tsx','src/index.css']){
  assert.equal(readFileSync(path,'utf8'),execFileSync('git',['show','5df78c6:'+path],{encoding:'utf8'}));
 }
 const view=readFileSync('src/pages/WorkspaceView.tsx','utf8'),live=readFileSync('src/providers/LiveExperience.tsx','utf8');
 assert.match(view,/showModelReasoning=\{runtime\?\.showModelReasoning\}/);
 assert.match(view,/onToggleShowModelReasoning=\{runtime\?\.onToggleShowModelReasoning\}/);
 assert.match(live,/onToggleShowModelReasoning:preferences.setShowModelReasoning/);
});

test('normal accepted answer without reasoning remains valid',async()=>{
 let reads=0;const c=new LiveWorkspaceController(source({history:async()=>({...history,messages:++reads===1?[]:canonical()}),send:async(_t,_id,emit)=>{emit({event:'delta',data:{text:'Accepted'}});emit({event:'done',data:{}});}}),()=>{},()=>turn);
 await c.load();await c.send('Question');assert.equal(c.snapshot().history.messages.at(-1)!.content,'Accepted');assert.equal(c.snapshot().history.messages.at(-1)!.reasoning,undefined);assert.equal(c.snapshot().error,null);c.stop();
});
test('unexpected ChatTurn change rejects and clears the previous turn reasoning',async()=>{
 const c=new LiveWorkspaceController(source({send:async(_t,_id,emit,options)=>{
  options?.onTurn?.(turn);emit(reasoning());options?.onTurn?.('00000000-0000-4000-8000-000000000002');
 }}),()=>{},()=>turn);
 await c.load();await c.send('Question');assert.equal(c.snapshot().history.messages.some(m=>m.reasoning),false);assert.equal(c.snapshot().uncertain,true);c.stop();
});
test('reasoning preference late response cannot change a disposed account',async()=>{
 let finish!:(u:ApiUser)=>void;const old=new UserPreferenceStore(source({savePreferences:async()=>new Promise(r=>{finish=r;})}),7,user,()=>{});
 old.setShowModelReasoning(true);old.dispose();
 const other=new UserPreferenceStore(source(),8,{...user,id:8},()=>{});
 finish({...user,preferences:{...user.preferences,show_model_reasoning:true}});await tick();
 assert.equal(other.snapshot().show_model_reasoning,false);assert.equal(other.snapshot().status,'saved');other.dispose();
});

test('a later turn and late callbacks never move the previous message reasoning',async()=>{
 let submissions=0,reads=0,oldEmit!:(e:ChatStreamEvent)=>void;
 const pair=canonical(),second=canonical().map(m=>({...m,id:'second-'+m.id,sequence:m.sequence+2,content:m.role==='user'?'Next question':m.content}));
 const c=new LiveWorkspaceController(source({history:async()=>({...history,messages:++reads===1?[]:reads===2?pair:pair.concat(second)}),
 send:async(_text,_id,emit,options)=>{
  options?.onTurn?.('turn-'+submissions);
  if(submissions===1){oldEmit=emit;emit(reasoning(1,'Only first'));}
  else oldEmit(reasoning(2,'Must be ignored'));
  emit({event:'delta',data:{text:'Accepted'}});emit({event:'done',data:{}});
 }}),()=>{},()=>String(++submissions));
 await c.load();await c.send('Question');await c.send('Next question');
 assert.equal(c.snapshot().history.messages.find(m=>m.id==='server-assistant')!.reasoning,'Only first');
 assert.equal(c.snapshot().history.messages.find(m=>m.id==='second-server-assistant')!.reasoning,undefined);c.stop();
});
