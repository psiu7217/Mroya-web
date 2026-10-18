import test from 'node:test';
import assert from 'node:assert/strict';
import {MroyaApi} from '../src/api/client.ts';
import {ApiError} from '../src/api/errors.ts';
import {readCalendarEvent} from '../src/api/calendar.ts';
import {calendarPresentation,calendarWrite,recurrenceFromApi,recurrenceToApi,googleSyncPresentation} from '../src/hooks/calendarAdapters.ts';
import {LiveCalendarController,consumeCalendarOAuthReturn} from '../src/hooks/useLiveCalendar.ts';
import type {WorkspaceSource} from '../src/types/source.ts';
import type {CalendarEventDto,GoogleConnectionDto} from '../src/types/calendarApi.ts';
const id='00000000-0000-4000-8000-000000000001',connectionId='00000000-0000-4000-8000-000000000002';
const event:CalendarEventDto={id,version:3,title:'Planning',description:'Notes',location:'Office',date:'2026-10-19',time_kind:'exact',start_time:'14:00',end_date:null,end_time:null,timezone:'Europe/Moscow',utc_offset_minutes:180,event_type:'meeting',recurrence:null,source:{kind:'local',read_only:false},edit_scope:'event'};
const connection:GoogleConnectionDto={id:connectionId,provider:'google',email:'calendar@example.test',status:'connected',sync_enabled:false,sync_requested:false,sync_status:'succeeded',error_code:'',initial_synced_at:'2026-10-19T10:00:00Z',last_synced_at:'2026-10-19T10:00:00Z',next_retry_at:null,retry_attempts:0,jobs:{pending:0,retry:0,synced:2,error:0,conflict:0},calendars:[{id,name:'Primary',selected:true,available:true,read_only:false,is_primary:true,export_destination:true,sync_status:'succeeded',error_code:'',last_synced_at:'2026-10-19T10:00:00Z'}]};
const source=(parts:Partial<WorkspaceSource>)=>({kind:'live',...parts}) as WorkspaceSource;
const gate=()=>{let resolve!:(value?:any)=>void;const promise=new Promise<any>(r=>resolve=r);return {promise,resolve};};
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});

test('DTOs preserve occurrence IDs, timezone/read-only/source and recurrence contracts without invented ends',()=>{
 const recurrence={frequency:'weekly' as const,interval:2,weekdays:['MO','SU'],until:'2027-01-31'};
 assert.deepEqual(recurrenceToApi(recurrenceFromApi(recurrence)),recurrence);
 assert.deepEqual(recurrenceToApi({frequency:'monthly',interval:1,endCondition:'after_count',endCount:12}),{frequency:'monthly',interval:1,count:12});
 const dto=readCalendarEvent({...event,recurrence,is_occurrence:true,series_id:id,occurrence_id:id+':2026-10-26:14:00',date:'2026-10-26',edit_scope:'series'});
 const view=calendarPresentation(dto);assert.equal(view.id,dto.occurrence_id);assert.equal(view.api?.id,id);assert.match(view.time,/Europe\/Moscow/);assert.equal(view.syncStatus,undefined);
 assert.equal(calendarWrite({...view,title:'Renamed'},'UTC').title,'Renamed');assert.equal('end_time' in calendarWrite({...view,title:'Renamed'},'UTC'),false);
 const allDay=calendarPresentation({...event,time_kind:'all_day',start_time:null,timezone:null,end_date:'2026-10-21',source:{kind:'google',read_only:true,calendar:'Birthdays'},edit_scope:'read_only_instance'});
 assert.equal(allDay.time,'All day');assert.equal(allDay.isReadOnly,true);assert.match(allDay.duration,/2026-10-21/);assert.match(allDay.sourceName!,/Google Calendar/);
 assert.throws(()=>calendarWrite({...view,date:'2027-02-30'},'UTC'));
 const opaque={...event,recurrence:{provider_rules:['RRULE:FREQ=MONTHLY;BYDAY=-1MO']}};
 assert.equal('recurrence' in calendarWrite({...calendarPresentation(opaque),title:'Changed'},'UTC'),false);
});

test('existing API client uses same-origin session and CSRF for create/update/delete and reads real Google state',async()=>{
 const calls:{url:string;init?:RequestInit}[]=[];
 const api=new MroyaApi((async(url,init)=>{calls.push({url:String(url),init});if(String(url).includes('auth/csrf'))return json({csrf_token:'test-csrf'});
  if(init?.method==='GET')return json({connections:[connection]});
  return json({status:'succeeded',events:init?.method==='DELETE'?[{id,version:4}]:[event],operation_replayed:false},init?.method==='POST'?201:200);
 }) as typeof fetch);
 await api.mutateCalendar('POST',null,{submission_id:crypto.randomUUID(),event:{title:'Planning',date:event.date}});
 await api.mutateCalendar('PATCH',id,{submission_id:crypto.randomUUID(),version:3,changes:{title:'New'}});
 await api.mutateCalendar('DELETE',id,{submission_id:crypto.randomUUID(),version:3});await api.googleCalendarConnections();
 assert.equal(calls.filter(c=>c.url==='/api/v1/auth/csrf/').length,1);
 for(const call of calls){assert.ok(call.url.startsWith('/api/v1/'));assert.equal(call.init?.credentials,'same-origin');if(call.init?.method!=='GET')assert.equal((call.init?.headers as Record<string,string>)['X-CSRFToken'],'test-csrf');}
 assert.equal(calls[2].url,'/api/v1/calendar/events/'+id+'/');assert.equal(calls[2].init?.method,'PATCH');
});

test('double create is serialized and a lost response replays only the identical submission on explicit Retry',async()=>{
 const wait=gate(),writes:any[]=[];let lost=true;
 const controller=new LiveCalendarController(source({calendarEvents:async()=>({events:[event],limit:100,offset:0}),mutateCalendar:async(method,id,body)=>{writes.push({method,id,body});await wait.promise;if(lost)throw new TypeError('Lost response');return {status:'succeeded',events:[event],operation_replayed:true};}}),'Europe/Moscow',()=>assert.fail('expired'));
 controller.start(true,false);const input={...calendarPresentation(event),api:undefined};const first=controller.create(input);assert.equal(await controller.create(input),false);assert.equal(writes.length,1);
 wait.resolve();assert.equal(await first,false);assert.equal(controller.snapshot().mutationPending,true);assert.equal(controller.snapshot().events.length,0);
 assert.equal(await controller.create(input),false);lost=false;assert.equal(await controller.retry(),true);
 assert.equal(writes.length,2);assert.deepEqual(writes[1],writes[0]);assert.equal(controller.snapshot().events.length,1);assert.equal(controller.snapshot().mutationPending,false);controller.stop();
});

test('whole-series edit loads canonical DTSTART and uses series UUID/version; stale writes never report success',async()=>{
 const calls:any[]=[];let conflict=false;
 const series={...event,recurrence:{frequency:'daily' as const,interval:1},edit_scope:'series' as const};
 const occurrence={...series,is_occurrence:true,series_id:id,occurrence_id:id+':2026-10-26:14:00',date:'2026-10-26'};
 const controller=new LiveCalendarController(source({calendarEvents:async()=>({events:[occurrence],limit:100,offset:0}),calendarEvent:async uuid=>{assert.equal(uuid,id);return series;},mutateCalendar:async(method,uuid,body)=>{calls.push({method,uuid,body});if(conflict)throw new ApiError(409,'version_conflict','stale');return {status:'succeeded',events:[series],operation_replayed:false};}}),'Europe/Moscow',()=>{});
 controller.start(true,false);await controller.loadEvents();const canonical=await controller.loadForEdit(controller.snapshot().events[0]);assert.equal(canonical?.date,event.date);
 assert.equal(await controller.edit({...canonical!,title:'Changed'}),true);assert.equal(calls[0].uuid,id);assert.equal(calls[0].body.version,3);assert.equal(calls[0].body.changes.title,'Changed');assert.equal(calls[0].body.changes.date,undefined);
 conflict=true;assert.equal(await controller.edit({...canonical!,title:'Stale change'}),false);assert.match(controller.snapshot().error!,/changed on the server/);assert.equal(controller.snapshot().mutationPending,false);controller.stop();
});

test('OAuth return only removes the hint; GET confirms state, ON/OFF waits for GET and manual sync never enables auto',async()=>{
 const histories:any[]=[];const message=consumeCalendarOAuthReturn({href:'https://app.heymroya.com/?calendar_google=connected&tab=calendar#details'},{state:{keep:true},replaceState:(...args)=>histories.push(args)});
 assert.match(message!,/Backend/);assert.equal(histories[0][2],'/?tab=calendar#details');
 let confirmed=structuredClone(connection);const pending=gate(),configs:any[]=[];let waits=false;
 const controller=new LiveCalendarController(source({googleCalendarConnections:async()=>{if(waits)await pending.promise;return [confirmed];},configureCalendarGoogle:async(uuid,changes)=>{configs.push(changes);confirmed={...confirmed,sync_enabled:changes.sync_enabled??confirmed.sync_enabled};return confirmed;},syncCalendarGoogle:async()=>{confirmed={...confirmed,sync_requested:true,sync_status:'pending'};}}),'UTC',()=>{});
 controller.start(true,true);controller.oauthReturn(message);assert.equal(controller.snapshot().connections.length,0);await controller.loadConnections();
 waits=true;const enabling=controller.toggleAuto();await Promise.resolve();assert.equal(controller.connection?.sync_enabled,false);pending.resolve();await enabling;assert.equal(controller.connection?.sync_enabled,true);
 waits=false;await controller.toggleAuto();assert.equal(controller.connection?.sync_enabled,false);await controller.sync();assert.equal(controller.connection?.sync_enabled,false);assert.equal(googleSyncPresentation(controller.connection).state,'syncing');
 assert.equal(googleSyncPresentation({...connection,sync_status:'paused'}).state,'connected_auto_off');
 assert.deepEqual(configs,[{sync_enabled:true},{sync_enabled:false}]);controller.stop();
});

test('partial/conflict/reconnect states are truthful, disabled capabilities do no IO, logout discards late reads',async()=>{
 assert.equal(googleSyncPresentation({...connection,sync_status:'partial',error_code:'network_unavailable'}).state,'sync_error');
 assert.equal(googleSyncPresentation({...connection,jobs:{...connection.jobs,conflict:1}}).state,'conflict');
 assert.equal(googleSyncPresentation({...connection,status:'reconnect'}).state,'reconnect_required');
 const pending=gate();let reads=0;
 const controller=new LiveCalendarController(source({googleCalendarConnections:async()=>{reads++;await pending.promise;return [connection];},calendarEvents:async()=>{reads++;return {events:[],limit:100,offset:0};}}),'UTC',()=>{});
 controller.start(false,false);await controller.loadEvents();await controller.loadConnections();assert.equal(reads,0);
 controller.start(true,true);const reading=controller.loadConnections();controller.stop();pending.resolve();await reading;assert.equal(controller.snapshot().connections.length,0);assert.equal(controller.snapshot().events.length,0);
});
