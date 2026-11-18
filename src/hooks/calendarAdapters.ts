import type {CalendarEventDto,CalendarRecurrence,CalendarWrite,GoogleConnectionDto} from '../types/calendarApi.ts';
import type {CalendarEvent,RecurrenceRule,GoogleSyncState} from '../types/mroya.ts';
import {tr} from '../i18n/index.ts';
import {formatDate} from '../i18n/format.ts';
const weekdays=['SU','MO','TU','WE','TH','FR','SA'];
export function recurrenceFromApi(rule:CalendarEventDto['recurrence']):RecurrenceRule|undefined{
 if(!rule||'provider_rules' in rule)return undefined;
 return {frequency:rule.frequency,interval:rule.interval,weekdays:rule.weekdays?.map(day=>weekdays.indexOf(day)),
  endCondition:rule.until?'on_date':rule.count?'after_count':'never',endDate:rule.until,endCount:rule.count};
}
export function recurrenceToApi(rule?:RecurrenceRule):CalendarRecurrence|null{
 if(!rule)return null;
 const interval=rule.interval??1;
 if(!Number.isInteger(interval)||interval<1||interval>366)throw new Error('Repeat interval must be 1–366.');
 const result:CalendarRecurrence={frequency:rule.frequency,interval};
 if(rule.weekdays?.length){if(rule.weekdays.some(day=>!Number.isInteger(day)||day<0||day>6))throw new Error('Invalid weekdays');result.weekdays=[...new Set(rule.weekdays.map(day=>weekdays[day]))];}
 if(rule.endCondition==='on_date'){if(!validCalendarDate(rule.endDate??''))throw new Error('Choose a valid recurrence end date.');result.until=rule.endDate;}
 if(rule.endCondition==='after_count'){if(!Number.isInteger(rule.endCount)||rule.endCount!<1||rule.endCount!>10000)throw new Error('Repeat count must be 1–10000.');result.count=rule.endCount;}
 return result;
}
export function validCalendarDate(value:string):boolean{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const date=new Date(value+'T12:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;
}
export function calendarPresentation(dto:CalendarEventDto):CalendarEvent{
 const clock=dto.time_kind==='all_day'?'All day':dto.start_time??'';
 return {id:dto.occurrence_id??dto.id,api:dto,memoryLinks:dto.memory_links?.map(link=>({...link})),title:dto.title,date:dto.date,dayOfMonth:Number(dto.date.slice(8)),
  time:clock+(dto.timezone&&dto.time_kind==='exact'?' · '+dto.timezone:''),
  duration:dto.end_time?`${dto.start_time}–${dto.end_time}${dto.end_date!==dto.date?' · '+dto.end_date:''}`:dto.end_date?`Ends before ${dto.end_date}`:'No end specified',
  category:['meeting','deadline','reminder'].includes(dto.event_type)?dto.event_type as CalendarEvent['category']:'meeting',
  locationOrLink:dto.location||undefined,notes:dto.description,recurrence:recurrenceFromApi(dto.recurrence),
  isReadOnly:dto.source.read_only||dto.edit_scope==='read_only_instance',
  calendarSource:dto.source.kind==='google'?'google_work':'local',sourceName:dto.source.kind==='google'?`Google Calendar · ${dto.source.calendar??''}`:'Mroya',
  // The period DTO has no per-event outbox confirmation. Never infer Synced from connection success.
  syncStatus:dto.source.read_only?'read_only':undefined};
}
export function calendarWrite(event:Omit<CalendarEvent,'id'>,timezone:string):CalendarWrite{
 if(!validCalendarDate(event.date))throw new Error('Choose a valid full date.');
 const allDay=/^all[ -]day$/i.test(event.time.trim())||!event.time.trim();
 const clock=allDay?null:event.time.split(' · ')[0];
 if(clock!==null&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(clock))throw new Error('Use HH:MM or All day.');
 const prior=event.api;
 const candidate:CalendarWrite={title:event.title.trim(),date:event.date,description:event.notes,location:event.locationOrLink??'',time_kind:allDay?'all_day':'exact',start_time:clock,
  timezone:allDay?'':prior?.timezone??timezone,event_type:prior&&calendarPresentation(prior).category===event.category?prior.event_type:event.category};
 if(!candidate.title)throw new Error('An event title is required.');
 if(!allDay&&!candidate.timezone)throw new Error('Set a valid timezone in your profile first.');
 // Keep opaque Google rules unless explicitly replaced by a normalized editor rule.
 if(!(prior?.recurrence&&'provider_rules' in prior.recurrence&&!event.recurrence))candidate.recurrence=recurrenceToApi(event.recurrence);
 if(!prior)return candidate;
 // Date moves carry the existing end-date offset; do not invent an end or duration.
 if(prior.end_date&&event.date!==prior.date){const days=Date.parse(event.date+'T12:00Z')-Date.parse(prior.date+'T12:00Z');candidate.end_date=new Date(Date.parse(prior.end_date+'T12:00Z')+days).toISOString().slice(0,10);}
 if(allDay&&prior.time_kind==='exact'){candidate.end_time=null;candidate.end_date=null;candidate.utc_offset_minutes=null;}
 const changes:Record<string,unknown>={};
 for(const [key,value] of Object.entries(candidate))if(JSON.stringify(value)!==JSON.stringify(prior[key as keyof CalendarEventDto]))changes[key]=value;
 return changes as CalendarWrite;
}
export function googleSyncPresentation(connection?:GoogleConnectionDto):{state:GoogleSyncState;notice:string}{
 if(!connection||connection.status==='disconnected')return {state:'disconnected',notice:''};
 if(connection.status==='reconnect')return {state:'reconnect_required',notice:tr('googleReconnectRequired',{ns:'connections'})};
 const codes=[connection.error_code,...connection.calendars.filter(c=>c.selected&&c.available).map(c=>c.error_code)].filter(Boolean);
 if(connection.jobs.conflict>0||codes.includes('sync_conflict'))return {state:'conflict',notice:tr('googleConflictPaused',{ns:'connections'})};
 if(['pending','running'].includes(connection.sync_status))return {state:connection.initial_synced_at?'syncing':'initial_syncing',notice:tr('googleSyncPending',{ns:'connections'})};
 if(['partial','needs_destination'].includes(connection.sync_status)||connection.jobs.error>0||codes.length){
  const issueCount=Math.max(connection.jobs.error,codes.length);
  const notice=[
   connection.sync_status==='partial'?tr('googleSyncPartial',{ns:'connections'}):undefined,
   connection.sync_status==='needs_destination'?tr('googleSyncChooseExport',{ns:'connections'}):undefined,
   issueCount?tr('googleSyncAttention',{ns:'connections',count:issueCount}):undefined,
   connection.next_retry_at?tr('googleSyncRetryAt',{ns:'connections',date:formatDate(connection.next_retry_at,{dateStyle:'short',timeStyle:'short'})}):undefined,
  ].filter(Boolean).join(' ');
  return {state:'sync_error',notice};
 }
 if(connection.sync_requested||['pending','running'].includes(connection.sync_status)||connection.sync_enabled&&(connection.jobs.pending>0||connection.jobs.retry>0))return {state:connection.initial_synced_at?'syncing':'initial_syncing',notice:tr('googleSyncPending',{ns:'connections'})};
 return {state:connection.sync_enabled?'connected_auto_on':'connected_auto_off',notice:connection.sync_status==='succeeded'?tr('googleSyncCompleted',{ns:'connections'}):connection.sync_status==='not_started'?tr('googleInitialSyncIncomplete',{ns:'connections'}):connection.sync_status==='paused'?tr('googleSyncPaused',{ns:'connections'}):''};
}
