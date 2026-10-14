import React,{useEffect,useRef,useState} from 'react';
import {Menu} from 'lucide-react';
import {Sidebar,type SidebarProps} from '../components/Sidebar';
import {ChatWorkspace,type ChatWorkspaceProps} from '../components/ChatWorkspace';
import {MemoryView,type MemoryViewProps} from '../components/MemoryView';
import {MemoryMapView} from '../components/MemoryMapView';
import {AccessNotice} from '../components/AccessNotice';
import type {NavSection,GraphNode,GraphEdge,ThemeMode} from '../types/mroya';
export interface LiveWorkspaceProps {
 settings:{theme:ThemeMode;nickname:string;status:'saved'|'saving'|'unsaved';error:string|null;onSelectTheme:(theme:ThemeMode)=>void;onSaveNickname:(nickname:string)=>void;onRetry:()=>void};
 sidebar:SidebarProps;chat:ChatWorkspaceProps;memory:MemoryViewProps;
 map:{nodes:GraphNode[];edges:GraphEdge[];selectedNodeId:string|null;onSelectNode:(id:string)=>void;onOpenMemory:(id:string)=>void;onAskAboutNode:(node:GraphNode)=>void};
 section:NavSection|'settings';notice:string|null;onCloseNotice:()=>void;error:string|null;loading:boolean;busy:boolean;onRefresh:()=>void;
 hasOlder:boolean;onOlder:()=>void;hasMoreMemories:boolean;onMoreMemories:()=>void;truncated:boolean;
}
export function LiveWorkspace(props:LiveWorkspaceProps) {
 const {sidebar,chat,memory,map,section}=props;
 const [nicknameDraft,setNicknameDraft]=useState(props.settings.nickname);
 const previousNickname=useRef(props.settings.nickname);
 useEffect(()=>{
  const previous=previousNickname.current;
  setNicknameDraft(draft=>draft===previous?props.settings.nickname:draft);
  previousNickname.current=props.settings.nickname;
 },[props.settings.nickname]);
 return <div className="flex h-dvh w-full overflow-hidden bg-[var(--mroya-bg)] text-[var(--mroya-text)]"><Sidebar {...sidebar}/><main className="relative flex-1 flex flex-col min-w-0 overflow-hidden">
 {(props.error||props.loading||props.busy)&&<div role={props.error?'alert':'status'} className="px-4 py-2 text-sm bg-[var(--mroya-surface-muted)] border-b border-[var(--mroya-divider)]">{props.error??(props.busy?'Mroya is working…':'Loading your workspace…')}{props.error&&<button disabled={props.busy||props.loading} onClick={props.onRefresh} className="ml-3 underline">Check server status</button>}</div>}
 {section==='chat'?<><div className="px-4 text-xs">{props.hasOlder&&<button disabled={props.loading||props.busy} onClick={props.onOlder} className="py-2 underline">Load earlier messages</button>}</div><ChatWorkspace {...chat}/></>:
 section==='memory'?<><p className="px-4 py-2 text-xs text-[var(--mroya-text-muted)]">Read-only list. Ask Mroya in chat to update your memory.</p>{props.hasMoreMemories&&<button disabled={props.loading||props.busy} onClick={props.onMoreMemories} className="py-2 text-sm underline">Load more memories</button>}<MemoryView {...memory} readOnly/></>:
 section==='memory-map'?<>{props.truncated&&<p role="status" className="p-2 text-xs">This map is limited by the server; some connections are not shown.</p>}<MemoryMapView {...map} isSidebarCollapsed={sidebar.isCollapsed} onExpandSidebar={chat.onExpandSidebar} onOpenMobileMenu={chat.onOpenMobileMenu}/></>:
 <section className="p-4 sm:p-6 overflow-y-auto space-y-5">
 <button onClick={chat.onOpenMobileMenu} aria-label="Open navigation" className="lg:hidden p-2"><Menu/></button>
 <h1 className="text-xl font-semibold">{section==='settings'?'Settings':section[0].toUpperCase()+section.slice(1)}</h1>
 {section==='settings'?<>
 <div className="max-w-xl rounded-xl border border-[var(--mroya-divider)] bg-[var(--mroya-surface)] p-5 space-y-3">
  <h2 className="font-semibold">Appearance</h2>
  <p className="text-sm text-[var(--mroya-text-muted)]">Your theme is saved to your account. System follows your device appearance.</p>
  <div role="group" aria-label="Theme preference" className="grid grid-cols-3 gap-2">
   {(['system','light','dark'] as const).map(choice=><button key={choice} type="button" aria-pressed={props.settings.theme===choice} onClick={()=>props.settings.onSelectTheme(choice)} className={`rounded-lg border px-3 py-2 text-sm font-medium ${props.settings.theme===choice?'border-[var(--mroya-primary)] bg-[var(--mroya-surface-active)]':'border-[var(--mroya-divider)] bg-[var(--mroya-surface-muted)]'}`}>{choice==='system'?'System':choice==='light'?'Light':'Dark'}</button>)}
  </div>
 </div>
 <div className="max-w-xl rounded-xl border border-[var(--mroya-divider)] bg-[var(--mroya-surface)] p-5 space-y-3">
  <h2 className="font-semibold">Profile</h2>
  <p className="text-sm text-[var(--mroya-text-muted)]">{sidebar.account.displayName} · {sidebar.account.email}</p>
  <p className="text-sm text-[var(--mroya-text-muted)]">Time zone: {sidebar.account.timezone||'Not set'}</p>
  <form onSubmit={event=>{event.preventDefault();setNicknameDraft(nicknameDraft.trim());props.settings.onSaveNickname(nicknameDraft);}} className="space-y-2">
   <label htmlFor="mroya-nickname" className="block text-sm font-medium">Nickname</label>
   <input id="mroya-nickname" type="text" autoComplete="nickname" value={nicknameDraft} onChange={event=>setNicknameDraft(event.target.value)} className="w-full rounded-lg border border-[var(--mroya-divider)] bg-[var(--mroya-bg)] px-3 py-2 text-[var(--mroya-text)]"/>
   <div className="flex flex-wrap gap-3">
    <button type="submit" className="rounded-full bg-[var(--mroya-primary)] px-4 py-2 text-sm font-medium text-[var(--mroya-on-primary)]">Save nickname</button>
    <button type="button" className="text-sm underline" onClick={()=>{setNicknameDraft('');props.settings.onSaveNickname('');}}>Clear nickname</button>
   </div>
  </form>
 </div>
 <div className="max-w-xl text-sm" aria-live="polite">
  {props.settings.status==='saving'?<p role="status">Saving account settings…</p>:props.settings.status==='saved'?<p role="status">Settings saved</p>:<p role="alert">These changes are not saved on the server.</p>}
  {props.settings.error&&<p role="alert" className="text-[var(--mroya-error)]">{props.settings.error}</p>}
  {props.settings.status==='unsaved'&&<button type="button" className="underline mt-2" onClick={props.settings.onRetry}>Retry saving</button>}
 </div>
 <button onClick={sidebar.onLogout} className="block underline text-sm">Sign out</button>
 </>:<AccessNotice message="This feature is not available on the current server. No changes have been saved."/>}
 </section>}
 {props.notice&&<div className="absolute top-16 left-3 right-3 z-30 max-w-md mx-auto"><AccessNotice message={props.notice} onClose={props.onCloseNotice}/></div>}
 </main></div>;
}
