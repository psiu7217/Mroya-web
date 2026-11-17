import React,{useEffect,useRef} from 'react';
import {Download,LoaderCircle,Share2,X} from 'lucide-react';
import type {ImageViewerPresentation} from '../types/imageViewer';
import {tr} from '../i18n';

export function ImageLightbox({viewer}:{viewer?:ImageViewerPresentation}){
 const panel=useRef<HTMLDivElement>(null),close=useRef<HTMLButtonElement>(null);
 const open=!!viewer?.image;
 useEffect(()=>{
  if(!open)return;
  const previous=document.activeElement,overflow=document.body.style.overflow;
  const imageUrl=viewer?.image?.url;
  document.body.style.overflow='hidden';close.current?.focus();
  return()=>{document.body.style.overflow=overflow;
   // Markdown can replace its image button while viewer state updates.
   const trigger=Array.from(document.querySelectorAll<HTMLElement>('[data-image-url]')).find(node=>node.dataset.imageUrl===imageUrl);
   if(trigger)trigger.focus();else if(previous instanceof HTMLElement&&previous.isConnected)previous.focus();
  };
 },[open,viewer?.image?.url]);
 if(!viewer?.image)return null;
 const t=(key:string)=>tr(key,{ns:'chat'});
 return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-2 backdrop-blur-sm sm:p-6" onClick={event=>{if(event.target===event.currentTarget)viewer.onClose();}}>
  <div ref={panel} role="dialog" aria-modal="true" aria-labelledby="mroya-image-viewer-title" onKeyDown={event=>{
   if(event.key==='Escape'){event.preventDefault();event.stopPropagation();viewer.onClose();}
   if(event.key==='Tab'){
    const items=Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href]')??[]);
    const first=items[0],last=items.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
   }
  }} className="flex max-h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-[var(--mroya-surface)] text-[var(--mroya-text)] shadow-2xl">
   <header className="flex shrink-0 items-center gap-3 border-b border-[var(--mroya-divider)] px-4 py-3 sm:px-5">
    <h2 id="mroya-image-viewer-title" className="min-w-0 flex-1 truncate text-sm font-medium">{viewer.image.title||t('imageViewerTitle')}</h2>
    <button ref={close} type="button" onClick={viewer.onClose} aria-label={t('imageViewerClose')} className="rounded-full p-2 hover:bg-[var(--mroya-surface-muted)]"><X className="h-5 w-5"/></button>
   </header>
   <div className="flex min-h-40 min-w-0 flex-1 items-center justify-center overflow-auto bg-[var(--mroya-surface-muted)] p-3 sm:p-5" aria-busy={viewer.loading}>
    {viewer.previewUrl?<img src={viewer.previewUrl} alt={viewer.image.title} className="max-h-[68dvh] max-w-full rounded-lg object-contain"/>:viewer.loading?<div role="status" className="flex flex-col items-center gap-3 py-16 text-sm text-[var(--mroya-text-muted)]"><LoaderCircle className="h-8 w-8 animate-spin motion-reduce:animate-none"/>{t('imageLoading')}</div>:<p role="alert" className="py-16 text-center text-sm">{t('imageNotice_loadFailed')}</p>}
   </div>
   <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-[var(--mroya-divider)] px-4 py-3 sm:px-5">
    {viewer.notice&&<p role="status" className="w-full pb-1 text-sm text-[var(--mroya-text-muted)]">{t('imageNotice_'+viewer.notice)}</p>}
    {viewer.notice==='loadFailed'&&<button type="button" onClick={viewer.onRetry} className="rounded-xl border border-[var(--mroya-divider)] px-4 py-2 text-sm">{t('imageRetry')}</button>}
    {viewer.downloadUrl?<a href={viewer.downloadUrl} download={viewer.filename} className="inline-flex items-center gap-2 rounded-xl border border-[var(--mroya-divider)] px-4 py-2 text-sm"><Download className="h-4 w-4"/>{t('imageDownload')}</a>:<button type="button" disabled className="rounded-xl border border-[var(--mroya-divider)] px-4 py-2 text-sm opacity-40">{t('imageDownload')}</button>}
    <button type="button" onClick={viewer.onShare} disabled={!viewer.downloadUrl||viewer.sharing} className="inline-flex items-center gap-2 rounded-xl bg-[var(--mroya-primary)] px-4 py-2 text-sm font-medium text-[var(--mroya-on-primary)] disabled:opacity-40">{viewer.sharing?<LoaderCircle className="h-4 w-4 animate-spin"/>:<Share2 className="h-4 w-4"/>}{t('imageShare')}</button>
   </footer>
  </div>
 </div>;
}
