export const isAllDay=(value:string)=>/^all[ -]day$/i.test(value.trim());
export function maskCalendarTime(value:string):string {
 const digits=value.replace(/\D/g,'').slice(0,4);
 return digits.length>2?digits.slice(0,2)+':'+digits.slice(2):digits;
}
export function calendarTimeError(value:string):string|null {
 return isAllDay(value)||/^([01]\d|2[0-3]):[0-5]\d$/.test(value)?null:'Enter a complete 24-hour time (00:00–23:59), or choose All day.';
}
