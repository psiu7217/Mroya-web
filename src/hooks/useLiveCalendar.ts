import {useEffect,useMemo,useRef,useSyncExternalStore} from 'react';
import {ApiError} from '../api/errors.ts';
import type {WorkspaceSource} from '../types/source.ts';
import type {CalendarEventDto,GoogleConnectionDto,GoogleConfiguration} from '../types/calendarApi.ts';
import type {CalendarEvent} from '../types/mroya.ts';
import {calendarPresentation,calendarWrite,googleSyncPresentation} from './calendarAdapters.ts';
export type CalendarState={available:boolean;googleAvailable:boolean;events:CalendarEvent[];connections:GoogleConnectionDto[];selectedConnectionId:string|null;loading:boolean;busy:boolean;mutationPending:boolean;error:string|null;googleError:string|null;googleBusy:boolean;oauthNotice:string|null};
type Operation={method:'POST'|'PATCH'|'DELETE';id:string|null;body:Record<string,unknown>};
export function consumeCalendarOAuthReturn(location:Pick<Location,'href'>,history:Pick<History,'state'|'replaceState'>):string|null{
 const url=new URL(location.href),hint=url.searchParams.get('calendar_google');
 if(hint===null)return null;
 url.searchParams.delete('calendar_google');history.replaceState(history.state,'',url.pathname+url.search+url.hash);
 return ({connected:'Google consent returned. Backend connection and sync status are verified separately below.',cancelled:'Google Calendar connection was cancelled.',expired:'Google Calendar authorization expired. Sign in and connect again.',error:'Google Calendar authorization failed. Try connecting again.'} as Record<string,string>)[hint]??'Checking Google Calendar connection.';
}
export class LiveCalendarController {
 private current:CalendarState={available:false,googleAvailable:false,events:[],connections:[],selectedConnectionId:null,loading:false,busy:false,mutationPending:false,error:null,googleError:null,googleBusy:false,oauthNotice:null};
 private listeners=new Set<()=>void>();private active=false;private generation=0;
 private reads=new Set<AbortController>();private eventRead:AbortController|null=null;private googleRead:AbortController|null=null;
 private operation:Operation|null=null;private writing=false;private googleWriting=false;
 private range={start:new Date().getFullYear()+'-01-01',end:new Date().getFullYear()+'-12-31'};
 private source:WorkspaceSource;private timezone:string;private expired:()=>void;private navigate:(url:string)=>void;
 constructor(source:WorkspaceSource,timezone:string,expired:()=>void,navigate:(url:string)=>void=url=>window.location.assign(url)){this.source=source;this.timezone=timezone;this.expired=expired;this.navigate=navigate;}
 setTimezone=(timezone:string)=>{this.timezone=timezone;}; // Only the default for future creates; existing DTOs/pending writes stay unchanged.
 snapshot=()=>this.current;
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
 private emit(patch:Partial<CalendarState>){if(!this.active)return;this.current={...this.current,...patch};this.listeners.forEach(fn=>fn());}
 start=(available:boolean,googleAvailable:boolean)=>{this.active=true;this.emit({available,googleAvailable});};
 stop=()=>{this.active=false;this.generation++;for(const request of this.reads)request.abort();this.reads.clear();this.operation=null;this.writing=false;this.googleWriting=false;this.eventRead=null;this.googleRead=null;this.current={...this.current,events:[],connections:[],selectedConnectionId:null,busy:false,mutationPending:false,googleBusy:false,loading:false};};
 private request(){const abort=new AbortController();this.reads.add(abort);return abort;}
 private fail(error:unknown,google=false){
  if(error instanceof ApiError&&error.status===401){this.stop();this.expired();return;}
  const message=error instanceof ApiError&&error.status===403?'Security check failed. Retry to refresh CSRF.':error instanceof ApiError&&error.status===409?'The event or calendar changed on the server. Review the refreshed state before trying again.':error instanceof Error?error.message:'Calendar request failed.';
  this.emit(google?{googleError:message}:{error:message});
 }
 setRange=(start:string,end:string)=>{if(start===this.range.start&&end===this.range.end)return;this.range={start,end};void this.loadEvents();};
 loadEvents=async()=>{
  if(!this.active||!this.current.available||!this.source.calendarEvents)return;
  this.eventRead?.abort();const abort=this.request(),generation=this.generation;this.eventRead=abort;
  this.emit({loading:true});
  try{
   const rows:CalendarEventDto[]=[];let offset=0;
   for(let page=0;page<50;page++){
    const result=await this.source.calendarEvents(this.range.start,this.range.end,offset,abort.signal);
    if(!this.active||abort.signal.aborted||generation!==this.generation)return;
    if(result.offset!==offset||result.limit!==100)throw new Error('Invalid calendar pagination.');
    rows.push(...result.events);if(result.events.length<result.limit){this.emit({events:[...new Map(rows.map(row=>[row.occurrence_id??row.id,calendarPresentation(row)])).values()],error:this.operation?this.current.error:null});return;}
    offset+=result.limit;
   }
   throw new Error('Too many events in this range. Choose a smaller calendar view.');
  }catch(error){if(this.active&&!abort.signal.aborted&&generation===this.generation)this.fail(error);}
  finally{this.reads.delete(abort);if(this.eventRead===abort){this.eventRead=null;this.emit({loading:false});}}
 };
 loadConnections=async()=>{
  if(!this.active||!this.current.googleAvailable||!this.source.googleCalendarConnections||this.googleWriting)return;
  this.googleRead?.abort();const abort=this.request(),generation=this.generation;this.googleRead=abort;
  try{const connections=await this.source.googleCalendarConnections(abort.signal);
   if(!this.active||abort.signal.aborted||generation!==this.generation)return;
   const selectedConnectionId=connections.some(c=>c.id===this.current.selectedConnectionId)?this.current.selectedConnectionId:connections.find(c=>c.status==='connected')?.id??connections[0]?.id??null;
   this.emit({connections,selectedConnectionId,googleError:null});
  }catch(error){if(this.active&&!abort.signal.aborted&&generation===this.generation)this.fail(error,true);}
  finally{this.reads.delete(abort);if(this.googleRead===abort)this.googleRead=null;}
 };
 selectConnection=(id:string)=>{if(this.googleWriting||!this.current.connections.some(c=>c.id===id))return;this.emit({selectedConnectionId:id,googleError:null});};
 get connection(){return this.current.connections.find(c=>c.id===this.current.selectedConnectionId);}
 oauthReturn=(message:string|null)=>{if(message)this.emit({oauthNotice:message});};
 loadForEdit=async(event:CalendarEvent):Promise<CalendarEvent|null>=>{
  if(!this.active||this.current.busy||this.operation||event.isReadOnly||!event.api||!this.source.calendarEvent)return null;
  const abort=this.request(),generation=this.generation;
  try{const dto=await this.source.calendarEvent(event.api.series_id??event.api.id,abort.signal);if(!this.active||abort.signal.aborted||generation!==this.generation)return null;return calendarPresentation(dto);}
  catch(error){if(!abort.signal.aborted)this.fail(error);return null;}finally{this.reads.delete(abort);}
 };
 create=(event:Omit<CalendarEvent,'id'>)=>this.prepare('POST',event);
 edit=(event:CalendarEvent)=>this.prepare('PATCH',event);
 remove=(id:string,version?:number)=>{const event=this.current.events.find(e=>e.id===id);if(!event)return Promise.resolve(false);if(version!==undefined&&event.api?.version!==version){this.emit({error:'This event changed. Close the confirmation and review the updated event.'});return Promise.resolve(false);}return this.prepare('DELETE',event);};
 private async prepare(method:Operation['method'],event:Omit<CalendarEvent,'id'>):Promise<boolean>{
  if(!this.active||!this.current.available||this.writing||this.operation)return false;
  try{
   if(method!=='POST'&&(!event.api||event.isReadOnly))throw new Error('This event is read-only.');
   const changes=method==='DELETE'?null:calendarWrite(event,this.timezone);
   if(method==='PATCH'&&!Object.keys(changes!).length)return true;
   const body=method==='POST'?{submission_id:crypto.randomUUID(),event:changes}:{submission_id:crypto.randomUUID(),version:event.api!.version,...(method==='PATCH'?{changes}:{})};
   this.emit({mutationPending:true});
   this.operation={method,id:method==='POST'?null:event.api!.series_id??event.api!.id,body};return await this.execute();
  }catch(error){this.fail(error);return false;}
 }
 private execute=async():Promise<boolean>=>{
  if(!this.active||this.writing||!this.operation||!this.source.mutateCalendar)return false;
  this.writing=true;this.eventRead?.abort();const op=this.operation,abort=this.request(),generation=this.generation;this.emit({busy:true,error:null});
  try{
   const result=await this.source.mutateCalendar(op.method,op.id,op.body,abort.signal);
   if(!this.active||abort.signal.aborted||generation!==this.generation)return false;
   if(op.id&&result.events[0].id!==op.id)throw new Error('Calendar mutation returned a different event.');
   this.operation=null;this.emit({mutationPending:false});await this.loadEvents();void this.loadConnections();return true;
  }catch(error){
   if(!this.active||abort.signal.aborted||generation!==this.generation)return false;
   const uncertain=!(error instanceof ApiError)||error.status>=500;
   // Only an explicit Retry may replay the exact submission UUID/payload after a lost response.
   if(!uncertain&&!(error instanceof ApiError&&error.status===403)){this.operation=null;this.emit({mutationPending:false});}
   this.fail(error);if(this.active&&error instanceof ApiError&&[404,409].includes(error.status)){const message=this.current.error;await this.loadEvents();this.emit({error:message});}
   return false;
  }finally{this.reads.delete(abort);if(generation===this.generation){this.writing=false;this.emit({busy:false});}}
 };
 retry=async()=>{if(this.operation)return this.execute();await this.loadEvents();return false;};
 connect=(another=false)=>this.googleWrite('connect',undefined,another);
 disconnect=()=>this.googleWrite('disconnect');
 sync=()=>this.googleWrite('sync');
 toggleAuto=()=>this.googleWrite('configure',{sync_enabled:!this.connection?.sync_enabled});
 imports=(ids:string[])=>this.googleWrite('configure',{selected_calendar_ids:ids});
 destination=(id:string)=>this.googleWrite('configure',{export_calendar_id:id||null});
 private async googleWrite(action:'connect'|'disconnect'|'sync'|'configure',changes?:GoogleConfiguration,another=false){
  if(!this.active||!this.current.googleAvailable||this.googleWriting)return;
  const connection=this.connection,state=googleSyncPresentation(connection).state;
  if(action!=='connect'&&(!connection||connection.status==='disconnected'))return;
  if(action==='sync'&&['conflict','reconnect_required','connecting','initial_syncing','syncing'].includes(state))return;
  // OFF remains available during pending/error/conflict; it cancels backend work rather than resolving it.
  this.googleWriting=true;this.googleRead?.abort();const abort=this.request(),generation=this.generation;this.emit({googleBusy:true,googleError:null});
  try{
   if(action==='connect'){
    if(!this.source.startCalendarGoogle)throw new Error('Google Calendar is unavailable.');
    const url=await this.source.startCalendarGoogle(!another&&connection?.status==='reconnect'?connection.id:undefined,abort.signal);
    if(this.active&&!abort.signal.aborted&&generation===this.generation)this.navigate(url);
   }else if(action==='disconnect')await this.source.disconnectCalendarGoogle!(connection!.id,abort.signal);
   else if(action==='sync')await this.source.syncCalendarGoogle!(connection!.id,abort.signal);
   else await this.source.configureCalendarGoogle!(connection!.id,changes!,abort.signal);
  }catch(error){if(this.active&&!abort.signal.aborted&&generation===this.generation)this.fail(error,true);}
  finally{
   this.reads.delete(abort);
   if(this.active&&generation===this.generation){this.googleWriting=false;this.emit({googleBusy:false});if(action!=='connect'){const error=this.current.googleError;await this.loadConnections();if(error)this.emit({googleError:error});}}
  }
 }
}
export function useLiveCalendar(source:WorkspaceSource,userId:number,timezone:string,available:boolean,googleAvailable:boolean,visible:boolean,onExpired:()=>void){
 const expired=useRef(onExpired);expired.current=onExpired;
 const controller=useMemo(()=>new LiveCalendarController(source,timezone,()=>expired.current()),[source,userId]);
 const state=useSyncExternalStore(controller.subscribe,controller.snapshot,controller.snapshot);
 useEffect(()=>{controller.setTimezone(timezone);},[controller,timezone]);
 useEffect(()=>{controller.start(available,googleAvailable);return controller.stop;},[controller,available,googleAvailable]);
 useEffect(()=>{if(typeof window!=='undefined')controller.oauthReturn(consumeCalendarOAuthReturn(window.location,window.history));void controller.loadConnections();},[controller,googleAvailable]);
 useEffect(()=>{
  if(!visible)return;
  const refresh=()=>{if(document.visibilityState==='visible'){void controller.loadConnections();void controller.loadEvents();}};
  void controller.loadEvents();void controller.loadConnections();
  window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);
  const timer=setInterval(refresh,10000);
  return()=>{clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};
 },[controller,visible,available,googleAvailable]);
 return {state,controller};
}
