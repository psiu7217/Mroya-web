import {ApiError} from './errors.ts';
import type {ExpandedToolActivity,ToolActivityEvent} from '../types/api.ts';
type Obj=Record<string,unknown>;
function invalid():never{throw new ApiError(502,'invalid_stream','Invalid tool activity');}
const object=(v:unknown):v is Obj=>!!v&&typeof v==='object'&&!Array.isArray(v);
const keys=(v:unknown,required:string[],optional:string[]=[]):v is Obj=>object(v)&&required.every(k=>Object.hasOwn(v,k))&&Object.keys(v).every(k=>required.includes(k)||optional.includes(k));
const count=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
const text=(v:unknown):v is string=>typeof v==='string'&&Array.from(v).length<=240;
const nullableText=(v:unknown)=>v===null||text(v);
const scalar=(v:unknown)=>nullableText(v)||typeof v==='boolean'||typeof v==='number'&&Number.isFinite(v);
const list=(v:unknown,valid:(item:unknown)=>boolean):boolean=>Array.isArray(v)&&v.length<=4&&v.every(valid);
const fact=(v:unknown)=>keys(v,['subject','predicate','value'])&&nullableText(v.subject)&&nullableText(v.predicate)&&scalar(v.value);
const kinds:Record<string,string>={
 search_memory:'memory_search',fast_search_memory:'memory_search',prepare_memory_write:'persistence_check',expand_memory_entities:'memory_search',
 write_statements:'memory_write',revise_memory_statements:'memory_write',forget_memory_statements:'memory_write',resolve_memory_write:'no_write',
 create_note:'note_write',get_note:'note_read',update_note:'note_write',delete_note:'note_write',
 enqueue_agent_task:'tool',echo:'tool',tool:'tool',search_calendar_events:'calendar_search',get_calendar_events:'calendar_search',
 create_calendar_events:'calendar_write',update_calendar_events:'calendar_write',delete_calendar_events:'calendar_write',
};
const reasons=['already_present','unsupported_mutation','not_durable','insufficient_context','inappropriate_to_store','other'];
const dimensions=['date','entity','conflicting_fact','other'];
const errors=['tool_budget_exhausted','search_before_write_required','unknown_tool_argument','invalid_tool_arguments_json','invalid_tool_argument_value','invalid_tool_variant','tool_not_allowed','agent_step_limit_exceeded','tool_execution_failed','not_executed'];
function input(name:string,v:unknown):boolean{
 if(v===null)return true;
 switch(name){
  case 'search_memory':case 'fast_search_memory':case 'prepare_memory_write':return keys(v,['queries'])&&list(v.queries,q=>keys(q,['query'])&&nullableText(q.query));
  case 'expand_memory_entities':return keys(v,['entities'])&&list(v.entities,e=>keys(e,['label','direction'])&&nullableText(e.label)&&(e.direction===null||['outgoing','incoming','both'].includes(e.direction as string)));
  case 'write_statements':case 'revise_memory_statements':return keys(v,['facts'])&&list(v.facts,fact);
  case 'resolve_memory_write':return keys(v,['reason','missing_dimension'])&&(v.reason===null||reasons.includes(v.reason as string))&&(v.missing_dimension===null||dimensions.includes(v.missing_dimension as string));
  default:return false;
 }
}
function output(name:string,status:string,v:unknown):boolean{
 if(v===null)return true; // Safe projection may intentionally be unavailable.
 if(status==='not_executed')return keys(v,['error_code'])&&errors.includes(v.error_code as string);
 if(status==='failure')return keys(v,['error_code'])&&v.error_code==='tool_execution_failed';
 switch(name){
  case 'search_memory':case 'fast_search_memory':case 'prepare_memory_write':return keys(v,['facts'],['result_count'])&&(!Object.hasOwn(v,'result_count')||count(v.result_count))&&list(v.facts,fact);
  case 'expand_memory_entities':return keys(v,['entities'],['result_count'])&&(!Object.hasOwn(v,'result_count')||count(v.result_count))&&list(v.entities,e=>keys(e,['label','facts'])&&nullableText(e.label)&&list(e.facts,fact));
  case 'write_statements':case 'revise_memory_statements':case 'forget_memory_statements':{
   const counters=name==='write_statements'?['created_count','reused_existing_count']:name==='revise_memory_statements'?['revised_count']:['forgotten_count'];
   const actions=name==='write_statements'?['created','reused_existing']:name==='revise_memory_statements'?['revised']:['forgotten'];
   return keys(v,[...counters,'results','search_ready'])&&counters.every(k=>count(v[k]))&&(v.search_ready===null||typeof v.search_ready==='boolean')&&list(v.results,r=>keys(r,['action'])&&actions.includes(r.action as string));
  }
  case 'get_note':return keys(v,['note_read'])&&v.note_read===true;
  case 'create_note':case 'update_note':return keys(v,['note_action','search_ready'])&&v.note_action===name&&(v.search_ready===null||typeof v.search_ready==='boolean');
  case 'delete_note':return keys(v,['note_action','search_removed'])&&v.note_action===name&&(v.search_removed===null||typeof v.search_removed==='boolean');
  case 'resolve_memory_write':return keys(v,['decision_resolved','new_facts_added'])&&v.decision_resolved===true&&v.new_facts_added===false;
  default:return false;
 }
}
// ASCII-normalized JSON with the Backend's default separators; activity cap excludes SSE envelope.
function asciiJSON(v:unknown):string{
 if(Array.isArray(v))return '['+v.map(asciiJSON).join(', ')+']';
 if(object(v))return '{'+Object.entries(v).map(([k,value])=>asciiJSON(k)+': '+asciiJSON(value)).join(', ')+'}';
 return JSON.stringify(v).replace(/[\u007f-\uffff]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));
}
function depth(v:unknown,n=0):boolean{
 if(n>6)return false;
 return !object(v)&&!Array.isArray(v)||Object.values(v as Obj).every(value=>depth(value,n+1));
}
export function readToolActivity(value:unknown):ToolActivityEvent{
 if(!keys(value,['sequence','activity'])||!count(value.sequence)||value.sequence<1)invalid();
 const a=value.activity;
 if(keys(a,['kind','status','title'])){
  if(typeof a.kind!=='string'||!a.kind.trim()||typeof a.title!=='string'||!a.title.trim()||!['success','failure','neutral'].includes(a.status as string))invalid();
  return value as unknown as ToolActivityEvent;
 }
 const fields=['call_id','tool_name','turn_number','phase','status','kind','title','input','output','duration_ms','truncated'];
 if(!keys(a,fields)||!count(a.turn_number)||a.turn_number<1||typeof a.call_id!=='string'||typeof a.tool_name!=='string'
  ||!Object.hasOwn(kinds,a.tool_name)||a.kind!==kinds[a.tool_name]||!text(a.title)||!a.title.trim()||typeof a.truncated!=='boolean')invalid();
 const match=/^t([1-9]\d*)-c([1-9]\d*)$/.exec(a.call_id);
 if(!match||Number(match[1])!==a.turn_number||!Number.isSafeInteger(Number(match[2])))invalid();
 if(a.phase==='started'){
  if(a.status!=='running'||a.output!==null||a.duration_ms!==null||!input(a.tool_name,a.input))invalid();
 }else if(a.phase==='finished'){
  if(!['success','failure','not_executed'].includes(a.status as string)||a.input!==null
   ||(a.status==='not_executed'?a.duration_ms!==null:!count(a.duration_ms))||!output(a.tool_name,a.status as string,a.output))invalid();
 }else invalid();
 if(!depth(a.input)||!depth(a.output)||asciiJSON(a).length>8192)invalid();
 return value as unknown as ToolActivityEvent;
}
/** Per HTTP stream only. No persistence, requests or inference from titles. */
export class ToolActivityLifecycle{
 private calls=new Map<string,ExpandedToolActivity>();
 accept(activity:ExpandedToolActivity){
  const previous=this.calls.get(activity.call_id);
  if(activity.phase==='started'){
   if(previous)invalid();
  }else if(previous){
   if(previous.phase!=='started'||activity.status==='not_executed'||previous.tool_name!==activity.tool_name||previous.kind!==activity.kind||previous.turn_number!==activity.turn_number)invalid();
  }else if(activity.status!=='not_executed')invalid();
  this.calls.set(activity.call_id,activity);
 }
 complete(){if([...this.calls.values()].some(a=>a.phase==='started'))invalid();}
}
