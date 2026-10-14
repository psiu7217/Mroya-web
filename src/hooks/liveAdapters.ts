import type {ApiUser,ApiMessage,CanonicalMemory,MemoryMapResponse} from '../types/api.ts';
import type {AccountPresentation} from '../types/workspace.ts';
import type {Conversation,MemoryItem,GraphNode,GraphEdge} from '../types/mroya.ts';
const text=(v:unknown):string=>v==null?'':typeof v==='string'?v:JSON.stringify(v);
export function accountPresentation(user:ApiUser):AccountPresentation {
 const name=user.nickname.trim()||[user.first_name,user.last_name].filter(Boolean).join(' ').trim()||user.username;
 return {displayName:name,initials:name.split(/\s+/).map(v=>Array.from(v)[0]).slice(0,2).join('').toUpperCase(),email:user.email,description:'',timezone:user.timezone,spaceDescription:'Personal space'};
}
export function chatPresentation(id:string,messages:ApiMessage[]):Conversation {
 return {id,title:'Your conversation',group:'Today',updatedAt:messages.at(-1)?.created_at??'',relatedMemoryIds:[],messages:messages.map(m=>({id:m.id,sender:m.role,content:m.content||(m.status==='failed'?'This reply could not be completed.':''),status:m.status,timestamp:new Date(m.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}))};
}
export function memoryPresentation(m:CanonicalMemory,map:MemoryMapResponse):MemoryItem {
 const subject=text(m.subject),predicate=text(m.predicate||m.predicate_key),value=text(m.object_label??m.literal_value);
 const node=map.nodes.find(n=>n.type==='memory'&&n.statement_id===m.uuid);
 return {id:m.uuid,title:[subject,predicate].filter(Boolean).join(' · ')||'Personal memory',summary:value,details:[subject,predicate,value].filter(Boolean).join(' — '),category:'Personal memory',dateSaved:text(m.learned_at).slice(0,10),source:'Canonical memory',entities:[subject,text(m.object_label)].filter(Boolean),relatedNodeId:node?.id??'',confidenceNote:text(m.state)};
}
export function graphPresentation(map:MemoryMapResponse):{nodes:GraphNode[];edges:GraphEdge[]} {
 const nodes=map.nodes.map((n,i):GraphNode=>({id:n.id,label:n.label,subtitle:n.type==='memory'?text(n.predicate):n.kind??'Entity',category:n.kind==='person'?'person':n.kind==='organization'?'organization':n.type==='memory'?'agreement':'preference',x:500+300*Math.cos(i*2*Math.PI/Math.max(1,map.nodes.length)),y:330+200*Math.sin(i*2*Math.PI/Math.max(1,map.nodes.length)),connectionsCount:map.edges.filter(e=>e.source===n.id||e.target===n.id).length,summary:n.label,dateRecorded:text(n.learned_at).slice(0,10),source:'Canonical memory map',linkedMemoryId:n.type==='memory'?text(n.statement_id):undefined}));
 return {nodes,edges:map.edges.map(e=>({id:e.id,source:e.source,target:e.target,relationship:e.predicate}))};
}
