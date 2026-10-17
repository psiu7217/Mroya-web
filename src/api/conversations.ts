import {ApiError} from './errors.ts';
import {isTurnUuid,readReportContext} from './reportContext.ts';
import type {ConversationSummary,ConversationPage,HistoryResponse} from '../types/api.ts';
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const date=(v:unknown)=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(v)&&Number.isFinite(Date.parse(v));
function invalid():never{throw new ApiError(502,'invalid_response','Invalid conversation response');}
export function conversationId(id:string):string{if(!isTurnUuid(id))throw new ApiError(400,'invalid_conversation','Invalid conversation UUID');return id;}
export function conversationTitle(title:string):string{
 const trimmed=title.trim();
 if(!trimmed||Array.from(trimmed).length>100||/[<>\u0000-\u001f\u007f]/.test(trimmed))throw new ApiError(400,'invalid_title','Title must contain 1–100 characters, without angle brackets or control characters.');
 return trimmed;
}
export function readConversation(value:unknown):ConversationSummary{
 if(!object(value)||!isTurnUuid(value.id)||typeof value.title!=='string'||Array.from(value.title).length>100
  ||!date(value.created_at)||!date(value.updated_at))invalid();
 return {id:value.id,title:value.title,created_at:value.created_at,updated_at:value.updated_at} as ConversationSummary;
}
export function readConversationPage(value:unknown,offset:number):ConversationPage{
 if(!object(value)||!Array.isArray(value.conversations)||value.conversations.length>100
  ||value.next_offset!==null&&(!Number.isSafeInteger(value.next_offset)||(value.next_offset as number)<=offset||(value.next_offset as number)>100000))invalid();
 return {conversations:value.conversations.map(readConversation),next_offset:value.next_offset as number|null};
}
export function readConversationHistory(value:unknown,id:string):HistoryResponse{
 if(!object(value)||value.conversation_id!==id||!Array.isArray(value.messages)||value.messages.length>200
  ||value.next_before!==null&&(!Number.isSafeInteger(value.next_before)||(value.next_before as number)<1))invalid();
 let sequence=0;
 for(const m of value.messages){
  if(!object(m)||!isTurnUuid(m.id)||!Number.isSafeInteger(m.sequence)||(m.sequence as number)<=sequence
   ||!['user','assistant'].includes(m.role as string)||typeof m.content!=='string'||!['completed','streaming','failed'].includes(m.status as string)
   ||!date(m.created_at)||m.completed_at!==null&&!date(m.completed_at)
   ||m.report_context!==undefined&&!readReportContext(m.report_context))invalid();
  sequence=m.sequence as number;
 }
 return {conversation_id:id,next_before:value.next_before as number|null,messages:value.messages.map(m=>({
  id:m.id,sequence:m.sequence,role:m.role,content:m.content,status:m.status,created_at:m.created_at,completed_at:m.completed_at,
  ...(m.report_context?{report_context:readReportContext(m.report_context)}:{}),
 }))} as HistoryResponse;
}
