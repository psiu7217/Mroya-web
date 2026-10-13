import React from 'react';
import {BrandMark} from './BrandMark';
export type GreetingPhase='pause'|'typing'|'ready';
export function GuestWelcome({phase,onSignIn}:{phase:GreetingPhase;onSignIn:()=>void}) {
 if(phase==='pause')return <div className="h-16"/>;
 return <section aria-label="Mroya welcome" className="mb-6 flex items-start gap-3 guest-welcome"><BrandMark size="sm"/><div className="flex-1 min-w-0 space-y-2"><p className="text-sm font-semibold">Mroya</p>
 {phase==='typing'?<div role="status" aria-label="Mroya is typing" className="flex gap-1.5 p-4"><span className="guest-dot"/><span className="guest-dot"/><span className="guest-dot"/></div>:<div className="p-5 rounded-[12px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] shadow-[var(--mroya-shadow-subtle)] space-y-3 text-[15px] leading-6"><p>Hi! I’m Mroya, your personal AI assistant.</p><p>I can help you remember what matters, connect information, and find details from our conversations.</p><p>Sign in to start chatting and build your personal memory.</p><button onClick={onSignIn} className="rounded-full px-5 py-2 bg-[var(--mroya-primary)] text-[var(--mroya-on-primary)] font-medium">Get started</button></div>}
 </div></section>;
}
