export const DEMO_ACCOUNT = {displayName:'Alex Lindqvist',initials:'AL',email:'alex@lindqvist.studio',description:'Independent Design Director',timezone:'Europe/Stockholm (CET)',spaceDescription:'Client Advisory & Studio Operations',nickname:'Alex'};
import { INITIAL_CONVERSATIONS, INITIAL_MEMORIES, INITIAL_GRAPH_NODES, INITIAL_GRAPH_EDGES } from './fixtures.ts';
import type { WorkspaceSource, SessionState } from '../types/source.ts';
export function createDesignSource(): WorkspaceSource {
  return {
    kind: 'design',
    session: async (): Promise<SessionState> => ({status:'authenticated',user:{id:0,username:'design-user',email:'alex@lindqvist.studio',first_name:'Alex',last_name:'Lindqvist',timezone:'Europe/Stockholm',nickname:'Alex',preferences:{theme:'light'}}}),
    login: async () => ({id:0,username:'design-user',email:'',first_name:'Alex',last_name:'Lindqvist',timezone:'Europe/Stockholm',nickname:'Alex',preferences:{theme:'light'}}),
    logout: async () => {},
    // Demo DTOs remain separate from canonical backend records. UI scenarios use the same fixtures.
    history: async () => ({conversation_id:'design',messages:INITIAL_CONVERSATIONS[0].messages.map((m,i)=>({id:m.id,sequence:i+1,role:m.sender,content:m.content,status:(m.status as any)||'completed',created_at:'2026-10-12T12:00:00Z',completed_at:null})),next_before:null}),
    memories: async () => ({memories:INITIAL_MEMORIES.map(m=>({uuid:m.id,design_presentation:m})),total:INITIAL_MEMORIES.length}),
    map: async () => ({nodes:INITIAL_GRAPH_NODES.map(n=>({id:n.id,type:'entity',label:n.label})),edges:INITIAL_GRAPH_EDGES.map(e=>({...e,type:'relation',statement_id:e.id,predicate:e.relationship,predicate_key:'',polarity:'positive',valid_from:null,valid_to:null,learned_at:null,evidence_count:0}))}),
    capabilities: async () => ({api_version:'v1',chat:true,memory_read:true,memory_mutations_via_chat:true,memory_mutations_rest:false,calendar_rest:false,connections_rest:false,reminders:false,local_recurrence:false,sse_token_streaming:false,google_oauth:true}),
    send: async () => { throw new Error('Design chat is handled locally by useDemoWorkspace; no API request is made.'); },
    turn: async () => { throw new Error('No backend turns in Design Mode'); },
    startGoogleAuth: async () => { throw new Error('Google sign-in is unavailable in Design Mode.'); },
  };
}
