import React from 'react';
import {WorkspaceSurface} from '../components/WorkspaceSurface';
import {Sidebar,type SidebarProps} from '../components/Sidebar';
import {ChatWorkspace,type ChatWorkspaceProps} from '../components/ChatWorkspace';
import {GuestWelcome,type GreetingPhase} from '../components/GuestWelcome';
import {AccessNotice} from '../components/AccessNotice';
export function GuestWorkspace({sidebar,chat,phase,notice,onSignIn,onCloseNotice}:{sidebar:SidebarProps;chat:ChatWorkspaceProps;phase:GreetingPhase;notice:string|null;onSignIn:()=>void;onCloseNotice:()=>void}) {
 return <WorkspaceSurface mobileOpen={sidebar.mobileOpen} onOpenMobile={chat.onOpenMobileMenu} onCloseMobile={sidebar.onCloseMobile}><Sidebar {...sidebar}/><main className="flex-1 min-w-0 relative flex flex-col"><ChatWorkspace {...chat} onSignIn={onSignIn} intro={<GuestWelcome phase={phase} onSignIn={onSignIn}/>}/>{notice&&<div className="absolute top-16 left-3 right-3 z-30 max-w-md mx-auto"><AccessNotice message={notice} onSignIn={onSignIn} onClose={onCloseNotice}/></div>}</main></WorkspaceSurface>;
}
