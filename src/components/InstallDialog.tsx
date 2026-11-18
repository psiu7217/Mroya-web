import React, {useEffect, useRef} from 'react';
import {Download, Share, X} from 'lucide-react';
import {tr} from '../i18n';
import type {InstallPresentation} from '../types/install';

export function InstallDialog({install}: {install: InstallPresentation}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (install.instruction) ref.current?.showModal();
    else ref.current?.close();
  }, [install.instruction]);
  return <dialog ref={ref} aria-labelledby="install-title" onCancel={install.onClose}
    onClick={event => { if (event.target === event.currentTarget) install.onClose(); }}
    className="m-auto w-[calc(100%_-_2rem)] max-w-sm rounded-2xl border border-[var(--mroya-divider)] bg-[var(--mroya-surface)] text-[var(--mroya-text)] p-6 shadow-xl backdrop:bg-black/40">
    <div className="flex items-center justify-between gap-3">
      <h2 id="install-title" className="text-lg font-semibold">{tr('installApp',{ns:'common'})}</h2>
      <button type="button" autoFocus onClick={install.onClose} aria-label={tr('close',{ns:'common'})} className="p-2 rounded-lg hover:bg-[var(--mroya-surface-muted)]"><X size={18}/></button>
    </div>
    <div className="my-5 text-[var(--mroya-primary)]">{install.instruction === 'ios' ? <Share size={28}/> : <Download size={28}/>}</div>
    <p className="text-sm leading-6">{tr(install.instruction === 'ios' ? 'installIos' : install.instruction === 'android' ? 'installAndroid' : 'installDesktop', {ns:'common'})}</p>
    <button type="button" onClick={install.onClose} className="mt-6 w-full rounded-xl px-4 py-2.5 bg-[var(--mroya-primary)] text-[var(--mroya-on-primary)] font-semibold">{tr('installGotIt',{ns:'common'})}</button>
  </dialog>;
}
