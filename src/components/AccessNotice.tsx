import React from 'react';
export function AccessNotice({message,onSignIn,onClose}:{message:string;onSignIn?:()=>void;onClose?:()=>void}) {
 return <div role="status" className="rounded-[12px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] p-4 space-y-3 text-sm shadow-[var(--mroya-shadow-subtle)]"><p>{message}</p><div className="flex gap-3">{onSignIn&&<button onClick={onSignIn} className="rounded-full px-4 py-2 bg-[var(--mroya-primary)] text-[var(--mroya-on-primary)]">Sign in</button>}{onClose&&<button onClick={onClose} className="px-3 py-2">Close</button>}</div></div>;
}
