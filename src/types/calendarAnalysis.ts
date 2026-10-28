export type AnalysisStatus='waiting_import'|'empty'|'running'|'stopping'|'stopped'|'service_unavailable'|'unavailable'|'errors'|'completed';
export type AnalysisEventStatus='queued'|'checking'|'stopping'|'stopped'|'error'|'checked'|'suitable'|'unavailable';
export interface CalendarAnalysis {
 calendar_id:string;name:string;version:number;status:AnalysisStatus;total:number;checked:number;suitable:number;errors:number;
 stopped:number;remaining:number;progress:number;can_stop:boolean;can_retry:boolean;
}
export interface AnalysisEvent {id:string;title:string|null;date:string|null;status:AnalysisEventStatus;can_retry:boolean}
export interface AnalysisEventsPage {calendar:CalendarAnalysis;events:AnalysisEvent[];next_offset:number|null}
export interface AnalysisEventState {rows:AnalysisEvent[];next:number|null;loading:boolean;error:boolean}
export interface CalendarAnalysisPresentation {
 calendars:CalendarAnalysis[];expanded:string[];events:Record<string,AnalysisEventState>;loading:boolean;
 error:'load'|'action'|'conflict'|null;busyCalendar:string|null;
 onRefresh:()=>void;onToggle:(id:string)=>void;onMore:(id:string)=>void;
 onStop:(id:string)=>void;onRetry:(id:string,jobId?:string)=>void;
}
