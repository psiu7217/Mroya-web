import {readReportContext} from '../api/reportContext.ts';
import {formatTime} from '../i18n/format.ts';
import {tr} from '../i18n/index.ts';
import type {ApiUser,ApiMessage,CanonicalMemory,MemoryMapResponse} from '../types/api.ts';
import type {AccountPresentation} from '../types/workspace.ts';
import type {Conversation,MemoryItem,GraphNode,GraphEdge} from '../types/mroya.ts';
const text=(v:unknown):string=>v==null?'':typeof v==='string'?v:JSON.stringify(v);
export function accountPresentation(user:ApiUser):AccountPresentation {
 const name=user.nickname.trim()||[user.first_name,user.last_name].filter(Boolean).join(' ').trim()||user.username;
 return {displayName:name,initials:name.split(/\s+/).map(v=>Array.from(v)[0]).slice(0,2).join('').toUpperCase(),email:user.email,description:'',timezone:user.timezone,spaceDescription:tr('personalSpace',{ns:'connections'}),nickname:user.nickname};
}
export function chatPresentation(id:string,messages:ApiMessage[]):Conversation {
 return {id,title:tr('yourConversation',{ns:'chat'}),group:tr('today',{ns:'sidebar'}),updatedAt:messages.at(-1)?.created_at??'',relatedMemoryIds:[],messages:messages.map(m=>({id:m.id,sender:m.role,content:m.content||(m.status==='failed'?tr('assistantReplyIncomplete',{ns:'chat'}):''),status:m.status,...(m.role==='assistant'&&m.timeline?.length?{timeline:m.timeline}:{}),...(m.role==='assistant'&&m.reasoning?{reasoning:m.reasoning}:{}),...(m.role==='assistant'&&m.tasks?.length?{tasks:m.tasks}:{}),...(m.role==='assistant'&&m.status==='failed'?{report_context:readReportContext(m.report_context)}:{}),timestamp:formatTime(m.created_at,{hour:'2-digit',minute:'2-digit'})}))};
}
export function memoryPresentation(m:CanonicalMemory,map:MemoryMapResponse):MemoryItem {
 const subject=text(m.subject),predicate=text(m.predicate||m.predicate_key),value=text(m.object_label??m.literal_value);
 const node=map.nodes.find(n=>n.type==='memory'&&n.statement_id===m.uuid);
 return {id:m.uuid,title:[subject,predicate].filter(Boolean).join(' · ')||tr('personalMemory',{ns:'memory'}),summary:value,details:[subject,predicate,value].filter(Boolean).join(' — '),category:'Personal memory',dateSaved:text(m.learned_at).slice(0,10),source:tr('canonicalMemory',{ns:'memory'}),entities:[subject,text(m.object_label)].filter(Boolean),relatedNodeId:node?.id??'',confidenceNote:text(m.state)};
}
export function graphPresentation(map:MemoryMapResponse):{nodes:GraphNode[];edges:GraphEdge[]} {
 const nodes=map.nodes.map((n):GraphNode=>({id:n.id,label:n.label,type:n.type,kind:n.kind,
  is_self:n.is_self,degree:n.degree,memory_count:n.memory_count,subject:n.subject,
  statement_id:typeof n.statement_id==='string'?n.statement_id:undefined,
  predicate:text(n.predicate),predicate_key:text(n.predicate_key),polarity:text(n.polarity),literal_type:n.literal_type,
  valid_from:typeof n.valid_from==='string'?n.valid_from:null,valid_to:typeof n.valid_to==='string'?n.valid_to:null,
  learned_at:typeof n.learned_at==='string'?n.learned_at:null,evidence_count:typeof n.evidence_count==='number'?n.evidence_count:undefined,
  resolution_state:n.resolution_state,
  subtitle:n.type==='memory'?text(n.predicate):n.kind??tr('entity',{ns:'memory'}),category:n.kind==='person'?'person':n.kind==='organization'?'organization':n.type==='memory'?'agreement':'preference',
  connectionsCount:n.degree??map.edges.filter(e=>e.source===n.id||e.target===n.id).length,summary:n.label,
  dateRecorded:text(n.learned_at).slice(0,10),source:'Canonical memory map',linkedMemoryId:n.type==='memory'?text(n.statement_id)||undefined:undefined}));
 return {nodes,edges:map.edges.map(e=>({...e,relationship:e.predicate}))};
}
