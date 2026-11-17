import React from 'react';
import {Check,ImagePlus} from 'lucide-react';
import {tr} from '../i18n';

export function ImageGenerationCard({phase}:{phase:'generating'|'finishing'}){
 return <div className="mroya-image-generation relative isolate flex aspect-[4/3] w-full max-w-[440px] items-center justify-center overflow-hidden rounded-2xl border border-[var(--mroya-divider)]" aria-busy={phase==='generating'}>
  <div className="mroya-image-generation-colors absolute -inset-1/2 -z-10" aria-hidden="true"/>
  <div className="relative flex max-w-[85%] flex-col items-center gap-4 rounded-2xl border border-white/30 bg-[var(--mroya-surface)]/80 px-6 py-5 text-center shadow-sm backdrop-blur-md">
   {phase==='generating'?<div role="progressbar" aria-label={tr('imageGenerating',{ns:'chat'})} className="relative h-14 w-14">
    <svg viewBox="0 0 48 48" className="mroya-image-generation-ring h-full w-full" aria-hidden="true"><circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="2.5" opacity=".15"/><circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="82 126" className="text-[var(--mroya-primary)]"/></svg>
    <ImagePlus className="absolute left-4 top-4 h-6 w-6 text-[var(--mroya-primary)]" aria-hidden="true"/>
   </div>:<Check className="h-10 w-10 text-[var(--mroya-primary)]" aria-hidden="true"/>}
   <div role="status"><p className="text-sm font-medium">{tr(phase==='generating'?'imageGenerating':'imageFinishing',{ns:'chat'})}</p><p className="mt-1 text-xs text-[var(--mroya-text-muted)]">{tr('imageAutoSaved',{ns:'chat'})}</p></div>
  </div>
 </div>;
}
