import type {MemoryInboxPresentation} from '../types/memoryInbox';
import {tr} from '../i18n';
import {formatDate} from '../i18n/format';
const labels:Record<string,string>={requested:'scanRequested',scanning:'scanDiscovering',processing:'scanProcessing',completed:'scanCompleted',completed_with_errors:'scanErrors'};
export function ScanningPanel({scanning:s}:{scanning:NonNullable<MemoryInboxPresentation['scanning']>}){
 const active=s.data?.sources.some(row=>s.selected.has(row.id)&&row.scan&&['requested','scanning','processing'].includes(row.scan.state));
 return <section aria-label={tr('scanning',{ns:'connections'})} className="p-4 rounded-xl border border-[var(--mroya-divider)] bg-[var(--mroya-surface)] space-y-3">
  <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">{tr('scanning',{ns:'connections'})}</h3>
   <button type="button" onClick={s.onScan} disabled={s.busy||!s.selected.size||!!active||!s.data?.worker.enabled} className="text-sm text-[var(--mroya-primary)] disabled:opacity-50">{s.busy?tr('pleaseWait',{ns:'connections'}):tr('scanNow',{ns:'connections'})}</button></div>
  <p className="text-xs text-[var(--mroya-text-muted)]">{tr('scanDescription',{ns:'connections'})}</p>
  {s.error&&<p role="alert">{tr('loadFailed',{ns:'common'})}</p>}
  {!s.data&&!s.error&&<p role="status">{tr('scanLoading',{ns:'connections'})}</p>}
  {s.data?.worker.last_seen_at&&<p className="text-xs text-[var(--mroya-text-muted)]">{tr('workerHeartbeat',{ns:'connections',date:formatDate(s.data.worker.last_seen_at,{dateStyle:'medium',timeStyle:'short'})})}</p>}
  {s.data?.worker.state==='unavailable'&&<p role="status">{tr('workerNoHeartbeat',{ns:'connections'})}</p>}
  {s.data?.worker.state==='disabled'&&<p role="status">{tr('workerDisabled',{ns:'connections'})}</p>}
  {s.data?.sources.length===0&&<p>{tr('scanNoCalendars',{ns:'connections'})}</p>}
  {s.data?.sources.map(row=>{const p=row.scan;return <div key={row.id} className="border-t border-[var(--mroya-divider)] pt-3 text-sm space-y-1">
   <label className="flex items-center gap-2"><input type="checkbox" disabled={!row.enabled||s.busy} checked={s.selected.has(row.id)} onChange={()=>s.onSelect(row.id)}/><span className="break-words">{row.name}</span><span className="text-xs text-[var(--mroya-text-muted)]">{row.enabled?tr('analysisEnabled',{ns:'connections'}):tr('analysisDisabled',{ns:'connections'})}</span></label>
   <p>{p?tr('manualScanStatus',{ns:'connections',status:tr(labels[p.state]??'scanLoading',{ns:'connections'})}):tr('notScanned',{ns:'connections'})}{row.quota_blocked?' · '+tr('aiQuotaExhausted',{ns:'connections'}):''}</p>
   {row.last_scanned_at&&<p className="text-xs text-[var(--mroya-text-muted)]">{tr('lastScan',{ns:'connections',date:formatDate(row.last_scanned_at,{dateStyle:'medium',timeStyle:'short'})})}</p>}
   {p&&<><p>{tr('scanCounts',{ns:'connections',discovered:p.discovered,checked:p.checked,eligible:p.eligible??''})}</p>
    {p.eligible!==null&&p.eligible>0&&<progress aria-label={tr('checkedCount',{ns:'connections',count:p.checked,source:row.name})} value={p.checked} max={p.eligible} className="w-full"/>}
    {p.eligible===0&&<p>{tr('noEligibleEvents',{ns:'connections'})}</p>}
    <p className="text-xs text-[var(--mroya-text-muted)]">{tr('scanQueueStats',{ns:'connections',queued:p.queued,triage:p.triage,deep:p.deep_analysis,noSave:p.no_save,awaiting:p.awaiting_confirmation,errors:p.errors,retrying:p.retrying,stale:p.stale})}</p>
    {!!p.error_codes.length&&<p role="status" className="text-xs">{tr('scanIssues',{ns:'connections'})}</p>}</>}
  </div>})}
  {s.data?.next_offset!==null&&s.data&&<button type="button" onClick={s.onMore} disabled={s.busy} className="text-sm underline">{tr('moreCalendars',{ns:'connections'})}</button>}
 </section>;
}
