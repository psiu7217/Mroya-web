import {useEffect,useMemo,useRef,useSyncExternalStore} from 'react';
import {ApiError} from '../api/errors.ts';
import {readReportContext,reportAttemptKey} from '../api/reportContext.ts';
import {copyDiagnosticText} from '../utils/diagnosticsClipboard.ts';
import type {WorkspaceSource} from '../types/source.ts';
import type {ChatMessage} from '../types/mroya.ts';
import type {ChatDiagnostics,DiagnosticActionState} from '../types/workspace.ts';
const empty:DiagnosticActionState={available:false,reporting:false,reported:false,copying:false,copied:false};
// Metadata is the first canonical section. Do not search user/provider text for IDs.
// render_report lengthens its backtick fence if a JSON string contains backticks.
function matchesFullAttempt(text:string,turnId:string,traceId:number):boolean{
 const lines=text.split(/\r?\n/);
 if(lines[0]!=='BEGIN MROYA ERROR REPORT'||lines[1]!=='# Mroya Error Report'||lines.at(-1)!=='END MROYA ERROR REPORT')return false;
 const section=lines.findIndex(line=>line.startsWith('## '));
 if(section<0||lines[section]!=='## Metadata')return false;
 const fence=/^(`{3,})json$/.exec(lines[section+1]??'')?.[1];if(!fence)return false;
 const end=lines.indexOf(fence,section+2);if(end<0)return false;
 try{
  const metadata:unknown=JSON.parse(lines.slice(section+2,end).join('\n'));
  return !!metadata&&typeof metadata==='object'&&!Array.isArray(metadata)
   &&(metadata as Record<string,unknown>).chat_turn_id===turnId
   &&(metadata as Record<string,unknown>).trace_id===traceId;
 }catch{return false;}
}
export class ChatDiagnosticsController {
 private states:Record<string,DiagnosticActionState>={};
 private listeners=new Set<()=>void>();
 private requests=new Set<AbortController>();
 private timers=new Map<string,ReturnType<typeof setTimeout>>();
 private active=true;private generation=0;private csrfRequired=false;
 constructor(private source:WorkspaceSource,private onExpired:()=>void,private onError:(message:string)=>void,
  private copy:typeof copyDiagnosticText=copyDiagnosticText){}
 snapshot=()=>this.states;
 subscribe=(fn:()=>void)=>{this.listeners.add(fn);return ()=>{this.listeners.delete(fn);};};
 private context(message:ChatMessage){return message.sender==='assistant'&&message.status==='failed'?readReportContext(message.report_context):undefined;}
 forMessage=(message:ChatMessage):DiagnosticActionState=>{
  if(!this.active||this.source.kind!=='live')return empty;
  const context=this.context(message);
  return context?this.states[reportAttemptKey(context)]??{...empty,available:true}:empty;
 };
 private set(key:string,patch:Partial<DiagnosticActionState>){this.states={...this.states,[key]:{...empty,...this.states[key],...patch,available:true}};for(const fn of this.listeners)fn();}
 start(){this.active=true;}
 stop=()=>{this.active=false;this.generation++;for(const request of this.requests)request.abort();this.requests.clear();for(const timer of this.timers.values())clearTimeout(timer);this.timers.clear();this.states={};for(const fn of this.listeners)fn();};
 private failure(error:unknown){
  if(error instanceof ApiError&&error.status===401){this.stop();this.onExpired();return;}
  if(error instanceof ApiError&&error.status===403)this.csrfRequired=true;
  this.onError(error instanceof ApiError&&error.status===403?'Session verification expired. Press Report issue again to refresh it and retry the same attempt.'
   :error instanceof ApiError&&error.status===404?'This failure attempt is unavailable. No diagnostic report was copied or registered.'
   :error instanceof ApiError&&error.status===409?'This failure attempt has changed. Reload history before reporting or copying it again.'
   :'The diagnostic action did not complete. You can retry using the same button. No success has been confirmed.');
 }
 onReport=async(message:ChatMessage)=>{
  const context=this.context(message);if(!this.active||this.source.kind!=='live'||!context)return;
  const key=reportAttemptKey(context),state=this.forMessage(message);if(state.reporting||state.reported)return;
  const version=this.generation,abort=new AbortController();this.requests.add(abort);this.set(key,{reporting:true});
  const current=()=>this.active&&version===this.generation&&!abort.signal.aborted;
  try{
   if(this.csrfRequired){
    if(!this.source.refreshCsrf)throw new Error('CSRF unavailable');
    await this.source.refreshCsrf(abort.signal);if(!current())return;this.csrfRequired=false;
   }
   if(!this.source.reportChatIssue)throw new Error('Reporting unavailable');
   await this.source.reportChatIssue(context,abort.signal);
   if(current())this.set(key,{reported:true});
  }catch(error){if(current())this.failure(error);}
  finally{this.requests.delete(abort);if(current())this.set(key,{reporting:false});}
 };
 onCopy=(message:ChatMessage):Promise<void>=>{
  const context=this.context(message);if(!this.active||this.source.kind!=='live'||!context)return Promise.resolve();
  const key=reportAttemptKey(context);if(this.forMessage(message).copying)return Promise.resolve();
  const version=this.generation,abort=new AbortController();this.requests.add(abort);this.set(key,{copying:true,copied:false});
  const current=()=>this.active&&version===this.generation&&!abort.signal.aborted;
  let operation:Promise<void>;
  try{
   // No await before this call: the native clipboard write must retain click activation.
   operation=this.copy(async()=>{
    if(!current())throw new DOMException('Cancelled','AbortError');
    if(!this.source.getFullChatErrorReport)throw new Error('Reporting unavailable');
    let text:string,full=true;
    try{text=await this.source.getFullChatErrorReport(context.turn_id,abort.signal);}
    catch(error){
     if(!current())throw new DOMException('Cancelled','AbortError');
     // Only this permission denial permits fallback; it is not a CSRF failure.
     if(!(error instanceof ApiError&&error.status===403&&error.code==='forbidden'))throw error;
     if(!this.source.getChatErrorReport)throw new Error('Reporting unavailable');
     full=false;text=await this.source.getChatErrorReport(context.turn_id,abort.signal);
    }
    if(!current())throw new DOMException('Cancelled','AbortError');
    const lines=full?[]:text.split(/\r?\n/);
    if(full?!matchesFullAttempt(text,context.turn_id,context.request_trace_id)
     :!lines.includes('ChatTurn: '+context.turn_id)||!lines.includes('RequestTrace: '+context.request_trace_id))
     throw new ApiError(409,'report_trace_mismatch','The failure attempt changed');
    return text;
   },current);
  }catch(error){operation=Promise.reject(error);}
  return operation.then(()=>{if(current()){this.set(key,{copied:true});const previous=this.timers.get(key);if(previous)clearTimeout(previous);this.timers.set(key,setTimeout(()=>{this.timers.delete(key);if(this.active&&version===this.generation)this.set(key,{copied:false});},2500));}})
   .catch(error=>{if(current())this.failure(error);})
   .finally(()=>{this.requests.delete(abort);if(current())this.set(key,{copying:false});abort.abort();});
 };
}
export function useChatDiagnostics(source:WorkspaceSource,userId:number,onExpired:()=>void,onError:(message:string)=>void,conversationId?:string|null):ChatDiagnostics&{stop:()=>void}{
 const callbacks=useRef({onExpired,onError});callbacks.current={onExpired,onError};
 const controller=useMemo(()=>new ChatDiagnosticsController(source,()=>callbacks.current.onExpired(),message=>callbacks.current.onError(message)),[source,userId,conversationId]);
 useSyncExternalStore(controller.subscribe,controller.snapshot,controller.snapshot);
 useEffect(()=>{controller.start();return controller.stop;},[controller]);
 return {forMessage:controller.forMessage,onReport:message=>{void controller.onReport(message);},onCopy:message=>{void controller.onCopy(message);},stop:controller.stop};
}
