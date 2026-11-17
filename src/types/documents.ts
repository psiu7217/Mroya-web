export interface DocumentDto {
 keywords?:string[];
 id:string;filename:string;title:string;mime_type:string;size_bytes:number;
 status:'staged'|'queued'|'processing'|'ready'|'needs_attention'|'failed';error_code:string|null;
 category:{id?:string;path:string[];search_enabled:boolean;effective_search_enabled:boolean}|null;
 searchable:boolean;document_date:string|null;document_type:string;coverage:string;created_at:string;original_url:string;
}

export interface DocumentCategoryDto {
 id:string;parent_id:string|null;name:string;path:string[];search_enabled:boolean;
 effective_search_enabled:boolean;policy_source:'model'|'user';version:number;
}
export interface DocumentDetail extends DocumentDto {
 review_reasons?:('unverified_facts'|'unverified_values'|'unverified_date'|'incomplete_text'|'model_uncertain')[];
 summary:string;analysis_version:number;page_count:number;processed_at:string|null;
 analysis_author:'model'|'user';analysis_model:string;
 pages:{page:number;text:string}[];
 facts:{text:string;page:number;quote:string}[];
 values:{label:string;value:string;unit?:string;subject?:string;observed_on?:string|null;page:number;quote:string}[];
}
export interface DocumentCorrection {title:string;summary:string;keywords:string[];category_id:string|null;analysis_version:number}
export interface DocumentLibraryQuery {category?:string;q?:string;order?:'newest'|'name';offset?:number}
export interface DocumentLibraryPage {documents:DocumentDto[];next_offset:number|null;total:number}
export interface FilesPresentation {
 canDelete:boolean;onDelete:()=>Promise<boolean>;
 designPreview?:boolean;
 rows:DocumentDto[];categories:DocumentCategoryDto[];category:string;query:string;order:'newest'|'name';total:number;
 loading:boolean;loadingMore:boolean;error:string|null;hasMore:boolean;uploading:boolean;mutating:boolean;
 selectedId:string|null;detail:DocumentDetail|null;detailLoading:boolean;detailError:string|null;
 onRefresh:()=>void;onMore:()=>void;onCategory:(id:string)=>void;onSearch:(query:string)=>void;onOrder:(order:'newest'|'name')=>void;
 onSelect:(id:string|null)=>void;onRetryDetail:()=>void;onUpload:(files:File[])=>Promise<boolean>;
 onSave:(changes:Omit<DocumentCorrection,'analysis_version'>)=>Promise<boolean>;onReprocess:()=>void;
 onCategorySearch:(category:DocumentCategoryDto,enabled:boolean)=>void;
 onCreateCategory:(name:string,parentId:string|null,searchEnabled:boolean)=>Promise<boolean>;
}
