export type CalendarRecurrence = {frequency:'daily'|'weekly'|'monthly'|'yearly';interval:number;weekdays?:string[];until?:string;count?:number};
export interface CalendarEventDto {
 id:string;version:number;title:string;description:string;location:string;date:string;
 time_kind:'exact'|'all_day';start_time:string|null;end_date:string|null;end_time:string|null;
 timezone:string|null;utc_offset_minutes:number|null;event_type:string;
 recurrence:CalendarRecurrence|{provider_rules:string[]}|null;
 source:{kind:'local'|'google';read_only:boolean;calendar?:string;account?:string;url?:string|null;event_type?:string};
 edit_scope:'event'|'series'|'read_only_instance';is_occurrence?:boolean;occurrence_id?:string;series_id?:string;
 memory_links?:{space_uuid:string;object_uuid:string}[];
}
export type CalendarWrite = Pick<CalendarEventDto,'title'|'date'> & Partial<Pick<CalendarEventDto,'description'|'location'|'time_kind'|'start_time'|'end_date'|'end_time'|'timezone'|'utc_offset_minutes'|'event_type'>> & {recurrence?:CalendarRecurrence|null};
export interface CalendarPage {events:CalendarEventDto[];limit:number;offset:number}
export interface CalendarOperation {status:'succeeded';events:(CalendarEventDto|{id:string;version:number})[];operation_replayed:boolean}
export interface GoogleCalendarDto {
 id:string;name:string;selected:boolean;available:boolean;read_only:boolean;is_primary:boolean;export_destination:boolean;
 sync_status:'not_started'|'succeeded'|'failed';error_code:string;last_synced_at:string|null;
}
export interface GoogleConnectionDto {
 id:string;provider:'google';email:string;status:'connected'|'reconnect'|'disconnected';sync_enabled:boolean;sync_requested:boolean;
 sync_status:'not_started'|'pending'|'running'|'succeeded'|'partial'|'needs_destination'|'paused';error_code:string;
 initial_synced_at:string|null;last_synced_at:string|null;next_retry_at:string|null;retry_attempts:number;
 jobs:Record<'pending'|'retry'|'synced'|'error'|'conflict',number>;calendars:GoogleCalendarDto[];
}
export type GoogleConfiguration={selected_calendar_ids?:string[];export_calendar_id?:string|null;sync_enabled?:boolean};
