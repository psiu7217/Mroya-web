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
function render(section,allowed,extra={}){
 function Test(){const model=useDemoWorkspace('empty');return React.createElement(WorkspaceView,{model:{...model,activeSection:section,...extra.model, runtime:{features:{googleCalendar:extra.google??allowed,technicalDiagnostics:allowed,experimentalFeatures:allowed,reminders:extra.reminders??allowed}, pending:false,loading:false,busy:false,error:null,onRetry:noop,chatAvailable:true,memoryAvailable:true,calendarAvailable:true,remindersAvailable:false,memoriesTotal:0,hasOlder:false,onOlder:noop,hasMoreMemories:false,onMoreMemories:noop,truncated:false,notice:null,onCloseNotice:noop,onUnavailable:noop,onLogout:noop,preferenceSave:{status:'saved',error:null,onRetry:noop},onSaveNickname:noop,onClearNickname:noop}}});}
 return renderToStaticMarkup(React.createElement(Test));
}
test('public calendar and connections omit unfinished integrations',()=>{
 for(const section of ['calendar','connections']){const html=render(section,false);assert.doesNotMatch(html,/Google Calendar|Gmail|Coming soon|Upgrade/i);}
});
test('developer calendar retains Google integration entry',()=>{assert.match(render('calendar',true),/Google Calendar/);});

test('imported event cards remain readable, neutral, and hide reminder controls',()=>{
 const now=new Date(),date=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
 const event={id:'external',title:'Imported appointment',date,dayOfMonth:now.getDate(),time:'12:00',duration:'1h',category:'reminder',calendarSource:'google_work',sourceName:'Google Calendar · Private',syncStatus:'synced',isReadOnly:true};
 const html=render('calendar',false,{model:{events:[event]}});
 assert.match(html,/Imported appointment/);assert.match(html,/External/);
 assert.doesNotMatch(html,/Google Calendar|Google Contacts|Add reminder|Add Reminder|Coming soon|Synced|Edit commitment|Delete commitment/i);
 const admin=render('calendar',true,{model:{events:[event]}});
 assert.match(admin,/Google Calendar/);assert.match(admin,/Add reminder/i);
});
test('Google feature can be enabled without enabling reminder controls',()=>{
 const now=new Date(),date=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
 const event={id:'local',title:'Local event',date,dayOfMonth:now.getDate(),time:'12:00',duration:'1h',category:'meeting',calendarSource:'local'};
 const html=render('calendar',false,{google:true,reminders:false,model:{events:[event]}});
 assert.match(html,/Google Calendar/);assert.match(html,/Local event/);assert.doesNotMatch(html,/Add reminder|Add Reminder/i);
});
