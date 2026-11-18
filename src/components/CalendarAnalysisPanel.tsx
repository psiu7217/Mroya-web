import React from 'react';
import {ChevronDown,ChevronRight,RefreshCw,Sparkles} from 'lucide-react';
import type {CalendarAnalysisPresentation,AnalysisStatus,AnalysisEventStatus} from '../types/calendarAnalysis';
import {tr} from '../i18n';
import {currentLocale} from '../i18n/format';
const text=(key:string,options={})=>tr(key,{ns:'connections',...options});
const statuses:Record<AnalysisStatus,string>={waiting_import:'analysisWaiting',empty:'analysisEmpty',running:'analysisRunning',stopping:'analysisStopping',stopped:'analysisStopped',service_unavailable:'analysisServiceUnavailable',unavailable:'analysisUnavailable',errors:'analysisErrors',completed:'analysisCompleted'};
const eventStatuses:Record<AnalysisEventStatus,string>={queued:'analysisQueued',checking:'analysisChecking',stopping:'analysisStopping',stopped:'analysisStopped',error:'analysisEventError',checked:'analysisChecked',suitable:'analysisSuitable',unavailable:'analysisEventUnavailable'};
const button='px-3 py-1.5 rounded-lg border border-[var(--mroya-divider)] text-xs font-medium hover:bg-[var(--mroya-surface-active)] disabled:opacity-40';
export function CalendarAnalysisPanel({analysis}:{analysis?:CalendarAnalysisPresentation}){
 if(!analysis)return null;
 const busy=analysis.busyCalendar!==null;
 return <section aria-label={text('analysisTitle')} className="space-y-3 pt-4 border-t border-[var(--mroya-divider)]">
  <h3 className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="w-4 h-4 text-[var(--mroya-primary)]"/>{text('analysisTitle')}</h3>
  <p className="text-xs text-[var(--mroya-text-muted)] leading-relaxed">{text('analysisDescription')}</p>
  {analysis.error&&<p role="alert" className="text-xs text-rose-600 dark:text-rose-300">{text(analysis.error==='conflict'?'analysisConflict':analysis.error==='action'?'analysisActionError':'analysisLoadError')} <button type="button" className="underline" disabled={busy||analysis.loading} onClick={analysis.onRefresh}>{text('analysisRefresh')}</button></p>}
  {!analysis.calendars.length&&!analysis.error&&<p role="status" className="text-xs text-[var(--mroya-text-muted)]">{text(analysis.loading?'analysisLoading':'analysisNoCalendars')}</p>}
  {analysis.calendars.map(calendar=>{
   const id=calendar.calendar_id,open=analysis.expanded.includes(id),events=analysis.events[id];
   return <div key={id} className="rounded-xl border border-[var(--mroya-divider)] bg-[var(--mroya-surface)] overflow-hidden">
    <div className="p-3 space-y-2">
     <button type="button" aria-expanded={open} aria-controls={'analysis-'+id} onClick={()=>analysis.onToggle(id)} className="flex items-start justify-between w-full gap-3 text-left">
      <span className="font-semibold text-[13px] break-words min-w-0">{calendar.name}</span>{open?<ChevronDown className="w-4 h-4 shrink-0"/>:<ChevronRight className="w-4 h-4 shrink-0"/>}
     </button>
     <p className={`text-xs ${['errors','service_unavailable'].includes(calendar.status)?'text-rose-600 dark:text-rose-300':'text-[var(--mroya-text-muted)]'}`}>{text(statuses[calendar.status])}</p>
     {calendar.status==='stopping'&&<p className="text-xs text-[var(--mroya-text-muted)]">{text('analysisInflight')}</p>}
     {calendar.total>0&&<>
      <p className="text-xs text-[var(--mroya-text-muted)]">{text('analysisProcessed',{done:calendar.checked+calendar.errors,total:calendar.total})}</p>
      <div role="progressbar" aria-label={text('analysisProgress')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={calendar.progress} className="h-1.5 rounded-full bg-[var(--mroya-surface-muted)] overflow-hidden"><div style={{width:calendar.progress+'%'}} className="h-full rounded-full bg-[var(--mroya-primary)]"/></div>
      <p className="flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-[var(--mroya-text-muted)]"><span>{text('analysisCheckedCount',{count:calendar.checked})}</span><span>{text('analysisSuitableCount',{count:calendar.suitable})}</span><span className={calendar.errors?'text-rose-600 dark:text-rose-300':''}>{text('analysisErrorCount',{count:calendar.errors})}</span>{calendar.stopped>0&&<span>{text('analysisStoppedCount',{count:calendar.stopped})}</span>}</p>
     </>}
     <div className="flex flex-wrap gap-2">
      {(calendar.errors>0||calendar.stopped>0)&&<button type="button" className={button} disabled={busy||!calendar.can_retry} onClick={()=>analysis.onRetry(id)}>{text(calendar.errors&&calendar.stopped?'analysisRetryRemaining':calendar.errors?'analysisRetryErrors':'analysisRetryStopped')}</button>}
      {calendar.can_stop&&<button type="button" className={button} disabled={busy} onClick={()=>analysis.onStop(id)}>{text('analysisStop')}</button>}
      {analysis.busyCalendar===id&&<span role="status" className="text-xs self-center">{text('analysisSaving')}</span>}
     </div>
    </div>
    {open&&<div id={'analysis-'+id} className="border-t border-[var(--mroya-divider)] p-3 space-y-2 max-h-96 overflow-y-auto">
     {events?.error&&<p role="alert" className="text-xs text-rose-600 dark:text-rose-300">{text('analysisLoadError')} <button type="button" className="underline" onClick={analysis.onRefresh}>{text('analysisRefresh')}</button></p>}
     {(!events||events.loading&&!events.rows.length)&&<p role="status" className="text-xs">{text('analysisLoading')}</p>}
     {events?.rows.map(event=><div key={event.id} className="py-2 flex items-start justify-between gap-3 border-b last:border-0 border-[var(--mroya-divider)]">
      <div className="min-w-0 space-y-1"><p className="text-xs font-medium break-words">{event.title||text('analysisEventUnavailable')}</p>{event.date&&<p className="text-[11px] text-[var(--mroya-text-muted)]">{new Intl.DateTimeFormat(currentLocale(),{dateStyle:'medium',timeZone:'UTC'}).format(new Date(event.date+'T12:00:00Z'))}</p>}<p className={`text-[11px] ${event.status==='error'?'text-rose-600 dark:text-rose-300':'text-[var(--mroya-text-muted)]'}`}>{text(eventStatuses[event.status])}</p></div>
      {event.can_retry&&<button type="button" className={button+' shrink-0'} disabled={busy} onClick={()=>analysis.onRetry(id,event.id)}>{text('analysisRetryOne')}</button>}
     </div>)}
     {events&&!events.loading&&!events.rows.length&&<p className="text-xs text-[var(--mroya-text-muted)]">{text(calendar.status==='waiting_import'?'analysisWaiting':'analysisEmpty')}</p>}
     {events?.next!==null&&events?.next!==undefined&&<button type="button" className={button+' w-full'} disabled={busy||events.loading} onClick={()=>analysis.onMore(id)}>{text('analysisMore')}</button>}
     {events?.loading&&events.rows.length>0&&<RefreshCw className="w-3 h-3 animate-spin" aria-label={text('analysisLoading')}/>}
    </div>}
   </div>;
  })}
 </section>;
}
