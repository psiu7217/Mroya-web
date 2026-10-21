import test from 'node:test';
import assert from 'node:assert/strict';
import {LiveCalendarController} from '../src/hooks/useLiveCalendar.ts';
import {calendarPresentation} from '../src/hooks/calendarAdapters.ts';
import {upcomingCalendarEvents,calendarInstant,dateInTimezone} from '../src/utils/upcomingCalendar.ts';
import {maskCalendarTime,calendarTimeError} from '../src/utils/calendarInput.ts';
import type {CalendarEventDto} from '../src/types/calendarApi.ts';
import type {WorkspaceSource} from '../src/types/source.ts';
const event=(id:string,date:string,time='12:00'):CalendarEventDto=>({id,version:1,title:id,description:'',location:'',date,time_kind:time==='All day'?'all_day':'exact',start_time:time==='All day'?null:time,end_date:null,end_time:null,timezone:time==='All day'?'':'Europe/Minsk',utc_offset_minutes:null,event_type:'meeting',recurrence:null,source:{kind:'local',read_only:false},edit_scope:'event'});
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const gate=()=>{let resolve!:(value:any)=>void;const promise=new Promise<any>(r=>resolve=r);return {promise,resolve};};

test('mask accepts typing/paste/backspace and validators reject incomplete and out-of-range exact times',()=>{
 for(const [input,expected] of [['1630','16:30'],['09:45','09:45'],['a1x6:30!','16:30'],['123456','12:34'],['16:3','16:3'],['16:','16'],['','']])assert.equal(maskCalendarTime(input),expected);
 for(const good of ['00:00','23:59','09:45','All day'])assert.equal(calendarTimeError(good),null);
 for(const bad of ['24:00','18:75','1','12:','12:3','1230',''])assert.ok(calendarTimeError(bad));
});

test('upcoming excludes past instants and earlier selected dates, sorts five, handles all-day/Google/occurrence IDs without expansion',()=>{
 const dtos=[event('past','2027-11-22','08:00'),event('old','2027-11-08'),event('z','2027-12-04'),event('all','2027-11-22','All day'),event('b','2027-11-23'),event('a','2027-11-22','16:30'),event('c','2027-11-24'),event('d','2027-11-25')];
 dtos[4].source={kind:'google',read_only:true};dtos[6]={...dtos[6],is_occurrence:true,occurrence_id:'series@2027-11-24',series_id:'series',recurrence:{frequency:'daily',interval:1}};
 const now=new Date('2027-11-22T09:00:00Z'),rows=dtos.map(calendarPresentation);
 assert.deepEqual(upcomingCalendarEvents(rows,'2027-11-22','Europe/Minsk',now).map(e=>e.id),['all','a','b','series@2027-11-24','d']);
 assert.deepEqual(upcomingCalendarEvents(rows,'2027-12-01','Europe/Minsk',now).map(e=>e.id),['z']);assert.equal(rows.length,8);
 assert.equal(dateInTimezone(new Date('2027-11-21T22:30Z'),'Europe/Minsk'),'2027-11-22');
 assert.equal(calendarInstant('2027-03-29','09:00','Europe/Berlin'),Date.parse('2027-03-29T07:00Z'));
 const far=calendarPresentation({...event('far','2027-11-20','23:59'),timezone:'Etc/GMT+12'});
 assert.equal(upcomingCalendarEvents([far],'2027-11-22','Pacific/Kiritimati',new Date('2027-11-21T10:30Z'))[0]?.id,'far');
});

test('separate paginated horizon loads December after November 22 without changing visible grid; refresh/CRUD rehydrate it',async()=>{
 const calls:any[]=[];let rows=[event('november-old','2027-11-08'),event('december','2027-12-02')];
 const source={kind:'live',calendarEvents:async(start,end,offset=0)=>{calls.push({start,end,offset});return {events:rows.filter(e=>e.date>=start&&e.date<=end),limit:100,offset};},mutateCalendar:async()=>{rows=[...rows,event('created','2027-11-25')];return {status:'succeeded',events:[rows.at(-1)!],operation_replayed:false};}} satisfies Partial<WorkspaceSource> as unknown as WorkspaceSource;
 const c=new LiveCalendarController(source,'Europe/Minsk',()=>{});c.setRange('2027-11-01','2027-11-30');c.setUpcomingStart('2027-11-22');c.start(true,false);await c.loadEvents();await settle();
 assert.deepEqual(c.snapshot().events.map(e=>e.id),['november-old']);assert.deepEqual(c.snapshot().upcomingEvents.map(e=>e.id),['december']);
 assert.ok(calls.some(q=>q.start==='2027-11-20'&&q.end>'2027-12-31'));
 await c.create({title:'Created',date:'2027-11-25',dayOfMonth:25,time:'12:00',duration:'1h',category:'meeting',notes:''});await settle();assert.deepEqual(c.snapshot().upcomingEvents.map(e=>e.id),['created','december']);
 rows=[event('synced','2027-12-01')];await c.loadEvents();await settle();assert.deepEqual(c.snapshot().upcomingEvents.map(e=>e.id),['synced']);
 const reloaded=new LiveCalendarController(source,'Europe/Minsk',()=>{});reloaded.setUpcomingStart('2027-11-22');reloaded.start(true,false);await reloaded.loadUpcoming();assert.deepEqual(reloaded.snapshot().upcomingEvents.map(e=>e.id),['synced']);c.stop();reloaded.stop();
});

test('upcoming pagination deduplicates UUID occurrences, stays independent of grid pages and returns at most five',async()=>{
 const offsets:number[]=[];const source={kind:'live',calendarEvents:async(_start,_end,offset)=>{offsets.push(offset!);return {offset:offset!,limit:100,events:offset===0?Array.from({length:100},(_,i)=>event('past'+i,'2027-11-20')):Array.from({length:8},(_,i)=>event('future'+i,'2027-12-'+String(i+1).padStart(2,'0')))};}} satisfies Partial<WorkspaceSource> as unknown as WorkspaceSource;
 const c=new LiveCalendarController(source,'UTC',()=>{});c.setUpcomingStart('2027-11-22');c.start(true,false);await c.loadUpcoming();assert.deepEqual(offsets,[0,100]);assert.equal(c.snapshot().events.length,0);assert.equal(c.snapshot().upcomingEvents.length,5);assert.equal(c.snapshot().upcomingEvents[0].id,'future0');c.stop();
});

test('new selected date, logout and account replacement fence late horizon responses; errors stay isolated and retryable',async()=>{
 const wait=gate();let count=0,aborted:AbortSignal|undefined;
 const source={kind:'live',calendarEvents:async(_s,_e,offset=0,signal)=>{if(++count===1){aborted=signal;return wait.promise;}return {events:[event('new','2028-02-02')],limit:100,offset};}} satisfies Partial<WorkspaceSource> as unknown as WorkspaceSource;
 const c=new LiveCalendarController(source,'UTC',()=>{});c.setUpcomingStart('2027-11-22');c.start(true,false);const old=c.loadUpcoming();c.setUpcomingStart('2028-02-01');await settle();assert.equal(aborted?.aborted,true);wait.resolve({events:[event('old','2027-12-01')],limit:100,offset:0});await old;assert.equal(c.snapshot().upcomingEvents[0].id,'new');c.stop();assert.equal(c.snapshot().upcomingEvents.length,0);
 let fail=true;const retry=new LiveCalendarController({kind:'live',calendarEvents:async()=>{if(fail)throw new Error('Synthetic offline');return {events:[],limit:100,offset:0};}} satisfies Partial<WorkspaceSource> as unknown as WorkspaceSource,'UTC',()=>{});retry.start(true,false);await retry.loadUpcoming();assert.match(retry.snapshot().upcomingError!,/offline/);assert.equal(retry.snapshot().error,null);fail=false;await retry.loadUpcoming();assert.equal(retry.snapshot().upcomingError,null);retry.stop();
});
