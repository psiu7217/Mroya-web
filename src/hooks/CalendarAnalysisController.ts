import type {WorkspaceSource} from '../types/source.ts';
import type {CalendarAnalysis,CalendarAnalysisPresentation,AnalysisEventState} from '../types/calendarAnalysis.ts';
import {ApiError} from '../api/errors.ts';
export interface AnalysisState {calendars:CalendarAnalysis[];expanded:string[];events:Record<string,AnalysisEventState>;loading:boolean;error:'load'|'action'|'conflict'|null;busyCalendar:string|null}
const empty=():AnalysisState=>({calendars:[],expanded:[],events:{},loading:false,error:null,busyCalendar:null});
export class CalendarAnalysisController {
 private state=empty();private listeners=new Set<()=>void>();private connection:string|null=null;private visible=false;
 private epoch=0;private sequence=0;private request:AbortController|null=null;private timer:ReturnType<typeof setTimeout>|null=null;
 private refreshing=false;private mutating=false;private csrfRequired=false;private pages=new Map<string,number>();
 private source:WorkspaceSource;private expired:()=>void;
 constructor(source:WorkspaceSource,expired:()=>void){this.source=source;this.expired=expired;}
 snapshot=()=>this.state;
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
 private emit(patch:Partial<AnalysisState>){this.state={...this.state,...patch};this.listeners.forEach(fn=>fn());}
 private cancel(){this.sequence++;this.request?.abort();this.request=null;this.refreshing=false;if(this.timer)clearTimeout(this.timer);this.timer=null;}
 stop=()=>{this.cancel();this.epoch++;this.connection=null;this.visible=false;this.mutating=false;this.pages.clear();this.emit(empty());};
 setContext=(connection:string|null,visible:boolean)=>{
  const changed=connection!==this.connection;
  if(!changed&&visible===this.visible)return;
  if(changed){this.stop();this.connection=connection;}
  this.visible=visible;
  if(!visible){if(!this.mutating)this.cancel();return;}
  if(connection)void this.refresh();
 };
 private schedule(){if(this.timer)clearTimeout(this.timer);this.timer=null;
  if(this.visible&&this.connection)this.timer=setTimeout(()=>void this.refresh(),5000);
 }
 private merge(row:CalendarAnalysis){
  this.emit({calendars:this.state.calendars.map(old=>old.calendar_id===row.calendar_id?(old.version>row.version?old:row):old)});
 }
 private async readEvents(id:string,signal:AbortSignal,valid:()=>boolean){
  if(!this.source.calendarAnalysisEvents)return;
  this.emit({events:{...this.state.events,[id]:{...(this.state.events[id]??{rows:[],next:null}),loading:true,error:false}}});
  try{
   let offset=0,next:number|null=null;const rows:AnalysisEventState['rows']=[];
   for(let page=0;page<(this.pages.get(id)??1);page++){
    const data=await this.source.calendarAnalysisEvents(id,offset,signal);if(!valid())return;
    if((this.state.calendars.find(c=>c.calendar_id===id)?.version??0)>data.calendar.version){
     this.emit({events:{...this.state.events,[id]:{...this.state.events[id],loading:false}}});return;
    }
    this.merge(data.calendar);rows.push(...data.events);next=data.next_offset;if(next===null)break;offset=next;
   }
   if(valid())this.emit({events:{...this.state.events,[id]:{rows,next,loading:false,error:false}}});
  }catch(error){
   if(!valid())return;
   if(error instanceof ApiError&&error.status===401)throw error;
   this.emit({events:{...this.state.events,[id]:{...(this.state.events[id]??{rows:[],next:null}),loading:false,error:true}}});
  }
 }
 refresh=async()=>{
  if(!this.visible||!this.connection||this.refreshing||this.mutating||!this.source.calendarAnalyses)return;
  this.cancel();const request=new AbortController(),epoch=this.epoch,sequence=this.sequence,id=this.connection;
  this.request=request;this.refreshing=true;const valid=()=>epoch===this.epoch&&sequence===this.sequence&&!request.signal.aborted;
  this.emit({loading:true});
  try{
   const incoming=await this.source.calendarAnalyses(id,request.signal);if(!valid())return;
   const calendars=incoming.map(row=>{const old=this.state.calendars.find(c=>c.calendar_id===row.calendar_id);return old&&old.version>row.version?old:row;});
   const ids=new Set(calendars.map(c=>c.calendar_id));
   this.emit({calendars,expanded:this.state.expanded.filter(id=>ids.has(id)),error:this.state.error==='load'?null:this.state.error});
   for(const id of this.state.expanded){await this.readEvents(id,request.signal,valid);if(!valid())return;}
  }catch(error){
   if(!valid())return;
   if(error instanceof ApiError&&error.status===401){this.stop();this.expired();return;}
   this.emit({error:'load'});
  }finally{if(valid()){this.refreshing=false;this.emit({loading:false});this.schedule();}}
 };
 toggle=(id:string)=>{
  if(this.mutating)return;
  const open=this.state.expanded.includes(id);
  this.emit({expanded:open?this.state.expanded.filter(value=>value!==id):[...this.state.expanded,id]});
  if(!open){this.cancel();void this.refresh();}
 };
 more=(id:string)=>{if(this.mutating||this.refreshing||!this.state.events[id]?.next)return;
  this.pages.set(id,(this.pages.get(id)??1)+1);void this.refresh();
 };
 action=async(id:string,action:'stop'|'retry',jobId?:string)=>{
  const calendar=this.state.calendars.find(c=>c.calendar_id===id);
  if(this.mutating||!this.visible||!this.source.controlCalendarAnalysis||!calendar||!(action==='stop'?calendar.can_stop:calendar.can_retry))return;
  this.cancel();this.mutating=true;const request=new AbortController(),epoch=this.epoch;
  this.request=request;const valid=()=>epoch===this.epoch&&!request.signal.aborted;
  this.emit({busyCalendar:id,loading:false,error:null});
  try{
   if(this.csrfRequired){await this.source.refreshCsrf?.(request.signal);if(!valid())return;this.csrfRequired=false;}
   const row=await this.source.controlCalendarAnalysis(id,action,calendar.version,jobId,request.signal);
   if(valid())this.merge(row);
  }catch(error){
   if(!valid())return;
   if(error instanceof ApiError&&error.status===401){this.stop();this.expired();return;}
   if(error instanceof ApiError&&error.status===403)this.csrfRequired=true;
   this.emit({error:error instanceof ApiError&&error.status===409?'conflict':'action'});
  }finally{if(valid()){this.mutating=false;this.emit({busyCalendar:null});void this.refresh();}}
 };
 presentation():CalendarAnalysisPresentation{return {...this.state,onRefresh:()=>void this.refresh(),onToggle:this.toggle,onMore:this.more,
  onStop:id=>void this.action(id,'stop'),onRetry:(id,jobId)=>void this.action(id,'retry',jobId)};}
}
