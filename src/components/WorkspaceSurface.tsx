import type {ReactNode} from 'react';
import React, {useEffect, useRef} from 'react';
import {observeMobileWorkspace} from '../utils/mobileWorkspace';
import {WorkspaceMenuContext} from './WorkspaceMenuButton';

/** One presentation surface for live, offline Studio and guest workspaces. */
export function WorkspaceSurface({children,mobileOpen,onOpenMobile,onCloseMobile}:{children:ReactNode;mobileOpen:boolean;onOpenMobile:()=>void;onCloseMobile:()=>void}) {
  const root=useRef<HTMLDivElement>(null);
  const actions=useRef({mobileOpen,onOpenMobile,onCloseMobile});
  actions.current={mobileOpen,onOpenMobile,onCloseMobile};
  useEffect(()=>{
    if(!root.current)return;
    const media=window.matchMedia('(max-width: 1023px)');
    const resize=()=>{if(!media.matches&&actions.current.mobileOpen)actions.current.onCloseMobile();};
    media.addEventListener('change',resize);
    const stopSwipe=observeMobileWorkspace(root.current,()=>({
      ...actions.current,
      onOpenMobile:()=>{
        root.current?.querySelector<HTMLElement>('[data-workspace-menu-trigger]')?.focus({preventScroll:true});
        actions.current.onOpenMobile();
      },
    }));
    return ()=>{stopSwipe();media.removeEventListener('change',resize);};
  },[]);
  return <div ref={root} className="mroya-workspace flex h-dvh w-full min-w-0 overflow-hidden bg-[var(--mroya-bg)] text-[var(--mroya-text)]">
    <WorkspaceMenuContext.Provider value={{open:mobileOpen,onOpen:onOpenMobile}}>{children}</WorkspaceMenuContext.Provider>
  </div>;
}
