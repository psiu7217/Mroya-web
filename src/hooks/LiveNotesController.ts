import {ApiError} from '../api/errors.ts';
import type {WorkspaceSource} from '../types/source.ts';
import type {NoteSummaryDto,NoteDetailDto} from '../types/notesApi.ts';
import type {NoteItem} from '../types/notes.ts';
export interface NotesState {
 rows:NoteSummaryDto[]; loaded:boolean; loading:boolean; loadingMore:boolean; error:string|null; next:number|null;
 selectedId:string|null; selectedSummary:NoteSummaryDto|null; detail:NoteDetailDto|null; detailLoading:boolean; detailError:string|null;
}
const initial=():NotesState=>({rows:[],loaded:false,loading:false,loadingMore:false,error:null,next:null,selectedId:null,selectedSummary:null,detail:null,detailLoading:false,detailError:null});
// Never map absent v1 category/source/noteType, or list metadata to a claimed full body.
export function notePresentation(note:NoteSummaryDto|NoteDetailDto):NoteItem {
 return {id:note.id,title:note.title,summary:note.summary,tags:[...note.keywords],searchPhrases:[...note.search_phrases],
  memoryLinks:'memory_links' in note?note.memory_links.map(link=>({...link})):undefined,
  content:'content' in note?note.content:'',createdAt:note.created_at,
  updatedAt:new Intl.DateTimeFormat(undefined,{day:'2-digit',month:'short',year:'numeric'}).format(new Date(note.updated_at))};
}
export const notesSourceAvailable=(source:WorkspaceSource,capable:boolean)=>source.kind==='live'&&capable===true&&typeof source.notes==='function'&&typeof source.note==='function';
// Preserve PostgreSQL's microsecond ordering before the UUID tie-breaker.
const subMillisecond=(stamp:string)=>(/\.(\d+)/.exec(stamp)?.[1]??'').padEnd(6,'0').slice(3,6);
const sorted=(rows:NoteSummaryDto[])=>rows.sort((a,b)=>Date.parse(b.updated_at)-Date.parse(a.updated_at)||subMillisecond(b.updated_at).localeCompare(subMillisecond(a.updated_at))||b.id.localeCompare(a.id));
export class LiveNotesController {
 private state=initial();private listeners=new Set<()=>void>();private active=false;private visible=false;
 private listAbort:AbortController|null=null;private detailAbort:AbortController|null=null;private epoch=0;private detailEpoch=0;
 readonly scopeKey='notes-'+crypto.randomUUID();
 private source:WorkspaceSource;private expired:()=>void;
 constructor(source:WorkspaceSource,expired:()=>void){this.source=source;this.expired=expired;}
 snapshot=()=>this.state;
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
 private emit(patch:Partial<NotesState>){if(!this.active)return;this.state={...this.state,...patch};this.listeners.forEach(fn=>fn());}
 start=()=>{this.active=true;};
 stop=()=>{this.active=false;this.visible=false;this.cancel();this.state=initial();this.listeners.forEach(fn=>fn());};
 private cancel(){this.epoch++;this.detailEpoch++;this.listAbort?.abort();this.detailAbort?.abort();this.listAbort=null;this.detailAbort=null;}
 setVisible=(visible:boolean)=>{
  if(this.visible===visible)return;this.visible=visible;
  if(visible)void this.refresh();
  else {this.cancel();this.emit({loading:false,loadingMore:false,selectedId:null,selectedSummary:null,detail:null,detailLoading:false,detailError:null});}
 };
 private message(error:unknown){return error instanceof ApiError?(error.status===403?'Notes access was denied. Check your session and retry.':error.status===404?'This note is no longer available.':error.message):'Unable to load Notes. Check your connection and retry.';}
 private failure(error:unknown){if(error instanceof ApiError&&error.status===401){this.stop();this.expired();return true;}return false;}
 refresh=()=>this.load(false);
 more=()=>this.load(true);
 private async load(more:boolean){
  if(!this.active||!this.visible||!this.source.notes||this.source.kind!=='live')return;
  if(more&&(this.state.loading||this.state.loadingMore||this.state.next===null))return;
  const offset=more?this.state.next!:0;
  if(offset>10000){this.emit({error:'Notes pagination limit reached. Reopen Notes to refresh the list.',next:null});return;}
  this.listAbort?.abort();const abort=this.listAbort=new AbortController(),epoch=++this.epoch;
  this.emit({loading:!more,loadingMore:more,error:null});
  try {
   const page=await this.source.notes(offset,abort.signal);
   if(!this.active||!this.visible||abort.signal.aborted||epoch!==this.epoch)return;
   const rows=more?[...new Map([...this.state.rows,...page.notes].map(n=>[n.id,n])).values()]:page.notes;
   sorted(rows);
   this.emit({rows,loaded:true,loading:false,loadingMore:false,error:null,next:page.has_more?offset+page.limit:null});
  }catch(error){if(!this.active||abort.signal.aborted||epoch!==this.epoch)return;if(this.failure(error))return;this.emit({loading:false,loadingMore:false,error:this.message(error)});}
 }
 select=(id:string|null)=>{
  if(!this.active||!this.visible)return;
  if(id!==null&&!this.state.rows.some(n=>n.id===id))return;
  this.detailAbort?.abort();this.detailEpoch++;
  if(id===null){this.emit({selectedId:null,selectedSummary:null,detail:null,detailLoading:false,detailError:null});return;}
  const selectedSummary=this.state.rows.find(n=>n.id===id);if(!selectedSummary)return;
  this.emit({selectedId:id,selectedSummary,detail:null,detailError:null,detailLoading:true});void this.readDetail(id);
 };
 retryDetail=()=>{if(this.state.selectedId&&!this.state.detailLoading){this.emit({detailLoading:true,detailError:null});void this.readDetail(this.state.selectedId);}};
 private async readDetail(id:string){
  if(!this.source.note)return;
  this.detailAbort?.abort();const abort=this.detailAbort=new AbortController(),epoch=++this.detailEpoch;
  try{
   const note=await this.source.note(id,abort.signal);
   if(!this.active||!this.visible||abort.signal.aborted||epoch!==this.detailEpoch||this.state.selectedId!==id)return;
   // Detail is authoritative even if the list's metadata predates an Agent update.
   const {content:_,memory_links:__,...brief}=note;
   this.emit({selectedSummary:brief,detail:note,detailLoading:false,detailError:null,rows:sorted(this.state.rows.map(n=>n.id===id?brief:n))});
  }catch(error){if(!this.active||abort.signal.aborted||epoch!==this.detailEpoch)return;if(this.failure(error))return;this.emit({detailLoading:false,detailError:this.message(error)});}
 }
}
