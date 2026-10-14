import React,{useState} from 'react';
import {LiveWorkspace} from '../pages/LiveWorkspace';
import {useLiveWorkspace} from '../hooks/useLiveWorkspace';
import {useWorkspaceLayout} from '../hooks/useWorkspaceLayout';
import {useUserPreferences} from '../hooks/useUserPreferences';
import {accountPresentation,chatPresentation,memoryPresentation,graphPresentation} from '../hooks/liveAdapters';
import type {ApiUser} from '../types/api';
import type {WorkspaceSource} from '../types/source';
import type {NavSection} from '../types/mroya';
export function LiveExperience({source,user,onExpired,onLogout}:{source:WorkspaceSource;user:ApiUser;onExpired:()=>void;onLogout:()=>void}) {
 const {state,controller}=useLiveWorkspace(source,onExpired);
 const preferences=useUserPreferences(source,user,onExpired);
 const logout=()=>{preferences.stop();onLogout();};
 const layout=useWorkspaceLayout({theme:preferences.theme,onThemeChange:preferences.setTheme});
 const [section,setSection]=useState<NavSection|'settings'>('chat'),[notice,setNotice]=useState<string|null>(null),[selectedMemory,setSelectedMemory]=useState<string|null>(null),[selectedNode,setSelectedNode]=useState<string|null>(null);
 const account=accountPresentation({...user,nickname:preferences.nickname}),conversation=state.history.conversation_id?chatPresentation(state.history.conversation_id,state.history.messages):null;
 const memories=state.memories.memories.map(m=>memoryPresentation(m,state.map)),graph=graphPresentation(state.map);
 const unavailable=()=>setNotice('This feature is not available on the current server. No changes have been saved.');
 const select=(s:NavSection|'settings')=>{setSection(s);layout.closeMobile();setNotice(null);};
 const openMemory=(id:string)=>{setSelectedMemory(id);select('memory');};
 const ask=(text:string)=>{select('chat');void controller.send(text);};
 const newChat=()=>{select('chat');setNotice('This server currently uses one conversation. Your history is preserved.');};
 return <LiveWorkspace settings={{theme:preferences.theme,nickname:preferences.nickname,status:preferences.status,error:preferences.error,onSelectTheme:preferences.setTheme,onSaveNickname:preferences.saveNickname,onRetry:preferences.retry}} section={section} notice={notice} onCloseNotice={()=>setNotice(null)} error={state.error} loading={state.loading} busy={state.busy} onRefresh={()=>void controller.recover()} hasOlder={state.history.next_before!==null} onOlder={()=>void controller.older()} hasMoreMemories={state.memories.memories.length<state.memories.total} onMoreMemories={()=>void controller.moreMemories()} truncated={state.map.truncated===true||state.map.stats?.truncated===true}
 sidebar={{account,live:true,onLogout:logout,activeSection:section==='settings'?'connections':section,onSelectSection:select,conversations:conversation?[conversation]:[],activeConversationId:conversation?.id??null,onSelectConversation:()=>select('chat'),onNewChat:newChat,plan:'free',onTogglePlan:unavailable,onOpenPlanModal:unavailable,theme:layout.appearance,onToggleTheme:layout.toggleTheme,isCollapsed:layout.collapsed,onToggleCollapse:layout.toggleCollapse,mobileOpen:layout.mobile,onCloseMobile:layout.closeMobile,memoriesCount:state.memories.total,upcomingEventsCount:0,pendingRemindersCount:0,onOpenSettingsTab:()=>select('settings')}}
 chat={{account,live:true,memoriesCount:state.memories.total,conversation,onSendMessage:content=>void controller.send(content),pending:state.busy||state.loading||state.uncertain,onCitationClick:openMemory,onActionClick:unavailable,addedActionIds:[],isSidebarCollapsed:layout.collapsed,onExpandSidebar:layout.expand,onOpenMobileMenu:layout.openMobile,isContextPanelOpen:false,onToggleContextPanel:()=>select('memory'),plan:'free',onTogglePlan:unavailable,onOpenPlanModal:unavailable,theme:layout.appearance,onToggleTheme:layout.toggleTheme,onNewChat:newChat,onOpenSettingsTab:()=>select('settings'),onUnavailable:unavailable}}
 memory={{memories,selectedMemoryId:selectedMemory,onSelectMemory:setSelectedMemory,onUpdateMemory:unavailable,onForgetMemory:unavailable,onAddMemory:unavailable,onExploreInMap:id=>{if(!id){setNotice('This memory has no displayed map node.');return;}setSelectedNode(id);select('memory-map');},onAskMroyaAbout:m=>ask('What do you know about '+m.title+'?'),isSidebarCollapsed:layout.collapsed,onExpandSidebar:layout.expand,onOpenMobileMenu:layout.openMobile}}
 map={{...graph,selectedNodeId:selectedNode,onSelectNode:setSelectedNode,onOpenMemory:openMemory,onAskAboutNode:n=>ask('What do you know about '+n.label+'?')}}/>;
}
