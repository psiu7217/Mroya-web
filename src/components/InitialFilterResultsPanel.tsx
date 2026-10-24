import React from 'react';
import type {InitialResultsPresentation} from '../types/initialResults';
import {tr} from '../i18n';
import {formatDate} from '../i18n/format';
import {currentLocale} from '../i18n/format';
export function InitialFilterResultsPanel({results:r}:{results:InitialResultsPresentation}){
 const language=currentLocale();
 const s=r.data?.summary,processed=s?s.approved+s.rejected+s.errors:0;
 const percent=s?.total?Math.floor(processed/s.total*100):0;
 const formattedDate=(value:string)=>{const date=new Date(value);return Number.isFinite(date.getTime())?formatDate(date,{dateStyle:'medium'},'UTC',language):value;};
 return <section className="p-4 sm:p-6 border-t border-[var(--mroya-divider)] space-y-3 text-[13px] text-[var(--mroya-text)]">
  <h3 className="font-semibold">{tr('initialFilterTitle',{ns:'connections'})}</h3>
  {s&&<div role="status" className="space-y-1">
   <p>{tr('initialFilterSummary',{ns:'connections',total:s.total,processed,percent})}</p>
   <p>{tr('initialFilterDecisions',{ns:'connections',approved:s.approved,rejected:s.rejected})}{s.errors>0&&<> {tr('initialFilterErrors',{ns:'connections',count:s.errors})}</>}</p>
   <progress value={processed} max={s.total||1} aria-label={tr('initialFilterProgress',{ns:'connections'})} className="w-full accent-[var(--mroya-primary)]"/>
   {s.errors>0&&<p className="text-[12px] text-[var(--mroya-text-muted)]">{tr('initialFilterErrorNote',{ns:'connections'})}</p>}
  </div>}
  {r.data&&!r.data.processing_enabled&&<p>{tr('initialFilterStopped',{ns:'connections'})}</p>}
  {r.error&&<p role="alert">{tr('requestFailed',{ns:'common'})}</p>}
  <div className="flex flex-wrap gap-3" role="tablist" aria-label={tr('initialFilterResults',{ns:'connections'})}>
   {(['APPROVE','REJECT'] as const).map(d=><button type="button" role="tab" aria-selected={r.decision===d} key={d} onClick={()=>r.onDecision(d)} className="px-3 py-2 rounded-[8px] border border-[var(--mroya-divider)] aria-selected:text-[var(--mroya-primary)] aria-selected:bg-[var(--mroya-bg)]">{d==='APPROVE'?tr('initialFilterApproved',{ns:'connections'}):tr('initialFilterRejected',{ns:'connections'})}</button>)}
  </div>
  {r.data&&<div role="tabpanel" className="space-y-2">
   {!r.data.results.length&&<p className="text-[var(--mroya-text-muted)]">{tr('initialFilterNoResults',{ns:'connections'})}</p>}
   {r.data.results.map(row=><div key={row.event_id} className="p-3 rounded-[8px] border border-[var(--mroya-divider)] flex flex-wrap justify-between gap-2">
    <div className="min-w-0 break-words"><p className="font-medium">{row.title}</p><p className="text-[12px] text-[var(--mroya-text-muted)]">{row.calendar_name} · <time dateTime={row.date}>{formattedDate(row.date)}</time></p></div>
    <span>{tr('initialFilterProbability',{ns:'connections',probability:new Intl.NumberFormat(language,{maximumFractionDigits:2}).format(row.probability*100)})}</span>
   </div>)}
  </div>}
  <div className="flex flex-wrap gap-3 text-[var(--mroya-primary)]">
   <button type="button" disabled={r.loading} onClick={r.onRefresh}>{tr('refreshRetry',{ns:'connections'})}</button>
   <button type="button" disabled={r.loading||r.offset===0} onClick={r.onPrevious}>{tr('previous',{ns:'connections'})}</button>
   <button type="button" disabled={r.loading||!r.data||r.data.next_offset===null} onClick={r.onNext}>{tr('next',{ns:'connections'})}</button>
  </div>
 </section>;
}
