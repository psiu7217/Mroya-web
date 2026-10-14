import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarDate,calendarWeek,calendarKey,calendarYears,sameCalendarDay} from '../src/utils/calendarDates.ts';
const keys=(year:number,month:number,day:number)=>calendarWeek(calendarDate(year,month,day)).map(calendarKey);
test('week follows a selected month instead of fixed October dates',()=>{
 assert.deepEqual(keys(2034,6,19),['2034-07-17','2034-07-18','2034-07-19','2034-07-20','2034-07-21','2034-07-22','2034-07-23']);
 assert.deepEqual(keys(2034,7,19),['2034-08-14','2034-08-15','2034-08-16','2034-08-17','2034-08-18','2034-08-19','2034-08-20']);
});
test('week crosses month boundaries with actual months on each day',()=>{
 assert.deepEqual(keys(2030,3,1),['2030-04-01','2030-04-02','2030-04-03','2030-04-04','2030-04-05','2030-04-06','2030-04-07']);
 assert.deepEqual(keys(2030,4,1),['2030-04-29','2030-04-30','2030-05-01','2030-05-02','2030-05-03','2030-05-04','2030-05-05']);
});
test('week crosses years using previous-year dates and next-year dates',()=>{
 assert.deepEqual(keys(2027,0,1),['2026-12-28','2026-12-29','2026-12-30','2026-12-31','2027-01-01','2027-01-02','2027-01-03']);
 assert.deepEqual(keys(2030,11,31),['2030-12-30','2030-12-31','2031-01-01','2031-01-02','2031-01-03','2031-01-04','2031-01-05']);
});
test('Today compares complete local date, not day-of-month or time-of-day',()=>{
 const today=new Date(2034,6,19,23,59);
 assert.ok(sameCalendarDay(today,new Date(2034,6,19,0,1)));
 assert.ok(!sameCalendarDay(today,new Date(2034,7,19)));
 assert.ok(!sameCalendarDay(today,new Date(2033,6,19)));
 assert.equal(calendarWeek(calendarDate(2034,7,19)).filter(day=>sameCalendarDay(day,today)).length,0);
});
test('month/year navigation clamps invalid days and supports leap years',()=>{
 assert.equal(calendarKey(calendarDate(2031,1,31)),'2031-02-28');
 assert.equal(calendarKey(calendarDate(2032,1,31)),'2032-02-29');
 assert.equal(calendarKey(calendarDate(2032,12,31)),'2033-01-31');
 assert.equal(calendarKey(calendarDate(2033,-1,31)),'2032-12-31');
 assert.equal(calendarKey(calendarDate(2033,1,29)),'2033-02-28');
});
test('year picker remains usable after 2028 and preserves Studio 2026 choices',()=>{
 assert.deepEqual(calendarYears(2026),[2024,2025,2026,2027,2028]);
 assert.deepEqual(calendarYears(2050),[2048,2049,2050,2051,2052]);
});
test('Studio initial week remains October 12–18, 2026',()=>{
 assert.deepEqual(keys(2026,9,12),['2026-10-12','2026-10-13','2026-10-14','2026-10-15','2026-10-16','2026-10-17','2026-10-18']);
});
