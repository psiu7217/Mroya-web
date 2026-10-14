import test from 'node:test';
import assert from 'node:assert/strict';
import {guestExchange} from '../src/hooks/guestConversation.ts';
import {LiveWorkspaceController} from '../src/hooks/LiveWorkspaceController.ts';
import {memoryPresentation,graphPresentation} from '../src/hooks/liveAdapters.ts';
import {ApiError,StreamInterruptedError} from '../src/api/errors.ts';
import type {WorkspaceSource} from '../src/types/source.ts';
const user={id:1,username:'account',first_name:'',last_name:'',email:'',timezone:'UTC',nickname:'',preferences:{theme:'system' as const}};
const caps={api_version:'v1' as const,chat:true,memory_read:true,memory_mutations_via_chat:true,memory_mutations_rest:false,calendar_rest:false,connections_rest:false,reminders:false,local_recurrence:false,sse_token_streaming:false};
const history={conversation_id:'server-conversation',messages:[],next_before:null};
function source(overrides:Partial<WorkspaceSource>={}):WorkspaceSource {return {kind:'live',session:async()=>({status:'authenticated',user}),login:async()=>user,logout:async()=>{},capabilities:async()=>caps,history:async()=>history,memories:async()=>({memories:[],total:0}),map:async()=>({nodes:[],edges:[]}),send:async()=>{},turn:async()=>({turn_status:'completed',summary:'',events:[]}),...overrides};}
const id='00000000-0000-4000-8000-000000000001';
test('guest sends remain a bounded in-memory exchange without networking or persistence',()=>{
 const fetch=globalThis.fetch;globalThis.fetch=()=>{throw Error('Guest must not fetch');};
 try{for(let i=0;i<100;i++){const c=guestExchange('Message '+i,'12:00');assert.equal(c.messages.length,2);assert.equal(c.messages[0].content,'Message '+i);assert.equal(c.messages.filter(m=>m.signInPrompt).length,1);}assert.equal(guestExchange('x'.repeat(20000),'').messages[0].content.length,16000);}finally{globalThis.fetch=fetch;}
});
test('live startup reads only advertised capabilities and server data',async()=>{
 let reads=0;const c=new LiveWorkspaceController(source({capabilities:async()=>({...caps,chat:false,memory_read:false}),history:async()=>{reads++;return history;},memories:async()=>{reads++;return {memories:[],total:0};},map:async()=>{reads++;return {nodes:[],edges:[]};}}),()=>{});
 await c.load();assert.equal(reads,0);await c.send('Hi');assert.match(c.snapshot().error!,/unavailable/);
});
test('live SSE send retains UUID, serializes writes and refreshes authoritative history',async()=>{
 let writes=0,reads=0;const ids:string[]=[];let release:()=>void=()=>{};
 const gate=new Promise<void>(resolve=>{release=resolve;});
 const c=new LiveWorkspaceController(source({history:async()=>{reads++;return history;},send:async(content,uuid,onEvent)=>{writes++;ids.push(uuid);onEvent({event:'delta',data:{text:'Server reply'}});await gate;onEvent({event:'done',data:{}});}}),()=>{},()=>id);
 await c.load();const sending=c.send('Real message');assert.equal(c.snapshot().busy,true);await c.send('Duplicate');assert.equal(writes,1);assert.equal(c.snapshot().history.messages.at(-1)!.content,'Server reply');release();await sending;assert.deepEqual(ids,[id]);assert.equal(reads,2);assert.equal(c.snapshot().busy,false);assert.equal(c.snapshot().history.conversation_id,'server-conversation');
});
test('interruption does not resend; recovery queries original server turn',async()=>{
 let sends=0,turns=0;const c=new LiveWorkspaceController(source({send:async(_c,_id,_e,options)=>{sends++;options?.onTurn?.(id);throw new StreamInterruptedError();},turn:async uuid=>{turns++;assert.equal(uuid,id);return {turn_status:turns===1?'running':'completed',summary:'',events:[]};}}),()=>{},()=>id);
 await c.load();await c.send('A');assert.equal(c.snapshot().uncertain,true);await c.send('B');assert.equal(sends,1);await c.recover();assert.equal(c.snapshot().uncertain,true);await c.recover();assert.equal(c.snapshot().uncertain,false);assert.equal(sends,1);
});
test('401 expires the workspace while network errors stay explicit errors',async()=>{
 let expired=0;const c=new LiveWorkspaceController(source({history:async()=>{throw new ApiError(401,'authentication_required','Expired');}}),()=>{expired++;});await c.load();assert.equal(expired,1);
 const failed=new LiveWorkspaceController(source({history:async()=>{throw Error('Offline');}}),()=>{throw Error('Must not log out on network failure');});await failed.load();assert.equal(failed.snapshot().error,'Offline');assert.deepEqual(failed.snapshot().history.messages,[]);
});
test('disposed workspace ignores late server data',async()=>{
 let resolve:(v:typeof caps)=>void=()=>{};const deferred=new Promise<typeof caps>(r=>{resolve=r;});const c=new LiveWorkspaceController(source({capabilities:()=>deferred}),()=>{});const request=c.load();c.stop();resolve(caps);await request;assert.equal(c.snapshot().capabilities,null);
});
test('canonical adapters retain actual IDs, literals and relationship predicates',()=>{
 const map={nodes:[{id:'memory:m',type:'memory' as const,label:'Actual value',statement_id:'m'}],edges:[]};const memory=memoryPresentation({uuid:'m',subject:'Actual subject',predicate:'prefers',literal_value:'Actual value',learned_at:'2026-10-14',state:'active'},map);assert.equal(memory.id,'m');assert.equal(memory.relatedNodeId,'memory:m');assert.equal(memory.summary,'Actual value');assert.equal(graphPresentation(map).nodes[0].linkedMemoryId,'m');
});
