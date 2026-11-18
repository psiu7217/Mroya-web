import React from 'react';
import {AlertCircle,FileText,RotateCw,X} from 'lucide-react';
import {tr} from '../i18n';
import type {ChatAttachmentItem} from '../types/chatAttachments';
type Item=Omit<ChatAttachmentItem,'file'>;
export function AttachmentPreviews({items,disabled,onRemove,onRetry}:{items:Item[];disabled:boolean;onRemove:(id:string)=>void;onRetry?:(id:string)=>void}){
 return <div className="flex gap-3 overflow-x-auto px-3.5 pt-3 pb-1" aria-label={tr('attachmentsLabel',{ns:'chat'})}>
  {items.map(item=><div key={item.id} className="relative h-28 w-28 shrink-0 overflow-hidden rounded-xl border border-[var(--mroya-divider)] bg-[var(--mroya-surface-muted)]" title={item.filename}>
   {item.previewUrl?<img src={item.previewUrl} alt={item.filename} className={`h-full w-full object-cover ${item.status==='uploading'?'blur-[2px]':''}`}/>:<div className="flex h-[76px] items-center justify-center text-[var(--mroya-primary)]"><FileText className="h-9 w-9"/></div>}
   <div className={`absolute inset-x-0 bottom-0 truncate px-2 py-1.5 text-[10px] ${item.previewUrl?'bg-black/65 text-white':'bg-[var(--mroya-surface)] text-[var(--mroya-text)]'}`}>{item.filename}</div>
   {item.status==='uploading'&&<div className="absolute inset-0 flex items-center justify-center bg-black/25">
    <svg viewBox="0 0 36 36" className={`h-9 w-9 text-white ${item.progress===null?'animate-spin':''}`} role="progressbar" aria-label={tr('attachmentUploading',{ns:'chat',name:item.filename})} aria-valuemin={0} aria-valuemax={100} aria-valuenow={item.progress===null?undefined:Math.round(item.progress*100)}>
     <circle cx="18" cy="18" r="14" fill="none" stroke="currentColor" strokeWidth="2.5" opacity="0.3"/>
     <circle cx="18" cy="18" r="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" pathLength="100" strokeDasharray={`${Math.max(5,(item.progress??0.25)*100)} 100`} transform="rotate(-90 18 18)"/>
    </svg>
   </div>}
   {item.status==='error'&&<div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-[var(--mroya-surface)]/95 p-2 text-center"><AlertCircle className="h-5 w-5 text-red-500"/><span role="alert" className="text-[10px] leading-tight text-[var(--mroya-text)]">{item.error}</span>{onRetry&&<button type="button" disabled={disabled} onClick={()=>onRetry(item.id)} className="rounded-lg p-1 text-[var(--mroya-primary)]" aria-label={tr('attachmentRetry',{ns:'chat',name:item.filename})}><RotateCw className="h-4 w-4"/></button>}</div>}
   <button type="button" onClick={()=>onRemove(item.id)} disabled={disabled} aria-label={tr('attachmentRemove',{ns:'chat',name:item.filename})} className="absolute top-1 right-1 z-10 rounded-full bg-[var(--mroya-surface)] p-1 text-[var(--mroya-text-muted)] shadow-sm disabled:opacity-50"><X className="h-3 w-3"/></button>
  </div>)}
 </div>;
}
