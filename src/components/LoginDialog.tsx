import React, {useEffect, useRef} from 'react';
import {X} from 'lucide-react';
import {LoginScreen, type LoginScreenProps} from './LoginScreen';
export function LoginDialog({onClose,...form}:LoginScreenProps & {onClose:()=>void}) {
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const dialog=ref.current!;const previous=document.activeElement as HTMLElement|null;dialog.showModal();dialog.querySelector<HTMLInputElement>('input[name="username"]')?.focus();return()=>{dialog.close();if(previous?.isConnected)previous.focus();};},[]);
 return <dialog ref={ref} aria-label="Sign in to Mroya" onKeyDown={event=>{if(event.key!=='Tab')return;const items=Array.from(ref.current!.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]')).filter(el=>el.getClientRects().length>0);const first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}} onCancel={event=>{event.preventDefault();onClose();}} className="m-auto w-full max-w-md max-h-[95dvh] overflow-y-auto rounded-[14px] border border-[var(--mroya-divider)] bg-[var(--mroya-bg)] p-0 text-[var(--mroya-text)] backdrop:bg-black/40 backdrop:backdrop-blur-sm">
 <button type="button" onClick={onClose} aria-label="Close sign in" className="absolute top-2 right-2 p-2 rounded-lg hover:bg-[var(--mroya-surface-muted)]"><X className="w-4 h-4"/></button>
 <LoginScreen {...form} embedded/>
 </dialog>;
}
