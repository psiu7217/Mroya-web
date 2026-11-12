import React from 'react';
import {tr} from '../i18n';
import type {MemoryTransferPresentation} from '../types/memoryTransfer';

// The controller owns authorization, validation, and the API.  This component
// is only shown when a live, authorized controller supplies these callbacks.
export function MemoryTransferSettings({transfer}: {transfer: MemoryTransferPresentation}) {
  const [confirming, setConfirming] = React.useState(false);
  const [validating, setValidating] = React.useState(false);
  const [validationFailed, setValidationFailed] = React.useState(false);
  const chooseFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    setConfirming(false);
    setValidationFailed(false);
    if (!file) return;
    setValidating(true);
    try { setConfirming(await transfer.validateFile(file)); }
    catch { setValidationFailed(true); }
    finally { setValidating(false); }
  };
  const busy = transfer.busy || validating;
  return <section className="mt-6 rounded-[14px] border border-[var(--mroya-divider)] p-4 space-y-3">
    <h3 className="font-semibold">{tr('memoryTransferTitle',{ns:'connections'})}</h3>
    <div className="flex flex-wrap gap-3">
      <button type="button" disabled={busy} onClick={transfer.exportMemory} className="rounded-lg border border-[var(--mroya-divider)] px-4 py-2 disabled:opacity-40">{tr('memoryExport',{ns:'connections'})}</button>
      <label className="rounded-lg border border-[var(--mroya-divider)] px-4 py-2 cursor-pointer has-[:disabled]:opacity-40">
        {tr('memoryImport',{ns:'connections'})}
        <input className="sr-only" type="file" accept="application/json,.json" disabled={busy||transfer.searchPending} onChange={event=>void chooseFile(event)} />
      </label>
    </div>
    {!transfer.importAvailable && <p className="text-sm text-[var(--mroya-text-muted)]">{tr('memoryImportUnavailable',{ns:'connections'})}</p>}
    {confirming && <div className="space-y-3" role="alert">
      <p>{tr('memoryReplaceWarning',{ns:'connections'})}</p>
      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={busy||!transfer.importAvailable} onClick={()=>{setConfirming(false);transfer.importValidatedFile();}} className="rounded-lg bg-[var(--mroya-primary)] text-[var(--mroya-on-primary)] px-4 py-2 disabled:opacity-40">{tr('memoryReplaceConfirm',{ns:'connections'})}</button>
        <button type="button" disabled={busy} onClick={()=>setConfirming(false)} className="px-4 py-2">{tr('cancel',{ns:'common'})}</button>
      </div>
    </div>}
    {transfer.error && <p role="alert" className="text-sm text-[var(--mroya-error)]">{transfer.error}</p>}
    {validationFailed && <p role="alert" className="text-sm text-[var(--mroya-error)]">{tr('memoryValidationFailed',{ns:'connections'})}</p>}
    {transfer.success && <p role="status" className="text-sm">{tr(transfer.restored?'memoryRestoreSuccess':'memoryImportSuccess',{ns:'connections'})}</p>}
    {transfer.searchPending && <div role="status" className="text-sm space-y-2">
      <p>{tr('memorySearchPending',{ns:'connections'})}</p>
      <button type="button" disabled={busy||!transfer.retryAvailable} onClick={transfer.retrySearch} className="underline disabled:opacity-40">{tr('memoryRetrySearch',{ns:'connections'})}</button>
    </div>}
    {transfer.canRestore && <button type="button" disabled={busy} onClick={transfer.restorePrevious} className="text-sm underline disabled:opacity-40">{tr('memoryRestore',{ns:'connections'})}</button>}
  </section>;
}
