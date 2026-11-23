import React, {useEffect, useRef} from 'react';
import {X} from 'lucide-react';
import {LoginScreen, type LoginScreenProps} from './LoginScreen';
import {tr} from '../i18n';
export function LoginDialog({onClose,...form}:LoginScreenProps & {onClose:()=>void}) {
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const dialog=ref.current!;const previous=document.activeElement as HTMLElement|null;dialog.showModal();if(window.matchMedia('(min-width: 640px)').matches)dialog.querySelector<HTMLInputElement>('input[name="username"]')?.focus();return()=>{dialog.close();if(previous?.isConnected)previous.focus();};},[]);
 return <dialog ref={ref} aria-label={tr('signInToMroya',{ns:'auth'})} onKeyDown={event=>{if(event.key!=='Tab')return;const items=Array.from(ref.current!.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]')).filter(el=>el.getClientRects().length>0);const first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}} onCancel={event=>{event.preventDefault();onClose();}} className="m-auto w-[calc(100%-2rem)] max-w-sm max-h-[95dvh] overflow-y-auto rounded-2xl bg-[var(--mroya-surface)] p-0 text-[var(--mroya-text)] backdrop:bg-black/55">
 <button type="button" onClick={onClose} aria-label={tr('closeSignIn',{ns:'auth'})} className="absolute top-2 right-2 p-2 rounded-lg hover:bg-[var(--mroya-surface-muted)]"><X className="w-4 h-4"/></button>
 <LoginScreen {...form} embedded/>
 </dialog>;
}
