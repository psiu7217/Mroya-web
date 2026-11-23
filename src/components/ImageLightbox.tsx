import {useEffect,useRef,useState,type ReactNode} from 'react';
import {ArrowLeft,Download,LoaderCircle,Scan,Share2,ZoomIn,ZoomOut} from 'lucide-react';
import type {ImageViewerPresentation} from '../types/imageViewer';
import {tr} from '../i18n';
import {DialogFocus} from './DialogFocus';

const toolbarAction = 'inline-flex min-h-10 min-w-10 items-center justify-center rounded-full text-[var(--mroya-text-muted)] hover:bg-[var(--mroya-surface-muted)] hover:text-[var(--mroya-primary)] disabled:cursor-default disabled:opacity-35';
const t=(key:string)=>tr(key,{ns:'chat'});

function ImagePreview({url,title,actions}:{url:string;title:string;actions:ReactNode}){
 const [zoom,setZoom]=useState(100);
 const viewport=useRef<HTMLDivElement>(null);
 const changeZoom=(value:number)=>{
  const area=viewport.current;
  const left=area?(area.scrollLeft+area.clientWidth/2)/zoom:0;
  const top=area?(area.scrollTop+area.clientHeight/2)/zoom:0;
  setZoom(value);
  requestAnimationFrame(()=>{
   if(area?.isConnected)area.scrollTo(left*value-area.clientWidth/2,top*value-area.clientHeight/2);
  });
 };
 return <>
  <div ref={viewport} className="min-h-0 flex-1 overflow-auto overscroll-contain">
   <div style={{width:`${zoom}%`,height:`${zoom}%`}}>
    <img src={url} alt={title} className="h-full w-full object-contain" draggable={false}/>
   </div>
  </div>
  <footer className="flex shrink-0 flex-wrap items-center justify-center gap-1 border-t border-[var(--mroya-divider)] px-3 pt-1.5 pb-[max(.5rem,env(safe-area-inset-bottom))]">
   <button type="button" onClick={()=>changeZoom(zoom-50)} disabled={zoom===100}
    title={t('imageZoomOut')} aria-label={t('imageZoomOut')} className={toolbarAction}><ZoomOut className="size-[18px]" aria-hidden="true"/></button>
   <button type="button" onClick={()=>changeZoom(zoom+50)} disabled={zoom===300}
    title={t('imageZoomIn')} aria-label={t('imageZoomIn')} className={toolbarAction}><ZoomIn className="size-[18px]" aria-hidden="true"/></button>
   <button type="button" onClick={()=>changeZoom(100)} disabled={zoom===100}
    className={`${toolbarAction} gap-2 px-3 text-sm text-[var(--mroya-primary)]`}><Scan className="size-4" aria-hidden="true"/>{t('imageZoomReset')}</button>
   {actions}
  </footer>
 </>;
}

export function ImageLightbox({viewer}:{viewer?:ImageViewerPresentation}){
 const imageUrl=viewer?.image?.url;
 useEffect(()=>{
  if(!imageUrl)return;
  const overflow=document.body.style.overflow;
  document.body.style.overflow='hidden';
  return()=>{
   document.body.style.overflow=overflow;
   // The source image button can be replaced as a reply becomes canonical.
   queueMicrotask(()=>{
    if(document.activeElement!==document.body)return;
    const trigger=Array.from(document.querySelectorAll<HTMLElement>('[data-image-url]'))
      .find(node=>node.dataset.imageUrl===imageUrl && node.getClientRects().length);
    trigger?.focus();
   });
  };
 },[imageUrl]);
 if(!viewer?.image)return null;
 const title=viewer.image.title||t('imageViewerTitle');
 const actions=<>
    {viewer.downloadUrl ? <a href={viewer.downloadUrl} download={viewer.filename} aria-label={t('imageDownload')}
      title={t('imageDownload')} className={toolbarAction}><Download className="size-[18px]" aria-hidden="true"/></a>
      : <button type="button" disabled aria-label={t('imageDownload')} className={toolbarAction}><Download className="size-[18px]" aria-hidden="true"/></button>}
    <button type="button" onClick={viewer.onShare} disabled={!viewer.downloadUrl||viewer.sharing} aria-label={t('imageShare')}
      title={t('imageShare')} className={toolbarAction}>
      {viewer.sharing ? <LoaderCircle className="size-[18px] animate-spin motion-reduce:animate-none" aria-hidden="true"/>
        : <Share2 className="size-[18px]" aria-hidden="true"/>}
    </button>
 </>;
 return <DialogFocus role="dialog" aria-modal="true" aria-labelledby="mroya-image-viewer-title" tabIndex={-1}
   onClose={viewer.onClose} className="fixed inset-0 z-[100] flex flex-col bg-[var(--mroya-bg)] text-[var(--mroya-text)]">
   <header className="flex min-h-14 shrink-0 items-center gap-2 bg-[var(--mroya-surface)] px-3 sm:px-6">
    <button type="button" onClick={viewer.onClose} aria-label={t('imageViewerClose')}
      title={t('imageViewerClose')} className={toolbarAction}><ArrowLeft className="size-5" aria-hidden="true"/></button>
    <h2 id="mroya-image-viewer-title" className="min-w-0 flex-1 truncate text-lg font-semibold" title={title}>{title}</h2>
   </header>
   {viewer.previewUrl ? <ImagePreview key={viewer.previewUrl} url={viewer.previewUrl} title={title} actions={actions}/>
    : <div className="grid min-h-0 flex-1 place-items-center px-4 text-sm" aria-busy={viewer.loading}>
      {viewer.loading ? <div role="status" className="flex flex-col items-center gap-3 text-[var(--mroya-text-muted)]">
        <LoaderCircle className="size-8 animate-spin motion-reduce:animate-none" aria-hidden="true"/>{t('imageLoading')}
       </div> : <div className="space-y-3 text-center">
        <p role="alert">{t('imageNotice_loadFailed')}</p>
        <button type="button" onClick={viewer.onRetry} className="rounded-lg bg-[var(--mroya-surface-muted)] px-4 py-2">{t('imageRetry')}</button>
       </div>}
     </div>}
   {viewer.notice&&viewer.notice!=='loadFailed'&&<p role="status" className="mx-auto max-w-lg px-3 py-2 text-center text-sm">{t('imageNotice_'+viewer.notice)}</p>}
 </DialogFocus>;
}
