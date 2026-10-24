import type {MemoryInboxPresentation} from '../types/memoryInbox';
const labels={requested:'Запрос зарегистрирован',scanning:'Обнаружение событий',processing:'Обработка',completed:'Проход завершён',completed_with_errors:'Проход завершён с ошибками'};
export function ScanningPanel({scanning:s}:{scanning:NonNullable<MemoryInboxPresentation['scanning']>}){
 const active=s.data?.sources.some(row=>s.selected.has(row.id)&&row.scan&&['requested','scanning','processing'].includes(row.scan.state));
 return <section aria-label="Сканирование" className="p-4 rounded-xl border border-[var(--mroya-divider)] bg-[var(--mroya-surface)] space-y-3">
  <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">Сканирование</h3>
   <button type="button" onClick={s.onScan} disabled={s.busy||!s.selected.size||!!active||!s.data?.worker.enabled} className="text-sm text-[var(--mroya-primary)] disabled:opacity-50">{s.busy?'Подождите…':'Сканировать сейчас'}</button></div>
  <p className="text-xs text-[var(--mroya-text-muted)]">Только разрешённые локальные события, до 50 календарей за запрос. Подтверждение предложений выполняется отдельно.</p>
  {s.error&&<p role="alert">{s.error}</p>}
  {!s.data&&!s.error&&<p role="status">Загрузка состояния сканирования…</p>}
  {s.data?.worker.last_seen_at&&<p className="text-xs text-[var(--mroya-text-muted)]">Heartbeat worker: {new Date(s.data.worker.last_seen_at).toLocaleString()}</p>}
  {s.data?.worker.state==='unavailable'&&<p role="status">Нет свежего heartbeat worker. Обработка может быть остановлена или задержана.</p>}
  {s.data?.worker.state==='disabled'&&<p role="status">Обработка на сервере выключена.</p>}
  {s.data?.sources.length===0&&<p>Нет календарей. Разрешите анализ в Settings → Memory Intelligence.</p>}
  {s.data?.sources.map(row=>{const p=row.scan;return <div key={row.id} className="border-t border-[var(--mroya-divider)] pt-3 text-sm space-y-1">
   <label className="flex items-center gap-2"><input type="checkbox" disabled={!row.enabled||s.busy} checked={s.selected.has(row.id)} onChange={()=>s.onSelect(row.id)}/><span className="break-words">{row.name}</span><span className="text-xs text-[var(--mroya-text-muted)]">{row.enabled?'Анализ включён':'Анализ выключен'}</span></label>
   <p>{p?labels[p.state]:'Ещё не сканировался'}{row.quota_blocked?' · Квота AI исчерпана':''}</p>
   {row.last_scanned_at&&<p className="text-xs text-[var(--mroya-text-muted)]">Последний обход: {new Date(row.last_scanned_at).toLocaleString()}</p>}
   {p&&<><p>Обнаружено: {p.discovered} · Проверено: {p.checked}{p.eligible!==null?` из ${p.eligible}`:''}</p>
    {p.eligible!==null&&p.eligible>0&&<progress aria-label={`Проверено: ${row.name}`} value={p.checked} max={p.eligible} className="w-full"/>}
    {p.eligible===0&&<p>Нет подходящих локальных событий в этом проходе.</p>}
    <p className="text-xs text-[var(--mroya-text-muted)]">Очередь: {p.queued} · Triage: {p.triage} · Deep Analysis: {p.deep_analysis} · Не требуют сохранения: {p.no_save} · Ожидают подтверждения: {p.awaiting_confirmation} · Ошибки: {p.errors} · Повтор после ошибки: {p.retrying} · Устарели: {p.stale}</p>
    {!!p.error_codes.length&&<p role="status" className="text-xs">Причины: {p.error_codes.join(', ')}</p>}</>}
  </div>})}
  {s.data?.next_offset!==null&&s.data&&<button type="button" onClick={s.onMore} disabled={s.busy} className="text-sm underline">Ещё календари</button>}
 </section>;
}
