import React,{useEffect,useRef,useState} from 'react';
import {BookOpen,Calendar,Check,ChevronDown,Copy,LoaderCircle,Minus,Wrench,X,TriangleAlert} from 'lucide-react';
import type {ToolPayload,ToolTimelineEntry} from '../types/mroya';

const labels:Record<ToolTimelineEntry['status'],string>={
 success:'Success',failure:'Failed',neutral:'Neutral',running:'Running',
 skipped:'Not executed',interrupted:'Interrupted',unknown:'Unknown',
};
export function toolPayloadText(payload:ToolPayload):string{
 if(payload.format==='json'){try{return JSON.stringify(JSON.parse(payload.text),null,2);}catch{/* Keep available text; never invent JSON. */}}
 return payload.text;
}
function Payload({label,payload}:{label:string;payload?:ToolPayload}){
 const [state,setState]=useState<'idle'|'copying'|'copied'|'error'>('idle');
 const active=useRef(true),busy=useRef(false),currentPayload=useRef(payload);currentPayload.current=payload;
 useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
 useEffect(()=>{setState('idle');},[payload]);
 useEffect(()=>{if(state!=='copied')return;const timer=setTimeout(()=>setState('idle'),2500);return()=>clearTimeout(timer);},[state]);
 const text=payload?toolPayloadText(payload):'';
 const copy=async()=>{
  if(!payload||!text||busy.current)return;
  busy.current=true;
  setState('copying');
  try{
   // Available data: invoke the native operation directly in the user click stack.
   await navigator.clipboard.writeText(text);
   if(active.current&&currentPayload.current===payload)setState('copied');
  }catch{if(active.current&&currentPayload.current===payload)setState('error');}
  finally{busy.current=false;}
 };
 const limit=12000,truncated=text.length>limit;
 return <section className="min-w-0 space-y-2">
  <div className="flex items-center justify-between gap-2">
   <span className="text-[11px] font-semibold text-[var(--mroya-text-muted)]">{label}</span>
   {text&&<button type="button" onClick={copy} disabled={state==='copying'} aria-label={'Copy tool '+label.toLowerCase()} className="inline-flex items-center gap-1 text-[11px] text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] disabled:opacity-50">
    {state==='copied'?<Check className="w-3 h-3"/>:<Copy className="w-3 h-3"/>}{state==='copied'?'Copied':state==='copying'?'Copying…':'Copy'}
   </button>}
  </div>
  {payload?<pre className="max-h-[220px] max-w-full overflow-auto whitespace-pre-wrap break-words [overflow-wrap:anywhere] rounded-[6px] bg-[var(--mroya-surface)] p-2.5 font-mono text-[11.5px] leading-[18px] text-[var(--mroya-text-muted)]">{text.slice(0,limit)}</pre>
   :<p className="text-[11.5px] text-[var(--mroya-text-muted)]">Data unavailable</p>}
  {(payload?.truncated||truncated)&&<p className="text-[11px] text-[var(--mroya-text-muted)]">{payload?.truncated?'Backend data is truncated.':'Display truncated; Copy includes all available text.'}</p>}
  {state==='error'&&<p role="alert" className="text-[11px] text-[var(--mroya-error)]">Could not copy. Try again.</p>}
 </section>;
}
export function ToolActivityBlock({activity,defaultExpanded=false}:{activity:ToolTimelineEntry;defaultExpanded?:boolean}){
 const [expanded,setExpanded]=useState(defaultExpanded);
 const Icon=activity.toolKind.startsWith('calendar')?Calendar:activity.toolKind.includes('memory')?BookOpen:Wrench;
 const StatusIcon=activity.status==='success'?Check:activity.status==='failure'?X:activity.status==='running'?LoaderCircle:activity.status==='interrupted'||activity.status==='unknown'?TriangleAlert:Minus;
 return <div className="w-full min-w-0 rounded-[10px] border border-[var(--mroya-divider)] bg-[var(--mroya-surface-muted)]/50 overflow-hidden text-left">
  <button type="button" aria-expanded={expanded} onClick={()=>setExpanded(value=>!value)} className="w-full flex items-center gap-2 px-3.5 py-2.5 hover:bg-[var(--mroya-surface-muted)]/80 text-left">
   <Icon className="w-3.5 h-3.5 shrink-0 text-[var(--mroya-brand-honey)]"/>
   <span className="min-w-0 flex-1">
    <span className="block break-words [overflow-wrap:anywhere] text-[12px] font-semibold text-[var(--mroya-text)]">{activity.title}</span>
    {activity.description&&<span className="block break-words [overflow-wrap:anywhere] text-[11px] text-[var(--mroya-text-muted)]">{activity.description}</span>}
   </span>
   <span className="inline-flex flex-wrap items-center justify-end gap-1 text-[10.5px] text-[var(--mroya-text-muted)]">
    <StatusIcon aria-hidden="true" className={`w-3 h-3 shrink-0 ${activity.status==='running'?'animate-spin':''}`}/>{labels[activity.status]}
    {activity.durationMs!==undefined&&Number.isFinite(activity.durationMs)&&activity.durationMs>=0&&<span>· {activity.durationMs} ms</span>}
   </span>
   <ChevronDown className={`w-3.5 h-3.5 shrink-0 text-[var(--mroya-text-muted)] transition-transform ${expanded?'rotate-180':''}`}/>
  </button>
  {expanded&&<div className="min-w-0 space-y-3 px-3.5 pb-3.5 pt-2.5 border-t border-[var(--mroya-divider)]/60">
   <Payload label="Input" payload={activity.input}/>
   <Payload label="Output" payload={activity.output}/>
  </div>}
 </div>;
}
