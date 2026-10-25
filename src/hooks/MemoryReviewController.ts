import {ApiError} from '../api/errors.ts';
import {tr} from '../i18n/index.ts';
import type {WorkspaceSource} from '../types/source.ts';
import type {ReviewState} from '../types/memoryReview.ts';
const initial=():ReviewState=>({data:null,loading:false,busy:false,error:null,offset:0,receipt:null});
export class MemoryReviewController {
 private current=initial();private active=false;private generation=0;private request:AbortController|null=null;
 private timer:ReturnType<typeof setTimeout>|null=null;private listeners=new Set<()=>void>();private refreshAgain=false;
 private source:WorkspaceSource;private expired:()=>void;
 constructor(source:WorkspaceSource,expired:()=>void){this.source=source;this.expired=expired;}
 snapshot=()=>this.current;subscribe=(fn:()=>void)=>{this.listeners.add(fn);return()=>{this.listeners.delete(fn);};};
 private emit(value:Partial<ReviewState>){if(this.active){this.current={...this.current,...value};this.listeners.forEach(fn=>fn());}}
 private clear(){if(this.timer!==null)clearTimeout(this.timer);this.timer=null;}
 start=()=>{this.active=true;void this.refresh();};
 stop=()=>{this.active=false;this.generation++;this.clear();this.request?.abort();this.refreshAgain=false;this.current=initial();this.listeners.forEach(fn=>fn());};
 invalidate=()=>{if(this.current.loading||this.current.busy)this.refreshAgain=true;else void this.refresh();};
 private fail(e:unknown){if(e instanceof ApiError&&e.status===401){this.stop();this.expired();return;}
  this.emit({error:e instanceof ApiError&&[404,405,501].includes(e.status)?tr('reviewUnavailable',{ns:'memory'}):tr('reviewFailed',{ns:'memory'})});}
 refresh=async(offset=this.current.offset)=>{
  if(!this.active||this.current.busy||this.current.loading||this.source.kind!=='live')return;
  this.clear();const abort=this.request=new AbortController(),ticket=++this.generation;
  const valid=()=>this.active&&!abort.signal.aborted&&ticket===this.generation;
  this.emit({loading:true,error:null,offset,...(offset!==this.current.offset?{data:null}:{})});
  try{
   if(!this.source.memoryReviewResults)throw new ApiError(404,'unavailable','Unavailable');
   const data=await this.source.memoryReviewResults(offset,abort.signal);if(!valid())return;
   this.emit({data});
   if(data.processing_enabled&&data.worker_available&&!data.is_complete)this.timer=setTimeout(()=>void this.refresh(),5000);
  }catch(e){if(valid())this.fail(e);}finally{if(valid()){
   this.emit({loading:false});if(this.refreshAgain){this.refreshAgain=false;void this.refresh();}
  }}
 };
 enqueue=()=>this.mutate();retry=(id:string)=>this.mutate(id);
 private async mutate(id?:string){
  if(!this.active||this.current.busy||this.current.loading||this.source.kind!=='live')return;
  this.clear();const abort=this.request=new AbortController(),ticket=++this.generation;
  const valid=()=>this.active&&!abort.signal.aborted&&ticket===this.generation;
  this.emit({busy:true,error:null,receipt:null});
  try{
   if(id){if(!this.source.retryMemoryReview)throw new ApiError(404,'unavailable','Unavailable');await this.source.retryMemoryReview(id,abort.signal);}
   else {if(!this.source.enqueueMemoryReview)throw new ApiError(404,'unavailable','Unavailable');
    const receipt=await this.source.enqueueMemoryReview(abort.signal);if(valid())this.emit({receipt});}
  }catch(e){if(valid())this.fail(e);}
  finally{if(valid()){this.emit({busy:false});const error=this.current.error;await this.refresh();if(error)this.emit({error});}}
 }
 next=()=>{if(this.current.data?.next_offset!==null&&this.current.data)void this.refresh(this.current.data.next_offset);};
 previous=()=>void this.refresh(Math.max(0,this.current.offset-20));
}
