import {ApiError} from './errors.ts';
import {isTurnUuid} from './reportContext.ts';
import type {InitialQueueTotals,InitialQueueReceipt} from '../types/initialQueue.ts';
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const count=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
function invalid():never{throw new ApiError(502,'invalid_response','Invalid initial queue response');}
export function readInitialQueue(v:unknown):InitialQueueTotals {
 if(!record(v)||!count(v.queue_total)||!Array.isArray(v.calendars)||v.calendars.length>10000)invalid();
 const calendars=v.calendars.map(row=>{if(!record(row)||!isTurnUuid(row.calendar_id)||!count(row.pending))invalid();return {calendar_id:row.calendar_id as string,pending:row.pending};});
 if(new Set(calendars.map(c=>c.calendar_id)).size!==calendars.length||calendars.reduce((sum,c)=>sum+c.pending,0)!==v.queue_total)invalid();
 return {queue_total:v.queue_total,calendars};
}
export function readInitialQueueReceipt(v:unknown):InitialQueueReceipt {
 if(!record(v)||!count(v.added)||!count(v.already_queued)||!count(v.queue_total)||v.added+v.already_queued>v.queue_total)invalid();
 return {added:v.added,already_queued:v.already_queued,queue_total:v.queue_total};
}
