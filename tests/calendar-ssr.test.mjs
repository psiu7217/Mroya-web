import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
const vite=await createServer({mode:'design',server:{middlewareMode:true},appType:'custom'});
after(()=>vite.close());
const {CalendarView}=await vite.ssrLoadModule('/src/components/CalendarView.tsx');
const noop=()=>{};
const props={events:[],memories:[],reminders:[],selectedEventId:null,onAddEvent:noop,onOpenMemory:noop,onOpenConnections:noop,onAddReminder:noop,onDeleteReminder:noop,onSimulateGoogleSync:noop,googleCalendarConnected:false,isSidebarCollapsed:false,onExpandSidebar:noop,onOpenMobileMenu:noop};
test('Production uses current civil date outside 2026 and has no false October labels',()=>{
 const OriginalDate=globalThis.Date;
 const now=new OriginalDate(2034,6,19,12);
 globalThis.Date=class extends OriginalDate {constructor(...args){super(...(args.length?args:[now.getTime()]));}static now(){return now.getTime();}};
 try{
  const html=renderToStaticMarkup(React.createElement(CalendarView,{...props,readOnly:true}));
  assert.match(html,/July 19, 2034/);assert.match(html,/>Today</);assert.doesNotMatch(html,/Oct|2026|2028/);
  assert.match(html,/disabled=""/);
  const design=renderToStaticMarkup(React.createElement(CalendarView,{...props,readOnly:false}));
  assert.match(design,/October 12, 2026/);assert.match(design,/Jump to today \(Oct 12\)/);
 }finally{globalThis.Date=OriginalDate;}
});
