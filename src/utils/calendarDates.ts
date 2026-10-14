/** Local civil dates: calendar arithmetic uses setDate, so DST is not a 24-hour assumption. */
export function calendarDate(year:number,month:number,day:number):Date {
 const first=new Date(year,month,1,12);
 const last=new Date(first.getFullYear(),first.getMonth()+1,0).getDate();
 return new Date(first.getFullYear(),first.getMonth(),Math.max(1,Math.min(day,last)),12);
}
export function calendarWeek(date:Date):Date[] {
 const monday=calendarDate(date.getFullYear(),date.getMonth(),date.getDate());
 monday.setDate(monday.getDate()-(monday.getDay()+6)%7);
 return Array.from({length:7},(_,i)=>{const day=new Date(monday);day.setDate(monday.getDate()+i);return day;});
}
export function sameCalendarDay(a:Date,b:Date):boolean {
 return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();
}
export function calendarKey(date:Date):string {
 return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
}
export function calendarYears(year:number):number[] {
 return Array.from({length:5},(_,i)=>year+i-2);
}
