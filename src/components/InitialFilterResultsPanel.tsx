import React from 'react';
import type {InitialResultsPresentation} from '../types/initialResults';
export function InitialFilterResultsPanel({results:r}:{results:InitialResultsPresentation}){
 const s=r.data?.summary,processed=s?s.approved+s.rejected+s.errors:0;
 const percent=s?.total?Math.floor(processed/s.total*100):0;
 return <section className="p-4 sm:p-6 border-t border-[var(--mroya-divider)] space-y-3 text-[13px] text-[var(--mroya-text)]">
  <h3 className="font-semibold">Первоначальная AI-проверка</h3>
  {s&&<div role="status" className="space-y-1">
   <p>Всего: {s.total}. Обработано: {processed} из {s.total}. {percent}%.</p>
   <p>ДА: {s.approved}. НЕТ: {s.rejected}.{s.errors>0&&<> Ошибки: {s.errors}.</>}</p>
   <progress value={processed} max={s.total||1} aria-label="Прогресс первоначальной проверки" className="w-full accent-[var(--mroya-primary)]"/>
   {s.errors>0&&<p className="text-[12px] text-[var(--mroya-text-muted)]">Ошибки учтены в обработанных заданиях, но не включены в ДА/НЕТ.</p>}
  </div>}
  {r.data&&!r.data.processing_enabled&&<p>Обработка не запущена</p>}
  {r.loading&&<p role="status" className="text-[var(--mroya-text-muted)]">Обновление результатов…</p>}
  {r.error&&<p role="alert">{r.error}</p>}
  <div className="flex flex-wrap gap-3" role="tablist" aria-label="Результаты первоначальной проверки">
   {(['APPROVE','REJECT'] as const).map(d=><button type="button" role="tab" aria-selected={r.decision===d} key={d} onClick={()=>r.onDecision(d)} className="px-3 py-2 rounded-[8px] border border-[var(--mroya-divider)] aria-selected:text-[var(--mroya-primary)] aria-selected:bg-[var(--mroya-bg)]">{d==='APPROVE'?'Подошли (ДА)':'Не подошли (НЕТ)'}</button>)}
  </div>
  {r.data&&<div role="tabpanel" className="space-y-2">
   {!r.data.results.length&&<p className="text-[var(--mroya-text-muted)]">На этой странице пока нет результатов.</p>}
   {r.data.results.map(row=><div key={row.event_id} className="p-3 rounded-[8px] border border-[var(--mroya-divider)] flex flex-wrap justify-between gap-2">
    <div className="min-w-0 break-words"><p className="font-medium">{row.title}</p><p className="text-[12px] text-[var(--mroya-text-muted)]">{row.calendar_name} · <time dateTime={row.date}>{row.date}</time></p></div>
    <span>Вероятность ДА: {Number((row.probability*100).toFixed(2))}%</span>
   </div>)}
  </div>}
  <div className="flex flex-wrap gap-3 text-[var(--mroya-primary)]">
   <button type="button" disabled={r.loading} onClick={r.onRefresh}>Обновить / Retry</button>
   <button type="button" disabled={r.loading||r.offset===0} onClick={r.onPrevious}>Назад</button>
   <button type="button" disabled={r.loading||!r.data||r.data.next_offset===null} onClick={r.onNext}>Далее</button>
  </div>
 </section>;
}
