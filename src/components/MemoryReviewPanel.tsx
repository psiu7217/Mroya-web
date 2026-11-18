import React from 'react';
import {tr} from '../i18n';
import {formatDate} from '../i18n/format';
import type {ReviewPresentation} from '../types/memoryReview';
export function MemoryReviewPanel({review:r}:{review:ReviewPresentation}){
 const s=r.data?.summary,waiting=r.loading||r.busy;
 return <section className="p-4 sm:p-6 space-y-3 border-b border-[var(--mroya-divider)] bg-[var(--mroya-surface)] text-[13px] text-[var(--mroya-text)]">
  <h2 className="font-semibold">{tr('reviewTitle',{ns:'memory'})}</h2>
  <p className="text-[12px] text-[var(--mroya-text-muted)]">{tr('reviewDryRun',{ns:'memory'})}</p>
  {r.data&&r.data.processing_enabled&&<button type="button" disabled={waiting||!r.data.eligible_count}
   onClick={r.onEnqueue} className="font-semibold text-[var(--mroya-primary)] disabled:opacity-60">
   {tr('reviewEnqueue',{ns:'memory',count:r.data.eligible_count})}
  </button>}
  {r.loading&&<p role="status">{tr('reviewLoading',{ns:'memory'})}</p>}
  {r.error&&<p role="alert">{r.error}</p>}
  {r.data&&!r.data.processing_enabled&&<p>{tr('reviewDisabled',{ns:'memory'})}</p>}
  {r.data&&!r.data.worker_available&&!r.data.is_complete&&<p role="status">{tr('reviewWorkerUnavailable',{ns:'memory'})}</p>}
  {r.receipt&&<p role="status">{tr('reviewReceipt',{ns:'memory',added:r.receipt.added,already:r.receipt.already_queued})}</p>}
  {s&&<div role="status"><p>{tr('reviewProgress',{ns:'memory',...s})}</p>
   <progress aria-label={tr('reviewTitle',{ns:'memory'})} value={s.completed+s.error+s.stale} max={s.total||1} className="w-full accent-[var(--mroya-primary)]"/>
   {r.data?.is_complete&&s.total>0&&<p>{tr('reviewComplete',{ns:'memory'})}</p>}
  </div>}
  {r.data&&!r.data.results.length&&<p>{tr('reviewEmpty',{ns:'memory'})}</p>}
  {r.data?.results.map(job=>{
   const source=job.source_preview;
   const date=source&&Number.isFinite(Date.parse(source.date))
    ? <time dateTime={source.date}>{formatDate(source.date,{dateStyle:'medium'},'UTC')}</time>
    : null;
   return <article key={job.id} className="p-3 rounded-[8px] border border-[var(--mroya-divider)] space-y-2 break-words">
   <h3 className="font-medium">{job.source_preview?.title??tr('reviewSourceUnavailable',{ns:'memory'})}</h3>
   {source&&<p className="text-[12px] text-[var(--mroya-text-muted)]">{source.calendar_name}{date&&<> · {date}</>}</p>}
   <p>{tr('reviewStatus_'+job.status,{ns:'memory'})}</p>
   {job.status==='error'&&<button type="button" disabled={waiting||!r.data?.processing_enabled} onClick={()=>r.onRetry(job.id)} className="text-[var(--mroya-primary)]">{tr('reviewRetry',{ns:'memory'})}</button>}
   {job.result&&<><p className="font-medium">{tr('reviewDecision_'+job.result.decision,{ns:'memory'})}</p><p>{job.result.explanation}</p>
    {!job.result.proposals.length&&<p>{tr('reviewNoProposals',{ns:'memory'})}</p>}
    {job.result.proposals.map((p,index)=><details key={index} className="p-3 rounded-[8px] bg-[var(--mroya-bg)]">
     <summary className="cursor-pointer font-medium">{p.formulation}</summary>
     <div className="pt-2 space-y-2">
      {p.usefulness&&<p>{p.usefulness}</p>}
      {!!p.entities.length&&<><h4>{tr('reviewEntities',{ns:'memory'})}</h4>{p.entities.map(e=><p key={e.local_id}>{e.description}{e.desired_match_unverified?' — '+tr('reviewUnverified',{ns:'memory'}):''}</p>)}</>}
      {!!p.evidence.length&&<><h4>{tr('reviewEvidence',{ns:'memory'})}</h4>{p.evidence.map((e,i)=><blockquote key={i}>{e.quote}</blockquote>)}</>}
      {!!p.uncertainties.length&&<><h4>{tr('reviewUncertainties',{ns:'memory'})}</h4>{p.uncertainties.map((u,i)=><p key={i}>{u}</p>)}</>}
     </div>
    </details>)}
   </>}
   </article>;
  })}
  <div className="flex flex-wrap gap-4 text-[var(--mroya-primary)]">
   <button type="button" disabled={waiting} onClick={r.onRefresh}>{tr('refreshRetry',{ns:'connections'})}</button>
   <button type="button" disabled={waiting||r.offset===0} onClick={r.onPrevious}>{tr('previous',{ns:'connections'})}</button>
   <button type="button" disabled={waiting||!r.data||r.data.next_offset===null} onClick={r.onNext}>{tr('next',{ns:'connections'})}</button>
  </div>
 </section>;
}
