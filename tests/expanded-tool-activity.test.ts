import test from 'node:test';
import assert from 'node:assert/strict';
import {readToolActivity} from '../src/api/toolActivity.ts';
import {readChatStream} from '../src/api/sse.ts';
import {LiveWorkspaceController} from '../src/hooks/LiveWorkspaceController.ts';
import {StreamInterruptedError,ApiError} from '../src/api/errors.ts';
import type {ChatStreamEvent,ApiMessage,ExpandedToolActivity} from '../src/types/api.ts';
import type {WorkspaceSource} from '../src/types/source.ts';
const start=(patch:Record<string,unknown>={}):Record<string,unknown>=>({
 call_id:'t1-c1',tool_name:'search_memory',turn_number:1,phase:'started',status:'running',kind:'memory_search',title:'Searching memory',
 input:{queries:[{query:'Synthetic query'}]},output:null,duration_ms:null,truncated:false,...patch,
});
const finish=(patch:Record<string,unknown>={}):Record<string,unknown>=>({
 ...start(),phase:'finished',status:'success',title:'Memory search completed',input:null,
 output:{result_count:1,facts:[{subject:'Self',predicate:'Likes',value:'Tea'}]},duration_ms:143,...patch,
});
const event=(sequence:number,activity:Record<string,unknown>):ChatStreamEvent=>({event:'tool_activity',data:{sequence,activity}});
const reasoning=(sequence:number,text='Synthetic reasoning'):ChatStreamEvent=>({event:'reasoning_delta',data:{sequence,text,turn_number:1}});
const done:ChatStreamEvent={event:'done',data:{}},answer:ChatStreamEvent={event:'delta',data:{text:'Accepted'}};
const encode=(events:ChatStreamEvent[])=>events.map(e=>'event: '+e.event+'\ndata: '+JSON.stringify(e.data)+'\n\n').join('');
async function parse(events:ChatStreamEvent[]){const seen:ChatStreamEvent[]=[];await readChatStream(new Response(encode(events)).body!,e=>seen.push(e));return seen;}
const id='00000000-0000-4000-8000-000000000001';
const empty={conversation_id:'synthetic',messages:[] as ApiMessage[],next_before:null};
const canonical:ApiMessage[]=[
 {id:'server-user',sequence:1,role:'user',content:'Question',status:'completed',created_at:'2026-10-16T00:00:00Z',completed_at:null},
 {id:'server-reply',sequence:2,role:'assistant',content:'Accepted',status:'completed',created_at:'2026-10-16T00:00:01Z',completed_at:null},
];
const source=(partial:Partial<WorkspaceSource>):WorkspaceSource=>({
 kind:'live',session:async()=>({status:'guest'}),login:async()=>{throw Error('Not used');},logout:async()=>{},
 capabilities:async()=>({api_version:'v1',chat:true,memory_read:false,memory_mutations_via_chat:true,memory_mutations_rest:false,calendar_rest:false,connections_rest:false,reminders:false,local_recurrence:false,sse_token_streaming:false}),
 history:async()=>empty,memories:async()=>({memories:[],total:0}),map:async()=>({nodes:[],edges:[]}),
 turn:async()=>({turn_status:'completed',summary:'',events:[]}),send:async()=>{},...partial,
});
test('strict legacy/expanded forms and phase invariants; no mixed schemas or secret/unknown fields',()=>{
 const good=[start(),finish(),finish({status:'failure',output:{error_code:'tool_execution_failed'}}),
 finish({status:'not_executed',duration_ms:null,output:{error_code:'not_executed'}})];
 for(const activity of good)assert.deepEqual(readToolActivity({sequence:1,activity}).activity,activity);
 assert.deepEqual(readToolActivity({sequence:1,activity:{kind:'tool',status:'neutral',title:'No change'}}).activity,{kind:'tool',status:'neutral',title:'No change'});
 const invalid=[
 {...start(),phase:'finished'},start({status:'success'}),start({output:{result_count:1}}),start({duration_ms:0}),
 finish({status:'running'}),finish({input:{queries:[]}}),finish({duration_ms:null}),finish({duration_ms:-1}),finish({duration_ms:1.5}),
 finish({status:'not_executed',duration_ms:0}),start({call_id:'native-provider-secret'}),start({call_id:'t2-c1'}),start({call_id:'t1-c0'}),
 start({call_id:'t01-c1'}),start({call_id:'t1-c9007199254740993'}),start({turn_number:0}),start({kind:'memory_write'}),
 start({tool_name:'unknown_tool'}),start({truncated:'true'}),start({title:'x'.repeat(241)}),
 {...start(),authorization:'SECRET'},start({input:{queries:[],headers:{Authorization:'SECRET'}}}),
 start({input:{queries:[{query:'x',token:'SECRET'}]}}),finish({output:{facts:[],provider_transcript:'SECRET'}}),
 finish({output:{error_code:'secret_message'}}),finish({output:{facts:[{subject:'Self',predicate:'x',value:{hidden:true}}]}}),
 {kind:'tool',title:'Mixed legacy',status:'success',phase:'finished'},
 ...Object.keys(start()).map(key=>{const a=start();delete a[key];return a;})
 ];
 for(const activity of invalid)assert.throws(()=>readToolActivity({sequence:1,activity}),ApiError);
 assert.throws(()=>readToolActivity({sequence:1,activity:start(),headers:{secret:'No'}}));
});
test('all documented allowlisted tool input/output schemas, nullable safe projections and conservative memory outcomes',()=>{
 const cases=[
 ['search_memory','memory_search',{queries:[{query:null}]},{facts:[],result_count:25}],
 ['prepare_memory_write','persistence_check',{queries:[]},{facts:[{subject:null,predicate:'count',value:3.5}]}],
 ['expand_memory_entities','memory_search',{entities:[{label:'Self',direction:'both'}]},{entities:[{label:null,facts:[{subject:'Self',predicate:null,value:true}]}]}],
 ['write_statements','memory_write',{facts:[{subject:'Self',predicate:'Name',value:'Proposed'}]},{created_count:0,reused_existing_count:7,results:[{action:'reused_existing'}],search_ready:false}],
 ['revise_memory_statements','memory_write',{facts:[]},{revised_count:2,results:[{action:'revised'}],search_ready:null}],
 ['forget_memory_statements','memory_write',null,{forgotten_count:9,results:[{action:'forgotten'}],search_ready:true}],
 ['resolve_memory_write','no_write',{reason:'already_present',missing_dimension:null},{decision_resolved:true,new_facts_added:false}],
 ['search_calendar_events','calendar_search',null,null],['echo','tool',null,null],['tool','tool',null,null],
 ] as const;
 for(const [tool_name,kind,input,output] of cases){
  readToolActivity({sequence:1,activity:start({tool_name,kind,input})});
  readToolActivity({sequence:2,activity:finish({tool_name,kind,output})});
  readToolActivity({sequence:2,activity:finish({tool_name,kind,output:null,truncated:true})});
 }
 for(const activity of [
 start({tool_name:'forget_memory_statements',kind:'memory_write',input:{refs:['secret']}}),
 start({tool_name:'get_calendar_events',kind:'calendar_search',input:{query:'Not public'}}),
 finish({tool_name:'write_statements',kind:'memory_write',output:{created_count:1,reused_existing_count:0,results:[{action:'created',statement_id:'hidden'}],search_ready:true}}),
 finish({tool_name:'resolve_memory_write',kind:'no_write',output:{decision_resolved:true,new_facts_added:true}}),
 finish({output:{facts:[],result_count:-1}})
 ])assert.throws(()=>readToolActivity({sequence:1,activity}));
});
test('Backend bounds: four preview items, 240 Unicode characters, depth and 8192 ASCII JSON bytes',()=>{
 const emojis='😀'.repeat(240);
 readToolActivity({sequence:1,activity:start({input:{queries:[{query:emojis}]}})});
 assert.throws(()=>readToolActivity({sequence:1,activity:start({input:{queries:[{query:emojis+'a'}]}})}));
 assert.throws(()=>readToolActivity({sequence:1,activity:start({input:{queries:Array.from({length:5},()=>({query:'x'}))}})}));
 const facts=Array.from({length:4},()=>({subject:emojis,predicate:emojis,value:emojis}));
 assert.throws(()=>readToolActivity({sequence:1,activity:finish({output:{facts}})}));
 const deeplyNested={value:{value:{value:{value:{value:{value:{value:'hidden'}}}}}}};
 assert.throws(()=>readToolActivity({sequence:1,activity:finish({output:deeplyNested})}));
});
test('one call lifecycle, standalone not_executed, legacy compatibility and terminal/sequence/call anomalies',async()=>{
 await parse([reasoning(1),event(2,start()),reasoning(3,'Between phases'),event(4,finish()),event(5,finish({call_id:'t1-c2',status:'not_executed',duration_ms:null,output:{error_code:'unknown_tool_argument'}})),answer,done]);
 await parse([event(1,{kind:'tool',status:'success',title:'Legacy'}),done]);
 const bad=[
 [event(1,start()),event(2,start()),done],
 [event(1,finish()),done],
 [event(1,start()),event(2,finish()),event(3,finish()),done],
 [event(1,start()),event(2,finish({tool_name:'prepare_memory_write',kind:'persistence_check'})),done],
 [event(1,start()),event(2,finish({status:'not_executed',duration_ms:null,output:{error_code:'not_executed'}})),done],
 [event(1,start()),done],[event(2,start()),event(2,finish()),done],
 [event(2,start()),reasoning(1),event(3,finish()),done],
 [event(1,start()),event(2,finish()),done,event(3,finish())],
 [event(1,start())],
 ];
 for(const events of bad)await assert.rejects(parse(events));
});
test('started and finished update one card in original position around reasoning and bind canonical history',async()=>{
 let emit!:(e:ChatStreamEvent)=>void,release!:()=>void,reads=0;
 const gate=new Promise<void>(r=>{release=r;});
 const c=new LiveWorkspaceController(source({history:async()=>({...empty,messages:++reads===1?[]:canonical}),send:async(_t,_id,onEvent,options)=>{options?.onTurn?.(id);emit=onEvent;onEvent(reasoning(1,'Before'));onEvent(event(2,start()));await gate;onEvent(answer);onEvent(done);}}),()=>{},()=>id);
 await c.load();const sending=c.send('Question'),last=()=>c.snapshot().history.messages.at(-1)!;
 const initial=last().timeline!;assert.equal(initial[1].kind==='tool'&&initial[1].status,'running');
 assert.equal(initial[1].kind==='tool'&&initial[1].durationMs,undefined);
 emit(reasoning(3,'After started'));emit(event(4,finish()));
 emit(event(5,start({call_id:'t1-c2'})));emit(event(6,finish({call_id:'t1-c2',status:'failure',title:'Memory change not confirmed',output:null,truncated:true})));
 const tools=last().timeline!.filter(e=>e.kind==='tool');
 assert.equal(tools.length,2);assert.equal(tools[0].callId,'t1-c1');assert.equal(tools[0].sequence,2);
 assert.equal(tools[0].input!.format,'json');assert.deepEqual(JSON.parse(tools[0].input!.text),{queries:[{query:'Synthetic query'}]});
 assert.equal(JSON.parse(tools[0].output!.text).result_count,1);assert.equal(tools[0].durationMs,143);
 assert.equal(tools[1].status,'failure');assert.equal(tools[1].title,'Memory change not confirmed');assert.equal(tools[1].truncated,true);
 assert.deepEqual(last().timeline!.map(e=>e.id),['reasoning:1','tool:t1-c1','reasoning:3','tool:t1-c2']);
 release();await sending;assert.equal(last().id,'server-reply');
 assert.equal(last().timeline!.filter(e=>e.kind==='tool')[1].status,'failure');await c.load();assert.equal(last().timeline!.length,4);c.stop();
});
test('not_executed without started is one Not executed card, null calendar details stay absent',async()=>{
 let reads=0;
 const c=new LiveWorkspaceController(source({history:async()=>({...empty,messages:++reads===1?[]:canonical}),send:async(_t,_id,emit)=>{
 emit(event(1,finish({status:'not_executed',duration_ms:null,output:{error_code:'not_executed'}})));
 emit(event(2,start({call_id:'t1-c2',tool_name:'get_calendar_events',kind:'calendar_search',input:null,truncated:true})));
 emit(event(3,finish({call_id:'t1-c2',tool_name:'get_calendar_events',kind:'calendar_search',output:null,truncated:true})));
 emit(answer);emit(done);
 }}),()=>{},()=>id);
 await c.load();await c.send('Question');const tools=c.snapshot().history.messages.at(-1)!.timeline!.filter(e=>e.kind==='tool');
 assert.equal(tools.length,2);assert.equal(tools[0].status,'skipped');assert.equal(tools[0].input,undefined);assert.equal(tools[0].durationMs,undefined);
 assert.equal(tools[1].input,undefined);assert.equal(tools[1].output,undefined);assert.equal(tools[1].truncated,true);c.stop();
});
test('interrupted running is local uncertainty; prior confirmed outcomes stay intact; logout and late results clear',async()=>{
 let emit!:(e:ChatStreamEvent)=>void,release!:()=>void;
 const gate=new Promise<void>(r=>{release=r;});
 const c=new LiveWorkspaceController(source({send:async(_t,_id,onEvent,options)=>{
 options?.onTurn?.(id);emit=onEvent;onEvent(event(1,start()));onEvent(event(2,finish()));
 onEvent(reasoning(3));onEvent(event(4,start({call_id:'t1-c2'})));await gate;throw new StreamInterruptedError();
 }}),()=>{},()=>id);
 await c.load();const sending=c.send('Question');release();await sending;
 const reply=c.snapshot().history.messages.at(-1)!,tools=reply.timeline!.filter(e=>e.kind==='tool');
 assert.equal(reply.reasoning,'Synthetic reasoning');assert.equal(c.snapshot().uncertain,true);
 assert.deepEqual(tools.map(e=>e.status),['success','interrupted']);assert.equal(tools[1].phase,'started');assert.equal(tools[1].durationMs,undefined);
 c.stop();emit(event(5,finish({call_id:'t1-c2'})));assert.equal(c.snapshot().history.messages.at(-1)!.timeline,undefined);
 const other=new LiveWorkspaceController(source({}),()=>{});await other.load();assert.deepEqual(other.snapshot().history.messages,[]);other.stop();
});
test('failed canonical message retains received activity matched to exact attempt',async()=>{
 const context={turn_id:id,request_trace_id:100,report_url:'/api/v1/chat/turns/'+id+'/report/'};
 let reads=0;
 const c=new LiveWorkspaceController(source({history:async()=>({...empty,messages:++reads===1?[]:[canonical[0],{...canonical[1],status:'failed',report_context:context}]}),send:async(_t,_id,emit,options)=>{
 options?.onTurn?.(id);emit(event(1,start()));emit(event(2,finish()));emit(event(3,start({call_id:'t1-c2'})));
 emit({event:'trace',data:{turn_status:'failed',assistant_content:'Accepted',report_context:context}});
 throw new ApiError(502,'chat_failed','Failed');
 }}),()=>{},()=>id);
 await c.load();await c.send('Question');const tools=c.snapshot().history.messages.at(-1)!.timeline!.filter(e=>e.kind==='tool');
 assert.equal(tools.length,2);assert.equal(tools[0].phase,'finished');assert.equal(tools[0].status,'success');assert.equal(tools[1].status,'interrupted');c.stop();
});

test('a fresh send may reuse call_id without inheriting the previous call or accepting late callbacks',async()=>{
 let sends=0,reads=0,oldEmit!:(e:ChatStreamEvent)=>void;
 const nextPair=canonical.map(m=>({...m,id:'next-'+m.id,sequence:m.sequence+2,content:m.role==='user'?'Next question':m.content}));
 const c=new LiveWorkspaceController(source({history:async()=>({...empty,messages:++reads===1?[]:reads===2?canonical:canonical.concat(nextPair)}),
 send:async(_t,_id,emit)=>{
 if(sends===1){oldEmit=emit;emit(event(1,start()));emit(event(2,finish()));}
 else{oldEmit(event(3,finish()));emit(event(1,start({input:null})));emit(event(2,finish({status:'failure',output:null,title:'Memory change not confirmed'})));}
 emit(answer);emit(done);
 }}),()=>{},()=>String(++sends));
 await c.load();await c.send('Question');await c.send('Next question');
 const old=c.snapshot().history.messages.find(m=>m.id==='server-reply')!.timeline!;
 const next=c.snapshot().history.messages.find(m=>m.id==='next-server-reply')!.timeline!;
 assert.equal(old[0].kind==='tool'&&old[0].status,'success');
 assert.equal(next.length,1);assert.equal(next[0].kind==='tool'&&next[0].status,'failure');
 assert.equal(next[0].kind==='tool'&&next[0].input,undefined);c.stop();
});
