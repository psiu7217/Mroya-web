import test from 'node:test';
import assert from 'node:assert/strict';
import {readChatStream} from '../src/api/sse.ts';
import {LiveWorkspaceController} from '../src/hooks/LiveWorkspaceController.ts';
import {chatPresentation} from '../src/hooks/liveAdapters.ts';
import {ApiError,StreamInterruptedError} from '../src/api/errors.ts';
import type {ChatStreamEvent,ApiMessage,ToolActivityEvent} from '../src/types/api.ts';
import type {WorkspaceSource} from '../src/types/source.ts';
const id='00000000-0000-4000-8000-000000000001';
const empty={conversation_id:'synthetic-conversation',messages:[] as ApiMessage[],next_before:null};
const caps={api_version:'v1' as const,chat:true,memory_read:false,memory_mutations_via_chat:true,memory_mutations_rest:false,calendar_rest:false,connections_rest:false,reminders:false,local_recurrence:false,sse_token_streaming:false};
const source=(partial:Partial<WorkspaceSource>):WorkspaceSource=>({
 kind:'live',session:async()=>({status:'guest'}),login:async()=>{throw Error('Not used');},logout:async()=>{},
 capabilities:async()=>caps,history:async()=>empty,memories:async()=>({memories:[],total:0}),map:async()=>({nodes:[],edges:[]}),
 turn:async()=>({turn_status:'completed',summary:'',events:[]}),send:async()=>{},...partial,
});
const reason=(sequence:number,text:string,turn_number=1):ChatStreamEvent=>({event:'reasoning_delta',data:{sequence,text,turn_number}});
const tool=(sequence:number,status:'success'|'failure'|'neutral'='success',title='Checked memory'):ChatStreamEvent=>({event:'tool_activity',data:{sequence,activity:{kind:'memory_search',status,title}}});
const done:ChatStreamEvent={event:'done',data:{}},answer:ChatStreamEvent={event:'delta',data:{text:'Accepted answer'}};
const canonical:ApiMessage[]=[
 {id:'server-user',sequence:1,role:'user',content:'Question',status:'completed',created_at:'2026-10-16T00:00:00Z',completed_at:null},
 {id:'server-reply',sequence:2,role:'assistant',content:'Accepted answer',status:'completed',created_at:'2026-10-16T00:00:01Z',completed_at:null},
];
const frame=(event:string,data:unknown)=>'event: '+event+'\ndata: '+JSON.stringify(data)+'\n\n';
async function parse(events:ChatStreamEvent[]){const seen:ChatStreamEvent[]=[];await readChatStream(new Response(events.map(e=>frame(e.event,e.data)).join('')).body!,e=>seen.push(e));return seen;}
test('real legacy tools share sequence with reasoning; duplicate, backward, unknown status/schema, huge frames and terminal violations reject',async()=>{
 const events=[reason(1,'Before'),tool(2),reason(3,'After',2),tool(4,'failure'),tool(5,'neutral'),answer,done];
 assert.deepEqual((await parse(events)).map(e=>e.event),events.map(e=>e.event));
 const invalid=[
 [tool(1),tool(1),done],[reason(2,'Before'),tool(1),done],[tool(0),done],
 [{event:'tool_activity',data:{sequence:1,activity:{kind:'tool',status:'running',title:'Not approved'}}} as ChatStreamEvent,done],
 [{event:'tool_activity',data:{...tool(1).data,call_id:'not-a-confirmed-field',phase:'finished'}} as ChatStreamEvent,done],
 [{event:'tool_activity',data:{sequence:1,activity:{kind:'tool',status:'success',title:'No extra data',input:{secret:'Never show'}}}} as ChatStreamEvent,done],
 [tool(1,'success','Ж'.repeat(1100000)),done],[done,tool(1)],[tool(1),{event:'error',data:{message:'Failed'}} as ChatStreamEvent],
 [tool(1)],
 ];
 for(const value of invalid)await assert.rejects(parse(value));
 await assert.rejects(readChatStream(new Response('event: tool_activity\ndata: invalid\n\n').body!,()=>{}));
});
test('timeline immediately preserves reasoning -> tool -> reasoning; same-name calls stay separate and canonical refresh retains order',async()=>{
 let emit!:(e:ChatStreamEvent)=>void,release!:()=>void,reads=0;
 const gate=new Promise<void>(r=>{release=r;});
 const c=new LiveWorkspaceController(source({history:async()=>({...empty,messages:++reads===1?[]:canonical}),
 send:async(_text,_submission,onEvent,options)=>{options?.onTurn?.(id);emit=onEvent;onEvent(reason(1,'Before '));onEvent(reason(2,'tool'));await gate;onEvent(answer);onEvent(done);}}),()=>{},()=>id);
 await c.load();const sending=c.send('Question');
 const last=()=>c.snapshot().history.messages.at(-1)!;
 assert.equal(last().content,'');assert.equal(last().timeline?.length,1);
 emit(tool(3));emit(reason(4,'After '));emit(reason(5,'tool'));emit(reason(6,'Next provider',2));emit(tool(7,'failure'));emit(tool(8,'neutral'));
 assert.deepEqual(last().timeline?.map(e=>e.kind),['reasoning','tool','reasoning','reasoning','tool','tool']);
 assert.deepEqual(last().timeline?.map(e=>e.sequence),[1,3,4,6,7,8]);
 const tools=last().timeline!.filter(e=>e.kind==='tool');
 assert.equal(new Set(tools.map(e=>e.id)).size,3);assert.deepEqual(tools.map(e=>e.status),['success','failure','neutral']);
 for(const entry of tools){assert.equal('callId' in entry,false);assert.equal(entry.input,undefined);assert.equal(entry.output,undefined);assert.equal(entry.durationMs,undefined);}
 const expected=last().timeline;release();await sending;
 assert.equal(last().id,'server-reply');assert.deepEqual(last().timeline,expected);
 assert.deepEqual(chatPresentation(empty.conversation_id,c.snapshot().history.messages).messages.at(-1)!.timeline,expected);
 await c.load();assert.deepEqual(last().timeline,expected);
 const reload=new LiveWorkspaceController(source({history:async()=>({...empty,messages:canonical})}),()=>{});
 await reload.load();assert.equal(reload.snapshot().history.messages.at(-1)!.timeline,undefined);reload.stop();c.stop();
});
test('tool-only stream creates a reply and binds completed timeline without invented reasoning',async()=>{
 let reads=0;const c=new LiveWorkspaceController(source({history:async()=>({...empty,messages:++reads===1?[]:canonical}),send:async(_t,_i,emit)=>{emit(tool(1));emit(answer);emit(done);}}),()=>{},()=>id);
 await c.load();await c.send('Question');const reply=c.snapshot().history.messages.at(-1)!;
 assert.equal(reply.reasoning,undefined);assert.equal(reply.timeline?.length,1);assert.equal(reply.status,'completed');c.stop();
});
test('interruption retains only confirmed tool outcomes, clears Thinking, never replays Agent, and ignores late account callbacks',async()=>{
 let sends=0,emit!:(e:ChatStreamEvent)=>void;
 const c=new LiveWorkspaceController(source({send:async(_t,_id,onEvent,options)=>{sends++;emit=onEvent;options?.onTurn?.(id);onEvent(reason(1,'Provisional'));onEvent(tool(2));throw new StreamInterruptedError();}}),()=>{},()=>id);
 await c.load();await c.send('Question');let reply=c.snapshot().history.messages.at(-1)!;
 assert.equal(c.snapshot().uncertain,true);assert.equal(reply.status,'failed');assert.equal(reply.reasoning,undefined);
 assert.deepEqual(reply.timeline?.map(e=>e.kind),['tool']);assert.equal(reply.timeline?.[0].kind==='tool'&&reply.timeline[0].status,'success');
 await c.send('Do not replay');assert.equal(sends,1);c.stop();emit(tool(3));
 reply=c.snapshot().history.messages.at(-1)!;assert.equal(reply.timeline,undefined);
 const other=new LiveWorkspaceController(source({}),()=>{});await other.load();assert.deepEqual(other.snapshot().history.messages,[]);other.stop();
});
test('confirmed failed attempt binds tool outcome only by exact failed report_context',async()=>{
 const context={turn_id:id,request_trace_id:100,report_url:'/api/v1/chat/turns/'+id+'/report/'};
 let reads=0;const failed={...canonical[1],status:'failed',content:'Failed',report_context:context};
 const c=new LiveWorkspaceController(source({history:async()=>({...empty,messages:++reads===1?[]:[canonical[0],failed]}),send:async(_t,_s,emit,options)=>{
 options?.onTurn?.(id);emit(tool(1,'failure'));emit({event:'trace',data:{turn_status:'failed',assistant_content:'Failed',report_context:context}});throw new ApiError(502,'chat_failed','Failed');
 }}),()=>{},()=>id);
 await c.load();await c.send('Question');const reply=c.snapshot().history.messages.at(-1)!;
 assert.equal(reply.id,'server-reply');assert.equal(reply.timeline?.[0].kind==='tool'&&reply.timeline[0].status,'failure');assert.equal(reply.reasoning,undefined);c.stop();
});
test('ambiguous canonical pairs drop timeline and fresh attempts do not inherit previous tools',async()=>{
 let reads=0;const duplicates=canonical.concat(canonical.map(m=>({...m,id:'other-'+m.id,sequence:m.sequence+2})));
 const c=new LiveWorkspaceController(source({history:async()=>({...empty,messages:++reads===1?[]:duplicates}),send:async(_t,_i,emit)=>{emit(tool(1));emit(answer);emit(done);}}),()=>{},()=>id);
 await c.load();await c.send('Question');assert.equal(c.snapshot().history.messages.some(m=>m.timeline),false);c.stop();
 let sent=0,load=0;const second=canonical.map(m=>({...m,id:'second-'+m.id,sequence:m.sequence+2,content:m.role==='user'?'Second question':m.content}));
 const next=new LiveWorkspaceController(source({history:async()=>({...empty,messages:++load===1?[]:load===2?canonical:canonical.concat(second)}),send:async(_t,_i,emit)=>{if(sent===1)emit(tool(1));emit(answer);emit(done);}}),()=>{},()=>String(++sent));
 await next.load();await next.send('Question');await next.send('Second question');
 assert.equal(next.snapshot().history.messages.find(m=>m.id==='server-reply')!.timeline?.length,1);
 assert.equal(next.snapshot().history.messages.find(m=>m.id==='second-server-reply')!.timeline,undefined);next.stop();
});

test('trace checkpoint is a chronology barrier even within the same provider turn',async()=>{
 let reads=0;const c=new LiveWorkspaceController(source({history:async()=>({...empty,messages:++reads===1?[]:canonical}),send:async(_t,_id,emit)=>{
 emit(reason(1,'Before checkpoint'));emit({event:'trace',data:{turn_status:'running'}});
 emit(reason(2,'After checkpoint'));emit(tool(3));emit(answer);emit(done);
 }}),()=>{},()=>id);
 await c.load();await c.send('Question');
 assert.deepEqual(c.snapshot().history.messages.at(-1)!.timeline?.map(e=>e.sequence),[1,2,3]);c.stop();
});
