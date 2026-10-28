import test from 'node:test';
import assert from 'node:assert/strict';
import {readAiTask,newerTask} from '../src/api/aiTasks.ts';
import {MroyaApi} from '../src/api/client.ts';
import {LiveWorkspaceController} from '../src/hooks/LiveWorkspaceController.ts';
import {ApiError} from '../src/api/errors.ts';
import type {WorkspaceSource} from '../src/types/source.ts';
import type {AiTask} from '../src/types/aiTasks.ts';
const id='00000000-0000-4000-8000-000000000001';
const dto={id,type:'calendar',description:'Birthday',status:'awaiting_review',created_at:'2026-10-28T12:00:00Z',updated_at:'2026-10-28T12:00:00Z',result:null,error_code:null,task_kind:'calendar_review',version:1,actions:['accept','reject','comment'],event_date:'2026-11-14',facts:[],result_code:null};

test('review DTO has no Chat timer; malformed dates/actions cannot break the drawer',()=>{
 const row=readAiTask(dto);assert.equal(row.confirmDeadlineAt,undefined);assert.equal(row.reviewVersion,1);
 for(const patch of [{event_date:'bad'},{actions:['execute']},{version:true},{task_kind:'chat'}])assert.throws(()=>readAiTask({...dto,...patch}));
 const newer={...row,status:'queued' as const,updatedAt:'2026-10-28T12:00:01Z'};
 assert.equal(newerTask(newer,row).status,'queued');
 assert.equal(newerTask({...row,status:'failed',reviewActions:[]},row).status,'awaiting_review');
 assert.equal(newerTask({...row,reviewVersion:2},row).reviewVersion,2);
});

test('comment approval uses existing CSRF client and structured versioned endpoint',async()=>{
 const calls:{url:string;init:RequestInit}[]=[];
 const api=new MroyaApi((async(url,init={})=>{calls.push({url:String(url),init});return new Response(JSON.stringify(String(url).endsWith('csrf/')?{csrf_token:'synthetic'}:{task:{...dto,status:'queued',version:2,actions:[]}}),{headers:{'Content-Type':'application/json'}});}) as typeof fetch);
 assert.equal((await api.decideAiTask(id,'comment',1,'My sister')).status,'queued');
 assert.equal(calls.length,2);const post=calls[1];assert.equal(post.url,`/api/v1/ai-tasks/${id}/decision/`);
 assert.equal((post.init.headers as Record<string,string>)['X-CSRFToken'],'synthetic');
 const body=JSON.parse(post.init.body as string);assert.equal(body.comment,'My sister');assert.equal(body.version,1);assert.ok(body.request_id);
});

test('decision blocks repeat clicks, keeps canonical state, and reconciles conflict without another POST',async()=>{
 let row=readAiTask(dto),posts=0,resolve!:(row:AiTask)=>void,conflict=false;
 const source={agentTasks:async()=>({tasks:[row],nextOffset:null}),agentTask:async()=>row,
 decideAiTask:async()=>{posts++;if(conflict)throw new ApiError(409,'task_state_changed','changed');return new Promise<AiTask>(r=>{resolve=r;});}} as unknown as WorkspaceSource;
 const controller=new LiveWorkspaceController(source,()=>assert.fail('Session expired'));
 try{
 await controller.refreshTasks();const pending=controller.decideTask(id,'accept');await controller.decideTask(id,'accept');
 assert.equal(posts,1);assert.equal(controller.snapshot().agentTasks[0].status,'awaiting_review');
 row={...row,status:'queued',updatedAt:'2026-10-28T12:00:01Z',reviewVersion:2,reviewActions:[]};resolve(row);assert.equal(await pending,true);
 assert.equal(controller.snapshot().agentTasks[0].status,'queued');
 row={...readAiTask(dto),reviewVersion:3,updatedAt:'2026-10-28T12:00:02Z'};await controller.refreshTasks();conflict=true;
 const attempt=controller.decideTask(id,'reject');row={...row,status:'cancelled',reviewVersion:4,updatedAt:'2026-10-28T12:00:03Z',reviewActions:[]};
 assert.equal(await attempt,false);assert.equal(posts,2);assert.equal(controller.snapshot().agentTasks[0].status,'cancelled');
 assert.ok(controller.snapshot().tasksError);
 }finally{controller.stop();}
});
