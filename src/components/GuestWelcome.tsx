import React from 'react';
import {BrandMark} from './BrandMark';
export type GreetingPhase='pause'|'typing'|'ready';
export function GuestWelcome({phase,onSignIn}:{phase:GreetingPhase;onSignIn:()=>void}) {
 if(phase==='pause')return <div className="h-16"/>;
 return (
  <section aria-label="Mroya welcome" className="w-full mb-6 space-y-2.5 guest-welcome">
   <div className="flex items-center gap-2">
    <BrandMark size="sm"/>
    <p className="text-[13px] font-semibold text-[var(--mroya-text)]">Mroya</p>
   </div>
   {phase==='typing'?(
    <div role="status" aria-label="Mroya is typing" className="w-full flex gap-1.5 p-4">
     <span className="guest-dot"/><span className="guest-dot"/><span className="guest-dot"/>
    </div>
   ):(
    <div className="w-full p-3.5 sm:p-5 rounded-[12px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] shadow-[var(--mroya-shadow-subtle)] space-y-3 text-[15px] leading-6">
     <p>Hi! I’m Mroya, your personal AI assistant.</p>
     <p>I can help you remember what matters, connect information, and find details from our conversations.</p>
     <p>Sign in to start chatting and build your personal memory.</p>
     <button onClick={onSignIn} className="rounded-full px-5 py-2 bg-[var(--mroya-primary)] text-[var(--mroya-on-primary)] font-medium">Get started</button>
    </div>
   )}
  </section>
 );
}
