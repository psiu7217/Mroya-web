export interface DocumentDto {
 keywords?:string[];
 id:string;filename:string;title:string;mime_type:string;size_bytes:number;
 status:'queued'|'processing'|'ready'|'needs_attention'|'failed';error_code:string|null;
 category:{path:string[];search_enabled:boolean;effective_search_enabled:boolean}|null;
 searchable:boolean;document_date:string|null;document_type:string;coverage:string;created_at:string;original_url:string;
}
