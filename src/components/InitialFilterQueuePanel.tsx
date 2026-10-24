import React from 'react';
import type {InitialQueuePresentation} from '../types/initialQueue';
export function InitialFilterQueuePanel({queue}:{queue:InitialQueuePresentation}){
 const selected=queue.sources.find(source=>source.id===queue.selectedId);
 const waiting=queue.loading||queue.busy;
 return <section className="p-4 sm:p-6 border-b border-[var(--mroya-divider)] bg-[var(--mroya-surface)] space-y-3">
  <h2 className="text-[14px] font-semibold text-[var(--mroya-text)]">Добавить события из календаря</h2>
  <p className="text-[12px] text-[var(--mroya-text-muted)]">Только постановка в очередь. AI не запускается; память не изменяется.</p>
  <div className="flex flex-col sm:flex-row gap-2">
   <label className="flex-1 min-w-0 text-[12px] text-[var(--mroya-text-muted)]">Календарь
    <select value={queue.selectedId} disabled={waiting} onChange={e=>queue.onSelect(e.target.value)} className="block w-full mt-1 rounded-[8px] border border-[var(--mroya-divider)] bg-[var(--mroya-bg)] text-[var(--mroya-text)] px-3 py-2 text-[13px]">
     <option value="">Выберите календарь</option>{queue.sources.map(source=><option key={source.id} value={source.id}>{source.name}{!source.enabled?' — анализ не разрешён':''}</option>)}
    </select>
   </label>
   <button type="button" disabled={waiting||!selected?.enabled} onClick={queue.onEnqueue} className="sm:self-end px-4 py-2 rounded-[8px] text-[13px] font-semibold bg-[var(--mroya-primary)] text-[var(--mroya-on-primary)] disabled:opacity-50">{queue.busy?'Добавление…':'Добавить в очередь'}</button>
  </div>
  {selected&&!selected.enabled&&<p className="text-[12px] text-[var(--mroya-text-muted)]">Для календаря не включено согласие на анализ. Разрешение можно включить только в настройках.</p>}
  <button type="button" onClick={queue.onSettings} className="text-[12px] text-[var(--mroya-primary)] hover:underline">Настройки разрешений анализа</button>
  {queue.loading&&<p role="status" className="text-[12px] text-[var(--mroya-text-muted)]">Загрузка календарей и счётчиков…</p>}
  {queue.error&&<p role="alert" className="text-[12px] text-[var(--mroya-text-muted)]">{queue.error}</p>}
  {queue.receipt&&<p role="status" className="text-[13px] text-[var(--mroya-text)]">Добавлено: {queue.receipt.added}. Уже в очереди: {queue.receipt.already_queued}.</p>}
  {queue.totals&&<div className="text-[13px] text-[var(--mroya-text)] space-y-1"><p>Всего событий в очереди: <strong>{queue.totals.queue_total}</strong></p>{queue.totals.calendars.map((row,index)=><p key={row.calendar_id}>{queue.sources.find(source=>source.id===row.calendar_id)?.name??`Календарь ${index+1} (название недоступно)`}: {row.pending}</p>)}</div>}
  <div className="flex gap-3 text-[12px] text-[var(--mroya-primary)]"><button type="button" disabled={waiting} onClick={queue.onRefresh} className="hover:underline">Обновить / Retry</button>{queue.hasMoreSources&&<button type="button" disabled={waiting} onClick={queue.onMoreSources} className="hover:underline">Ещё календари</button>}</div>
 </section>;
}
