import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
const vite=await createServer({server:{middlewareMode:true},appType:'custom'});
after(()=>vite.close());
const {TaskConfirmationView}=await vite.ssrLoadModule('/src/components/AiTaskConfirmationCard.tsx');
const {AiTasksDrawer}=await vite.ssrLoadModule('/src/components/AiTasksDrawer.tsx');
const {needsTaskReview}=await vite.ssrLoadModule('/src/hooks/aiTaskPresentation.ts');
const {taskMessageText}=await vite.ssrLoadModule('/src/utils/taskMessage.ts');
const {ChatWorkspace}=await vite.ssrLoadModule('/src/components/ChatWorkspace.tsx');
const task={id:'00000000-0000-4000-8000-000000000001',target:'memory',title:'Synthetic prepared intent',
 userPrompt:'Synthetic',status:'pending_confirmation',createdAt:'2026-10-27T12:00:00Z',updatedAt:'2026-10-27T12:00:00Z',confirmDeadlineAt:'2026-10-27T12:00:15Z'};
const html=props=>renderToStaticMarkup(React.createElement(TaskConfirmationView,{task,canApprove:true,canRevoke:true,...props}));
test('pending task has three actions and actual progress; an unarmed window disables all actions',()=>{
 const armed=html({remaining:12000});assert.match(armed,/width:20%/);
 assert.match(armed,/>Save<\/button>/);assert.match(armed,/Edit/);assert.match(armed,/Cancel/);
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
 const queued=html({task:{...task,status:'queued'}});assert.match(queued,/Waiting to save/);assert.doesNotMatch(queued,/Saved to memory|<button/);
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
 assert.match(cancelled,/Active \(0\)/);assert.match(cancelled,/Issues \(1\)/);
 assert.doesNotMatch(cancelled,/Synthetic prepared intent/);
});

test('calendar study and memory save share the drawer without technical identifiers or Chat timer',()=>{
 for(const [taskKind,button] of [['calendar_review','Study'],['memory_proposal','Save']]){
  const markup=renderToStaticMarkup(React.createElement(AiTasksDrawer,{isOpen:true,onClose:()=>{},
   onDecision:async()=>true,tasks:[{...task,status:'awaiting_review',taskKind,reviewVersion:1,
    reviewActions:['accept','reject','comment'],confirmDeadlineAt:undefined,
    eventTitle:'Birthday',eventDate:'2026-11-14',facts:taskKind==='memory_proposal'?['Natasha: Birthday 14 November']:[]}]}));
  assert.match(markup,new RegExp('>'+button+'</button>'));
  assert.match(markup,/>Skip<\/button>/);assert.match(markup,new RegExp('>'+(taskKind==='calendar_review'?'Add context':'Correct')+'</button>'));
  assert.doesNotMatch(markup,new RegExp(task.id));assert.doesNotMatch(markup,/role="timer"|initial.filter|APPROVE|pipeline/);
  if(taskKind==='memory_proposal')assert.match(markup,/Natasha: Birthday 14 November/);
 }
});


test('compact chat retains one canonical card through every task state',()=>{
 assert.equal((html({compact:true,remaining:10000}).match(/<button/g)||[]).length,3);
 for(const status of ['queued','running','completed','failed','needs_clarification','cancelled'])
  {const markup=html({compact:true,task:{...task,status}});assert.match(markup,/Synthetic prepared intent/);assert.doesNotMatch(markup,/<button|role="timer"/);}
 assert.match(html({compact:true,task:{...task,status:'cancelled'},editing:true}),/<textarea/);
});

test('proposal and canonical completion retain exact review values without a second completion description',()=>{
 const row={...task,review:['Remember: You · Preference: Solaris','Remember: You · Frequency: every month']};
 const pending=html({task:row,remaining:13000});
 assert.match(pending,/Solaris/);assert.match(pending,/every month/);assert.match(pending,/Ready to save/);
 const saved=html({task:{...row,status:'completed',resultSummary:'Memory changes saved: 2. Synthetic prepared intent'}});
 assert.match(saved,/Saved to memory/);assert.match(saved,/Solaris/);
 assert.doesNotMatch(saved,/Memory changes saved:|<button|role="timer"/);
 assert.equal((saved.match(/Synthetic prepared intent/g)||[]).length,1);
 assert.equal((saved.match(/data-task-id=/g)||[]).length,1);
 assert.equal(taskMessageText([row]),[row.title,...row.review].join('\n'));
});

function chat(row,technical=false,status='completed',completedTask=null){
 const noop=()=>{};
 const conversation={id:'chat',title:'Chat',messages:[{id:'answer',sender:'assistant',status,timestamp:'12:00',
  content:'LEGACY_TECHNICAL_RESPONSE self obj:private',tasks:row?[row]:undefined,
  timeline:[{kind:'reasoning',id:'reasoning',sequence:1,turnNumber:1,text:'Model reasoning marker'},
   {kind:'tool',id:'tool',sequence:2,toolKind:'task_registered',toolName:'submit_memory_changes',title:'Registered task marker',status:'success'}]}]};
 return renderToStaticMarkup(React.createElement(ChatWorkspace,{
  live:true,showModelReasoning:technical,account:{displayName:'Example',initials:'EX',email:'',description:'',timezone:'UTC',spaceDescription:''},
  aiTasks:{tasks:row?[row]:[],completedTask,onOpen:noop,onDismiss:noop},
  conversation,memoriesCount:0,onSendMessage:noop,onCitationClick:noop,onActionClick:noop,addedActionIds:[],
  isSidebarCollapsed:false,onExpandSidebar:noop,onOpenMobileMenu:noop,isContextPanelOpen:false,
  onToggleContextPanel:noop,plan:'free',onTogglePlan:noop,onOpenPlanModal:noop,theme:'dark',onToggleTheme:noop,
 }));
}

test('the chat renders one task card instead of a duplicate technical answer in both reasoning modes',()=>{
 for(const technical of [false,true]){
  const markup=chat({...task,review:['Remember: exact proposed value']},technical);
  assert.equal((markup.match(/data-task-id=/g)||[]).length,1);
  assert.equal((markup.match(/Synthetic prepared intent/g)||[]).length,1);
  assert.match(markup,/exact proposed value/);assert.doesNotMatch(markup,/LEGACY_TECHNICAL_RESPONSE|obj:private/);
  assert.doesNotMatch(markup,/Registered task marker/);
  if(technical)assert.match(markup,/Model reasoning marker/);
 }
 // Without canonical receipts the ordinary answer must remain visible.
 assert.match(chat(null),/LEGACY_TECHNICAL_RESPONSE/);
 const legacy=chat(task);
 assert.equal((legacy.match(/data-task-id=/g)||[]).length,1);
 assert.match(legacy,/<details open=""/);assert.match(legacy,/Original confirmation/);
 assert.match(legacy,/LEGACY_TECHNICAL_RESPONSE/);
 // A failed turn can still have accepted work: retain both the error and its receipt.
 assert.match(chat(task,false,'failed'),/data-task-id=/);
 assert.match(chat(task,false,'failed'),/reply failed|couldn.t complete|could not complete/i);
});

test('a completed receipt updates its visible card without a duplicate completion toast',()=>{
 const done={...task,status:'completed',review:['Remember: exact value']};
 assert.doesNotMatch(chat(done,true,'completed',done),/<aside/);
 assert.match(chat(done,true,'completed',{...done,id:'another-task'}),/<aside/);
});

test('review text is escaped and raw task error codes are not used as user copy',()=>{
 const markup=html({task:{...task,review:['<script>bad()</script>'],status:'failed',errorMessage:'private_internal_error'}});
 assert.match(markup,/&lt;script&gt;/);assert.doesNotMatch(markup,/<script>|private_internal_error/);
 assert.match(markup,/Could not save to memory|could not be confirmed/);
});
test('incomplete chat task offers a report without an unsafe retry',()=>{
 const markup=renderToStaticMarkup(React.createElement(AiTasksDrawer,{isOpen:true,onClose(){},onReport:async()=>{},
  tasks:[{...task,taskKind:'chat',status:'needs_clarification',errorMessage:'execution_incomplete'}]}));
 assert.match(markup,/Active \(0\)/);assert.match(markup,/Issues \(1\)/);assert.doesNotMatch(markup,/>Retry<|execution_incomplete/);
 for(const errorMessage of ['execution_incomplete','partial_execution','mutation_receipt_invalid','final_disposition_invalid','other_technical_error'])
  assert.equal(needsTaskReview({...task,taskKind:'chat',status:'needs_clarification',errorMessage}),true);
 assert.equal(needsTaskReview({...task,taskKind:'chat',status:'needs_clarification',errorMessage:'clarification_required'}),false);
 const clarification=renderToStaticMarkup(React.createElement(AiTasksDrawer,{isOpen:true,onClose(){},tasks:[{...task,taskKind:'chat',status:'needs_clarification',errorMessage:'clarification_required'}]}));
 assert.match(clarification,/Active \(1\)/);assert.match(clarification,/Replies to this task/);assert.doesNotMatch(clarification,/>Answer<\/button>/);
});

test('explicit confirmation remains enabled without a countdown or automatic execution claim',()=>{
 const explicit=html({task:{...task,confirmationMode:'explicit',confirmDeadlineAt:undefined}});
 assert.doesNotMatch(explicit,/disabled=""|role="timer"|queued automatically/);
 assert.match(explicit,/will not be saved without your confirmation/);
});
