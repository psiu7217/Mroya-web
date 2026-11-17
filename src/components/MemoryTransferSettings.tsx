import React from 'react';
import {CheckCircle2, Clock3, LoaderCircle} from 'lucide-react';
import {tr} from '../i18n';
import type {MemoryTransferPresentation} from '../types/memoryTransfer';

// The controller owns authorization, validation, and the API.  This component
// is only shown when a live, authorized controller supplies these callbacks.
export function MemoryTransferSettings({transfer}: {transfer: MemoryTransferPresentation}) {
  const [confirming, setConfirming] = React.useState(false);
  const [validating, setValidating] = React.useState(false);
  const [validationFailed, setValidationFailed] = React.useState(false);
  const [fileName, setFileName] = React.useState<string|null>(null);
  const [fileChecked, setFileChecked] = React.useState(false);
  const chooseFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    setConfirming(false);
    setValidationFailed(false);
    if (!file) return;
    setFileName(file.name);
    setFileChecked(false);
    setValidating(true);
    try {
      const valid = await transfer.validateFile(file);
      setConfirming(valid);setFileChecked(valid);
    }
    catch { setValidationFailed(true); }
    finally { setValidating(false); }
  };
  const busy = transfer.busy || validating;
  const processing = transfer.operation==='import'||transfer.operation==='retry'||transfer.operation==='restore';
  const pending = transfer.searchPending&&!processing&&!validating;
  const complete = transfer.success&&!pending&&!processing&&!validating;
  const showProgress = !validating&&(processing||pending||complete);
  const progressTitle = transfer.operation==='import'?'memoryImportProgress'
    :transfer.operation==='retry'?'memoryRetryProgress'
    :transfer.operation==='restore'?'memoryRestoreProgress'
    :pending?'memoryUpdateWaiting'
    :transfer.restored?'memoryRestoreSuccess':'memoryImportSuccess';
  const progressDetail = pending?'memorySearchPending'
    :transfer.operation==='restore'?'memoryRestoreProgressDetail'
    :transfer.operation==='retry'?'memoryRetryProgressDetail':'memoryImportProgressDetail';
  return <section className="mt-6 rounded-[14px] border border-[var(--mroya-divider)] p-4 space-y-3">
    <h3 className="font-semibold">{tr('memoryTransferTitle',{ns:'connections'})}</h3>
    <div className="flex flex-wrap gap-3">
      <button type="button" disabled={busy} onClick={transfer.exportMemory} className="rounded-lg border border-[var(--mroya-divider)] px-4 py-2 disabled:opacity-40">{tr('memoryExport',{ns:'connections'})}</button>
      <label className="rounded-lg border border-[var(--mroya-divider)] px-4 py-2 cursor-pointer has-[:disabled]:opacity-40">
        {tr('memoryImport',{ns:'connections'})}
        <input className="sr-only" type="file" accept="application/json,.json" disabled={busy||transfer.searchPending} onChange={event=>void chooseFile(event)} />
      </label>
    </div>
    {fileName&&(validating||fileChecked)&&!showProgress&&<div role="status" aria-live="polite" aria-busy={validating} className="flex items-center gap-3 rounded-xl bg-[var(--mroya-surface-muted)] px-3 py-2.5">
      {validating?<LoaderCircle aria-hidden="true" className="h-4 w-4 shrink-0 motion-safe:animate-spin text-[var(--mroya-primary)]"/>
        :<CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0 text-emerald-600"/>}
      <div className="min-w-0">
        <p className="text-sm font-medium">{tr(validating?'memoryFileChecking':'memoryFileReady',{ns:'connections'})}</p>
        <p className="truncate text-xs text-[var(--mroya-text-muted)]" title={fileName}>{fileName}</p>
      </div>
    </div>}
    {transfer.importUnavailable && <p className="text-sm text-[var(--mroya-text-muted)]">{tr('memoryImportUnavailable',{ns:'connections'})}</p>}
    {confirming && <div className="space-y-3" role="alert">
      <p>{tr('memoryReplaceWarning',{ns:'connections'})}</p>
      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={busy||!transfer.canImportFile} onClick={()=>{setConfirming(false);transfer.importValidatedFile();}} className="rounded-lg bg-[var(--mroya-primary)] text-[var(--mroya-on-primary)] px-4 py-2 disabled:opacity-40">{tr('memoryReplaceConfirm',{ns:'connections'})}</button>
        <button type="button" disabled={busy} onClick={()=>setConfirming(false)} className="px-4 py-2">{tr('cancel',{ns:'common'})}</button>
      </div>
    </div>}
    {transfer.error && <p role="alert" className="text-sm text-[var(--mroya-error)]">{transfer.error}</p>}
    {validationFailed && <p role="alert" className="text-sm text-[var(--mroya-error)]">{tr('memoryValidationFailed',{ns:'connections'})}</p>}
    {showProgress&&<div role="status" aria-live="polite" aria-busy={processing} className="space-y-3 rounded-xl border border-[var(--mroya-divider)] bg-[var(--mroya-surface-muted)] p-3">
      <div className="flex items-center gap-2.5">
        {processing?<LoaderCircle aria-hidden="true" className="h-4 w-4 shrink-0 motion-safe:animate-spin text-[var(--mroya-primary)]"/>
          :pending?<Clock3 aria-hidden="true" className="h-4 w-4 shrink-0 text-[var(--mroya-text-muted)]"/>
          :<CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0 text-emerald-600"/>}
        <p className="text-sm font-medium">{tr(progressTitle,{ns:'connections'})}</p>
      </div>
      <div role="progressbar" aria-label={tr(progressTitle,{ns:'connections'})}
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={complete?100:undefined}
        aria-valuetext={tr(complete?progressTitle:progressDetail,{ns:'connections'})}
        className="h-2 overflow-hidden rounded-full bg-[var(--mroya-divider)]">
        <div className={`h-full rounded-full ${complete?'w-full bg-emerald-500':pending?'mroya-memory-progress-paused bg-[var(--mroya-primary)]':'mroya-memory-progress bg-[var(--mroya-primary)]'}`}/>
      </div>
      {!complete&&<p className="text-xs leading-relaxed text-[var(--mroya-text-muted)]">{tr(progressDetail,{ns:'connections'})}</p>}
      {pending&&<button type="button" disabled={busy||!transfer.retryAvailable} onClick={transfer.retrySearch} className="text-sm underline underline-offset-2 disabled:opacity-40">{tr('memoryRetrySearch',{ns:'connections'})}</button>}
    </div>}
    {transfer.canRestore && <button type="button" disabled={busy} onClick={transfer.restorePrevious} className="text-sm underline disabled:opacity-40">{tr('memoryRestore',{ns:'connections'})}</button>}
  </section>;
}
