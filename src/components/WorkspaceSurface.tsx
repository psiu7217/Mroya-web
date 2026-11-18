import type {ReactNode} from 'react';
import React, {useEffect, useRef} from 'react';
import {observeMobileWorkspace} from '../utils/mobileWorkspace';

/** One presentation surface for live, offline Studio and guest workspaces. */
export function WorkspaceSurface({children,mobileOpen,onOpenMobile,onCloseMobile}:{children:ReactNode;mobileOpen:boolean;onOpenMobile:()=>void;onCloseMobile:()=>void}) {
  const root=useRef<HTMLDivElement>(null);
  const actions=useRef({mobileOpen,onOpenMobile,onCloseMobile});
  actions.current={mobileOpen,onOpenMobile,onCloseMobile};
  useEffect(()=>root.current?observeMobileWorkspace(root.current,()=>actions.current):undefined,[]);
  useEffect(()=>{if(mobileOpen&&window.matchMedia('(max-width: 1023px)').matches)(document.activeElement as HTMLElement|null)?.blur?.();},[mobileOpen]);
  return <div ref={root} className="mroya-workspace flex h-dvh w-full min-w-0 overflow-hidden bg-[var(--mroya-bg)] text-[var(--mroya-text)]">{children}</div>;
}
