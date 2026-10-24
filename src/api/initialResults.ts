import {ApiError} from './errors.ts';
import {isTurnUuid} from './reportContext.ts';
import type {InitialFilterResults,InitialDecision} from '../types/initialResults.ts';
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const count=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
function invalid():never{throw new ApiError(502,'invalid_response','Invalid initial filter results');}
export function readInitialResults(v:unknown,decision:InitialDecision,offset:number):InitialFilterResults {
 if(!record(v)||!record(v.summary))invalid();
 const s=v.summary;
 if(!['total','pending','processing','approved','rejected','errors'].every(k=>count(s[k])))invalid();
 if(s.total!==Number(s.pending)+Number(s.processing)+Number(s.approved)+Number(s.rejected)+Number(s.errors)
  ||typeof v.is_complete!=='boolean'||v.is_complete!==(s.pending===0&&s.processing===0)||typeof v.processing_enabled!=='boolean'
  ||!Array.isArray(v.results)||v.results.length>50||!(v.next_offset===null||(count(v.next_offset)&&v.next_offset>offset)))invalid();
 for(const r of v.results){
  if(!record(r)||!isTurnUuid(r.event_id)||!['title','calendar_name','date','model','processed_at'].every(k=>typeof r[k]==='string')
   ||!/^\d{4}-\d{2}-\d{2}$/.test(String(r.date))||!Number.isFinite(Date.parse(String(r.date)))||!Number.isFinite(Date.parse(String(r.processed_at)))
   ||r.decision!==decision||typeof r.probability!=='number'||!Number.isFinite(r.probability)||r.probability<0||r.probability>1
   ||(r.probability>=0.8)!==(decision==='APPROVE'))invalid();
 }
 if(new Set(v.results.map(r=>r.event_id)).size!==v.results.length)invalid();
 return v as unknown as InitialFilterResults;
}
