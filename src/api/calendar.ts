import {ApiError} from './errors.ts';
import type {CalendarEventDto,CalendarPage,CalendarOperation,GoogleConnectionDto} from '../types/calendarApi.ts';
const invalid=():never=>{throw new ApiError(502,'invalid_response','Invalid calendar response');};
const object=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export const calendarUuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export function readCalendarEvent(v:unknown):CalendarEventDto{
 if(!object(v)||!calendarUuid(v.id)||!Number.isSafeInteger(v.version)||v.version<1||typeof v.title!=='string'||typeof v.description!=='string'||typeof v.location!=='string'
  ||!/^\d{4}-\d{2}-\d{2}$/.test(v.date)||!['exact','all_day'].includes(v.time_kind)||!object(v.source)||typeof v.source.read_only!=='boolean'||!['local','google'].includes(v.source.kind)
  ||!['event','series','read_only_instance'].includes(v.edit_scope)||typeof v.event_type!=='string'
  || ![v.start_time,v.end_time].every(t=>t===null||typeof t==='string'&&/^\d{2}:\d{2}$/.test(t))
  || !(v.end_date===null||typeof v.end_date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v.end_date))
  || !(v.timezone===null||typeof v.timezone==='string')
  || !(v.utc_offset_minutes===null||Number.isInteger(v.utc_offset_minutes)))return invalid();
 if(v.is_occurrence!==undefined&&typeof v.is_occurrence!=='boolean')return invalid();
 if(v.is_occurrence&&(!calendarUuid(v.series_id)||v.series_id!==v.id||typeof v.occurrence_id!=='string'||!v.occurrence_id.startsWith(v.id+':')||v.occurrence_id.length>160))return invalid();
 if(v.recurrence!==null){const r=v.recurrence;if(!object(r))return invalid();
  if('provider_rules' in r){if(!Array.isArray(r.provider_rules)||!r.provider_rules.every((s:unknown)=>typeof s==='string'))return invalid();}
  else if(!['daily','weekly','monthly','yearly'].includes(r.frequency)||!Number.isInteger(r.interval)||r.interval<1||r.interval>366
   ||r.weekdays!==undefined&&(!Array.isArray(r.weekdays)||!r.weekdays.every((d:unknown)=>['MO','TU','WE','TH','FR','SA','SU'].includes(d as string)))
   ||r.until!==undefined&&!/^\d{4}-\d{2}-\d{2}$/.test(r.until)||r.count!==undefined&&(!Number.isInteger(r.count)||r.count<1||r.count>10000))return invalid();
 }
 return v as CalendarEventDto;
}
export function readCalendarPage(v:unknown):CalendarPage{
 if(!object(v)||!Array.isArray(v.events)||!Number.isInteger(v.limit)||v.limit<1||v.limit>100||!Number.isInteger(v.offset)||v.offset<0)return invalid();
 return {events:v.events.map(readCalendarEvent),limit:v.limit,offset:v.offset};
}
export function readCalendarOperation(v:unknown,deleting=false):CalendarOperation{
 if(!object(v)||v.status!=='succeeded'||typeof v.operation_replayed!=='boolean'||!Array.isArray(v.events)||v.events.length!==1)return invalid();
 if(deleting){const e=v.events[0];if(!object(e)||!calendarUuid(e.id)||!Number.isSafeInteger(e.version))return invalid();}
 else v.events.forEach(readCalendarEvent);
 return v as CalendarOperation;
}
export function readGoogleConnection(v:unknown):GoogleConnectionDto{
 if(!object(v)||!calendarUuid(v.id)||v.provider!=='google'||typeof v.email!=='string'||!['connected','reconnect','disconnected'].includes(v.status)
  ||typeof v.sync_enabled!=='boolean'||typeof v.sync_requested!=='boolean'||!['not_started','pending','running','succeeded','partial','needs_destination','paused'].includes(v.sync_status)
  ||typeof v.error_code!=='string'||![v.initial_synced_at,v.last_synced_at,v.next_retry_at].every(t=>t===null||typeof t==='string'&&Number.isFinite(Date.parse(t)))
  ||!Number.isInteger(v.retry_attempts)||!object(v.jobs)||!['pending','retry','synced','error','conflict'].every(key=>Number.isSafeInteger(v.jobs[key])&&v.jobs[key]>=0)||!Array.isArray(v.calendars))return invalid();
 for(const c of v.calendars)if(!object(c)||!calendarUuid(c.id)||typeof c.name!=='string'||!['selected','available','read_only','is_primary','export_destination'].every(key=>typeof c[key]==='boolean')
  ||!['not_started','succeeded','failed'].includes(c.sync_status)||typeof c.error_code!=='string'||!(c.last_synced_at===null||typeof c.last_synced_at==='string'&&Number.isFinite(Date.parse(c.last_synced_at))))return invalid();
 return v as GoogleConnectionDto;
}
export function readGoogleConnections(v:unknown):GoogleConnectionDto[]{if(!object(v)||!Array.isArray(v.connections))return invalid();return v.connections.map(readGoogleConnection);}
export function googleAuthorizationUrl(v:unknown):string{
 if(!object(v)||typeof v.authorization_url!=='string')return invalid();
 try{const url=new URL(v.authorization_url);if(url.protocol==='https:'&&url.host==='accounts.google.com'&&!url.username&&!url.password)return url.href;}catch{}
 return invalid();
}
