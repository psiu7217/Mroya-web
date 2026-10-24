export const INBOX_STATUSES=['pending','reanalyzing','rejected','pending_apply','applying','applied','search_pending','apply_conflict','apply_retry','apply_error','stale','error','no_proposal'] as const;
export type IntelligenceStatus=typeof INBOX_STATUSES[number];
export type ProposalDecision='accept'|'reject'|'comment'|'reconsider'|'retry';
export type DecisionBody={version:number;request_id:string;comment?:string};
export type JsonValue=null|boolean|number|string|JsonValue[]|{[key:string]:JsonValue};
export interface IntelligenceAction {
 type:'link'|'create_object'|'add_fact'|'add_relation'|'revise_fact'|'clarify'|'skip';
 reason?:string;question?:string;entity?:{ref:string;label:string;kind:string};
 target?:{reference:'existing';object_uuid:string};statement?:{[key:string]:JsonValue};statement_uuid?:string;
}
export interface IntelligencePlan {
 rationale:string;matches:{mention:string;objects:{object_uuid:string;label?:string;kind?:string}[]}[];actions:IntelligenceAction[];
}
export interface IntelligenceReceipt {
 canonical_saved?:boolean;memory_applied?:boolean;search_ready?:boolean;links_saved?:boolean;
 [key:string]:JsonValue|undefined;
}
export interface IntelligenceProposal {
 id:string;version:number;status:IntelligenceStatus;
 source:{kind:'calendar';id:string;resource_id:string;revision:string};space_uuid:string;
 source_preview:{available:boolean;title?:string;calendar_name?:string;date?:string;time_kind?:string;recurrence?:JsonValue};
 plan:IntelligencePlan;policy:string;analysis_version:string;
 memory_applied:boolean;canonical_saved:boolean;search_ready:boolean;
 apply:null|{operation_id:string;status:string;code:string|null;attempts:number;result:IntelligenceReceipt};
 created_at:string;updated_at:string;
}
export interface IntelligenceCapabilities {stage:string;inbox:boolean;deep_analysis:boolean;memory_apply:boolean;auto_link:boolean;auto_write:boolean;related_sources?:boolean}
export interface IntelligenceRuntime {worker_enabled:boolean;deep_enabled:boolean;apply_enabled:boolean}
export interface IntelligenceHistory {version:number;kind:string;snapshot:{[key:string]:JsonValue};comment:string;created_at:string}
export type ProposalPage={proposals:IntelligenceProposal[];next_offset:number|null};
export type ProposalHistoryPage={history:IntelligenceHistory[];next_offset:number|null};

export type IntelligenceAutonomy='review_all'|'auto_link'|'auto_write';
export interface IntelligencePreferences {autonomy:IntelligenceAutonomy;capabilities:IntelligenceCapabilities}
export interface IntelligenceSource {kind:'calendar';id:string;name:string;enabled:boolean}
export const JOB_STATUSES=['queued','triaging','awaiting_analysis','irrelevant','stale','error','analyzing','analyzed','skipped','suppressed','analysis_error'] as const;
export interface EventAnalysisStatus {
 event_id:string;source:{kind:'calendar';id:string;enabled:boolean};runtime:IntelligenceRuntime;
 job:null|{status:typeof JOB_STATUSES[number];decision:string|null};
 proposal:null|{id:string;status:IntelligenceStatus;version:number;canonical_saved:boolean;links_saved:boolean;search_ready:boolean};
}
export interface IntelligencePresentation {
 available:boolean;loading:boolean;busy:boolean;error:string|null;preferences:IntelligencePreferences|null;runtime:IntelligenceRuntime|null;sources:IntelligenceSource[];hasMore:boolean;
 onRefresh:()=>void;onMore:()=>void;onSource:(id:string,enabled:boolean)=>void;onAutonomy:(value:'review_all'|'auto_link')=>void;
}
export interface EventAnalysisPresentation {
 eventId:string|null;loading:boolean;error:string|null;unavailable:boolean;data:EventAnalysisStatus|null;
 onSelect:(id:string|null)=>void;onRefresh:()=>void;onProposal:(id:string)=>void;
}

export interface SourceScanProgress {
 id:string;name:string;enabled:boolean;last_scanned_at:string|null;quota_blocked:boolean;
 scan:null|{id:string;state:'requested'|'scanning'|'processing'|'completed'|'completed_with_errors';
 requested_at:string;started_at:string|null;discovered_at:string|null;eligible:number|null;discovered:number;checked:number;
 queued:number;triage:number;deep_analysis:number;no_save:number;stale:number;errors:number;retrying:number;awaiting_confirmation:number;error_codes:string[]};
}
export interface ScanningPage {worker:{enabled:boolean;state:'disabled'|'recent'|'unavailable';last_seen_at:string|null};sources:SourceScanProgress[];next_offset:number|null}
