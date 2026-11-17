import React,{useEffect,useRef} from 'react';
import {Download,LoaderCircle,Share2,X} from 'lucide-react';
import type {ImageViewerPresentation} from '../types/imageViewer';
import {tr} from '../i18n';

const toolbarAction = 'inline-flex size-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-default disabled:opacity-35';

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
 return <div ref={panel} role="dialog" aria-modal="true" aria-labelledby="mroya-image-viewer-title" onKeyDown={event=>{
   if(event.key==='Escape'){event.preventDefault();event.stopPropagation();viewer.onClose();}
   if(event.key==='Tab'){
    const items=Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href]')??[]);
    const first=items[0],last=items.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
   }
  }} className="fixed inset-0 z-[100] grid grid-rows-[auto_minmax(0,1fr)_auto] gap-3 bg-neutral-950/95 p-3 text-white sm:gap-4 sm:p-6">
   <h2 id="mroya-image-viewer-title" className="sr-only">{viewer.image.title||t('imageViewerTitle')}</h2>
   <header className="flex items-center justify-end gap-2" onClick={event=>{if(event.target===event.currentTarget)viewer.onClose();}}>
    {viewer.downloadUrl ? <a href={viewer.downloadUrl} download={viewer.filename} aria-label={t('imageDownload')}
      title={t('imageDownload')} className={toolbarAction}><Download className="size-[18px]" aria-hidden="true"/></a>
      : <button type="button" disabled aria-label={t('imageDownload')} className={toolbarAction}><Download className="size-[18px]" aria-hidden="true"/></button>}
    <button type="button" onClick={viewer.onShare} disabled={!viewer.downloadUrl||viewer.sharing} aria-label={t('imageShare')}
      title={t('imageShare')} className={toolbarAction}>
      {viewer.sharing ? <LoaderCircle className="size-[18px] animate-spin motion-reduce:animate-none" aria-hidden="true"/>
        : <Share2 className="size-[18px]" aria-hidden="true"/>}
    </button>
    <button ref={close} type="button" onClick={viewer.onClose} aria-label={t('imageViewerClose')}
      title={t('imageViewerClose')} className={toolbarAction}><X className="size-5" aria-hidden="true"/></button>
   </header>
   <div className="flex min-h-0 min-w-0 items-center justify-center" aria-busy={viewer.loading}
     onClick={event=>{if(event.target===event.currentTarget)viewer.onClose();}}>
    {viewer.previewUrl ? <img src={viewer.previewUrl} alt={viewer.image.title} className="max-h-full max-w-full rounded-lg object-contain"/>
      : viewer.loading ? <div role="status" className="flex flex-col items-center gap-3 text-sm text-white/75">
          <LoaderCircle className="size-8 animate-spin motion-reduce:animate-none" aria-hidden="true"/>{t('imageLoading')}
        </div> : <div className="space-y-3 px-4 text-center text-sm">
          <p role="alert">{t('imageNotice_loadFailed')}</p>
          <button type="button" onClick={viewer.onRetry} className="rounded-lg bg-white/10 px-4 py-2 hover:bg-white/20">{t('imageRetry')}</button>
        </div>}
   </div>
   {viewer.notice&&viewer.notice!=='loadFailed'&&<p role="status" className="mx-auto max-w-lg rounded-lg bg-white/10 px-3 py-2 text-center text-sm">{t('imageNotice_'+viewer.notice)}</p>}
 </div>;
}
