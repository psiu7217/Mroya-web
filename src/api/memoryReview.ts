import {ApiError} from './errors.ts';
import {isTurnUuid} from './reportContext.ts';
import type {ReviewPage,ReviewJob,ReviewProposal} from '../types/memoryReview.ts';
const bad=():never=>{throw new ApiError(502,'invalid_response','Invalid memory review response');};
const rec=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:bad();
const str=(v:unknown,max=1000):string=>typeof v==='string'&&Array.from(v).length<=max?v:bad();
const num=(v:unknown):number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0?v:bad();
const bool=(v:unknown):boolean=>typeof v==='boolean'?v:bad();
const uuid=(v:unknown):string=>typeof v==='string'&&isTurnUuid(v)?v:bad();
const list=(v:unknown,max=8):unknown[]=>Array.isArray(v)&&v.length<=max?v:bad();
const local=(v:unknown):string=>/^local_[1-9][0-9]?$/.test(str(v,10))?v as string:bad();
function proposal(v:unknown):ReviewProposal{
 const r=rec(v),entities=list(r.entities).map(x=>{const e=rec(x);return {local_id:local(e.local_id),description:str(e.description,600),desired_match_unverified:bool(e.desired_match_unverified)};});
 const ids=new Set(entities.map(e=>e.local_id));if(ids.size!==entities.length)bad();
 return {formulation:str(r.formulation,600),information_type:str(r.information_type,120),memory_placement:str(r.memory_placement,600),usefulness:str(r.usefulness,600),entities,
  relations:list(r.relations).map(x=>{const e=rec(x);const subject=local(e.subject),object=local(e.object);if(!ids.has(subject)||!ids.has(object))bad();return {subject,object,predicate:str(e.predicate,120)};}),
  evidence:list(r.evidence).map(x=>{const e=rec(x);return {field:str(e.field,32),quote:str(e.quote,600)};}),uncertainties:list(r.uncertainties).map(x=>str(x,600))};
}
export function readReviewJob(v:unknown):ReviewJob{
 const r=rec(v);if(!['pending','processing','completed','error','stale'].includes(String(r.status))||r.pipeline_version!=='memory-review-v1')bad();
 const p=r.source_preview===null?null:rec(r.source_preview),a=r.result===null?null:rec(r.result);
 let result:ReviewJob['result']=null;
 if(a){if(r.status!=='completed'||!p||!['KEEP','DISCARD','NEEDS_CLARIFICATION'].includes(String(a.decision))||a.schema_version!=='memory-review-schema-v1'||!Number.isFinite(Date.parse(str(a.processed_at,64))))bad();
  const proposals=list(a.proposals).map(proposal);if((a.decision==='KEEP')!==Boolean(proposals.length))bad();
  result={decision:a.decision as NonNullable<ReviewJob['result']>['decision'],explanation:str(a.explanation),proposals,schema_version:'memory-review-schema-v1',model:str(a.model,255),processed_at:str(a.processed_at,64)};
 }
 if(r.status==='completed'&&!result)bad();
 return {id:uuid(r.id),initial_filter_job_id:uuid(r.initial_filter_job_id),event_id:uuid(r.event_id),revision:str(r.revision,64),pipeline_version:'memory-review-v1',status:r.status as ReviewJob['status'],attempts:num(r.attempts),error_code:r.error_code===null?null:str(r.error_code,40),source_preview:p?{title:str(p.title,1000),calendar_name:str(p.calendar_name,255),date:str(p.date,32)}:null,result};
}
export function readReviewPage(v:unknown,offset=0):ReviewPage{
 const r=rec(v),s=rec(r.summary),summary=Object.fromEntries(['total','pending','processing','completed','error','stale'].map(k=>[k,num(s[k])])) as ReviewPage['summary'];
 if(summary.total!==summary.pending+summary.processing+summary.completed+summary.error+summary.stale||bool(r.is_complete)!==(summary.pending===0&&summary.processing===0))bad();
 const next=r.next_offset===null?null:num(r.next_offset);if(next!==null&&next!==offset+20)bad();
 return {summary,eligible_count:num(r.eligible_count),processing_enabled:bool(r.processing_enabled),worker_available:bool(r.worker_available),is_complete:bool(r.is_complete),results:list(r.results,20).map(readReviewJob),next_offset:next};
}
export function readReviewReceipt(v:unknown){const r=rec(v);return {added:num(r.added),already_queued:num(r.already_queued)};}
