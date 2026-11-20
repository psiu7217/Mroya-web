import React from 'react';
import {BookOpen, CheckCircle2, Clock3, Download, FileWarning, LoaderCircle, RotateCcw, Upload} from 'lucide-react';
import {tr} from '../i18n';
import {MEMORY_SNAPSHOT_MAX_BYTES, type MemoryTransferPresentation} from '../types/memoryTransfer';

const copy=(key:string,options:Record<string,unknown>={})=>tr(key,{ns:'connections',...options});
const row='flex w-full min-w-0 items-center gap-3 px-3 py-3 text-left hover:bg-[var(--mroya-surface-muted)] disabled:opacity-50 disabled:cursor-default';
const icon='size-5 shrink-0 text-[var(--mroya-primary)]';

// The controller owns authorization, validation, and the API.  This component
// is only shown when a live, authorized controller supplies these callbacks.
export function MemoryTransferSettings({transfer}: {transfer: MemoryTransferPresentation}) {
  const [confirming, setConfirming] = React.useState(false);
  const [selected, setSelected] = React.useState<{name:string; status:'checking'|'ready'|'rejected'}|null>(null);
  const input = React.useRef<HTMLInputElement>(null);
  const upload = React.useRef<HTMLButtonElement>(null);
  const confirmation = React.useRef<HTMLDivElement>(null);
  React.useEffect(()=>{if(confirming)confirmation.current?.focus();},[confirming]);

  const chooseFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if(!file)return;
    setConfirming(false);
    setSelected({name:file.name,status:'checking'});
    let valid=false;
    try {valid=await transfer.validateFile(file);}
    catch {/* The file remains rejected. */}
    setSelected({name:file.name,status:valid?'ready':'rejected'});
    setConfirming(valid);
  };
  const cancel=()=>{setConfirming(false);upload.current?.focus();};
  const validating=selected?.status==='checking';
  const validated=selected?.status==='ready';
  const ready=validated&&transfer.canImportFile;
  const busy = transfer.busy || validating;
  const processing = transfer.operation==='import'||transfer.operation==='retry'||transfer.operation==='restore';
  const pending = transfer.searchPending&&!processing&&!validating;
  const complete = transfer.success&&!pending&&!processing&&!validating;
  const showProgress = !validating&&(processing||pending||complete);
  const showFile=!!selected&&!showProgress;
  const progressTitle = transfer.operation==='import'?'memoryImportProgress'
    :transfer.operation==='retry'?'memoryRetryProgress'
    :transfer.operation==='restore'?'memoryRestoreProgress'
    :pending?'memoryUpdateWaiting'
    :transfer.restored?'memoryRestoreSuccess':'memoryImportSuccess';
  const progressDetail = pending?'memorySearchPending'
    :transfer.operation==='restore'?'memoryRestoreProgressDetail'
    :transfer.operation==='retry'?'memoryRetryProgressDetail':'memoryImportProgressDetail';
  return <section aria-labelledby="mroya-memory-transfer-title" className="space-y-3">
    <h3 id="mroya-memory-transfer-title" className="font-semibold">{copy('memoryTransferTitle')}</h3>
    <div className="flex items-start gap-3 rounded-xl bg-[var(--mroya-surface-muted)] p-3.5">
      <BookOpen aria-hidden="true" className={`${icon} mt-0.5`}/>
      <div className="min-w-0 space-y-2 text-sm">
        <h4 className="font-semibold">{copy('memoryBulkEditTitle')}</h4>
        <p className="leading-relaxed text-[var(--mroya-text-muted)]">{copy('memoryBulkEditExport')}</p>
        <p className="leading-relaxed text-[var(--mroya-text-muted)]">{copy('memoryBulkEditImport')}</p>
      </div>
    </div>

    <div className="divide-y divide-[var(--mroya-divider)] rounded-xl border border-[var(--mroya-divider)]">
      <button type="button" disabled={busy} onClick={transfer.exportMemory} className={`${row} rounded-t-xl`}>
        {transfer.operation==='export'
          ? <LoaderCircle aria-hidden="true" className={`${icon} motion-safe:animate-spin`}/>
          : <Download aria-hidden="true" className={icon}/>}
        <span><span className="block text-sm font-medium">{copy('memoryExport')}</span>
          <span className="block text-xs text-[var(--mroya-text-muted)]">{copy(transfer.operation==='export'?'memoryExportPreparing':'memorySnapshotFormat')}</span></span>
      </button>
      <div>
        <button ref={upload} type="button" disabled={busy||transfer.searchPending||!transfer.importAvailable} onClick={()=>input.current?.click()}
          className={`${row} rounded-b-xl`}>
          <Upload aria-hidden="true" className={icon}/>
          <span><span className="block text-sm font-medium">{copy('memoryImport')}</span>
            <span className="block text-xs text-[var(--mroya-text-muted)]">{copy('memorySnapshotUploadFormat',{limit:MEMORY_SNAPSHOT_MAX_BYTES/1024/1024})}</span></span>
        </button>
        <input ref={input} hidden type="file" accept="application/json,.json" aria-label={copy('memoryImport')}
          disabled={busy||transfer.searchPending||!transfer.importAvailable} onChange={event=>void chooseFile(event)}/>
        {transfer.importUnavailable&&<p className="px-3 pb-3 text-sm text-[var(--mroya-text-muted)]">{copy('memoryImportUnavailable')}</p>}
        {selected&&showFile&&(
          <div role={selected.status==='rejected'?'alert':'status'} aria-busy={validating} className="mx-3 mb-3 flex items-start gap-2.5 rounded-lg bg-[var(--mroya-surface-muted)] p-2.5">
            {validating ? <LoaderCircle aria-hidden="true" className={`${icon} motion-safe:animate-spin`}/>
              : validated ? <CheckCircle2 aria-hidden="true" className={icon}/>
              : <FileWarning aria-hidden="true" className="size-5 shrink-0 text-[var(--mroya-error)]"/>}
            <div className="min-w-0">
              <p className="break-words text-xs text-[var(--mroya-text-muted)] [overflow-wrap:anywhere]">{selected.name}</p>
              <p className="text-sm">{validating?copy('memoryFileChecking'):validated?copy('memoryFileReady'):transfer.error??copy('memoryValidationFailed')}</p>
              {ready&&!confirming&&<button type="button" className="mt-1 text-sm text-[var(--mroya-primary)] underline" onClick={()=>setConfirming(true)}>{copy('memoryReviewImport')}</button>}
            </div>
          </div>
        )}
        {confirming&&ready&&(
          <div ref={confirmation} tabIndex={-1} role="group" aria-label={copy('memoryReplaceConfirm')}
            onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();cancel();}}}
            className="mx-3 mb-3 space-y-2.5 rounded-lg border border-[var(--mroya-divider)] p-3">
            <p className="text-sm">{copy('memoryReplaceWarning')}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={busy||transfer.searchPending} onClick={()=>{setConfirming(false);transfer.importValidatedFile();}}
                className="rounded-lg bg-[var(--mroya-primary)] px-3 py-2 text-sm text-[var(--mroya-on-primary)] disabled:opacity-40">{copy('memoryReplaceConfirm')}</button>
              <button type="button" disabled={busy} onClick={cancel} className="rounded-lg px-3 py-2 text-sm hover:bg-[var(--mroya-surface-muted)]">{tr('cancel',{ns:'common'})}</button>
            </div>
          </div>
        )}
      </div>
    </div>
    {transfer.error&&!(showFile&&selected?.status==='rejected')&&<p role="alert" className="text-sm text-[var(--mroya-error)]">{transfer.error}</p>}
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
    {transfer.canRestore&&<button type="button" disabled={busy} onClick={transfer.restorePrevious} className={`${row} rounded-xl border border-[var(--mroya-divider)]`}>
      <RotateCcw aria-hidden="true" className={icon}/>
      <span><span className="block text-sm font-medium">{copy('memoryRestore')}</span>
        <span className="block text-xs text-[var(--mroya-text-muted)]">{copy('memoryRestoreSnapshotDetail')}</span></span>
    </button>}
  </section>;
}
