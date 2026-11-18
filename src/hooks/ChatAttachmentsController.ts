import type {WorkspaceSource} from '../types/source.ts';
import type {DocumentDto} from '../types/documents.ts';
import type {ChatAttachmentItem,ChatAttachmentsPresentation} from '../types/chatAttachments.ts';
import {ApiError} from '../api/errors.ts';
import {tr} from '../i18n/index.ts';
interface Entry {item:ChatAttachmentItem;abort:AbortController;task?:Promise<void>;document?:DocumentDto}
export class ChatAttachmentsController {
 private entries=new Map<string,Entry>();private rows:ChatAttachmentItem[]=[];private listeners=new Set<()=>void>();private active=false;
 private source:WorkspaceSource;private uuid:()=>string;
 constructor(source:WorkspaceSource,uuid:()=>string=()=>crypto.randomUUID()){this.source=source;this.uuid=uuid;}
 snapshot=()=>this.rows;
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
 start=()=>{this.active=true;};
 private emit(){this.rows=[...this.entries.values()].map(entry=>({...entry.item}));this.listeners.forEach(fn=>fn());}
 private current(entry:Entry){return this.active&&this.entries.get(entry.item.id)===entry;}
 add=(files:File[])=>{
  if(!this.active)return;
  if(files.length+this.entries.size>8||files.some(file=>file.size<1||file.size>25*1024*1024))throw new ApiError(400,'invalid_upload','Invalid files');
  for(const file of files){
   const previewUrl=['image/png','image/jpeg','image/webp','image/gif'].includes(file.type)?URL.createObjectURL(file):null;
   const entry:Entry={item:{id:this.uuid(),file,filename:file.name,previewUrl,progress:0,status:'uploading',error:null},abort:new AbortController()};
   this.entries.set(entry.item.id,entry);entry.task=this.upload(entry);
  }this.emit();
 };
 private async upload(entry:Entry){
  try{
   if(!this.source.uploadStagedDocument)throw new ApiError(503,'files_unavailable','Unavailable');
   const document=await this.source.uploadStagedDocument(entry.item.file,entry.item.id,progress=>{
    if(this.current(entry)){entry.item.progress=progress;this.emit();}
   },entry.abort.signal);
   if(!this.current(entry)||entry.abort.signal.aborted)return;
   entry.document=document;entry.item.status='ready';entry.item.progress=1;this.emit();
  }catch(error){if(!this.current(entry)||entry.abort.signal.aborted)return;
   entry.item.status='error';entry.item.error=tr('attachmentUploadFailed',{ns:'chat'});this.emit();}
 }
 retry=(id:string)=>{const entry=this.entries.get(id);if(!entry||entry.item.status!=='error'||!this.active)return;
  entry.abort=new AbortController();entry.item.status='uploading';entry.item.error=null;entry.item.progress=0;entry.task=this.upload(entry);this.emit();};
 private detach(entry:Entry){this.entries.delete(entry.item.id);if(entry.item.previewUrl)URL.revokeObjectURL(entry.item.previewUrl);}
 remove=(id:string)=>{const entry=this.entries.get(id);if(!entry)return;entry.abort.abort();this.detach(entry);this.emit();
  // The server tombstone also cancels a POST that finishes after this request.
  void this.source.discardStagedUpload?.(id).catch(()=>{});
 };
 clear=()=>{for(const id of [...this.entries.keys()])this.remove(id);};
 stop=()=>{this.clear();this.active=false;};
 async prepare(files:File[]):Promise<DocumentDto[]>{
  const entries=files.map(file=>[...this.entries.values()].find(entry=>entry.item.file===file));
  if(entries.some(entry=>!entry))throw new ApiError(400,'invalid_upload','Attachment changed');
  await Promise.all(entries.map(entry=>entry!.task));
  if(entries.some(entry=>!this.current(entry!)||entry!.item.status!=='ready'||!entry!.document))throw new ApiError(400,'upload_pending','Wait for the upload or retry');
  return entries.map(entry=>entry!.document!);
 }
 accepted=(files:File[])=>{for(const entry of [...this.entries.values()])if(files.includes(entry.item.file))this.detach(entry);this.emit();};
 presentation():ChatAttachmentsPresentation{return {items:this.rows,onAdd:this.add,onRemove:this.remove,onRetry:this.retry,onClear:this.clear};}
}
