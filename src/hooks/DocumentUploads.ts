import type {WorkspaceSource} from '../types/source.ts';
import type {DocumentDto} from '../types/documents.ts';
import {ApiError} from '../api/errors.ts';

function pause(signal:AbortSignal){
 return new Promise<void>((resolve,reject)=>{
  if(signal.aborted){reject(new DOMException('Aborted','AbortError'));return;}
  const done=()=>{signal.removeEventListener('abort',cancel);resolve();};
  const timer=setTimeout(done,1500);
  const cancel=()=>{clearTimeout(timer);reject(new DOMException('Aborted','AbortError'));};
  signal.addEventListener('abort',cancel,{once:true});
 });
}

/** Account-local cache: a deliberate retry of the same File uses the same upload ID. */
export class DocumentUploads {
 private files=new WeakMap<File,{uploadId:string;document?:DocumentDto}>();
 private uuid:()=>string;
 constructor(uuid:()=>string=()=>crypto.randomUUID()){this.uuid=uuid;}
 async prepare(source:WorkspaceSource,files:File[],context:string,signal:AbortSignal):Promise<DocumentDto[]>{
  if(!files.length)return [];
  if(!source.uploadDocument||!source.document||files.length>8||files.some(file=>file.size<1||file.size>25*1024*1024))
   throw new ApiError(400,'invalid_upload','Choose up to 8 files, each between 1 byte and 25 MiB.');
  const entries:{uploadId:string;document?:DocumentDto}[]=[];
  for(const file of files){
   if(signal.aborted)throw new DOMException('Aborted','AbortError');
   let entry=this.files.get(file);
   if(!entry){entry={uploadId:this.uuid()};this.files.set(file,entry);}
   if(!entry.document)entry.document=await source.uploadDocument(file,entry.uploadId,context.slice(0,4000),signal);
   entries.push(entry);
  }
  // Save the whole batch first. One processing deadline covers all files.
  for(let attempt=0;attempt<40;attempt++){
   const pending=entries.filter(entry=>['queued','processing'].includes(entry.document!.status));
   if(!pending.length)break;
   await pause(signal);
   await Promise.all(pending.map(async entry=>{entry.document=await source.document!(entry.document!.id,signal);}));
  }
   if(signal.aborted)throw new DOMException('Aborted','AbortError');
  return entries.map(entry=>entry.document!);
 }
}
