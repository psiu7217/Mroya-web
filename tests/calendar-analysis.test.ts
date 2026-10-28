import test from 'node:test';
import assert from 'node:assert/strict';
import {MroyaApi} from '../src/api/client.ts';
import {readCalendarAnalysis,readAnalysisEvents} from '../src/api/calendarAnalysis.ts';
import {CalendarAnalysisController} from '../src/hooks/CalendarAnalysisController.ts';
import {ApiError} from '../src/api/errors.ts';
import type {CalendarAnalysis} from '../src/types/calendarAnalysis.ts';
import type {WorkspaceSource} from '../src/types/source.ts';
const connection='00000000-0000-4000-8000-000000000001',id='00000000-0000-4000-8000-000000000002',job='00000000-0000-4000-8000-000000000003';
const row:CalendarAnalysis={calendar_id:id,name:'Synthetic calendar',version:1,status:'errors',total:47,checked:0,suitable:0,errors:47,stopped:0,remaining:0,progress:100,can_stop:false,can_retry:true};
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));

test('owned analysis client validates counts and sends explicit versioned actions with CSRF once',async()=>{
 const calls:{url:string;init:RequestInit}[]=[];
 const api=new MroyaApi((async(url,init={})=>{calls.push({url:String(url),init});return new Response(JSON.stringify(String(url).endsWith('/csrf/')?{csrf_token:'synthetic'}:String(url).includes('/retry/')?{calendar:{...row,version:2,status:'running',errors:46,remaining:1}}:{calendars:[row]}),{headers:{'Content-Type':'application/json'}});}) as typeof fetch);
 assert.equal((await api.calendarAnalyses(connection))[0].errors,47);
 await api.controlCalendarAnalysis(id,'retry',1,job);
 assert.equal(calls.length,3);assert.ok(calls[2].url.endsWith(`/calendars/${id}/analysis/retry/`));
 assert.equal(calls[2].init.method,'POST');assert.deepEqual(JSON.parse(calls[2].init.body as string),{version:1,job_id:job});
 assert.equal((calls[2].init.headers as Record<string,string>)['X-CSRFToken'],'synthetic');
 assert.throws(()=>readCalendarAnalysis({...row,checked:48}));
 assert.throws(()=>readAnalysisEvents({calendar:row,events:[{id:job,title:'Synthetic',date:'bad',status:'error',can_retry:true}],next_offset:null},id,0));
});

test('accordion is closed by default, opens real event GET, and stops all polling on scope change',async()=>{
 let eventGets=0;
 const controller=new CalendarAnalysisController({kind:'live',calendarAnalyses:async()=>[row],calendarAnalysisEvents:async()=>{eventGets++;return {calendar:row,events:[{id:job,title:'Synthetic event',date:'2026-11-14',status:'error',can_retry:true}],next_offset:null};}} as unknown as WorkspaceSource,()=>assert.fail('Expired'));
 try{
  controller.setContext(connection,true);await tick();assert.equal(controller.snapshot().calendars[0].errors,47);
  assert.deepEqual(controller.snapshot().expanded,[]);assert.equal(eventGets,0);
  controller.toggle(id);await tick();assert.equal(eventGets,1);assert.equal(controller.snapshot().events[id].rows[0].id,job);
  controller.setContext('00000000-0000-4000-8000-000000000004',false);
  assert.deepEqual(controller.snapshot().expanded,[]);assert.deepEqual(controller.snapshot().calendars,[]);
 }finally{controller.stop();}
});

test('duplicate clicks post once, lost responses reconcile without repeating, and stale reads cannot regress version',async()=>{
 let current={...row},posts=0,release!:(row:CalendarAnalysis)=>void,conflict=false;
 const controller=new CalendarAnalysisController({kind:'live',calendarAnalyses:async()=>[current],controlCalendarAnalysis:async()=>{posts++;if(conflict)throw new ApiError(409,'analysis_state_changed','Synthetic conflict');return new Promise<CalendarAnalysis>(resolve=>{release=resolve;});}} as unknown as WorkspaceSource,()=>assert.fail('Expired'));
 try{
  controller.setContext(connection,true);await tick();
  const action=controller.action(id,'retry',job);await controller.action(id,'retry',job);assert.equal(posts,1);
  assert.equal(controller.snapshot().calendars[0].status,'errors');
  const updated={...row,version:2,status:'running' as const,errors:46,remaining:1,can_stop:true};
  release(updated);await action;await tick();assert.equal(controller.snapshot().calendars[0].version,2);
  current=updated;conflict=true;await controller.action(id,'stop');await tick();
  assert.equal(posts,2);assert.equal(controller.snapshot().error,'conflict');assert.equal(controller.snapshot().calendars[0].status,'running');
 }finally{controller.stop();}
});

test('an obsolete account request cannot deliver after stop',async()=>{
 let release!:(rows:CalendarAnalysis[])=>void;
 const controller=new CalendarAnalysisController({kind:'live',calendarAnalyses:()=>new Promise<CalendarAnalysis[]>(resolve=>{release=resolve;})} as unknown as WorkspaceSource,()=>assert.fail('Expired'));
 controller.setContext(connection,true);controller.stop();release([row]);await tick();
 assert.deepEqual(controller.snapshot().calendars,[]);
});
