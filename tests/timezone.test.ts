import test from 'node:test';
import assert from 'node:assert/strict';
import {UserTimezoneStore} from '../src/hooks/useUserTimezone.ts';
import {browserTimezone,timezoneChoices} from '../src/utils/timezones.ts';
import {MroyaApi} from '../src/api/client.ts';
import {ApiError} from '../src/api/errors.ts';
import {LiveCalendarController} from '../src/hooks/useLiveCalendar.ts';
import type {WorkspaceSource} from '../src/types/source.ts';
import type {ApiUser} from '../src/types/api.ts';
import type {CalendarEventDto} from '../src/types/calendarApi.ts';
const user:ApiUser={id:7,username:'tester',email:'user@example.test',first_name:'',last_name:'',timezone:'',nickname:'',preferences:{theme:'system'}};
const source=(parts:Partial<WorkspaceSource>)=>({kind:'live',...parts}) as WorkspaceSource;
const tick=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
const gate=()=>{let resolve!:(value:any)=>void;const promise=new Promise<any>(r=>resolve=r);return {resolve,promise};};
const saved=(timezone:string)=>({...user,timezone});

test('browser discovery handles unavailable Intl; full catalog includes uncommon zones, UTC and manual aliases',()=>{
 assert.ok(browserTimezone());
 const original=Intl.DateTimeFormat;
 try{Intl.DateTimeFormat=(()=>{throw Error('unavailable');}) as any;assert.equal(browserTimezone(),null);}finally{Intl.DateTimeFormat=original;}
 const options=timezoneChoices('US/Eastern','Etc/GMT+12');assert.ok(options.some(zone=>zone.value==='UTC'));assert.ok(options.some(zone=>zone.value==='Pacific/Chatham'));assert.ok(options.some(zone=>zone.value==='US/Eastern'));assert.ok(options.some(zone=>zone.value==='Etc/GMT+12'));
});

test('missing backend port is explicit and issues no guessed HTTP or session requests',async()=>{
 let reads=0;const store=new UserTimezoneStore(source({session:async()=>{reads++;throw Error('must not read');}}),user,()=>{},()=> 'UTC');
 store.start();await tick();assert.equal(store.snapshot().apiReady,false);assert.equal(store.snapshot().status,'error');
 store.change('Europe/Moscow');assert.equal(store.snapshot().draft,'Europe/Moscow');assert.equal(store.snapshot().timezone,'');await store.retry();assert.equal(reads,0);assert.notEqual(store.snapshot().status,'saved');store.stop();
});

test('authenticated login and restored/new-account sessions initialize once; saved timezone reload does not initialize again',async()=>{
 for(const kind of ['password','google-created','restored']){
  let persisted=user,initializations=0;
  const api=new MroyaApi((async(input)=>new Response(JSON.stringify(String(input).includes('csrf')?{csrf_token:'token'}:String(input).includes('login')?{user,csrf_token:'token'}:{user:persisted}),{headers:{'Content-Type':'application/json'}})) as typeof fetch);
  const authenticated=kind==='password'?await api.login('tester','password'):(await api.me()).user;
  const transport={initializeIfUnset:async(zone:string)=>{initializations++;if(!persisted.timezone)persisted=saved(zone);return persisted;},save:async(zone:string)=>persisted=saved(zone)};
  const store=new UserTimezoneStore(source({timezone:transport}),authenticated,()=>{},()=> 'Pacific/Chatham');
  store.start();await tick();store.start();store.hydrate(authenticated);await tick();assert.equal(initializations,1);assert.equal(store.snapshot().timezone,'Pacific/Chatham');assert.equal(store.snapshot().status,'saved');store.stop();
  const reloaded=new UserTimezoneStore(source({timezone:transport}),(await api.me()).user,()=>{},()=>{throw Error('must not detect');});reloaded.start();await tick();assert.equal(initializations,1);assert.equal(reloaded.snapshot().timezone,'Pacific/Chatham');reloaded.stop();
 }
});

test('only-if-unset accepts another confirmed manual setting and never overwrites it automatically',async()=>{
 const store=new UserTimezoneStore(source({timezone:{initializeIfUnset:async()=>saved('Asia/Tokyo'),save:async()=>{throw Error('manual write must not run');}}}),user,()=>{},()=> 'Europe/Moscow');
 store.start();await tick();assert.equal(store.snapshot().timezone,'Asia/Tokyo');assert.equal(store.snapshot().draft,'Asia/Tokyo');store.stop();
});

test('manual selection during initialization survives its late response and is saved once after it',async()=>{
 const pending=gate(),writes:string[]=[];
 const store=new UserTimezoneStore(source({timezone:{initializeIfUnset:()=>pending.promise,save:async(zone)=>{writes.push(zone);return saved(zone);}}}),user,()=>{},()=> 'UTC');
 store.start();await tick();store.change('Europe/Moscow');assert.equal(store.snapshot().status,'saving');assert.equal(store.snapshot().timezone,'');
 pending.resolve(saved('UTC'));await tick();assert.deepEqual(writes,['Europe/Moscow']);assert.equal(store.snapshot().draft,'Europe/Moscow');assert.equal(store.snapshot().timezone,'Europe/Moscow');store.stop();
});

test('failed initialization retries only-if-unset, not a manual overwrite, and failed detection allows manual recovery',async()=>{
 let attempts=0,manuals=0;
 const transport={initializeIfUnset:async()=>{attempts++;if(attempts===1)throw Error('lost');return saved('Asia/Tokyo');},save:async(zone:string)=>{manuals++;return saved(zone);}};
 const store=new UserTimezoneStore(source({timezone:transport,session:async()=>({status:'authenticated',user})}),user,()=>{},()=> 'UTC');
 store.start();await tick();assert.equal(store.snapshot().status,'error');await store.retry();await tick();assert.equal(attempts,2);assert.equal(manuals,0);assert.equal(store.snapshot().timezone,'Asia/Tokyo');store.stop();
 const missing=new UserTimezoneStore(source({timezone:transport,session:async()=>({status:'authenticated',user})}),user,()=>{},()=>null);missing.start();await tick();assert.match(missing.snapshot().error!,/manually/);missing.change('US/Eastern');await missing.retry();await tick();assert.equal(missing.snapshot().timezone,'US/Eastern');missing.stop();
});

test('manual errors retain draft; Retry reconciles a lost response and no false Saved appears',async()=>{
 let persisted=saved('UTC'),writes=0,fail=true;
 const store=new UserTimezoneStore(source({session:async()=>({status:'authenticated',user:persisted}),timezone:{initializeIfUnset:async()=>persisted,save:async(zone)=>{writes++;if(fail){persisted=saved(zone);throw Error('response lost');}return persisted=saved(zone);}}}),persisted,()=>{});
 store.start();store.change('Asia/Tokyo');await tick();assert.equal(store.snapshot().status,'error');assert.equal(store.snapshot().draft,'Asia/Tokyo');assert.equal(store.snapshot().timezone,'UTC');
 await store.retry();await tick();assert.equal(writes,1);assert.equal(store.snapshot().status,'saved');assert.equal(store.snapshot().timezone,'Asia/Tokyo');
 fail=false;store.change('Europe/Moscow');store.change('Europe/Moscow');await tick();assert.equal(writes,2);assert.equal(store.snapshot().status,'saved');store.stop();
});

test('a wrong confirmation cannot show Saved; logout/account changes reject late replies and 401 expires normally',async()=>{
 const pending=gate();let expired=0;
 const store=new UserTimezoneStore(source({timezone:{initializeIfUnset:async()=>saved('UTC'),save:()=>pending.promise}}),saved('UTC'),()=>expired++);
 store.start();store.change('Asia/Tokyo');pending.resolve(saved('UTC'));await tick();assert.equal(store.snapshot().status,'error');assert.equal(store.snapshot().draft,'Asia/Tokyo');store.stop();
 const late=gate(),other=new UserTimezoneStore(source({timezone:{initializeIfUnset:()=>late.promise,save:async()=>user}}),user,()=>expired++,()=> 'UTC');other.start();await tick();other.stop();late.resolve(saved('UTC'));await tick();assert.equal(other.snapshot().timezone,'');
 const unauthorized=new UserTimezoneStore(source({timezone:{initializeIfUnset:async()=>{throw new ApiError(401,'authentication_required','Sign in');},save:async()=>user}}),user,()=>expired++,()=> 'UTC');unauthorized.start();await tick();assert.equal(expired,1);
});

test('StrictMode abandoned setup does not initialize twice',async()=>{
 let attempts=0;
 const store=new UserTimezoneStore(source({timezone:{initializeIfUnset:async()=>{attempts++;return saved('UTC');},save:async()=>user}}),user,()=>{},()=> 'UTC');
 store.start();store.stop();store.start();await tick();assert.equal(attempts,1);store.stop();
});

test('confirmed timezone changes affect only future calendar creates, preserving pending bodies and existing event timezone',async()=>{
 const rows:CalendarEventDto[]=[],writes:any[]=[],pending=gate();
 const calendarSource=source({calendarEvents:async()=>({events:rows,limit:100,offset:0}),mutateCalendar:async(method,id,body:any)=>{
  writes.push(structuredClone(body));if(writes.length===1)await pending.promise;
  const dto:CalendarEventDto={id:id??crypto.randomUUID(),version:1,title:body.event.title,date:body.event.date,description:'',location:'',time_kind:body.event.time_kind,start_time:body.event.start_time,end_date:null,end_time:null,timezone:body.event.timezone||null,utc_offset_minutes:null,event_type:'meeting',recurrence:body.event.recurrence??null,source:{kind:'local',read_only:false},edit_scope:body.event.recurrence?'series':'event'};
  rows.push(dto);return {status:'succeeded',events:[dto],operation_replayed:false};
 }});
 const event={title:'Appointment',date:'2026-10-19',dayOfMonth:19,time:'14:00',duration:'1h',category:'meeting' as const,notes:''};
 const controller=new LiveCalendarController(calendarSource,'',()=>{});controller.start(true,false);
 assert.equal(await controller.create(event),false);assert.match(controller.snapshot().error!,/timezone/);assert.equal(writes.length,0);
 const allDay=controller.create({...event,time:'All day'});controller.setTimezone('Europe/Moscow');assert.equal(await controller.create(event),false);pending.resolve(null);assert.equal(await allDay,true);assert.equal(writes[0].event.time_kind,'all_day');assert.equal(writes[0].event.timezone,'');
 assert.equal(await controller.create({...event,recurrence:{frequency:'weekly',weekdays:[1,4],interval:1}}),true);assert.equal(writes[1].event.timezone,'Europe/Moscow');assert.deepEqual(writes[1].event.recurrence.weekdays,['MO','TH']);
 const old=structuredClone(controller.snapshot().events);controller.setTimezone('Asia/Tokyo');assert.deepEqual(controller.snapshot().events,old);controller.stop();
 const reloaded=new LiveCalendarController(calendarSource,'Asia/Tokyo',()=>{});reloaded.start(true,false);await reloaded.loadEvents();assert.equal(reloaded.snapshot().events.length,2);assert.equal(reloaded.snapshot().events[1].api?.timezone,'Europe/Moscow');reloaded.stop();
});
