import type {GraphNode,GraphEdge} from '../../types/mroya';
export type RenderNode=GraphNode&{type:'entity'|'memory';kind:string;degree:number;memory_count:number};
export type RenderEdge=GraphEdge&{type:'relation'|'memory';predicate:string};
export interface RenderGraph {nodes:RenderNode[];edges:RenderEdge[];stats:{entities:number;memories:number;connections:number;truncated:boolean}}
/** Shared offline/live props. No coordinates, invented nodes or mutation of Workspace state. */
export function renderGraph(nodes:GraphNode[],edges:GraphEdge[]):RenderGraph {
 const ids=new Set(nodes.map(n=>n.id));
 const validEdges=edges.filter(e=>ids.has(e.source)&&ids.has(e.target)).map(e=>({...e,type:e.type??'relation',predicate:e.predicate??e.relationship}));
 const normalized=nodes.map(n=>({...n,type:n.type??'entity',kind:n.kind??n.category,degree:n.degree??validEdges.filter(e=>e.source===n.id||e.target===n.id).length,memory_count:n.memory_count??0}));
 return {nodes:normalized,edges:validEdges,stats:{entities:normalized.filter(n=>n.type==='entity').length,memories:validEdges.length,connections:validEdges.filter(e=>e.type==='relation').length,truncated:false}};
}
