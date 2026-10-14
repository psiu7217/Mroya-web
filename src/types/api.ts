// Observed contract: Mroya-api apps/api/views.py and docs/API.md (main 504e67c).
export interface TelegramConnectionStatus {configured:boolean;connected:boolean;bot_username:string;telegram_username?:string;connected_at?:string}
export interface TelegramLinkResponse {url:string;expires_at:string}
export interface TelegramDisconnectResponse {connected:false}
export type ThemeMode = 'system'|'light'|'dark';
export interface ApiUser { id:number; username:string; email:string; first_name:string; last_name:string; timezone:string; nickname:string; preferences:{theme:ThemeMode} }
export type PreferencesPatch = Partial<Pick<ApiUser,'nickname'> & {theme:ThemeMode}>;
export interface ApiMessage { id:string; sequence:number; role:'user'|'assistant'; content:string; status:string; created_at:string; completed_at:string|null }
export interface HistoryResponse { conversation_id:string; messages:ApiMessage[]; next_before:number|null }
export interface Capabilities { api_version:'v1'; chat:boolean; memory_read:boolean; memory_mutations_via_chat:boolean; memory_mutations_rest:boolean; calendar_rest:boolean; connections_rest:boolean; reminders:boolean; local_recurrence:boolean; sse_token_streaming:boolean; google_oauth?:boolean }
// Canonical statements deliberately retain provenance/revisions without pretending to be UI cards.
export type CanonicalMemory = {uuid:string} & Record<string,unknown>;
export interface MemoriesResponse { memories:CanonicalMemory[]; total:number }
export interface MapNode { id:string; type:'entity'|'memory'; label:string; kind?:string; resolution_state?:string|null; is_self?:boolean; degree?:number; memory_count?:number; subject?:string; literal_type?:string; [field:string]:unknown }
export interface MapEdge { id:string; source:string; target:string; type:'relation'|'memory'; statement_id:string; predicate:string; predicate_key:string; polarity:string; valid_from:string|null; valid_to:string|null; learned_at:string|null; evidence_count:number }
export interface MemoryMapResponse { nodes:MapNode[]; edges:MapEdge[]; stats?:{entities:number;memories:number;connections:number;truncated:boolean}; truncated?:boolean }
export interface TurnResponse { turn_status:'running'|'completed'|'failed'; summary:string; events:Record<string,unknown>[]; assistant_content?:string; error_id?:string; error_message?:string; error_report_url?:string; [field:string]:unknown }
export interface SendOptions { signal?:AbortSignal; retry?:boolean; timezone?:string; onTurn?:(id:string)=>void }
export type ChatStreamEvent = {event:'trace'|'delta'|'done'|'error'|'replay';data:Record<string,unknown>};
