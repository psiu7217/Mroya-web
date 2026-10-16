import test from 'node:test';
import assert from 'node:assert/strict';
import {LiveWorkspaceController} from '../src/hooks/LiveWorkspaceController.ts';
import {ApiError,StreamInterruptedError} from '../src/api/errors.ts';
import {chatPresentation} from '../src/hooks/liveAdapters.ts';
import type {ApiMessage,ChatStreamEvent,ReportContext} from '../src/types/api.ts';
import type {WorkspaceSource} from '../src/types/source.ts';
const turn='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
const context:ReportContext={turn_id:turn,request_trace_id:100,report_url:'/api/v1/chat/turns/'+turn+'/report/'};
const empty={conversation_id:'synthetic',messages:[] as ApiMessage[],next_before:null};
const canonical=(ctx:ReportContext=context):ApiMessage=>({id:'canonical-assistant',sequence:2,role:'assistant',status:'failed',content:'Safe server failure',created_at:'2026-10-16T00:00:00Z',completed_at:null,report_context:ctx});
const caps={api_version:'v1' as const,chat:true,memory_read:false,memory_mutations_via_chat:true,memory_mutations_rest:false,calendar_rest:false,connections_rest:false,reminders:false,local_recurrence:false,sse_token_streaming:false};
const source=(p:Partial<WorkspaceSource>):WorkspaceSource=>({kind:'live',session:async()=>({status:'guest'}),login:async()=>{throw Error('Not used');},logout:async()=>{},history:async()=>empty,capabilities:async()=>caps,memories:async()=>({memories:[],total:0}),map:async()=>({nodes:[],edges:[]}),turn:async()=>({turn_status:'failed',summary:'',events:[],assistant_content:'Safe server failure',report_context:context}),send:async()=>{},...p});
const reason=(sequence:number,text:string):ChatStreamEvent=>({event:'reasoning_delta',data:{sequence,text,turn_number:1}});
const tool=(sequence:number,call_id:string,phase:'started'|'finished',status='success'):ChatStreamEvent=>({
 event:'tool_activity',data:{sequence,activity:{call_id,tool_name:'search_memory',turn_number:1,phase,status:phase==='started'?'running':status,kind:'memory_search',title:phase==='started'?'Searching memory':status==='success'?'Memory search completed':'Memory search failed',
 input:phase==='started'?{queries:[{query:'Synthetic'}]}:null,output:phase==='started'?null:status==='success'?{facts:[],result_count:1}:{error_code:'tool_execution_failed'},duration_ms:phase==='started'?null:12,truncated:false}}
});
const failedTrace=(ctx=context):ChatStreamEvent=>({event:'trace',data:{turn_status:'failed',assistant_content:'Safe server failure',report_context:ctx}});
const terminal=()=>new ApiError(502,'chat_failed','Synthetic failure');
const last=(c:LiveWorkspaceController)=>c.snapshot().history.messages.at(-1)!;
test('reasoning-only terminal failure without trace/history remains local static text, never an unconfirmed answer',async()=>{
 const c=new LiveWorkspaceController(source({send:async(_t,_id,emit)=>{emit(reason(1,'Already received'));emit({event:'delta',data:{text:'UNCONFIRMED ANSWER'}});throw terminal();}}),()=>{},()=>turn);
 await c.load();await c.send('Question');assert.equal(last(c).reasoning,'Already received');assert.equal(last(c).status,'failed');assert.equal(last(c).content,'');
 assert.equal(c.snapshot().busy,false);assert.equal(c.snapshot().uncertain,false);assert.equal(last(c).timeline?.[0].kind,'reasoning');c.stop();
});
test('failed trace and canonical history preserve reasoning alone or interleaved with successful/failed tools',async()=>{
 for(const tools of [false,true]){
  let reads=0;
  const c=new LiveWorkspaceController(source({history:async()=>({...empty,messages:++reads===1?[]:[canonical()]}),send:async(_t,_id,emit,options)=>{
   options?.onTurn?.(turn);emit(reason(1,'Before'));
   if(tools){emit(tool(2,'t1-c1','started'));emit(tool(3,'t1-c1','finished'));emit(reason(4,'Between'));emit(tool(5,'t1-c2','started'));emit(tool(6,'t1-c2','finished','failure'));emit(reason(7,'After'));}
   emit(failedTrace());throw terminal();
  }}),()=>{},()=>turn);
  await c.load();await c.send('Question');
  const reply=last(c);assert.equal(reply.id,'canonical-assistant');assert.equal(reply.status,'failed');assert.equal(reply.content,'Safe server failure');
  assert.equal(reply.reasoning,tools?'BeforeBetweenAfter':'Before');
  assert.deepEqual(reply.timeline?.map(e=>e.kind),tools?['reasoning','tool','reasoning','tool','reasoning']:['reasoning']);
  if(tools)assert.deepEqual(reply.timeline!.filter(e=>e.kind==='tool').map(e=>e.status),['success','failure']);
  const expected=reply.timeline;await c.load();assert.deepEqual(last(c).timeline,expected);assert.equal(last(c).reasoning,reply.reasoning);
  const view=chatPresentation(empty.conversation_id,c.snapshot().history.messages).messages.at(-1)!;assert.equal(view.reasoning,reply.reasoning);assert.deepEqual(view.timeline,expected);
  c.stop();
 }
});
test('SSE interruption after reasoning or during Running keeps chronology, stops animations and preserves confirmed outcomes',async()=>{
 for(const running of [false,true]){
  const c=new LiveWorkspaceController(source({send:async(_t,_id,emit,options)=>{
   options?.onTurn?.(turn);emit(reason(1,'Before'));
   if(running){emit(tool(2,'t1-c1','started'));emit(tool(3,'t1-c1','finished'));emit(reason(4,'Between'));emit(tool(5,'t1-c2','started'));}
   throw new StreamInterruptedError();
  }}),()=>{},()=>turn);
  await c.load();await c.send('Question');const reply=last(c);
  assert.equal(reply.status,'failed');assert.equal(reply.reasoning,running?'BeforeBetween':'Before');assert.equal(c.snapshot().uncertain,true);
  assert.deepEqual(reply.timeline?.map(e=>e.kind),running?['reasoning','tool','reasoning','tool']:['reasoning']);
  if(running)assert.deepEqual(reply.timeline!.filter(e=>e.kind==='tool').map(e=>e.status),['success','interrupted']);
  c.stop();
 }
});
test('recover binds original failed turn and preserves received reasoning while marking running Interrupted',async()=>{
 let reads=0;
 const c=new LiveWorkspaceController(source({history:async()=>({...empty,messages:++reads===1?[]:[canonical()]}),send:async(_t,_id,emit,options)=>{
 options?.onTurn?.(turn);emit(reason(1,'Before'));emit(tool(2,'t1-c1','started'));emit(failedTrace());throw new StreamInterruptedError();
 }}),()=>{},()=>turn);
 await c.load();await c.send('Question');await c.recover();assert.equal(last(c).id,'canonical-assistant');assert.equal(last(c).reasoning,'Before');
 const interrupted=last(c).timeline?.[1];assert.equal(interrupted?.kind==='tool'&&interrupted.status,'interrupted');assert.equal(c.snapshot().uncertain,false);c.stop();
});
test('wrong turn, wrong trace or ambiguous failed history never gets another attempt reasoning',async()=>{
 const foreign={...context,turn_id:other,report_url:'/api/v1/chat/turns/'+other+'/report/'};
 for(const records of [[canonical({...context,request_trace_id:101})],[canonical(foreign)],[canonical(),{...canonical(),id:'duplicate'}]]){
  let reads=0;const c=new LiveWorkspaceController(source({history:async()=>({...empty,messages:++reads===1?[]:records}),send:async(_t,_id,emit,options)=>{
   options?.onTurn?.(turn);emit(reason(1,'Original only'));emit(failedTrace());throw terminal();
  }}),()=>{},()=>turn);
  await c.load();await c.send('Question');
  for(const m of c.snapshot().history.messages.filter(m=>records.some(r=>r.id===m.id))){assert.equal(m.reasoning,undefined);assert.equal(m.timeline,undefined);}
  c.stop();
 }
});
test('canonical message ID reused by Retry invalidates cached reasoning and never resurrects it later',async()=>{
 let reads=0,ctx=context;const c=new LiveWorkspaceController(source({history:async()=>({...empty,messages:++reads===1?[]:[canonical(ctx)]}),send:async(_t,_id,emit,options)=>{
 options?.onTurn?.(turn);emit(reason(1,'Old attempt'));emit(failedTrace());throw terminal();
 }}),()=>{},()=>turn);
 await c.load();await c.send('Question');assert.equal(last(c).reasoning,'Old attempt');
 ctx={...context,request_trace_id:101};await c.load();assert.equal(last(c).reasoning,undefined);assert.equal(last(c).timeline,undefined);
 ctx=context;await c.load();assert.equal(last(c).reasoning,undefined);assert.equal(last(c).timeline,undefined);c.stop();
});
test('recover cannot retarget preserved reasoning to a newer trace of the same turn',async()=>{
 let reads=0;const newer={...context,request_trace_id:101};
 const c=new LiveWorkspaceController(source({history:async()=>({...empty,messages:++reads===1?[]:[canonical(newer)]}),turn:async()=>({turn_status:'failed',summary:'',events:[],assistant_content:'New attempt',report_context:newer}),send:async(_t,_id,emit,options)=>{
 options?.onTurn?.(turn);emit(reason(1,'Original'));emit(failedTrace());throw new StreamInterruptedError();
 }}),()=>{},()=>turn);
 await c.load();await c.send('Question');await c.recover();assert.equal(last(c).reasoning,undefined);assert.equal(last(c).timeline,undefined);c.stop();
});
test('logout/account switch, reload and late events cannot restore ephemeral reasoning',async()=>{
 let emit!:(e:ChatStreamEvent)=>void,release!:()=>void;
 const gate=new Promise<void>(r=>{release=r;});
 const c=new LiveWorkspaceController(source({send:async(_t,_id,onEvent)=>{emit=onEvent;emit(reason(1,'Old account'));await gate;throw terminal();}}),()=>{},()=>turn);
 await c.load();const sending=c.send('Question');c.stop();emit(reason(2,'Late'));release();await sending;
 assert.equal(last(c).reasoning,undefined);assert.equal(last(c).timeline,undefined);
 const reloaded=new LiveWorkspaceController(source({history:async()=>({...empty,messages:[canonical()]})}),()=>{});
 await reloaded.load();assert.equal(last(reloaded).reasoning,undefined);assert.equal(last(reloaded).timeline,undefined);reloaded.stop();
});
test('new submission never inherits reasoning from a failed attempt or its late callbacks',async()=>{
 let sends=0,reads=0,oldEmit!:(e:ChatStreamEvent)=>void;
 const c=new LiveWorkspaceController(source({history:async()=>({...empty,messages:++reads===1?[]:[canonical()]}),send:async(_t,_id,emit,options)=>{
 options?.onTurn?.(sends===1?turn:other);
 if(sends===1){oldEmit=emit;emit(reason(1,'Old attempt'));emit(failedTrace());throw terminal();}
 oldEmit(reason(2,'Late original'));emit({event:'delta',data:{text:'Accepted new answer'}});emit({event:'done',data:{}});
 }}),()=>{},()=>String(++sends));
 await c.load();await c.send('Question');await c.send('New question');
 assert.equal(c.snapshot().history.messages.filter(m=>m.reasoning).length,1);assert.equal(last(c).reasoning,'Old attempt');
 assert.equal(c.snapshot().history.messages.some(m=>m.reasoning?.includes('Late')),false);c.stop();
});

test('recovery GET cannot prove an unknown original trace: keep local reasoning without assigning it to current canonical attempt',async()=>{
 let reads=0;const newer={...context,request_trace_id:101};
 const c=new LiveWorkspaceController(source({history:async()=>({...empty,messages:++reads===1?[]:[canonical(newer)]}),turn:async()=>({turn_status:'failed',summary:'',events:[],assistant_content:'Safe server failure',report_context:newer}),send:async(_t,_id,emit,options)=>{
 options?.onTurn?.(turn);emit(reason(1,'Original, unknown trace'));throw new StreamInterruptedError();
 }}),()=>{},()=>turn);
 await c.load();await c.send('Question');await c.recover();
 assert.equal(last(c).id,'reply:'+turn);assert.equal(last(c).report_context,undefined);assert.equal(last(c).reasoning,'Original, unknown trace');
 assert.equal(c.snapshot().history.messages.some(m=>m.id==='canonical-assistant'),false);c.stop();
});
