import React from 'react';
import {Menu} from 'lucide-react';
import {Sidebar,type SidebarProps} from '../components/Sidebar';
import {ChatWorkspace,type ChatWorkspaceProps} from '../components/ChatWorkspace';
import {MemoryView,type MemoryViewProps} from '../components/MemoryView';
import {MemoryMapView} from '../components/MemoryMapView';
import {AccessNotice} from '../components/AccessNotice';
import type {NavSection,GraphNode,GraphEdge} from '../types/mroya';
export interface LiveWorkspaceProps {
 sidebar:SidebarProps;chat:ChatWorkspaceProps;memory:MemoryViewProps;
 map:{nodes:GraphNode[];edges:GraphEdge[];selectedNodeId:string|null;onSelectNode:(id:string)=>void;onOpenMemory:(id:string)=>void;onAskAboutNode:(node:GraphNode)=>void};
 section:NavSection|'settings';notice:string|null;onCloseNotice:()=>void;error:string|null;loading:boolean;busy:boolean;onRefresh:()=>void;
 hasOlder:boolean;onOlder:()=>void;hasMoreMemories:boolean;onMoreMemories:()=>void;truncated:boolean;
}
export function LiveWorkspace(props:LiveWorkspaceProps) {
 const {sidebar,chat,memory,map,section}=props;
 return <div className="flex h-dvh w-full overflow-hidden bg-[var(--mroya-bg)] text-[var(--mroya-text)]"><Sidebar {...sidebar}/><main className="relative flex-1 flex flex-col min-w-0 overflow-hidden">
 {(props.error||props.loading||props.busy)&&<div role={props.error?'alert':'status'} className="px-4 py-2 text-sm bg-[var(--mroya-surface-muted)] border-b border-[var(--mroya-divider)]">{props.error??(props.busy?'Mroya is working…':'Loading your workspace…')}{props.error&&<button disabled={props.busy||props.loading} onClick={props.onRefresh} className="ml-3 underline">Check server status</button>}</div>}
 {section==='chat'?<><div className="px-4 text-xs">{props.hasOlder&&<button disabled={props.loading||props.busy} onClick={props.onOlder} className="py-2 underline">Load earlier messages</button>}</div><ChatWorkspace {...chat}/></>:
 section==='memory'?<><p className="px-4 py-2 text-xs text-[var(--mroya-text-muted)]">Read-only list. Ask Mroya in chat to update your memory.</p>{props.hasMoreMemories&&<button disabled={props.loading||props.busy} onClick={props.onMoreMemories} className="py-2 text-sm underline">Load more memories</button>}<MemoryView {...memory} readOnly/></>:
 section==='memory-map'?<>{props.truncated&&<p role="status" className="p-2 text-xs">This map is limited by the server; some connections are not shown.</p>}<MemoryMapView {...map} isSidebarCollapsed={sidebar.isCollapsed} onExpandSidebar={chat.onExpandSidebar} onOpenMobileMenu={chat.onOpenMobileMenu}/></>:
 <section className="p-5 space-y-4"><button onClick={chat.onOpenMobileMenu} aria-label="Open navigation" className="lg:hidden p-2"><Menu/></button><h1 className="text-xl font-semibold">{section==='settings'?'Settings':section[0].toUpperCase()+section.slice(1)}</h1>{section==='settings'?<><p>{sidebar.account.displayName}</p><p>{sidebar.account.email}</p><p>Time zone: {sidebar.account.timezone}</p><button onClick={chat.onToggleTheme} className="underline">Switch to {sidebar.theme==='light'?'dark':'light'} theme</button><button onClick={sidebar.onLogout} className="block underline">Sign out</button></>:<AccessNotice message="This feature is not available on the current server. No changes have been saved."/>}</section>}
 {props.notice&&<div className="absolute top-16 left-3 right-3 z-30 max-w-md mx-auto"><AccessNotice message={props.notice} onClose={props.onCloseNotice}/></div>}
 </main></div>;
}
