import {useChatAttachments} from '../hooks/useChatAttachments';
import {hasFeature} from '../utils/accountRoles';
import {useMemoryTransfer} from '../hooks/useMemoryTransfer';
import {usePrivacySettings} from '../hooks/usePrivacySettings';
import {useSpeechInput} from '../hooks/useSpeechInput';
import {memoryLinkTargets} from '../hooks/memoryLinkTargets';
import {useFiles} from '../hooks/useFiles';
import {useImageViewer} from '../hooks/useImageViewer';
import {useLiveNotes} from '../hooks/useLiveNotes';
import {useNotificationSettings} from '../hooks/useNotificationSettings';
import {useUserTimezone} from '../hooks/useUserTimezone';
import {useLiveCalendar} from '../hooks/useLiveCalendar';
import {googleSyncPresentation} from '../hooks/calendarAdapters';
import React,{useState,useMemo} from 'react';
import {WorkspaceView} from '../pages/WorkspaceView';
import {useLiveWorkspace} from '../hooks/useLiveWorkspace';
import {useWorkspaceLayout} from '../hooks/useWorkspaceLayout';
import {useWorkspaceNavigation} from '../hooks/useWorkspaceNavigation';
import {useTelegramConnection} from '../hooks/useTelegramConnection';
import {conversationListPresentation} from '../hooks/conversationPresentation';
import {useChatDiagnostics} from '../hooks/useChatDiagnostics';
import {useUserPreferences} from '../hooks/useUserPreferences';
import {setAppLanguage,tr} from '../i18n';
import {currentLocale} from '../i18n/format';
import type {AppLanguage} from '../i18n/language';
import {accountPresentation,chatPresentation,memoryPresentation,graphPresentation} from '../hooks/liveAdapters';
import type {ApiUser} from '../types/api';
import type {WorkspaceSource} from '../types/source';
import type {InstallPresentation} from '../types/install';
import type {SettingsPage,WorkspaceModel} from '../types/workspace';
import type {NavSection} from '../types/mroya';

const detailsNeedChange=(selected:string|null,route:string|undefined)=>selected!==(route??null);

export function LiveExperience({install,source,user,onExpired,onLogout}:{install?:InstallPresentation;source:WorkspaceSource;user:ApiUser;onExpired:()=>void;onLogout:()=>void}) {
 const features={googleCalendar:hasFeature(user.role,'google_calendar'),reminders:hasFeature(user.role,'reminders')};
 const {state,controller}=useLiveWorkspace(source,onExpired,user.id);
 const memoryTransfer=useMemoryTransfer(source,()=>void controller.refreshMemory(),user.role==='admin');
 const [language,setLanguage]=useState<AppLanguage>(currentLocale);
 const preferences=useUserPreferences(source,user,onExpired,language);
 React.useLayoutEffect(()=>{if(preferences.language!==language){setAppLanguage(preferences.language);setLanguage(preferences.language);}},[preferences.language,language]);
 const timezone=useUserTimezone(source,user,onExpired);
 const confirmedUser=timezone.user;

 const layout=useWorkspaceLayout({theme:preferences.theme,onThemeChange:preferences.setTheme});
 const [notice,setNotice]=useState<string|null>(null);
 const navigation=useWorkspaceNavigation(()=>{layout.closeMobile();setNotice(null);});
 const {section,settings:settingsPage='home',detail}=navigation.route;
 const inSettings=section==='connections';
 const lastNonSettings=React.useRef<NavSection>('chat');
 const visitedNotes=React.useRef(false);
 if(!inSettings)lastNonSettings.current=section;
 if(section==='notes')visitedNotes.current=true;
 const settingsTab:WorkspaceModel['settingsTab']=settingsPage==='chat'?'settings'
  :settingsPage==='appearance'||settingsPage==='plan'?settingsPage
  :['profile','name','timezone','language','memory-transfer'].includes(settingsPage)?'profile':'connections';
 const speech=useSpeechInput(source,user.id,section+':'+(state.activeConversationId??''),onExpired);
 const [selectedMemory,setSelectedMemory]=useState<string|null>(null),[selectedNode,setSelectedNode]=useState<string|null>(null);
 const [contextOpen,setContextOpen]=useState(false),[focusedMemoryId,setFocusedMemoryId]=useState<string|null>(null);
 const telegram=useTelegramConnection(source,user.id,inSettings&&['connections','telegram','notifications'].includes(settingsPage),onExpired);
 const notifications=useNotificationSettings(source,user.id,telegram,onExpired);
 const calendar=useLiveCalendar(source,user.id,confirmedUser.timezone,state.capabilities?.calendar_rest===true,features.googleCalendar&&state.capabilities?.calendar_rest===true&&state.capabilities?.connections_rest===true,section==='calendar'||inSettings&&['connections','google','calendar-selection'].includes(settingsPage),onExpired,60000);
 const attachments=useChatAttachments(source,user.id,state.capabilities?.staged_document_uploads===true);
 const files=useFiles(source,user.id,state.capabilities?.documents===true,section==='files',onExpired);
 const images=useImageViewer(source,user.id,section+':'+(state.activeConversationId??''),onExpired);
 const notes=useLiveNotes(source,user.id,state.capabilities?.notes_read===true,section==='notes',state.busy,onExpired);
 React.useEffect(()=>{
  if(section==='notes'&&detailsNeedChange(notes.presentation.selectedId,detail))notes.controller.select(detail??null);
  if(section==='files'&&detailsNeedChange(files.presentation.selectedId,detail))files.controller.select(detail??null);
 },[section,detail,notes.controller,files.controller,notes.available,files.available]);
 const openDetail=(id:string|null)=>{
  if(id)navigation.navigate({section,detail:id});
  else if(detail)navigation.back();
 };
 const linkTargets=useMemo(()=>memoryLinkTargets(state.map),[state.map]);
 const google=calendar.controller.connection;
 const privacy=usePrivacySettings(source,user.id,state.capabilities?.google_data_privacy===true&&inSettings&&settingsPage==='privacy',onExpired);
 const googleView=googleSyncPresentation(google);
 const diagnostics=useChatDiagnostics(source,user.id,onExpired,setNotice,state.activeConversationId);
 const logout=()=>{images.controller.stop();attachments.controller.stop();files.controller.stop();notes.controller.stop();notifications.controller.stop();controller.stop();calendar.controller.stop();timezone.stop();diagnostics.stop();telegram.stop();preferences.stop();onLogout();};
 const account=accountPresentation({...confirmedUser,nickname:preferences.nickname});
 const metadata=state.conversations.find(c=>c.id===state.activeConversationId);
 const conversation=state.history.conversation_id?chatPresentation(state.history.conversation_id,state.history.messages):null;
 if(conversation&&metadata)conversation.title=metadata.title||tr('newChat',{ns:'chat'});
 const memories=state.memories.memories.map(m=>memoryPresentation(m,state.map));
 const graph=useMemo(()=>graphPresentation(state.map),[state.map]);
 const unavailable=()=>setNotice('unavailable');
 const openSettingsPage=(page:SettingsPage)=>{navigation.navigate({section:'connections',settings:page});layout.closeMobile();setNotice(null);};
 const select=(next:NavSection)=>{
  if(next!==section&&next!=='chat')attachments.controller.clear();
  if(next==='connections'){if(!inSettings)openSettingsPage('home');}
  else navigation.navigate({section:next});
  layout.closeMobile();setNotice(null);
 };
 const openSettings=(tab:WorkspaceModel['settingsTab'])=>{
  if(!inSettings)openSettingsPage('home');
  if(tab!=='settings')openSettingsPage(tab);
 };
 const openMemory=(id:string)=>{
  select('memory');
  if(!memories.some(m=>m.id===id)){setNotice('memoryNotLoaded');return;}
  setSelectedMemory(id);setFocusedMemoryId(id);
 };
 const openMap=(id:string)=>{if(!id){setNotice('memoryNoNode');return;}setSelectedNode(id);select('memory-map');};
 const ask=(text:string)=>{select('chat');void controller.send(text);};
 const newChat=()=>{select('chat');void controller.createConversation();};
 const selectChat=(id:string)=>{
  const current=controller.snapshot();
  if(id===current.activeConversationId){select('chat');return;}
  if(current.busy||current.uncertain||current.conversationBusy||current.operationUncertain||!current.conversations.some(c=>c.id===id))return;
  diagnostics.stop();select('chat');void controller.selectConversation(id);
 };
 const focusMemory=(id:string)=>{if(!memories.some(m=>m.id===id)){setNotice('memoryNotLoaded');return;}setFocusedMemoryId(id);setContextOpen(true);};
 const sendMessage=async(content:string,_attachmentName?:string,selected:File[]=[])=>{
  try{
   const prepared=selected.length&&attachments.presentation?await attachments.controller.prepare(selected):undefined;
   return await new Promise<boolean>(resolve=>{
    const accepted=()=>{if(prepared)attachments.controller.accepted(selected);resolve(true);};
    void controller.send(content,accepted,prepared?[]:selected,prepared).then(result=>{if(result&&prepared)attachments.controller.accepted(selected);resolve(result);},()=>resolve(false));
   });
  }catch{return false;}
 };
 const model:WorkspaceModel={
  imageViewer:images.presentation,
  chatAttachments:attachments.presentation,
  files:files.available?{...files.presentation,onSelect:openDetail}:undefined,
  documentsAvailable:state.capabilities?.documents===true,
  speech,
  install,
  privacy,
  aiTasks:{tasks:state.agentTasks,loading:state.tasksLoading,error:state.tasksError,hasMore:state.tasksNext!==null,
   executingTaskId:state.executingTaskId,onExecute:id=>void controller.executeTask(id),
   cancellingTaskId:state.cancellingTaskId,onCancel:id=>void controller.cancelTask(id),
   onReport:controller.reportTask,
   decidingTaskId:state.decidingTaskId,onDecision:(id,action,comment)=>controller.decideTask(id,action,comment),
   beginReview:controller.beginPendingReview,approveTask:controller.approvePendingTask,revokeTask:controller.revokePendingTask,
   refreshTask:controller.readTask,
   completedTask:state.completedTask,onOpen:()=>controller.openTasks(),onClose:()=>controller.closeTasks(),
   onRefresh:()=>void controller.refreshTasks(),onMore:()=>void controller.moreTasks(),
   onDetails:id=>void controller.taskDetails(id),onDismiss:()=>controller.dismissTask()},
  memoryLinksNavigation:{targets:linkTargets,onOpen:openMap},
  notifications:notifications.presentation,
  runtime:{features,notifications:notifications.presentation,timezoneSettings:timezone,diagnostics,telegram,pending:state.busy||state.loading||state.uncertain||state.conversationBusy||state.operationUncertain||state.capabilities?.chat!==true,
   conversationLocked:state.busy||state.uncertain||state.conversationBusy||state.loading||state.operationUncertain,
   loading:state.loading,busy:state.busy,error:state.error,onRetry:()=>void controller.recover(),
   chatAvailable:state.capabilities?.chat===true,memoryAvailable:state.capabilities?.memory_read===true,
   calendarAvailable:calendar.state.available,remindersAvailable:false,memoriesTotal:state.memories.total,
   hasOlder:state.history.next_before!==null,onOlder:()=>void controller.older(),
   hasMoreMemories:memories.length<state.memories.total,onMoreMemories:()=>void controller.moreMemories(),
   truncated:state.map.truncated===true||state.map.stats?.truncated===true,notice,onCloseNotice:()=>setNotice(null),
   onUnavailable:unavailable,onLogout:logout,
   preferenceSave:{status:preferences.status,error:preferences.error,onRetry:preferences.retry},
   languageSave:{status:preferences.languageStatus,error:preferences.languageError,onRetry:preferences.retry},
   onSaveNickname:preferences.saveNickname,onClearNickname:()=>preferences.saveNickname('')},
  memoryTransfer:user.role==='admin'?memoryTransfer:undefined,
  retainCalendar:inSettings&&lastNonSettings.current==='calendar',retainNotes:visitedNotes.current,
  settingsNavigation:{page:settingsPage,open:openSettingsPage,back:navigation.back,showReasoning:preferences.show_model_reasoning,showPrivacy:state.capabilities?.google_data_privacy===true,toggleReasoning:preferences.setShowModelReasoning},
  account,activeSection:section,isSidebarCollapsed:layout.collapsed,mobileMenuOpen:layout.mobile,
  theme:preferences.theme,appearance:layout.appearance,plan:'free',planModalOpen:false,
  language:preferences.language,onChangeLanguage:preferences.setLanguage,
  conversations:conversationListPresentation(state.conversations,user.timezone),activeConversationId:state.activeConversationId,activeConversation:conversation,
  memories,nodes:graph.nodes,edges:graph.edges,events:calendar.state.events,reminders:[],notesAvailable:notes.available,notes:notes.notes,notesRuntime:{...notes.presentation,onSelect:openDetail},connections:[],
  reminderModalOpen:false,editingReminder:null,reminderPreselectedEventId:undefined,
  isContextPanelOpen:contextOpen,selectedMemoryViewId:selectedMemory,selectedGraphNodeId:selectedNode,selectedCalendarEventId:null,
  focusedMemory:memories.find(m=>m.id===focusedMemoryId)??null,
  relatedMemoriesForActiveChat:[],upcomingRelatedEvent:null,settingsTab,addedActionIds:[],googleCalendarConnected:google?.status==='connected',
  calendar:{upcoming:{events:calendar.state.upcomingEvents,loading:calendar.state.upcomingLoading,error:calendar.state.upcomingError,onStartChange:calendar.controller.setUpcomingStart,onRetry:()=>void calendar.controller.loadUpcoming()},loading:calendar.state.loading,busy:calendar.state.busy,mutationPending:calendar.state.mutationPending,error:calendar.state.error,timezone:confirmedUser.timezone,
   onRetry:calendar.controller.retry,onRangeChange:calendar.controller.setRange,onYearChange:calendar.controller.setYear,onLoadEventForEdit:calendar.controller.loadForEdit},
  googleCalendarAvailable:calendar.state.googleAvailable,googleCalendarBusy:calendar.state.googleBusy,
  googleCalendarError:calendar.state.googleError,
  googleCalendarNotice:[calendar.state.oauthNotice,googleView.notice].filter(Boolean).join(' · '),
  googleCalendarOAuthNotice:calendar.state.oauthNotice??undefined,
  googleConnections:calendar.state.connections,selectedGoogleConnectionId:calendar.state.selectedConnectionId,
  onSelectGoogleConnection:calendar.controller.selectConnection,onRefreshGoogleCalendar:()=>void calendar.controller.loadConnections(),
  onConnectAnotherGoogleCalendar:()=>void calendar.controller.connect(true),
  gcalSyncState:googleView.state,autoSync:google?.sync_enabled??false,
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
  onWorkspaceOpenMobile:layout.openMobile,onSidebarCloseMobile:layout.closeMobile,onSidebarOpenSettingsTab:openSettings,
  onChatWorkspaceExpandSidebar:layout.expand,
  onChatWorkspaceToggleContextPanel:()=>setContextOpen(v=>!v),onChatWorkspaceTogglePlan:unavailable,
  onChatWorkspaceOpenPlanModal:()=>openSettings('plan'),onChatWorkspaceToggleTheme:layout.toggleTheme,onChatWorkspaceOpenSettingsTab:openSettings,
  onMemoryContextPanelClose:()=>setContextOpen(false),onMemoryContextPanelSelectMemory:focusMemory,
  onMemoryContextPanelOpenInMemoryView:openMemory,onMemoryContextPanelOpenInMemoryMap:openMap,onMemoryContextPanelOpenInCalendar:unavailable,
  onCalendarViewAddEvent:calendar.controller.create,onCalendarViewEditEvent:calendar.controller.edit,onCalendarViewDeleteEvent:calendar.controller.remove,onCalendarViewOpenMemory:openMemory,onCalendarViewOpenConnections:()=>openSettingsPage('google'),
  onCalendarViewAddReminder:unavailable,onCalendarViewNavigateToReminders:()=>select('reminders'),
  onCalendarViewExpandSidebar:layout.expand,
  onRemindersViewUpdateReminder:unavailable,onRemindersViewOpenCalendarEvent:unavailable,
  onRemindersViewOpenNewReminderModal:unavailable,onRemindersViewOpenEditReminderModal:unavailable,
  onRemindersViewExpandSidebar:layout.expand,
  onMemoryViewSelectMemory:id=>{setSelectedMemory(id);setFocusedMemoryId(id);},onMemoryViewUpdateMemory:unavailable,onMemoryViewForgetMemory:unavailable,onMemoryViewAddMemory:unavailable,
  onMemoryViewExploreInMap:openMap,onMemoryViewAskMroyaAbout:m=>ask(tr('askAboutMemory',{ns:'chat',title:m.title})),
  onMemoryViewExpandSidebar:layout.expand,
  onMemoryMapViewSelectNode:setSelectedNode,onMemoryMapViewOpenMemory:openMemory,onMemoryMapViewAskAboutNode:n=>ask(tr('askAboutMemory',{ns:'chat',title:n.label})),
  onMemoryMapViewExpandSidebar:layout.expand,onRefreshMap:()=>void controller.refreshMemory(),
  onConnectionsSettingsViewToggleConnection:unavailable,onConnectionsSettingsViewSelectPlan:unavailable,
  onConnectionsSettingsViewSelectTheme:preferences.setTheme,onConnectionsSettingsViewChangeTab:openSettings,
  onConnectionsSettingsViewExpandSidebar:layout.expand,
  onClosePlanPreview:unavailable,onPreviewFreePlan:unavailable,onPreviewPremiumPlan:unavailable,onReminderEditorModalClose:unavailable,
 };
 return <WorkspaceView model={model}/>;
}
