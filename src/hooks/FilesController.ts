import type {WorkspaceListCache} from './workspaceListCache.ts';
import type {WorkspaceSource} from '../types/source.ts';
import type {DocumentDto,DocumentDetail,DocumentCategoryDto,DocumentCorrection,FilesPresentation} from '../types/documents.ts';
import {ApiError} from '../api/errors.ts';
import {tr} from '../i18n/index.ts';

interface State {
 rows:DocumentDto[];categories:DocumentCategoryDto[];category:string;query:string;order:'newest'|'name';total:number;next:number|null;
 loading:boolean;loadingMore:boolean;error:string|null;uploading:boolean;mutating:boolean;
 selectedId:string|null;detail:DocumentDetail|null;detailLoading:boolean;detailError:string|null;
}
const initial=():State=>({rows:[],categories:[],category:'',query:'',order:'newest',total:0,next:null,
 loading:false,loadingMore:false,error:null,uploading:false,mutating:false,selectedId:null,detail:null,detailLoading:false,detailError:null});
export const filesAvailable=(source:WorkspaceSource,capable:boolean)=>capable&&!!(source.documents&&source.documentDetail&&source.documentCategories);

/** Account-local, cancellable library. Presentation never performs transport work. */
export class FilesController {
 private state=initial();private listeners=new Set<()=>void>();private active=false;private visible=false;
 private listAbort?:AbortController;private pageAbort?:AbortController;private listReading=false;private detailAbort?:AbortController;private mutationAbort?:AbortController;
 private poll?:ReturnType<typeof setTimeout>;private epoch=0;private uploads=new WeakMap<File,string>();
 private cache?:WorkspaceListCache;private source:WorkspaceSource;private expired:()=>void;private uuid:()=>string;
 constructor(source:WorkspaceSource,expired:()=>void,uuid:()=>string=()=>crypto.randomUUID(),cache?:WorkspaceListCache){this.cache=cache;this.source=source;this.expired=expired;this.uuid=uuid;}
 snapshot=()=>this.state;
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
 private emit(patch:Partial<State>){this.state={...this.state,...patch};this.listeners.forEach(fn=>fn());}
 start=()=>{
  this.active=true;
  if(!this.cache)return;
  const page=this.cache.read('files');
  const categories=this.cache.read('folders');
  this.emit({
   ...(page&&Array.isArray(page.documents)?{rows:page.documents,total:page.total,next:page.next_offset}:{}),
   ...(Array.isArray(categories)?{categories}:{}),
  });
  void this.refresh(true);
 };
 stop=()=>{this.active=false;this.visible=false;this.epoch++;this.listAbort?.abort();this.pageAbort?.abort();this.detailAbort?.abort();this.mutationAbort?.abort();clearTimeout(this.poll);this.state=initial();};
 setVisible=(visible:boolean)=>{if(this.visible===visible)return;this.visible=visible;clearTimeout(this.poll);
  if(visible&&this.active){if(!this.listAbort||this.listAbort.signal.aborted)void this.refresh();}else{this.epoch++;this.listAbort?.abort();this.pageAbort?.abort();this.detailAbort?.abort();this.emit({loading:false,loadingMore:false,detailLoading:false});}};
 private message(error:unknown){
  if(error instanceof ApiError&&error.status===401){this.stop();this.expired();return '';}
  if(error instanceof ApiError&&error.status===409)return tr('conflict',{ns:'files'});
  if(error instanceof ApiError&&['invalid_upload','file_too_large','document_quota_exceeded','category_exists','invalid_category','category_depth_exceeded'].includes(error.code))return tr(error.code,{ns:'files'});
  return tr('requestFailed',{ns:'files'});
 }
 private schedule(){clearTimeout(this.poll);if(this.active&&this.visible&&this.state.rows.some(d=>['queued','processing'].includes(d.status)))
  this.poll=setTimeout(()=>void this.refresh(),4000);}
 refresh=async(preload=false)=>{
  if(!this.active||!this.visible&&!preload||this.state.mutating||!this.source.documents||!this.source.documentCategories)return;
  this.listAbort?.abort();this.pageAbort?.abort();const abort=this.listAbort=new AbortController(),epoch=++this.epoch;
  const current=()=>this.active&&!abort.signal.aborted&&epoch===this.epoch;
  const query={category:this.state.category,q:this.state.query,order:this.state.order};
  this.listReading=true;
  this.emit({loading:!this.state.rows.length,loadingMore:false,error:null});
  const fail=(error:unknown,from:'files'|'folders')=>{
   if(!current())return;
   if(error instanceof ApiError&&error.status===403){
    this.cache?.forget(from);
    this.emit(from==='files'?{rows:[],total:0,next:null,selectedId:null,detail:null}:{categories:[]});
   }
   const message=this.message(error);
   if(this.active)this.emit({error:message});
  };
  await Promise.allSettled([
   this.source.documents(query,abort.signal).then(page=>{
    if(!current())return;
    if(!query.category&&!query.q&&query.order==='newest')this.cache?.write('files',page);
    this.emit({rows:page.documents,total:page.total,next:page.next_offset,loading:false});
    if(this.state.selectedId)void this.readDetail(this.state.selectedId,false);
    this.schedule();
   }).catch(error=>{fail(error,'files');if(current())this.emit({loading:false});}).finally(()=>{if(current())this.listReading=false;}),
   this.source.documentCategories(abort.signal).then(categories=>{
    if(!current())return;
    this.cache?.write('folders',categories);this.emit({categories});
   }).catch(error=>fail(error,'folders')),
  ]);
  if(this.listAbort===abort)this.listAbort=undefined;
 };
 more=async()=>{
  if(!this.active||!this.visible||this.listReading||this.state.loading||this.state.loadingMore||this.state.next===null||!this.source.documents)return;
  const abort=this.pageAbort=new AbortController(),epoch=this.epoch;this.emit({loadingMore:true});
  try{const page=await this.source.documents({category:this.state.category,q:this.state.query,order:this.state.order,offset:this.state.next},abort.signal);
   if(!this.active||!this.visible||abort.signal.aborted||epoch!==this.epoch)return;
   const ids=new Set(this.state.rows.map(d=>d.id));this.emit({rows:[...this.state.rows,...page.documents.filter(d=>!ids.has(d.id))],total:page.total,next:page.next_offset,loadingMore:false});this.schedule();
  }catch(error){if(this.active&&!abort.signal.aborted&&epoch===this.epoch){const message=this.message(error);if(this.active)this.emit({loadingMore:false,error:message});}}
  finally{if(this.pageAbort===abort)this.pageAbort=undefined;}
 };
 category=(category:string)=>{this.select(null);this.emit({category,rows:[],next:null,total:0});void this.refresh();};
 search=(query:string)=>{this.emit({query:query.slice(0,200),rows:[],next:null,total:0});void this.refresh();};
 order=(order:'newest'|'name')=>{this.emit({order});void this.refresh();};
 select=(id:string|null)=>{this.detailAbort?.abort();this.emit({selectedId:id,detail:null,detailError:null,detailLoading:!!id});if(id)void this.readDetail(id,true);};
 retryDetail=()=>{if(this.state.selectedId)void this.readDetail(this.state.selectedId,true);};
 private async readDetail(id:string,loading:boolean){
  if(!this.source.documentDetail||!this.active||!this.visible)return;
  this.detailAbort?.abort();const abort=this.detailAbort=new AbortController();
  if(loading)this.emit({detailLoading:true,detailError:null});
  try{const detail=await this.source.documentDetail(id,abort.signal);
   if(!this.active||!this.visible||abort.signal.aborted||id!==this.state.selectedId)return;
   this.emit({detail,detailLoading:false,detailError:null});
  }catch(error){if(this.active&&!abort.signal.aborted&&this.state.selectedId===id){const message=this.message(error);if(this.active){
    if(error instanceof ApiError&&[403,404].includes(error.status)){this.cache?.forget('files');this.emit({rows:this.state.rows.filter(row=>row.id!==id),detail:null});}
    this.emit({detailLoading:false,detailError:message});
   }}}
 }
 private async mutate(action:(signal:AbortSignal)=>Promise<unknown>,detail=false):Promise<boolean>{
  if(!this.active||this.state.mutating||this.state.uploading)return false;
  const abort=this.mutationAbort=new AbortController();this.emit({mutating:true,error:null,detailError:null});
  try{await action(abort.signal);if(!this.active||abort.signal.aborted)return false;this.emit({mutating:false});await this.refresh();return true;}
  catch(error){if(!this.active||abort.signal.aborted)return false;const message=this.message(error);if(!this.active)return false;
   this.emit({mutating:false});
   // A lost or conflicting write is reconciled by GET, never by repeating it.
   await this.refresh();if(this.state.selectedId)await this.readDetail(this.state.selectedId,false);
   if(this.active)this.emit(detail?{detailError:message}:{error:message});return false;}
 }
 save=(changes:Omit<DocumentCorrection,'analysis_version'>)=>{
  const detail=this.state.detail;if(!detail||!this.source.saveDocument)return Promise.resolve(false);
  return this.mutate(async signal=>{await this.source.saveDocument!(detail.id,{...changes,analysis_version:detail.analysis_version},signal);},true);
 };
 reprocess=()=>{if(this.state.selectedId&&this.source.retryDocument){const id=this.state.selectedId;void this.mutate(signal=>this.source.retryDocument!(id,signal),true);}};
 deleteSelected=async():Promise<boolean>=>{
  const id=this.state.selectedId;
  if(!this.active||!id||!this.source.deleteDocument||this.state.mutating||this.state.uploading)return false;
  clearTimeout(this.poll);this.listAbort?.abort();this.pageAbort?.abort();this.detailAbort?.abort();this.epoch++;
  const abort=this.mutationAbort=new AbortController();
  this.emit({mutating:true,loading:false,loadingMore:false,detailLoading:false,error:null,detailError:null});
  let removed:string[]=[];
  try{
   const receipt=await this.source.deleteDocument(id,abort.signal);removed=receipt.deleted_category_ids;
  }catch(error){
   if(!this.active||abort.signal.aborted)return false;
   if(error instanceof ApiError&&error.status===401){this.message(error);return false;}
   // Reconcile an uncertain DELETE with GET, never an automatic repeat DELETE.
   let gone=false;
   try{await this.source.documentDetail?.(id,abort.signal);}
   catch(readError){
    gone=readError instanceof ApiError&&readError.status===404;
    if(readError instanceof ApiError&&readError.status===401){this.message(readError);return false;}
   }
   if(!this.active||abort.signal.aborted)return false;
   if(!gone){this.emit({mutating:false,detailError:this.message(error)});this.schedule();return false;}
   try{
    const current=await this.source.documentCategories!(abort.signal),ids=new Set(current.map(category=>category.id));
    removed=this.state.categories.filter(category=>!ids.has(category.id)).map(category=>category.id);
   }catch{
    // The file is confirmed gone; fall back to All files until folder refresh succeeds.
    if(this.active&&!abort.signal.aborted)this.emit({category:'',rows:[],total:0,next:null});
   }
  }
  if(!this.active||abort.signal.aborted)return false;
  this.listAbort?.abort();this.pageAbort?.abort();this.detailAbort?.abort();this.epoch++;
  const removedIds=new Set(removed),before=this.state.categories;
  let category=this.state.category;
  while(removedIds.has(category)){category=before.find(folder=>folder.id===category)?.parent_id??'';}
  const present=this.state.rows.some(file=>file.id===id),selected=this.state.selectedId===id;
  this.emit({rows:this.state.rows.filter(file=>file.id!==id),total:Math.max(0,this.state.total-(present?1:0)),
   categories:before.filter(folder=>!removedIds.has(folder.id)),category,mutating:false,
   ...(selected?{selectedId:null,detail:null,detailError:null,detailLoading:false}:{})});
  await this.refresh();return true;
 };
 categorySearch=(category:DocumentCategoryDto,enabled:boolean)=>{
  if(this.source.setDocumentCategorySearch)void this.mutate(signal=>this.source.setDocumentCategorySearch!(category.id,enabled,category.version,signal));
 };
 createCategory=(name:string,parentId:string|null,enabled:boolean)=>this.source.createDocumentCategory
  ?this.mutate(signal=>this.source.createDocumentCategory!(name,parentId,enabled,signal)):Promise.resolve(false);
 upload=async(files:File[]):Promise<boolean>=>{
  if(!this.active||this.state.uploading||this.state.mutating||!this.source.uploadDocument)return false;
  if(!files.length||files.length>8||files.some(file=>file.size<1||file.size>25*1024*1024)){this.emit({error:tr('invalid_upload',{ns:'files'})});return false;}
  const abort=this.mutationAbort=new AbortController();this.emit({uploading:true,error:null});
  try{for(const file of files){let id=this.uploads.get(file);if(!id){id=this.uuid();this.uploads.set(file,id);}
    await this.source.uploadDocument(file,id,'',abort.signal);if(!this.active||abort.signal.aborted)return false;}
   this.emit({uploading:false});this.category('');return true;
  }catch(error){if(this.active&&!abort.signal.aborted){const message=this.message(error);if(this.active){this.emit({uploading:false,error:message});}}return false;}
 };
 presentation():FilesPresentation {return {...this.state,hasMore:this.state.next!==null,
  canDelete:!!this.source.deleteDocument,onDelete:this.deleteSelected,
  onRefresh:()=>void this.refresh(),onMore:()=>void this.more(),onCategory:this.category,onSearch:this.search,onOrder:this.order,
  onSelect:this.select,onRetryDetail:this.retryDetail,onSave:this.save,onReprocess:this.reprocess,onCategorySearch:this.categorySearch,
  onCreateCategory:this.createCategory,onUpload:this.upload};}
}
