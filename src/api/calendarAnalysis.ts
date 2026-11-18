import {ApiError} from './errors.ts';
import {isTurnUuid} from './reportContext.ts';
import type {CalendarAnalysis,AnalysisEventsPage} from '../types/calendarAnalysis.ts';
const invalid=()=>new ApiError(502,'invalid_response','Invalid calendar analysis');
export function readCalendarAnalysis(value:unknown,expectedId?:string):CalendarAnalysis {
 const v=value as Record<string,unknown>|null;
 if(!v||!isTurnUuid(v.calendar_id)||expectedId&&v.calendar_id!==expectedId||typeof v.name!=='string'
  ||!['waiting_import','empty','running','stopping','stopped','service_unavailable','unavailable','errors','completed'].includes(v.status as string)
  ||!['version','total','checked','suitable','errors','stopped','remaining','progress'].every(k=>Number.isSafeInteger(v[k])&&(v[k] as number)>=0)
  ||(v.progress as number)>100||(v.checked as number)<(v.suitable as number)
  ||(v.checked as number)+(v.errors as number)+(v.stopped as number)+(v.remaining as number)!==v.total
  ||typeof v.can_stop!=='boolean'||typeof v.can_retry!=='boolean'
  ||v.version===0&&(v.can_stop||v.can_retry))throw invalid();
 return v as unknown as CalendarAnalysis;
}
export function readCalendarAnalyses(value:unknown):CalendarAnalysis[]{
 const v=value as {calendars?:unknown}|null;
 if(!v||!Array.isArray(v.calendars))throw invalid();
 const rows=v.calendars.map(row=>readCalendarAnalysis(row));
 if(new Set(rows.map(r=>r.calendar_id)).size!==rows.length)throw invalid();return rows;
}
export function readAnalysisEvents(value:unknown,id:string,offset:number):AnalysisEventsPage {
 const v=value as Record<string,unknown>|null;
 if(!v||!Array.isArray(v.events)||v.events.length>50||!(v.next_offset===null||v.next_offset===offset+50))throw invalid();
 const calendar=readCalendarAnalysis(v.calendar,id);
 const events=v.events.map(value=>{
  const e=value as Record<string,unknown>|null;
  if(!e||!isTurnUuid(e.id)||!(e.title===null||typeof e.title==='string')
   ||!(e.date===null||typeof e.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(e.date)&&Number.isFinite(Date.parse(e.date)))
   ||!['queued','checking','stopping','stopped','error','checked','suitable','unavailable'].includes(e.status as string)
   ||typeof e.can_retry!=='boolean')throw invalid();
  return e as unknown as AnalysisEventsPage['events'][number];
 });
 if(new Set(events.map(e=>e.id)).size!==events.length)throw invalid();
 return {calendar,events,next_offset:v.next_offset as number|null};
}
