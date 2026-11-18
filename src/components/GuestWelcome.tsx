import React from 'react';
import {BrandMark} from './BrandMark';
import {tr} from '../i18n';
export type GreetingPhase='pause'|'typing'|'ready';
export function GuestWelcome({phase,onSignIn}:{phase:GreetingPhase;onSignIn:()=>void}) {
 if(phase==='pause')return <div className="h-16"/>;
 return (
  <section aria-label={tr('welcomeTitle',{ns:'auth'})} className="w-full mb-6 space-y-2.5 guest-welcome">
   <div className="flex items-center gap-2">
    <BrandMark size="sm"/>
    <p className="text-[13px] font-semibold text-[var(--mroya-text)]">Mroya</p>
   </div>
   {phase==='typing'?(
    <div role="status" aria-label={tr('typing',{ns:'chat'})} className="w-full flex gap-1.5 p-4">
     <span className="guest-dot"/><span className="guest-dot"/><span className="guest-dot"/>
    </div>
   ):(
    <div className="w-full p-3.5 sm:p-5 rounded-[12px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] shadow-[var(--mroya-shadow-subtle)] space-y-3 text-[15px] leading-6">
     <p>{tr('guestHello',{ns:'auth'})}</p>
     <p>{tr('guestHelp',{ns:'auth'})}</p>
     <p>{tr('guestInvite',{ns:'auth'})}</p>
     <button onClick={onSignIn} className="rounded-full px-5 py-2 bg-[var(--mroya-primary)] text-[var(--mroya-on-primary)] font-medium">{tr('getStarted',{ns:'auth'})}</button>
    </div>
   )}
  </section>
 );
}
