import {useEffect,useRef,useState} from 'react';
import {copyDiagnosticText} from '../utils/diagnosticsClipboard';
import type {ChatDiagnostics,DiagnosticActionState} from '../types/workspace';
export function useDemoDiagnostics():ChatDiagnostics{
 const states=useRef<Record<string,DiagnosticActionState>>({}),active=useRef(true),timers=useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
 const [,render]=useState(0);
 useEffect(()=>{active.current=true;return()=>{active.current=false;for(const timer of timers.current)clearTimeout(timer);};},[]);
 const forMessage:ChatDiagnostics['forMessage']=message=>states.current[message.id]??{available:message.sender==='assistant'&&message.status==='failed',reporting:false,reported:false,copying:false,copied:false};
 const set=(id:string,patch:Partial<DiagnosticActionState>)=>{if(active.current){const initial={available:false,reporting:false,reported:false,copying:false,copied:false};states.current={...states.current,[id]:{...initial,...states.current[id],...patch,available:true}};render(v=>v+1);}};
 return {forMessage,onReport:message=>{
  const state=forMessage(message);if(!state.available||state.reporting||state.reported)return;
  set(message.id,{reporting:true});
  // Explicitly local Design simulation; no live source, account or API context.
  void Promise.resolve().then(()=>set(message.id,{reporting:false,reported:true}));
 },onCopy:message=>{
  const state=forMessage(message);if(!state.available||state.copying)return;
  set(message.id,{copying:true,copied:false});
  void copyDiagnosticText(async()=>'Mroya — synthetic Design diagnostics preview',()=>active.current)
   .then(()=>{set(message.id,{copying:false,copied:true});
    const timer=setTimeout(()=>{timers.current.delete(timer);set(message.id,{copied:false});},2500);timers.current.add(timer);
   }).catch(()=>set(message.id,{copying:false,copied:false}));
 }};
}
