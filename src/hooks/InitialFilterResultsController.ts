import {ApiError} from '../api/errors.ts';
import type {WorkspaceSource} from '../types/source.ts';
import type {InitialDecision,InitialResultsState} from '../types/initialResults.ts';
const initial=():InitialResultsState=>({data:null,decision:'APPROVE',offset:0,loading:false,error:null});
export class InitialFilterResultsController {
 private current=initial();private active=false;private generation=0;private request:AbortController|null=null;private timer:ReturnType<typeof setTimeout>|null=null;
 private listeners=new Set<()=>void>();private source:WorkspaceSource;private expired:()=>void;
 constructor(source:WorkspaceSource,expired:()=>void){this.source=source;this.expired=expired;}
 snapshot=()=>this.current;subscribe=(fn:()=>void)=>{this.listeners.add(fn);return()=>{this.listeners.delete(fn);};};
 private emit(v:Partial<InitialResultsState>){if(this.active){this.current={...this.current,...v};this.listeners.forEach(fn=>fn());}}
 private clearTimer(){if(this.timer!==null)clearTimeout(this.timer);this.timer=null;}
 start=()=>{this.active=true;void this.refresh();};
 stop=()=>{this.active=false;this.generation++;this.clearTimer();this.request?.abort();this.current=initial();this.listeners.forEach(fn=>fn());};
 select=(decision:InitialDecision)=>{if(decision!==this.current.decision)void this.refresh(decision,0);};
 next=()=>{if(!this.current.loading&&this.current.data?.next_offset!==null&&this.current.data)void this.refresh(this.current.decision,this.current.data.next_offset);};
 previous=()=>{if(!this.current.loading)void this.refresh(this.current.decision,Math.max(0,this.current.offset-50));};
 refresh=async(decision=this.current.decision,offset=this.current.offset)=>{
  if(!this.active||this.source.kind!=='live')return;
  this.clearTimer();this.request?.abort();const request=this.request=new AbortController(),ticket=++this.generation;
  const valid=()=>this.active&&!request.signal.aborted&&ticket===this.generation;
  this.emit({loading:true,error:null,decision,offset,...(decision!==this.current.decision||offset!==this.current.offset?{data:null}:{})});
  try{
   if(!this.source.initialFilterResults)throw new ApiError(404,'unavailable','Unavailable');
   const data=await this.source.initialFilterResults(decision,offset,request.signal);if(!valid())return;
   this.emit({data});
   if(data.processing_enabled&&!data.is_complete)this.timer=setTimeout(()=>void this.refresh(),5000);
  }catch(e){if(valid()){
   if(e instanceof ApiError&&e.status===401){this.stop();this.expired();return;}
   this.emit({error:e instanceof ApiError&&[404,405,501].includes(e.status)?'Результаты первоначальной проверки пока недоступны на этом сервере. Требуется обновление Backend.':'Не удалось обновить результаты. Показанные данные могут быть устаревшими. Повторите загрузку.'});
  }}finally{if(valid())this.emit({loading:false});}
 };
}
