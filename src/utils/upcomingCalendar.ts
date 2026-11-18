import type {CalendarEvent} from '../types/mroya.ts';
export function dateInTimezone(now:Date,timezone:string):string {
 if(!timezone)return [now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
 const parts=new Intl.DateTimeFormat('en-CA',{...(timezone?{timeZone:timezone}:{}),year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 return ['year','month','day'].map(type=>parts.find(p=>p.type===type)!.value).join('-');
}
// Convert an event wall clock, never a YYYY-MM-DD parsed in the browser's UTC zone.
export function calendarInstant(date:string,time:string,timezone:string,offset?:number|null):number {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))return NaN;
 const [year,month,day]=date.split('-').map(Number),[hour,minute]=time.split(':').map(Number);
 const wall=Date.UTC(year,month-1,day,hour,minute);
 if(offset!==undefined&&offset!==null)return wall-offset*60000;
 if(!timezone)return new Date(year,month-1,day,hour,minute).getTime();
 const formatter=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 let instant=wall;
 for(let i=0;i<4;i++){
  const parts=formatter.formatToParts(new Date(instant)),n=(type:string)=>Number(parts.find(p=>p.type===type)!.value);
  const difference=wall-Date.UTC(n('year'),n('month')-1,n('day'),n('hour'),n('minute'));
  if(!difference)return instant;instant+=difference;
 }
 return NaN; // A nonexistent DST wall time is never fabricated as a different appointment.
}
export function upcomingCalendarEvents(events:CalendarEvent[],selectedDate:string,timezone:string,now=new Date()):CalendarEvent[] {
 const today=dateInTimezone(now,timezone),start=selectedDate>today?selectedDate:today;
 const threshold=Math.max(now.getTime(),calendarInstant(start,'00:00',timezone));
 return [...new Map(events.map(e=>[e.id,e])).values()].map(event=>{
  const allDay=event.api?event.api.time_kind==='all_day':/^all[ -]day$/i.test(event.time);
  const time=event.api?.start_time??event.time.split(' · ')[0];
  const instant=calendarInstant(event.date,allDay?'00:00':time,event.api?.timezone||timezone,event.api?.utc_offset_minutes);
  return {event,instant,keep:allDay?event.date>=start:instant>=threshold};
 }).filter(row=>row.keep&&Number.isFinite(row.instant)).sort((a,b)=>a.instant-b.instant||a.event.id.localeCompare(b.event.id)).slice(0,5).map(row=>row.event);
}

// Only offline Design series use the existing recurrence helper. Live DTOs are already occurrences.
export function designUpcomingCalendarEvents(events:CalendarEvent[],selectedDate:string,now:Date,occurs:(event:CalendarEvent,date:string)=>boolean):CalendarEvent[] {
 if(!events.length)return [];
 const start=selectedDate>dateInTimezone(now,'')?selectedDate:dateInTimezone(now,'');
 const [y,m,d]=start.split('-').map(Number),rows:CalendarEvent[]=[];
 for(let i=0;i<365;i++){
  const date=new Date(y,m-1,d+i,12),key=dateInTimezone(date,'');
  for(const event of events)if(occurs(event,key))rows.push({...event,date:key,dayOfMonth:date.getDate(),id:event.id+'@'+key});
  const result=upcomingCalendarEvents(rows,start,'',now);if(result.length===5)return result;
 }
 return upcomingCalendarEvents(rows,start,'',now);
}
