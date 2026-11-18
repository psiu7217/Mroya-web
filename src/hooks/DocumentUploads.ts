import type {WorkspaceSource} from '../types/source.ts';
import type {DocumentDto} from '../types/documents.ts';
import {ApiError} from '../api/errors.ts';

/** Account-local cache: a deliberate retry of the same File uses the same upload ID. */
export class DocumentUploads {
 private files=new WeakMap<File,{uploadId:string;document?:DocumentDto}>();
 private uuid:()=>string;
 constructor(uuid:()=>string=()=>crypto.randomUUID()){this.uuid=uuid;}
 async prepare(source:WorkspaceSource,files:File[],context:string,signal:AbortSignal):Promise<DocumentDto[]>{
  if(!files.length)return [];
  if(!source.uploadDocument||files.length>8||files.some(file=>file.size<1||file.size>25*1024*1024))
   throw new ApiError(400,'invalid_upload','Choose up to 8 files, each between 1 byte and 25 MiB.');
  const entries:{uploadId:string;document?:DocumentDto}[]=[];
  for(const file of files){
   if(signal.aborted)throw new DOMException('Aborted','AbortError');
   let entry=this.files.get(file);
   if(!entry){entry={uploadId:this.uuid()};this.files.set(file,entry);}
   if(!entry.document)entry.document=await source.uploadDocument(file,entry.uploadId,context.slice(0,4000),signal);
   entries.push(entry);
  }
  // Classification is a background job. Chat only waits for the original bytes.
  if(signal.aborted)throw new DOMException('Aborted','AbortError');
  return entries.map(entry=>entry.document!);
 }
}
