export interface ReviewProposal {
 formulation:string;information_type:string;memory_placement:string;usefulness:string;
 entities:{local_id:string;description:string;desired_match_unverified:boolean}[];
 relations:{subject:string;predicate:string;object:string}[];
 evidence:{field:string;quote:string}[];uncertainties:string[];
}
export interface ReviewJob {
 id:string;initial_filter_job_id:string;event_id:string;revision:string;pipeline_version:'memory-review-v1';
 status:'pending'|'processing'|'completed'|'error'|'stale';attempts:number;error_code:string|null;
 source_preview:{title:string;calendar_name:string;date:string}|null;
 result:{decision:'KEEP'|'DISCARD'|'NEEDS_CLARIFICATION';explanation:string;proposals:ReviewProposal[];
  schema_version:'memory-review-schema-v1';model:string;processed_at:string}|null;
}
export interface ReviewPage {
 summary:Record<'total'|'pending'|'processing'|'completed'|'error'|'stale',number>;
 eligible_count:number;processing_enabled:boolean;worker_available:boolean;is_complete:boolean;
 results:ReviewJob[];next_offset:number|null;
}
export interface ReviewState {data:ReviewPage|null;loading:boolean;busy:boolean;error:string|null;offset:number;receipt:{added:number;already_queued:number}|null}
export interface ReviewPresentation extends ReviewState {
 onEnqueue:()=>void;onRefresh:()=>void;onRetry:(id:string)=>void;onNext:()=>void;onPrevious:()=>void;
}
