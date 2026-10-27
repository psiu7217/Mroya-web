import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
const vite=await createServer({server:{middlewareMode:true},appType:'custom'});
after(()=>vite.close());
const {TaskConfirmationView}=await vite.ssrLoadModule('/src/components/AiTaskConfirmationCard.tsx');
const {AiTasksDrawer}=await vite.ssrLoadModule('/src/components/AiTasksDrawer.tsx');
const task={id:'00000000-0000-4000-8000-000000000001',target:'memory',title:'Synthetic prepared intent',
 userPrompt:'Synthetic',status:'pending_confirmation',createdAt:'2026-10-27T12:00:00Z',updatedAt:'2026-10-27T12:00:00Z',confirmDeadlineAt:'2026-10-27T12:00:15Z'};
const html=props=>renderToStaticMarkup(React.createElement(TaskConfirmationView,{task,canApprove:true,canRevoke:true,...props}));
test('pending task has three actions and actual progress; an unarmed window disables all actions',()=>{
 const armed=html({remaining:12000});assert.match(armed,/width:20%/);
 assert.match(armed,/Send/);assert.match(armed,/Edit/);assert.match(armed,/Cancel/);
 assert.equal((armed.match(/<button/g)||[]).length,3);
 const unarmed=html({task:{...task,confirmDeadlineAt:undefined}});
 assert.equal((unarmed.match(/disabled=""/g)||[]).length,3);
});
test('successful revocation keeps the editor visible for a cancelled original and abandoning never revives it',()=>{
 const cancelled={...task,status:'cancelled'};
 const editing=html({task:cancelled,editing:true,comment:'Correct the owner'});
 assert.match(editing,/<textarea/);assert.match(editing,/Correct the owner/);
 assert.match(editing,/Discard edit/);assert.doesNotMatch(editing,/role="timer"/);
 const abandoned=html({task:cancelled,editing:false});
 assert.doesNotMatch(abandoned,/<textarea|<button/);assert.match(abandoned,/Cancelled/);
});
test('queue approval and clarification display honest canonical states rather than a saved result',()=>{
 const queued=html({task:{...task,status:'queued'}});assert.match(queued,/Queued/);assert.doesNotMatch(queued,/Completed|<button/);
 const partial=html({task:{...task,status:'needs_clarification',resultSummary:'One result confirmed; remaining action needs a date'}});
 assert.match(partial,/remaining action needs a date/);
});

test('drawer cancellation uses backend permission and cancelled rows leave Active but remain counted in Issues',()=>{
 const drawer=(row,props={})=>renderToStaticMarkup(React.createElement(AiTasksDrawer,
  {isOpen:true,onClose:()=>{},tasks:[row],onCancel:()=>{},...props}));
 for(const status of ['queued','needs_clarification']){
  assert.match(drawer({...task,status,canCancel:true}),/>Cancel<\/button>/);
  assert.doesNotMatch(drawer({...task,status,canCancel:false}),/>Cancel<\/button>/);
 }
 assert.match(drawer({...task,status:'queued',canCancel:true},{cancellingTaskId:task.id}),/disabled=""[^>]*>Cancelling/);
 for(const status of ['running','completed'])assert.doesNotMatch(drawer({...task,status,canCancel:true}),/>Cancel<\/button>/);
 const cancelled=drawer({...task,status:'cancelled',canCancel:false});
 assert.match(cancelled,/Активные \(0\)/);assert.match(cancelled,/Ошибки \(1\)/);
 assert.doesNotMatch(cancelled,/Synthetic prepared intent/);
});
