import {ApiError} from './errors.ts';
import {isTurnUuid} from './reportContext.ts';
import {JOB_STATUSES,INBOX_STATUSES} from '../types/intelligenceApi.ts';
import type {IntelligenceAction,IntelligenceReceipt,IntelligenceProposal,IntelligencePlan,IntelligenceCapabilities,IntelligenceRuntime,ProposalPage,ProposalHistoryPage,JsonValue,DecisionBody,ProposalDecision} from '../types/intelligenceApi.ts';
function invalid():never{throw new ApiError(502,'invalid_response','Invalid Memory Inbox response.');}
const record=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:invalid();
const text=(v:unknown,max=16000):string=>typeof v==='string'&&Array.from(v).length<=max?v:invalid();
const bool=(v:unknown):boolean=>typeof v==='boolean'?v:invalid();
const integer=(v:unknown,min=0):number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min?v:invalid();
const uuid=(v:unknown):string=>typeof v==='string'&&isTurnUuid(v)?v:invalid();
const list=(v:unknown,max=100):unknown[]=>Array.isArray(v)&&v.length<=max?v:invalid();
const time=(v:unknown):string=>typeof v==='string'&&Number.isFinite(Date.parse(v))?v:invalid();
// Bounded JSON for plan/history previews, never executable commands or HTML.
function json(v:unknown,depth=0):JsonValue{
 if(depth>16)invalid();
 if(v===null||typeof v==='boolean')return v;
 if(typeof v==='number')return Number.isFinite(v)?v:invalid();
 if(typeof v==='string')return text(v,64000);
 if(Array.isArray(v))return list(v,1000).map(x=>json(x,depth+1));
 return Object.fromEntries(Object.entries(record(v)).map(([k,x])=>[k,json(x,depth+1)]));
}
export function readIntelligencePlan(value:unknown):IntelligencePlan{
 const p=record(value);
 return {rationale:text(p.rationale),matches:list(p.matches,8).map(value=>{const m=record(value);return {mention:text(m.mention,240),objects:list(m.objects,8).map(value=>{const o=record(value);return {object_uuid:uuid(o.object_uuid),...(o.label!==undefined?{label:text(o.label,240)}:{}),...(o.kind!==undefined?{kind:text(o.kind,120)}:{})};})};}),
  actions:list(p.actions,8).map(value=>{const a=record(value),type=text(a.type);
   if(!['link','create_object','add_fact','add_relation','revise_fact','clarify','skip'].includes(type))invalid();
   const out:IntelligenceAction={type:type as IntelligenceAction['type']};
   if(type==='clarify')out.question=text(a.question);else out.reason=text(a.reason);
   if(type==='create_object'){const e=record(a.entity);out.entity={ref:text(e.ref,240),label:text(e.label,240),kind:text(e.kind,120)};}
   if(type==='link'){const t=record(a.target);if(t.reference!=='existing')invalid();out.target={reference:'existing',object_uuid:uuid(t.object_uuid)};}
   if(['add_fact','add_relation','revise_fact'].includes(type)){const st=record(a.statement),predicate=record(st.predicate);text(predicate.key);text(predicate.label);record(st.subject);record(st.value);out.statement=json(st) as {[key:string]:JsonValue};}
   if(type==='revise_fact')out.statement_uuid=uuid(a.statement_uuid);
   return out;
  })};
}
export function readIntelligenceProposal(value:unknown,expected?:string):IntelligenceProposal{
 const p=record(value),source=record(p.source),preview=record(p.source_preview),id=uuid(p.id);
 if(expected!==undefined&&id!==expected||source.kind!=='calendar'||!INBOX_STATUSES.some(status=>status===p.status))invalid();
 const available=bool(preview.available);
 let apply:IntelligenceProposal['apply']=null;
 if(p.apply!==null){const a=record(p.apply),result=record(a.result);for(const name of ['canonical_saved','memory_applied','search_ready','links_saved'])if(result[name]!==undefined)bool(result[name]);
  apply={operation_id:uuid(a.operation_id),status:text(a.status,120),code:a.code===null?null:text(a.code,240),attempts:integer(a.attempts),result:json(result) as IntelligenceReceipt};}
 if(bool(p.canonical_saved)!==bool(p.memory_applied)||p.canonical_saved!==(apply?.result.canonical_saved===true)||bool(p.search_ready)!==(apply?.result.search_ready===true))invalid();
 return {id,version:integer(p.version,1),status:p.status as IntelligenceProposal['status'],source:{kind:'calendar',id:uuid(source.id),resource_id:text(source.resource_id,240),revision:text(source.revision,240)},space_uuid:uuid(p.space_uuid),
  source_preview:available?{available,title:text(preview.title,240),calendar_name:text(preview.calendar_name,120),date:text(preview.date,40),time_kind:text(preview.time_kind,40),recurrence:json(preview.recurrence)}:{available:false},
  plan:readIntelligencePlan(p.plan),policy:text(p.policy,120),analysis_version:text(p.analysis_version,120),memory_applied:bool(p.memory_applied),canonical_saved:bool(p.canonical_saved),search_ready:bool(p.search_ready),apply,created_at:time(p.created_at),updated_at:time(p.updated_at)};
}
function nextOffset(v:unknown,offset:number):number|null{if(v===null)return null;const n=integer(v,1);return n>offset&&n<=10000?n:invalid();}
export function readProposalPage(value:unknown,offset:number):ProposalPage{const v=record(value);return {proposals:list(v.proposals,50).map(p=>readIntelligenceProposal(p)),next_offset:nextOffset(v.next_offset,offset)};}
export function readProposalHistory(value:unknown,offset:number):ProposalHistoryPage{const v=record(value);return {history:list(v.history,50).map(value=>{const h=record(value);return {version:integer(h.version,1),kind:text(h.kind,120),snapshot:json(record(h.snapshot)) as {[k:string]:JsonValue},comment:text(h.comment,2000),created_at:time(h.created_at)};}),next_offset:nextOffset(v.next_offset,offset)};}
export function readIntelligenceSettings(value:unknown):IntelligenceCapabilities{const v=record(value),c=record(v.capabilities);return {stage:text(c.stage,120),inbox:bool(c.inbox),deep_analysis:bool(c.deep_analysis),memory_apply:bool(c.memory_apply),auto_link:bool(c.auto_link),auto_write:bool(c.auto_write),...(c.related_sources!==undefined?{related_sources:bool(c.related_sources)}:{})};}
export function readIntelligenceRuntime(value:unknown):IntelligenceRuntime{const v=record(value);return {worker_enabled:bool(v.worker_enabled),deep_enabled:bool(v.deep_enabled),apply_enabled:bool(v.apply_enabled)};}
export function validateDecision(id:string,action:ProposalDecision,body:DecisionBody){
 if(!isTurnUuid(id)||!['accept','reject','comment','reconsider','retry'].includes(action)||!Number.isSafeInteger(body.version)||body.version<1||!isTurnUuid(body.request_id)
  ||Object.keys(body).some(k=>!['version','request_id',...(action==='comment'?['comment']:[])].includes(k))
  ||action==='comment'&&(typeof body.comment!=='string'||!body.comment.trim()||Array.from(body.comment.trim()).length>2000))throw new ApiError(400,'invalid_proposal_decision','Invalid proposal decision.');
}

export function readIntelligencePreferences(v:unknown):import('../types/intelligenceApi.ts').IntelligencePreferences {
 const value=record(v),settings=record(value.settings),autonomy=settings.autonomy;
 if(!['review_all','auto_link','auto_write'].includes(autonomy as string))invalid();
 return {autonomy:autonomy as import('../types/intelligenceApi.ts').IntelligenceAutonomy,capabilities:readIntelligenceSettings(v)};
}
export function readIntelligenceSources(v:unknown,offset:number){const value=record(v);return {sources:list(value.sources,50).map(x=>{const s=record(x);if(s.kind!=='calendar')invalid();return {kind:'calendar' as const,id:uuid(s.id),name:text(s.name,240),enabled:bool(s.enabled)};}),next_offset:nextOffset(value.next_offset,offset)};}
export function readIntelligenceSource(v:unknown,id:string){const value=record(record(v).source);if(value.kind!=='calendar'||uuid(value.id)!==id)invalid();return {kind:'calendar' as const,id,enabled:bool(value.enabled)};}
export function readEventAnalysis(v:unknown,id:string):import('../types/intelligenceApi.ts').EventAnalysisStatus {
 const value=record(v),source=record(value.source);if(uuid(value.event_id)!==id||source.kind!=='calendar')invalid();
 let job:import('../types/intelligenceApi.ts').EventAnalysisStatus['job']=null,proposal:import('../types/intelligenceApi.ts').EventAnalysisStatus['proposal']=null;
 if(value.job!==null){const j=record(value.job);if(!JOB_STATUSES.some(s=>s===j.status)||j.decision!==null&&!['irrelevant','candidate','uncertain'].includes(j.decision as string))invalid();job={status:j.status as NonNullable<typeof job>['status'],decision:j.decision===null?null:text(j.decision,120)};}
 if(value.proposal!==null){const p=record(value.proposal);if(!INBOX_STATUSES.some(s=>s===p.status))invalid();proposal={id:uuid(p.id),status:p.status as NonNullable<typeof proposal>['status'],version:integer(p.version,1),canonical_saved:bool(p.canonical_saved),links_saved:bool(p.links_saved),search_ready:bool(p.search_ready)};}
 return {event_id:id,source:{kind:'calendar',id:uuid(source.id),enabled:bool(source.enabled)},runtime:readIntelligenceRuntime(value.runtime),job,proposal};
}
