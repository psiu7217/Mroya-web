import test from 'node:test';
import assert from 'node:assert/strict';
import {MroyaApi} from '../src/api/client.ts';
import {LiveWorkspaceController} from '../src/hooks/LiveWorkspaceController.ts';
import {readConversationHistory} from '../src/api/conversations.ts';
import {readTasksPayload,readAiTask,taskTimeRemaining,newerTask} from '../src/api/aiTasks.ts';
import {ApiError} from '../src/api/errors.ts';
import type {WorkspaceSource} from '../src/types/source.ts';
import type {AiTask} from '../src/types/aiTasks.ts';
const id='00000000-0000-4000-8000-000000000001';
const dto={id,type:'memory',description:'Сохранить, что Влад купил приставку',status:'queued',created_at:'2026-10-27T12:00:00Z',updated_at:'2026-10-27T12:00:00Z',result:null,error_code:null};
const task:AiTask={id,target:'memory',title:dto.description,userPrompt:dto.description,status:'queued',createdAt:dto.created_at,updatedAt:dto.updated_at};
test('task API uses session client and validates pages and canonical detail',async()=>{
 const calls:string[]=[];
 const api=new MroyaApi((async(url,init)=>{calls.push(String(url));assert.equal(init?.credentials,'same-origin');return new Response(JSON.stringify(String(url).includes(id)?{task:dto}:{tasks:[dto],next_offset:null}),{headers:{'Content-Type':'application/json'}});}) as typeof fetch);
 assert.equal((await api.agentTasks()).tasks[0].status,'queued');
 assert.equal((await api.agentTask(id)).id,id);
 assert.deepEqual(calls,['/api/v1/agent-tasks/?limit=50&offset=0','/api/v1/agent-tasks/'+id+'/']);
 await assert.rejects(()=>api.agentTasks(-1));await assert.rejects(()=>api.agentTask('other'));
});
test('restores tasks, emits toast only on observed completion, refreshes details and retains rows on error',async()=>{
 let row={...task},fail=false;
 const source={agentTasks:async()=>{if(fail)throw Error('offline');return {tasks:[row],nextOffset:null};},agentTask:async()=>({...row})} as unknown as WorkspaceSource;
 const c=new LiveWorkspaceController(source,()=>assert.fail('unexpected expiry'));
 try{
  await c.refreshTasks();assert.equal(c.snapshot().agentTasks[0].id,id);assert.equal(c.snapshot().completedTask,null);
  row={...task,status:'completed'};await c.taskDetails(id);assert.equal(c.snapshot().completedTask?.id,id);
  c.dismissTask();await c.refreshTasks();assert.equal(c.snapshot().completedTask,null);
  fail=true;await c.refreshTasks();assert.equal(c.snapshot().agentTasks[0].status,'completed');assert.equal(c.snapshot().tasksError,'offline');
 }finally{c.stop();}
 const reloaded=new LiveWorkspaceController({...source,agentTasks:async()=>({tasks:[row],nextOffset:null})},()=>{});
 await reloaded.refreshTasks();assert.equal(reloaded.snapshot().completedTask,null);reloaded.stop();
});
test('pagination retains server IDs and stopped account cannot deliver a late result',async()=>{
 const offsets:number[]=[];let resolve!:(v:{tasks:AiTask[];nextOffset:null})=>void;
 const c=new LiveWorkspaceController({agentTasks:async(offset=0)=>{offsets.push(offset);return {tasks:[{...task,id:offset? '00000000-0000-4000-8000-000000000002':id}],nextOffset:offset?null:50};}} as unknown as WorkspaceSource,()=>{});
 try{await c.refreshTasks();await c.moreTasks();assert.deepEqual(offsets,[0,0,50]);assert.equal(c.snapshot().agentTasks.length,2);}finally{c.stop();}
 const late=new LiveWorkspaceController({agentTasks:()=>new Promise(r=>{resolve=r;})} as unknown as WorkspaceSource,()=>{});
 const pending=late.refreshTasks();late.stop();resolve({tasks:[task],nextOffset:null});await pending;
 assert.deepEqual(late.snapshot().agentTasks,[]);assert.equal(late.snapshot().completedTask,null);
});

test('manual execution uses CSRF once, blocks duplicate clicks and waits for backend statuses/timing',async()=>{
 const calls:{url:string;init:RequestInit}[]=[];
 const completed={...dto,status:'completed',started_at:'2026-10-27T12:00:00Z',finished_at:'2026-10-27T12:00:08.400Z',duration_ms:8400,result:'Confirmed'};
 const api=new MroyaApi((async(url,init={})=>{calls.push({url:String(url),init});return new Response(JSON.stringify(String(url).endsWith('csrf/')?{csrf_token:'synthetic'}:{task:completed}),{headers:{'Content-Type':'application/json'}});}) as typeof fetch);
 assert.equal((await api.executeAgentTask(id)).durationMs,8400);
 assert.equal(calls.length,2);assert.ok(calls[1].url.endsWith('/'+id+'/execute/'));
 assert.equal(calls[1].init.method,'POST');assert.equal(calls[1].init.body,'{}');
 assert.equal((calls[1].init.headers as Record<string,string>)['X-CSRFToken'],'synthetic');
 let posts=0,release!:(row:AiTask)=>void,row={...task};
 const c=new LiveWorkspaceController({agentTasks:async()=>({tasks:[row],nextOffset:null}),
 executeAgentTask:()=>{posts++;return new Promise(r=>{release=r;});}} as unknown as WorkspaceSource,()=>{});
 try{
  await c.refreshTasks();const pending=c.executeTask(id);await c.executeTask(id);
  assert.equal(posts,1);assert.equal(c.snapshot().executingTaskId,id);
  assert.equal(c.snapshot().agentTasks[0].status,'queued'); // Never optimistic running.
  await new Promise(r=>setTimeout(r,0));
  row={...task,status:'running',startedAt:completed.started_at,updatedAt:'2026-10-27T12:00:01Z'};
  await c.refreshTasks();assert.equal(c.snapshot().agentTasks[0].status,'running');
  const finished={...row,status:'completed' as const,updatedAt:completed.finished_at,finishedAt:completed.finished_at,durationMs:8400};
  release(finished);await pending;
  assert.equal(c.snapshot().agentTasks[0].status,'completed');assert.equal(c.snapshot().agentTasks[0].durationMs,8400);
  assert.equal(c.snapshot().executingTaskId,null);assert.equal(posts,1);
 }finally{c.stop();}
});

const pendingDto={...dto,status:'pending_confirmation',confirm_deadline_at:'2026-10-27T12:00:15Z' as string|null};
const conv='00000000-0000-4000-8000-000000000001';
const turnA='00000000-0000-4000-8000-00000000000a';
const turnB='00000000-0000-4000-8000-00000000000b';
const messageA={id:turnA,sequence:1,role:'user',content:'Запиши покупку',status:'completed',created_at:'2026-10-27T12:00:00Z',completed_at:'2026-10-27T12:00:01Z'};
const messageB={id:turnB,sequence:2,role:'assistant',content:'Подготовил.',status:'completed',created_at:'2026-10-27T12:00:02Z',completed_at:'2026-10-27T12:00:03Z',tasks:[pendingDto]};

test('pending task receipts: reader validates window, approves/cancels via CSRF and bounds turn payloads',async()=>{
 const calls:string[]=[];
 const approved={...pendingDto,status:'queued'};
 const cancelled={...pendingDto,status:'cancelled'};
 const api=new MroyaApi((async(url,init)=>{calls.push(String(url));
  if(String(url).endsWith('csrf/'))return new Response(JSON.stringify({csrf_token:'synthetic'}),{headers:{'Content-Type':'application/json'}});
  return new Response(JSON.stringify({task:String(url).endsWith('/approve/')?approved:String(url).endsWith('/cancel/')?cancelled:pendingDto}),{headers:{'Content-Type':'application/json'}});}) as typeof fetch);
 // Canonical detail with the window field.
 const detail=await api.agentTask(id);
 assert.equal(detail.status,'pending_confirmation');assert.equal(detail.confirmDeadlineAt,'2026-10-27T12:00:15Z');
 // Approve/cancel ride the exact endpoints with the session CSRF token.
 assert.equal((await api.approveAgentTask(id)).status,'queued');
 assert.equal((await api.revokePendingAgentTask(id)).status,'cancelled');
 assert.ok(calls.some(u=>u.endsWith('/agent-tasks/'+id+'/approve/')));
 assert.ok(calls.some(u=>u.endsWith('/agent-tasks/'+id+'/cancel/')));
 // The window reader rejects junk deadlines; legacy rows keep an undefined deadline.
 await assert.rejects(()=>new MroyaApi((async()=>new Response(JSON.stringify({task:{...pendingDto,confirm_deadline_at:'not-a-date'}}),{headers:{'Content-Type':'application/json'}})) as typeof fetch).agentTask(id));
 assert.deepEqual(readTasksPayload(undefined),[]);
 assert.deepEqual(readTasksPayload([pendingDto]).map(t=>t.status),['pending_confirmation']);
 assert.throws(()=>readTasksPayload(Array.from({length:10},()=>pendingDto)));
 assert.throws(()=>readTasksPayload('nope'));
});

test('chat history binds task receipts to assistant messages only, in both multi and single runners',async()=>{
 const parsed=readConversationHistory({conversation_id:conv,next_before:null,messages:[messageA,messageB]},conv);
 assert.deepEqual(parsed.messages[1].tasks?.map(t=>t.status),['pending_confirmation']);
 assert.equal(parsed.messages[0].tasks,undefined);
 // A receipt array on a user message is a contract violation.
 assert.throws(()=>readConversationHistory({conversation_id:conv,next_before:null,messages:[{...messageA,tasks:[pendingDto]},messageB]},conv));
 const api=new MroyaApi((async()=>new Response(JSON.stringify({conversation_id:conv,next_before:null,messages:[messageA,messageB]}),{headers:{'Content-Type':'application/json'}})) as typeof fetch);
 assert.deepEqual((await api.history()).messages[1].tasks?.map(t=>t.id),[id]);
});

test('cards reconcile through the controller: approve merges rows, late revocation surfaces 409 honestly',async()=>{
 const rejected=new ApiError(409,'confirm_window_closed','The confirmation window has closed');
 const approvedTask:AiTask={...task,status:'queued',updatedAt:'2026-10-27T12:00:20Z'};
 const c=new LiveWorkspaceController({
  agentTasks:async()=>({tasks:[{...task,status:'pending_confirmation',confirmDeadlineAt:'2026-10-27T12:00:15Z'}],nextOffset:null}),
  agentTask:async()=>({...task}),
  approveAgentTask:async()=>approvedTask,
  revokePendingAgentTask:()=>Promise.reject(rejected),
 } as unknown as WorkspaceSource,()=>{});
 try{
  await c.refreshTasks();assert.equal(c.snapshot().agentTasks[0].status,'pending_confirmation');
  assert.strictEqual(await c.approvePendingTask(id),approvedTask);
  assert.equal(c.snapshot().agentTasks[0].status,'queued');
  await assert.rejects(()=>c.revokePendingTask(id),(error:unknown)=>error instanceof ApiError&&error.status===409&&error.code==='confirm_window_closed');
 }finally{c.stop();}
 // Without bound pending-confirmation capabilities the card actions never misrepresent state.
 const plain=new LiveWorkspaceController({agentTasks:async()=>({tasks:[task],nextOffset:null})} as unknown as WorkspaceSource,()=>{});
 try{await plain.refreshTasks();await assert.rejects(()=>plain.approvePendingTask(id));}finally{plain.stop();}
});



test('delivery acknowledgement is explicit, CSRF-protected and never a polling side effect',async()=>{
 const calls:string[]=[];
 const api=new MroyaApi((async(url,init)=>{
  calls.push(String(url));
  if(String(url).endsWith('csrf/'))return new Response(JSON.stringify({csrf_token:'csrf-review'}),{headers:{'Content-Type':'application/json'}});
  assert.equal(init?.method,'POST');assert.equal(init?.body,'{}');
  assert.equal(new Headers(init?.headers).get('X-CSRFToken'),'csrf-review');
  return new Response(JSON.stringify({task:{...pendingDto,server_time:'2026-10-27T12:00:00Z'}}),{headers:{'Content-Type':'application/json'}});
 }) as typeof fetch);
 await api.beginAgentTaskReview(id);
 assert.ok(calls.at(-1)?.endsWith('/agent-tasks/'+id+'/review/'));
 assert.throws(()=>readTasksPayload([pendingDto,pendingDto]));
});

test('server clock correction and monotone statuses handle clock skew and stale reads',()=>{
 const received=Date.now();
 const row=readAiTask({...pendingDto,server_time:new Date(received+3600000).toISOString(),confirm_deadline_at:new Date(received+3615000).toISOString()});
 const left=taskTimeRemaining(row);
 assert.ok(left!==null&&left>14000&&left<=15000);
 const pending={...task,status:'pending_confirmation' as const};
 const queued={...task,status:'queued' as const};
 assert.equal(newerTask(queued,pending).status,'queued');
 assert.equal(newerTask({...pending,confirmDeadlineAt:'2026-10-27T12:00:15Z'},pending).confirmDeadlineAt,'2026-10-27T12:00:15Z');
 assert.equal(newerTask({...task,status:'completed'},queued).status,'completed');
});

test('canonical actions update the drawer and every bound history card without stale-response regression',async()=>{
 let acknowledgements=0;
 const pending:AiTask={...task,status:'pending_confirmation'};
 const queued:AiTask={...pending,status:'queued',confirmDeadlineAt:'2026-10-27T12:00:15Z'};
 const source={
  capabilities:async()=>({chat:true,memory_read:false}),
  history:async()=>({conversation_id:conv,next_before:null,messages:[messageA,{...messageB,tasks:[pending]}]}),
  agentTasks:async()=>({tasks:[pending],nextOffset:null}),
  agentTask:async()=>pending,
  beginAgentTaskReview:async()=>{acknowledgements++;return {...pending,confirmDeadlineAt:queued.confirmDeadlineAt};},
  approveAgentTask:async()=>queued,
 } as unknown as WorkspaceSource;
 const c=new LiveWorkspaceController(source,()=>assert.fail('Unexpected expiry'));
 try{
  await c.load();await c.refreshTasks();assert.equal(acknowledgements,0);
  await c.beginPendingReview(id);assert.equal(acknowledgements,1);
  assert.equal(c.snapshot().history.messages[1].tasks?.[0].confirmDeadlineAt,queued.confirmDeadlineAt);
  await c.approvePendingTask(id);
  assert.equal(c.snapshot().history.messages[1].tasks?.[0].status,'queued');
  await c.refreshTasks();await c.load();
  assert.equal(c.snapshot().agentTasks[0].status,'queued');
  assert.equal(c.snapshot().history.messages[1].tasks?.[0].status,'queued');
 }finally{c.stop();}
});


test('late approval authentication failures cannot expire a replacement account session',async()=>{
 let reject!:(error:unknown)=>void,expired=0;
 const controller=new LiveWorkspaceController({approveAgentTask:()=>new Promise((_,fail)=>{reject=fail;})} as unknown as WorkspaceSource,()=>{expired++;});
 const request=controller.approvePendingTask(id);controller.stop();
 reject(new ApiError(401,'authentication_required','Old session'));
 await assert.rejects(request);assert.equal(expired,0);
});

test('panel cancellation reads server permission and sends CSRF; chat keeps pending-only intent',async()=>{
 assert.equal(readAiTask({...dto,can_cancel:true}).canCancel,true);
 assert.equal(readAiTask(dto).canCancel,false);
 assert.throws(()=>readAiTask({...dto,can_cancel:'true'}));
 const calls:{url:string;init:RequestInit}[]=[];
 const api=new MroyaApi((async(url,init={})=>{
  calls.push({url:String(url),init});
  return new Response(JSON.stringify(String(url).endsWith('csrf/')?{csrf_token:'cancel-csrf'}:
   {task:{...dto,status:'cancelled',can_cancel:false}}),{headers:{'Content-Type':'application/json'}});
 }) as typeof fetch);
 assert.equal((await api.cancelAgentTask(id)).status,'cancelled');
 await api.revokePendingAgentTask(id);
 assert.equal(calls[1].init.body,'{"pending_only":false}');
 assert.equal(calls[2].init.body,'{}');
 for(const call of calls.slice(1)){
  assert.ok(call.url.endsWith('/'+id+'/cancel/'));
  assert.equal(call.init.method,'POST');assert.equal(call.init.credentials,'same-origin');
  assert.equal(new Headers(call.init.headers).get('X-CSRFToken'),'cancel-csrf');
 }
});

test('panel cancellation waits for server, blocks duplicates and updates drawer/history despite stale list',async()=>{
 const queued={...task,canCancel:true};
 const cancelled:AiTask={...queued,status:'cancelled',canCancel:false,updatedAt:'2026-10-27T12:00:01Z'};
 let posts=0,release!:(task:AiTask)=>void;
 const source={capabilities:async()=>({chat:true,memory_read:false}),
  history:async()=>({conversation_id:conv,next_before:null,messages:[messageA,{...messageB,tasks:[queued]}]}),
  agentTasks:async()=>({tasks:[queued],nextOffset:null}),
  cancelAgentTask:()=>{posts++;return new Promise<AiTask>(r=>{release=r;});},
 } as unknown as WorkspaceSource;
 const c=new LiveWorkspaceController(source,()=>assert.fail('Unexpected expiry'));
 try{
  await c.load();await c.refreshTasks();const pending=c.cancelTask(id);await c.cancelTask(id);
  assert.equal(posts,1);assert.equal(c.snapshot().cancellingTaskId,id);
  assert.equal(c.snapshot().agentTasks[0].status,'queued');
  release(cancelled);await pending;
  assert.equal(c.snapshot().agentTasks[0].status,'cancelled');
  assert.equal(c.snapshot().history.messages[1].tasks?.[0].status,'cancelled');
  await c.refreshTasks();assert.equal(c.snapshot().agentTasks[0].status,'cancelled');
  assert.equal(c.snapshot().cancellingTaskId,null);assert.equal(c.snapshot().tasksError,null);
 }finally{c.stop();}
});

test('cancel conflicts and lost responses reconcile canonical state without repeating the command',async()=>{
 for(const status of ['running','cancelled'] as const){
  let posts=0,gets=0;
  const current:AiTask={...task,status,canCancel:false,updatedAt:'2026-10-27T12:00:01Z'};
  const c=new LiveWorkspaceController({agentTasks:async()=>({tasks:[{...task,canCancel:true}],nextOffset:null}),
   cancelAgentTask:async()=>{posts++;throw status==='running'?new ApiError(409,'cancel_not_allowed','Conflict'):Error('Lost response');},
   agentTask:async()=>{gets++;return current;},
  } as unknown as WorkspaceSource,()=>assert.fail('Unexpected expiry'));
  try{
   await c.refreshTasks();await c.cancelTask(id);
   assert.equal(posts,1);assert.equal(gets,1);assert.equal(c.snapshot().agentTasks[0].status,status);
   assert.equal(c.snapshot().tasksError===null,status==='cancelled');
   await c.cancelTask(id);assert.equal(posts,1);
  }finally{c.stop();}
 }
});
