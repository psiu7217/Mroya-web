// Observed contract: Mroya-api apps/api/views.py and docs/API.md (main 504e67c).
export interface TelegramConnectionStatus {configured:boolean;connected:boolean;bot_username:string;telegram_username?:string;connected_at?:string}
export interface TelegramLinkResponse {url:string;expires_at:string}
export interface TelegramDisconnectResponse {connected:false}
export type ThemeMode = 'system'|'light'|'dark';
export interface ApiUser { id:number; username:string; email:string; first_name:string; last_name:string; timezone:string; nickname:string; preferences:{theme:ThemeMode;show_model_reasoning?:boolean} }
export type PreferencesPatch = Partial<Pick<ApiUser,'nickname'> & {theme:ThemeMode;show_model_reasoning:boolean;timezone:string;timezone_only_if_unset:boolean}>;
export interface ReportContext {turn_id:string;request_trace_id:number;report_url:string}
export interface IssueReportResponse {issue:{id:string;turn_id:string;request_trace_id:number;status:'new'|'investigating'|'resolved';created_at:string};created:boolean}
export type LiveToolName = 'search_memory'|'fast_search_memory'|'prepare_memory_write'|'expand_memory_entities'|'write_statements'|'revise_memory_statements'|'forget_memory_statements'|'resolve_memory_write'|'echo'|'search_calendar_events'|'get_calendar_events'|'create_calendar_events'|'update_calendar_events'|'delete_calendar_events'|'tool';
export interface LiveFact {subject:string|null;predicate:string|null;value:string|number|boolean|null}
export type LiveToolInput = {queries:{query:string|null}[]}
 | {entities:{label:string|null;direction:'outgoing'|'incoming'|'both'|null}[]}
 | {facts:LiveFact[]}
 | {reason:'already_present'|'unsupported_mutation'|'not_durable'|'insufficient_context'|'inappropriate_to_store'|'other'|null;missing_dimension:'date'|'entity'|'conflicting_fact'|'other'|null};
export type LiveToolOutput = {result_count?:number;facts:LiveFact[]}
 | {result_count?:number;entities:{label:string|null;facts:LiveFact[]}[]}
 | {created_count:number;reused_existing_count:number;results:{action:'created'|'reused_existing'}[];search_ready:boolean|null}
 | {revised_count:number;results:{action:'revised'}[];search_ready:boolean|null}
 | {forgotten_count:number;results:{action:'forgotten'}[];search_ready:boolean|null}
 | {decision_resolved:true;new_facts_added:false}
 | {error_code:'tool_budget_exhausted'|'search_before_write_required'|'unknown_tool_argument'|'invalid_tool_arguments_json'|'invalid_tool_argument_value'|'invalid_tool_variant'|'tool_not_allowed'|'agent_step_limit_exceeded'|'tool_execution_failed'|'not_executed'};
export interface LegacyToolActivity {kind:string;status:'success'|'failure'|'neutral';title:string}
export type ExpandedToolActivity = {
 call_id:string;tool_name:LiveToolName;turn_number:number;kind:string;title:string;truncated:boolean;
} & (
 {phase:'started';status:'running';input:LiveToolInput|null;output:null;duration_ms:null}
 | {phase:'finished';status:'success'|'failure';input:null;output:LiveToolOutput|null;duration_ms:number}
 | {phase:'finished';status:'not_executed';input:null;output:LiveToolOutput|null;duration_ms:null}
);
export interface ToolActivityEvent {sequence:number;activity:LegacyToolActivity|ExpandedToolActivity}
export interface ApiMessage { /** Controller-local, never a history/write DTO. */ timeline?:import('./mroya').ChatTimelineEntry[]; /** Transient live reasoning, never sent or persisted. */ reasoning?:string; report_context?:ReportContext; id:string; sequence:number; role:'user'|'assistant'; content:string; status:string; created_at:string; completed_at:string|null }
export interface ConversationSummary {id:string;title:string;created_at:string;updated_at:string}
export interface ConversationPage {conversations:ConversationSummary[];next_offset:number|null}
export interface HistoryResponse { conversation_id:string; messages:ApiMessage[]; next_before:number|null }
export interface Capabilities { api_version:'v1'; chat:boolean; memory_read:boolean; memory_mutations_via_chat:boolean; memory_mutations_rest:boolean; calendar_rest:boolean; connections_rest:boolean; reminders:boolean; local_recurrence:boolean; sse_token_streaming:boolean; google_oauth?:boolean }
// Canonical statements deliberately retain provenance/revisions without pretending to be UI cards.
export type CanonicalMemory = {uuid:string} & Record<string,unknown>;
export interface MemoriesResponse { memories:CanonicalMemory[]; total:number }
export interface MapNode { id:string; type:'entity'|'memory'; label:string; kind?:string; resolution_state?:string|null; is_self?:boolean; degree?:number; memory_count?:number; subject?:string; literal_type?:string; [field:string]:unknown }
export interface MapEdge { id:string; source:string; target:string; type:'relation'|'memory'; statement_id:string; predicate:string; predicate_key:string; polarity:string; valid_from:string|null; valid_to:string|null; learned_at:string|null; evidence_count:number }
export interface MemoryMapResponse { nodes:MapNode[]; edges:MapEdge[]; stats?:{entities:number;memories:number;connections:number;truncated:boolean}; truncated?:boolean }
export interface TurnResponse { report_context?:ReportContext; turn_status:'running'|'completed'|'failed'; summary:string; events:Record<string,unknown>[]; assistant_content?:string; error_id?:string; error_message?:string; error_report_url?:string; [field:string]:unknown }
export interface SendOptions { signal?:AbortSignal; retry?:boolean; timezone?:string; onTurn?:(id:string)=>void }
export type ChatStreamEvent = {event:'trace'|'delta'|'done'|'error'|'replay'|'reasoning_delta'|'tool_activity';data:Record<string,unknown>};
