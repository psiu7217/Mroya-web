import {useLiveMemoryInbox} from '../hooks/useLiveMemoryInbox';
import {useUserTimezone} from '../hooks/useUserTimezone';
import {useLiveCalendar} from '../hooks/useLiveCalendar';
import {googleSyncPresentation} from '../hooks/calendarAdapters';
import React,{useState,useMemo} from 'react';
import {WorkspaceView} from '../pages/WorkspaceView';
import {useLiveWorkspace} from '../hooks/useLiveWorkspace';
import {useWorkspaceLayout} from '../hooks/useWorkspaceLayout';
import {useTelegramConnection} from '../hooks/useTelegramConnection';
import {conversationListPresentation} from '../hooks/conversationPresentation';
import {useChatDiagnostics} from '../hooks/useChatDiagnostics';
import {useUserPreferences} from '../hooks/useUserPreferences';
import {accountPresentation,chatPresentation,memoryPresentation,graphPresentation} from '../hooks/liveAdapters';
import type {ApiUser} from '../types/api';
import type {WorkspaceSource} from '../types/source';
import type {WorkspaceModel} from '../types/workspace';
import type {NavSection} from '../types/mroya';

export function LiveExperience({source,user,onExpired,onLogout}:{source:WorkspaceSource;user:ApiUser;onExpired:()=>void;onLogout:()=>void}) {
 const {state,controller}=useLiveWorkspace(source,onExpired,user.id);
 const preferences=useUserPreferences(source,user,onExpired);
 const timezone=useUserTimezone(source,user,onExpired);
 const confirmedUser=timezone.user;

 const layout=useWorkspaceLayout({theme:preferences.theme,onThemeChange:preferences.setTheme});
 const [section,setSection]=useState<NavSection>('chat'),[notice,setNotice]=useState<string|null>(null);
 const [selectedMemory,setSelectedMemory]=useState<string|null>(null),[selectedNode,setSelectedNode]=useState<string|null>(null);
 const [contextOpen,setContextOpen]=useState(false),[focusedMemoryId,setFocusedMemoryId]=useState<string|null>(null);
 const [settingsTab,setSettingsTab]=useState<WorkspaceModel['settingsTab']>('connections');
 const telegram=useTelegramConnection(source,user.id,section==='connections'&&settingsTab==='connections',onExpired);
 const calendar=useLiveCalendar(source,user.id,confirmedUser.timezone,state.capabilities?.calendar_rest===true,state.capabilities?.calendar_rest===true&&state.capabilities?.connections_rest===true,section==='calendar'||section==='connections'&&settingsTab==='connections',onExpired);
 const inbox=useLiveMemoryInbox(source,user.id,section==='memory',onExpired,()=>void controller.refreshMemory());
 const google=calendar.controller.connection;
 const googleView=googleSyncPresentation(google);
 const diagnostics=useChatDiagnostics(source,user.id,onExpired,setNotice,state.activeConversationId);
 const logout=()=>{controller.stop();inbox.controller.stop();calendar.controller.stop();timezone.stop();diagnostics.stop();telegram.stop();preferences.stop();onLogout();};
 const account=accountPresentation({...confirmedUser,nickname:preferences.nickname});
 const metadata=state.conversations.find(c=>c.id===state.activeConversationId);
 const conversation=state.history.conversation_id?chatPresentation(state.history.conversation_id,state.history.messages):null;
 if(conversation&&metadata)conversation.title=metadata.title||'New chat';
 const memories=state.memories.memories.map(m=>memoryPresentation(m,state.map));
 const graph=useMemo(()=>graphPresentation(state.map),[state.map]);
 const unavailable=()=>setNotice('This feature is not available on the current server. No changes have been saved.');
 const select=(next:NavSection)=>{if(next==='connections')setSettingsTab('connections');setSection(next);layout.closeMobile();setNotice(null);};
 const openSettings=(tab:WorkspaceModel['settingsTab'])=>{select('connections');setSettingsTab(tab);};
 const openMemory=(id:string)=>{
  select('memory');
  if(!memories.some(m=>m.id===id)){setNotice('This memory is not in the loaded page. Load more memories to inspect it.');return;}
  setSelectedMemory(id);setFocusedMemoryId(id);
 };
 const openMap=(id:string)=>{if(!id){setNotice('This memory has no displayed map node.');return;}setSelectedNode(id);select('memory-map');};
 const ask=(text:string)=>{select('chat');void controller.send(text);};
 const newChat=()=>{select('chat');void controller.createConversation();};
 const selectChat=(id:string)=>{
  const current=controller.snapshot();
  if(id===current.activeConversationId){select('chat');return;}
  if(current.busy||current.uncertain||current.conversationBusy||current.operationUncertain||!current.conversations.some(c=>c.id===id))return;
  diagnostics.stop();select('chat');void controller.selectConversation(id);
 };
 const focusMemory=(id:string)=>{if(!memories.some(m=>m.id===id)){setNotice('This memory is not in the loaded page. Load more memories to inspect it.');return;}setFocusedMemoryId(id);setContextOpen(true);};
 const sendMessage=(content:string)=>new Promise<boolean>(resolve=>{
  // Acknowledge the composer after CREATE is confirmed and the pending message is queued.
  void controller.send(content,()=>resolve(true)).then(resolve,()=>resolve(false));
 });
 const model:WorkspaceModel={
  memoryInbox:inbox.presentation,
  runtime:{memoryInboxAvailable:inbox.state.available,timezoneSettings:timezone,diagnostics,telegram,pending:state.busy||state.loading||state.uncertain||state.conversationBusy||state.operationUncertain||state.capabilities?.chat!==true,
   conversationLocked:state.busy||state.uncertain||state.conversationBusy||state.loading||state.operationUncertain,
   loading:state.loading,busy:state.busy,error:state.error,onRetry:()=>void controller.recover(),
   chatAvailable:state.capabilities?.chat===true,memoryAvailable:state.capabilities?.memory_read===true,
   calendarAvailable:calendar.state.available,remindersAvailable:false,memoriesTotal:state.memories.total,
   hasOlder:state.history.next_before!==null,onOlder:()=>void controller.older(),
   hasMoreMemories:memories.length<state.memories.total,onMoreMemories:()=>void controller.moreMemories(),
   truncated:state.map.truncated===true||state.map.stats?.truncated===true,notice,onCloseNotice:()=>setNotice(null),
   onUnavailable:unavailable,onLogout:logout,
   preferenceSave:{status:preferences.status,error:preferences.error,onRetry:preferences.retry},
   showModelReasoning:preferences.show_model_reasoning,onToggleShowModelReasoning:preferences.setShowModelReasoning,
   onSaveNickname:preferences.saveNickname,onClearNickname:()=>preferences.saveNickname('')},
  account,activeSection:section,isSidebarCollapsed:layout.collapsed,mobileMenuOpen:layout.mobile,
  theme:preferences.theme,appearance:layout.appearance,plan:'free',planModalOpen:false,
  conversations:conversationListPresentation(state.conversations,user.timezone),activeConversationId:state.activeConversationId,activeConversation:conversation,
  memories,nodes:graph.nodes,edges:graph.edges,events:calendar.state.events,reminders:[],connections:[],
  reminderModalOpen:false,editingReminder:null,reminderPreselectedEventId:undefined,
  isContextPanelOpen:contextOpen,selectedMemoryViewId:selectedMemory,selectedGraphNodeId:selectedNode,selectedCalendarEventId:null,
  focusedMemory:memories.find(m=>m.id===focusedMemoryId)??null,
  relatedMemoriesForActiveChat:[],upcomingRelatedEvent:null,settingsTab,addedActionIds:[],googleCalendarConnected:google?.status==='connected',
  calendar:{loading:calendar.state.loading,busy:calendar.state.busy,mutationPending:calendar.state.mutationPending,error:calendar.state.error,timezone:confirmedUser.timezone,
   onRetry:calendar.controller.retry,onRangeChange:calendar.controller.setRange,onLoadEventForEdit:calendar.controller.loadForEdit},
  googleCalendarAvailable:calendar.state.googleAvailable,googleCalendarBusy:calendar.state.googleBusy,
  googleCalendarError:calendar.state.googleError,
  googleCalendarNotice:[calendar.state.oauthNotice,googleView.notice].filter(Boolean).join(' · '),
  googleConnections:calendar.state.connections,selectedGoogleConnectionId:calendar.state.selectedConnectionId,
  onSelectGoogleConnection:calendar.controller.selectConnection,onRefreshGoogleCalendar:()=>void calendar.controller.loadConnections(),
  onConnectAnotherGoogleCalendar:()=>void calendar.controller.connect(true),
  gcalSyncState:googleView.state,autoSync:google?.sync_enabled??false,lastSyncedTime:google?.last_synced_at??'',syncSummary:null,
  googleCalendarEmail:google?.email??'',importedCalendars:google?.calendars.filter(c=>c.selected).map(c=>c.id)??[],
  exportCalendar:google?.calendars.find(c=>c.export_destination)?.id??'',
  onConnectGoogleCalendar:()=>void calendar.controller.connect(),onDisconnectGoogleCalendar:()=>void calendar.controller.disconnect(),
  onSyncNowGoogleCalendar:()=>void calendar.controller.sync(),onToggleAutoSyncGoogleCalendar:()=>void calendar.controller.toggleAuto(),
  onChangeImportedCalendars:ids=>void calendar.controller.imports(ids),onChangeExportCalendar:id=>void calendar.controller.destination(id),
  handleNewChat:newChat,handleSendMessage:sendMessage,handleCitationClick:focusMemory,handleChatActionClick:unavailable,
  handleAddOrUpdateReminder:unavailable,handleDeleteReminder:unavailable,handleToggleCompleteReminder:unavailable,
  handleTogglePauseReminder:unavailable,handleUnlinkReminder:unavailable,handleSimulateGoogleSync:unavailable,
  onSidebarSelectSection:select,onSidebarSelectConversation:selectChat,
  onSidebarRenameConversation:controller.renameConversation,onSidebarDeleteConversation:controller.deleteConversation,
  onSidebarTogglePlan:unavailable,
  onSidebarOpenPlanModal:()=>openSettings('plan'),onSidebarToggleTheme:layout.toggleTheme,onSidebarToggleCollapse:layout.toggleCollapse,
  onSidebarCloseMobile:layout.closeMobile,onSidebarOpenSettingsTab:openSettings,
  onChatWorkspaceExpandSidebar:layout.expand,onChatWorkspaceOpenMobileMenu:layout.openMobile,
  onChatWorkspaceToggleContextPanel:()=>setContextOpen(v=>!v),onChatWorkspaceTogglePlan:unavailable,
  onChatWorkspaceOpenPlanModal:()=>openSettings('plan'),onChatWorkspaceToggleTheme:layout.toggleTheme,onChatWorkspaceOpenSettingsTab:openSettings,
  onMemoryContextPanelClose:()=>setContextOpen(false),onMemoryContextPanelSelectMemory:focusMemory,
  onMemoryContextPanelOpenInMemoryView:openMemory,onMemoryContextPanelOpenInMemoryMap:openMap,onMemoryContextPanelOpenInCalendar:unavailable,
  onCalendarViewAddEvent:calendar.controller.create,onCalendarViewEditEvent:calendar.controller.edit,onCalendarViewDeleteEvent:calendar.controller.remove,onCalendarViewOpenMemory:openMemory,onCalendarViewOpenConnections:()=>openSettings('connections'),
  onCalendarViewAddReminder:unavailable,onCalendarViewNavigateToReminders:()=>select('reminders'),
  onCalendarViewExpandSidebar:layout.expand,onCalendarViewOpenMobileMenu:layout.openMobile,
  onRemindersViewUpdateReminder:unavailable,onRemindersViewOpenCalendarEvent:unavailable,
  onRemindersViewOpenNewReminderModal:unavailable,onRemindersViewOpenEditReminderModal:unavailable,
  onRemindersViewExpandSidebar:layout.expand,onRemindersViewOpenMobileMenu:layout.openMobile,
  onMemoryViewSelectMemory:id=>{setSelectedMemory(id);setFocusedMemoryId(id);},onMemoryViewUpdateMemory:unavailable,onMemoryViewForgetMemory:unavailable,onMemoryViewAddMemory:unavailable,
  onMemoryViewExploreInMap:openMap,onMemoryViewAskMroyaAbout:m=>ask('What do you know about '+m.title+'?'),
  onMemoryViewExpandSidebar:layout.expand,onMemoryViewOpenMobileMenu:layout.openMobile,
  onMemoryMapViewSelectNode:setSelectedNode,onMemoryMapViewOpenMemory:openMemory,onMemoryMapViewAskAboutNode:n=>ask('What do you know about '+n.label+'?'),
  onMemoryMapViewExpandSidebar:layout.expand,onMemoryMapViewOpenMobileMenu:layout.openMobile,
  onConnectionsSettingsViewToggleConnection:unavailable,onConnectionsSettingsViewSelectPlan:unavailable,
  onConnectionsSettingsViewSelectTheme:preferences.setTheme,onConnectionsSettingsViewChangeTab:setSettingsTab,
  onConnectionsSettingsViewExpandSidebar:layout.expand,onConnectionsSettingsViewOpenMobileMenu:layout.openMobile,
  onClosePlanPreview:unavailable,onPreviewFreePlan:unavailable,onPreviewPremiumPlan:unavailable,onReminderEditorModalClose:unavailable,
 };
 return <WorkspaceView model={model}/>;
}
