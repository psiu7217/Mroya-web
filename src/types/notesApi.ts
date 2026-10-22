export interface NoteSummaryDto {
 id:string; space_uuid:string; title:string; summary:string; keywords:string[]; search_phrases:string[];
 version:number; sync_status:'pending'|'synced'|'error'; created_at:string; updated_at:string;
}
export interface NoteDetailDto extends NoteSummaryDto {
 content:string; memory_links:{space_uuid:string;object_uuid:string}[];
}
export interface NotesPage {notes:NoteSummaryDto[];limit:number;offset:number;has_more:boolean}
