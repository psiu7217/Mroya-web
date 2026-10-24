import React from 'react';
import {InitialFilterResultsPanel} from './InitialFilterResultsPanel';
import type {InitialQueuePresentation} from '../types/initialQueue';
import {tr} from '../i18n';
export function InitialFilterQueuePanel({queue}:{queue:InitialQueuePresentation}){
 const selected=queue.sources.find(source=>source.id===queue.selectedId);
 const waiting=queue.loading||queue.busy;
 return <section className="p-4 sm:p-6 border-b border-[var(--mroya-divider)] bg-[var(--mroya-surface)] space-y-3">
  <h2 className="text-[14px] font-semibold text-[var(--mroya-text)]">{tr('enqueueCalendarEvents',{ns:'connections'})}</h2>
  <p className="text-[12px] text-[var(--mroya-text-muted)]">{tr('enqueueExplanation',{ns:'connections'})}</p>
  <div className="flex flex-col sm:flex-row gap-2">
   <label className="flex-1 min-w-0 text-[12px] text-[var(--mroya-text-muted)]">{tr('calendar',{ns:'calendar'})}
    <select value={queue.selectedId} disabled={waiting} onChange={e=>queue.onSelect(e.target.value)} className="block w-full mt-1 rounded-[8px] border border-[var(--mroya-divider)] bg-[var(--mroya-bg)] text-[var(--mroya-text)] px-3 py-2 text-[13px]">
     <option value="">{tr('chooseCalendar',{ns:'connections'})}</option>{queue.sources.map(source=><option key={source.id} value={source.id}>{source.name}{!source.enabled?' — '+tr('analysisNotAllowed',{ns:'connections'}):''}</option>)}
    </select>
   </label>
   <button type="button" disabled={waiting||!selected?.enabled} onClick={queue.onEnqueue} className="sm:self-end px-4 py-2 rounded-[8px] text-[13px] font-semibold bg-[var(--mroya-primary)] text-[var(--mroya-on-primary)] disabled:opacity-50">{queue.busy?tr('adding',{ns:'connections'}):tr('addToQueue',{ns:'connections'})}</button>
  </div>
  {selected&&!selected.enabled&&<p className="text-[12px] text-[var(--mroya-text-muted)]">{tr('calendarConsentNeeded',{ns:'connections'})}</p>}
  <button type="button" onClick={queue.onSettings} className="text-[12px] text-[var(--mroya-primary)] hover:underline">{tr('analysisPermissionSettings',{ns:'connections'})}</button>
  {queue.loading&&<p role="status" className="text-[12px] text-[var(--mroya-text-muted)]">{tr('loadingCalendarsCounters',{ns:'connections'})}</p>}
  {queue.error&&<p role="alert" className="text-[12px] text-[var(--mroya-text-muted)]">{tr('requestFailed',{ns:'common'})}</p>}
  {queue.receipt&&<p role="status" className="text-[13px] text-[var(--mroya-text)]">{tr('enqueueReceipt',{ns:'connections',added:queue.receipt.added,alreadyQueued:queue.receipt.already_queued})}</p>}
  {queue.totals&&<div className="text-[13px] text-[var(--mroya-text)] space-y-1"><p>{tr('totalQueuedEvents',{ns:'connections'})}: <strong>{queue.totals.queue_total}</strong></p>{queue.totals.calendars.map((row,index)=><p key={row.calendar_id}>{queue.sources.find(source=>source.id===row.calendar_id)?.name??tr('calendarNameUnavailable',{ns:'connections',count:index+1})}: {row.pending}</p>)}</div>}
  <div className="flex gap-3 text-[12px] text-[var(--mroya-primary)]"><button type="button" disabled={waiting} onClick={queue.onRefresh} className="hover:underline">{tr('refreshRetry',{ns:'connections'})}</button>{queue.hasMoreSources&&<button type="button" disabled={waiting} onClick={queue.onMoreSources} className="hover:underline">{tr('moreCalendars',{ns:'connections'})}</button>}</div>
  {queue.results&&<InitialFilterResultsPanel results={queue.results}/>}
 </section>;
}
