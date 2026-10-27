import test from 'node:test';
import assert from 'node:assert/strict';
import {MroyaApi} from '../src/api/client.ts';
import {LiveWorkspaceController} from '../src/hooks/LiveWorkspaceController.ts';
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
