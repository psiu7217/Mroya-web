import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
const vite=await createServer({mode:'design',server:{middlewareMode:true},appType:'custom'});
const {useDemoWorkspace}=await vite.ssrLoadModule('/src/demo/useDemoWorkspace.ts');
const {WorkspaceView}=await vite.ssrLoadModule('/src/pages/WorkspaceView.tsx');
after(()=>vite.close());
const noop=()=>{};
function render(section,allowed){
 function Test(){const model=useDemoWorkspace('empty');return React.createElement(WorkspaceView,{model:{...model,activeSection:section, runtime:{features:{googleCalendar:allowed,technicalDiagnostics:allowed,experimentalFeatures:allowed}, pending:false,loading:false,busy:false,error:null,onRetry:noop,chatAvailable:true,memoryAvailable:true,calendarAvailable:true,remindersAvailable:false,memoriesTotal:0,hasOlder:false,onOlder:noop,hasMoreMemories:false,onMoreMemories:noop,truncated:false,notice:null,onCloseNotice:noop,onUnavailable:noop,onLogout:noop,preferenceSave:{status:'saved',error:null,onRetry:noop},onSaveNickname:noop,onClearNickname:noop}}});}
 return renderToStaticMarkup(React.createElement(Test));
}
test('public calendar and connections omit unfinished integrations',()=>{
 for(const section of ['calendar','connections']){const html=render(section,false);assert.doesNotMatch(html,/Google Calendar|Gmail|Coming soon|Upgrade/i);}
});
test('developer calendar retains Google integration entry',()=>{assert.match(render('calendar',true),/Google Calendar/);});
