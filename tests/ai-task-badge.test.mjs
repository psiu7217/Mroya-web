import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';

const vite=await createServer({mode:'design',server:{middlewareMode:true,hmr:false},appType:'custom'});
after(()=>vite.close());
const {countsTowardTaskBadge}=await vite.ssrLoadModule('/src/hooks/aiTaskPresentation.ts');
const {readAiTask}=await vite.ssrLoadModule('/src/api/aiTasks.ts');
const {WorkspaceView}=await vite.ssrLoadModule('/src/pages/WorkspaceView.tsx');
const {useDemoWorkspace}=await vite.ssrLoadModule('/src/demo/useDemoWorkspace.ts');
const {setAppLanguage}=await vite.ssrLoadModule('/src/i18n/index.ts');
setAppLanguage('en');
const base={id:'00000000-0000-4000-8000-000000000001',type:'calendar',task_kind:'chat',
 description:'Synthetic task',status:'needs_clarification',created_at:'2026-11-17T12:00:00Z',
 updated_at:'2026-11-17T12:00:00Z',result:'Completion unconfirmed',error_code:'partial_execution',can_cancel:false};
const task=readAiTask(base);

test('report-only issues do not count, with or without task_kind or an error code',()=>{
 for(const errorMessage of ['partial_execution','completion_unconfirmed','clarification_required',undefined])
  for(const taskKind of ['chat',undefined])
   assert.equal(countsTowardTaskBadge({...task,taskKind,errorMessage}),false);
 for(const status of ['failed','cancelled','completed'])
  assert.equal(countsTowardTaskBadge({...task,status,canRetry:true}),false);
});

test('ongoing work and explicit, supported decisions count',()=>{
 for(const status of ['pending_confirmation','queued','running'])
  assert.equal(countsTowardTaskBadge({...task,status}),true);
 const review={...task,taskKind:'memory_proposal',status:'awaiting_review'};
 for(const reviewActions of [['accept'],['reject'],['comment']])
  assert.equal(countsTowardTaskBadge({...review,reviewActions}),true);
 assert.equal(countsTowardTaskBadge({...review,reviewActions:[]}),false);
 assert.equal(countsTowardTaskBadge({...review,reviewActions:['accept'],needsClarification:true}),false);
 assert.equal(countsTowardTaskBadge({...review,reviewActions:['comment'],needsClarification:true}),true);
 assert.equal(countsTowardTaskBadge({...task,canCancel:true}),true);
 for(const status of ['failed','cancelled']){
  assert.equal(countsTowardTaskBadge({...review,status,reviewActions:['retry']}),true);
  assert.equal(countsTowardTaskBadge({...review,status,reviewActions:[]}),false);
 }
 assert.equal(countsTowardTaskBadge({...review,status:'completed',reviewActions:['retry'],canCancel:true}),false);
});

function render(tasks){
 function App(){
  const model=useDemoWorkspace('empty');
  return React.createElement(WorkspaceView,{model:{...model,aiTasks:{...model.aiTasks,tasks}}});
 }
 return renderToStaticMarkup(React.createElement(App));
}
function taskTriggers(html){
 return [...html.matchAll(/<button\b[^>]*title="AI tasks \((\d+)\)"[^>]*>(.*?)<\/button>/gs)];
}
function sidebarTask(html){
 return html.slice(0,html.indexOf('<main')).match(/<button\b[^>]*>(?:(?!<\/button>).)*>AI tasks<(?:(?!<\/button>).)*<\/button>/s)?.[0];
}

test('the two stuck issues produce no desktop/mobile or sidebar badge; ongoing work and decisions still count',()=>{
 const issues=[task,{...task,id:'00000000-0000-4000-8000-000000000002',errorMessage:'completion_unconfirmed'}];
 const empty=render(issues),triggers=taskTriggers(empty);
 assert.equal(triggers.length,2);
 for(const trigger of triggers){assert.equal(trigger[1],'0');assert.doesNotMatch(trigger[2],/<span[^>]*>\s*\d+\s*<\/span>/);}
 assert.ok(sidebarTask(empty));assert.doesNotMatch(sidebarTask(empty),/<span[^>]*>\s*\d+\s*<\/span>/);
 const active=[{...task,status:'running'},{...task,status:'pending_confirmation'},
  {...task,taskKind:'memory_proposal',status:'awaiting_review',reviewActions:['comment'],needsClarification:true},
  {...task,taskKind:'calendar_review',status:'failed',reviewActions:['retry']}].map((row,i)=>({...row,id:`active-${i}`}));
 const mixed=render([...issues,...active]);
 for(const trigger of taskTriggers(mixed)){assert.equal(trigger[1],'4');assert.match(trigger[2],/>\s*4\s*<\/span>/);}
 assert.match(sidebarTask(mixed),/>\s*4\s*<\/span>/);
});
