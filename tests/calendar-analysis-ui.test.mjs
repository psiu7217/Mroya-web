import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
const vite=await createServer({server:{middlewareMode:true},appType:'custom'});after(()=>vite.close());
const {CalendarAnalysisPanel}=await vite.ssrLoadModule('/src/components/CalendarAnalysisPanel.tsx');
const {setAppLanguage}=await vite.ssrLoadModule('/src/i18n/index.ts');
const id='00000000-0000-4000-8000-000000000002';
const calendar={calendar_id:id,name:'Odysseus',version:1,status:'errors',total:47,checked:0,suitable:0,errors:47,stopped:0,remaining:0,progress:100,can_retry:true,can_stop:false};
const props={calendars:[calendar],expanded:[],events:{},loading:false,error:null,busyCalendar:null,onRefresh:()=>{},onToggle:()=>{},onMore:()=>{},onStop:()=>{},onRetry:()=>{}};
const html=overrides=>renderToStaticMarkup(React.createElement(CalendarAnalysisPanel,{analysis:{...props,...overrides}}));
test('closed accordion shows error count and real actions in RU/EN without developer diagnostics',()=>{
 setAppLanguage('en');const en=html({});assert.match(en,/aria-expanded="false"/);assert.match(en,/Errors: 47/);assert.match(en,/Retry errors/);
 assert.doesNotMatch(en,/Synthetic event|mammoth|HTTP|pipeline|initial_filter|probability/);
 setAppLanguage('ru');const ru=html({});assert.match(ru,/Анализ событий для памяти/);assert.match(ru,/Ошибок: 47/);assert.match(ru,/Повторить ошибки/);
 setAppLanguage('en');
});
test('empty calendar has honest empty copy; expanded stopped request explains in-flight fencing',()=>{
 const empty=html({calendars:[{...calendar,total:0,errors:0,progress:0,status:'empty',can_retry:false}]});assert.match(empty,/No events to analyse/);assert.doesNotMatch(empty,/role="progressbar"/);
 const stopping=html({calendars:[{...calendar,status:'stopping',remaining:1,errors:46}],expanded:[id],events:{[id]:{rows:[{id:'internal-job-id',title:'Synthetic event',date:'2026-11-14',status:'stopping',can_retry:false}],next:null,loading:false,error:false}}});
 assert.match(stopping,/request already sent may finish/);assert.match(stopping,/Synthetic event/);assert.doesNotMatch(stopping,/internal-job-id/);
});
