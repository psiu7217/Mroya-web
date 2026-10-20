// Stable shared UI contract. Only coordinated, reviewed changes should alter this interface.
import type React from 'react';
import { NavSection, SubscriptionPlan, ThemeMode, ConversationListItem, Conversation, MemoryItem, CalendarEvent, GraphNode, ChatAction, ReminderItem } from './mroya';
export interface AccountPresentation { displayName:string; initials:string; email:string; description:string; timezone:string; spaceDescription:string; nickname?:string }
export interface TelegramPresentation {
    status:import('./api').TelegramConnectionStatus|null;
    phase:'loading'|'idle'|'creating'|'pending'|'disconnecting'|'expired';
    openFallback:boolean; checking:boolean; error:string|null; link:import('./api').TelegramLinkResponse|null;
    onConnect:()=>void; onDisconnect:()=>void; onCheck:()=>void; onRetry:()=>void;
}
export interface DiagnosticActionState {available:boolean;reporting:boolean;reported:boolean;copying:boolean;copied:boolean}
export interface ChatDiagnostics {
    forMessage:(message:import('./mroya').ChatMessage)=>DiagnosticActionState;
    onReport:(message:import('./mroya').ChatMessage)=>void;
    onCopy:(message:import('./mroya').ChatMessage)=>void;
}
export interface CalendarPresentation {
    loading:boolean;busy:boolean;mutationPending:boolean;error:string|null;timezone:string;
    onRetry:()=>boolean|Promise<boolean>;onRangeChange:(start:string,end:string)=>void;
    onLoadEventForEdit:(event:CalendarEvent)=>Promise<CalendarEvent|null>;
}
export interface TimezonePresentation {
    timezone:string;draft:string;status:'idle'|'saving'|'saved'|'error';error:string|null;apiReady:boolean;
    onChange:(value:string)=>void;onRetry:()=>void;
}
export interface NotificationPresentation {
    available:boolean; loading:boolean; saving:boolean; testing:boolean;
    enabled:boolean; connected:boolean; configured:boolean; deliveryReady:boolean;
    canEnable:boolean; canSendTest:boolean; simulated:boolean;
    error:string|null; lastTestStatus:import('./api').NotificationDeliveryStatus|null;
    lastTest:import('./api').NotificationDto|null;
    onToggleTelegram:(enabled:boolean)=>Promise<void>;
    onSendTest:()=>Promise<void>; onRefresh:()=>Promise<void>; onRetry:()=>Promise<void>;
}
export interface WorkspaceRuntime {
    notifications?:NotificationPresentation;
    memoryInboxAvailable?:boolean;
    timezoneSettings?:TimezonePresentation;
    diagnostics?:ChatDiagnostics;
    telegram?:TelegramPresentation;
    conversationLocked?:boolean;
    pending:boolean; loading:boolean; busy:boolean; error:string|null; onRetry:()=>void;
    chatAvailable:boolean; memoryAvailable:boolean;
    calendarAvailable:boolean; remindersAvailable:false;
    memoriesTotal:number; hasOlder:boolean; onOlder:()=>void; hasMoreMemories:boolean; onMoreMemories:()=>void;
    truncated:boolean; notice:string|null; onCloseNotice:()=>void; onUnavailable:()=>void; onLogout:()=>void;
    preferenceSave: {status:'saved'|'saving'|'unsaved';error:string|null;onRetry:()=>void};
    showModelReasoning?:boolean; onToggleShowModelReasoning?:(enabled:boolean)=>void;
    onSaveNickname:(value:string)=>void; onClearNickname:()=>void;
}
export interface ConnectionSamples {
    googleCalendarId:string;
    telegramId:string;
    calendars:{id:string;name:string;desc:string;available:boolean;read_only:boolean;exportable:boolean}[];
    scenarios:{id:import('./mroya').GoogleSyncState;label:string}[];
}
export interface WorkspaceModel {
    notifications?:NotificationPresentation;
    memoryInbox?:import('./memoryInbox').MemoryInboxPresentation;
    connectionSamples?:ConnectionSamples;
    onChangeTimezone?:(value:string)=>void;
    onSaveNickname?:(value:string)=>void;
    onClearNickname?:()=>void;
    diagnostics?:ChatDiagnostics;
    runtime?:WorkspaceRuntime;
    feedback?:Pick<WorkspaceRuntime,'loading'|'busy'|'error'|'onRetry'>;
    account: AccountPresentation;
    calendarSamples?: {person:string;titlePlaceholder:string;personPlaceholder:string;accountLabel:string};
    composerSamples?: {memoryPrompt:string;attachmentName:string;voicePhrases:string[]};
    activeSection: NavSection;
    isSidebarCollapsed: boolean;
    mobileMenuOpen: boolean;
    theme: ThemeMode;
    appearance?: 'light'|'dark';
    plan: SubscriptionPlan;
    planModalOpen: boolean;
    conversations: ConversationListItem[];
    activeConversationId: string | null;
    memories: MemoryItem[];
    events: CalendarEvent[];
    nodes: GraphNode[];
    connections: import("./mroya").ServiceConnection[];
    reminders: ReminderItem[];
    reminderModalOpen: boolean;
    editingReminder: ReminderItem | null;
    reminderPreselectedEventId: string | undefined;
    handleAddOrUpdateReminder: (reminderData: Omit<ReminderItem, 'id' | 'createdAt'>, existingId?: string) => void;
    handleDeleteReminder: (id: string) => void;
    handleToggleCompleteReminder: (id: string) => void;
    handleTogglePauseReminder: (id: string) => void;
    handleUnlinkReminder: (id: string) => void;
    handleSimulateGoogleSync: (reminderId: string) => void;
    isContextPanelOpen: boolean;
    selectedMemoryViewId: string | null;
    selectedGraphNodeId: string | null;
    selectedCalendarEventId: string | null;
    settingsTab: "appearance" | "connections" | "plan" | "profile" | "settings";
    addedActionIds: string[];
    activeConversation: Conversation | null;
    focusedMemory: MemoryItem | null;
    relatedMemoriesForActiveChat: MemoryItem[];
    upcomingRelatedEvent: CalendarEvent | null;
    handleNewChat: () => void;
    handleSendMessage: (content: string, attachmentName?: string) => void | boolean | Promise<boolean>;
    handleCitationClick: (memoryId: string) => void;
    handleChatActionClick: (action: ChatAction) => void;
    calendar?:CalendarPresentation;
    googleCalendarAvailable?:boolean;
    googleCalendarBusy?:boolean;
    googleCalendarNotice?:string;
    googleCalendarError?:string|null;
    googleConnections?:import('./calendarApi').GoogleConnectionDto[];
    selectedGoogleConnectionId?:string|null;
    onSelectGoogleConnection?:(id:string)=>void;
    onRefreshGoogleCalendar?:()=>void;
    onConnectAnotherGoogleCalendar?:()=>void;
    googleCalendarConnected: boolean;
    gcalSyncState?: import("./mroya").GoogleSyncState;
    autoSync?: boolean;
    lastSyncedTime?: string;
    syncSummary?: {
      imported: number;
      exported: number;
      lastSynced: string;
    } | null;
    googleCalendarEmail?: string;
    importedCalendars?: string[];
    exportCalendar?: string;
    onChangeImportedCalendars?: (ids:string[]) => void;
    onChangeExportCalendar?: (id:string) => void;
    onConnectGoogleCalendar?: () => void;
    onDisconnectGoogleCalendar?: () => void;
    onSyncNowGoogleCalendar?: () => void;
    onToggleAutoSyncGoogleCalendar?: () => void;
    onSetGcalSyncState?: (state: import("./mroya").GoogleSyncState) => void;
    edges: import("./mroya").GraphEdge[];
    onSidebarSelectSection: (section: NavSection) => void;
    onSidebarSelectConversation: (id: string) => void;
    onSidebarRenameConversation?: (id: string, newTitle: string) => void | boolean | Promise<boolean>;
    onSidebarDeleteConversation?: (id: string) => void | boolean | Promise<boolean>;
    onSidebarTogglePlan: () => void;
    onSidebarOpenPlanModal: () => void;
    onSidebarToggleTheme: () => void;
    onSidebarToggleCollapse: () => void;
    onSidebarCloseMobile: () => void;
    onSidebarOpenSettingsTab: (tab: 'profile' | 'plan' | 'connections' | 'appearance' | 'settings') => void;
    onChatWorkspaceExpandSidebar: () => void;
    onChatWorkspaceOpenMobileMenu: () => void;
    onChatWorkspaceToggleContextPanel: () => void;
    onChatWorkspaceTogglePlan: () => void;
    onChatWorkspaceOpenPlanModal: () => void;
    onChatWorkspaceToggleTheme: () => void;
    onChatWorkspaceOpenSettingsTab: (tab: 'profile' | 'plan' | 'connections' | 'appearance' | 'settings') => void;
    onMemoryContextPanelClose: () => void;
    onMemoryContextPanelSelectMemory: (memoryId: string) => void;
    onMemoryContextPanelOpenInMemoryView: (memoryId: string) => void;
    onMemoryContextPanelOpenInMemoryMap: (nodeId: string) => void;
    onMemoryContextPanelOpenInCalendar: (eventId: string) => void;
    onCalendarViewAddEvent: (event: Omit<CalendarEvent, 'id'>, initialReminderOffset?: number) => void|boolean|Promise<boolean>;
    onCalendarViewEditEvent?: (event: CalendarEvent) => void|boolean|Promise<boolean>;
    onCalendarViewDeleteEvent?: (id: string, version?:number) => void|boolean|Promise<boolean>;
    onCalendarViewOpenMemory: (memoryId: string) => void;
    onCalendarViewOpenConnections: () => void;
    onCalendarViewAddReminder: (reminder: Omit<ReminderItem, 'id' | 'createdAt'>) => void;
    onCalendarViewNavigateToReminders: () => void;
    onCalendarViewExpandSidebar: () => void;
    onCalendarViewOpenMobileMenu: () => void;
    onRemindersViewUpdateReminder: (reminder: ReminderItem) => void;
    onRemindersViewOpenCalendarEvent: (eventId: string) => void;
    onRemindersViewOpenNewReminderModal: () => void;
    onRemindersViewOpenEditReminderModal: (reminder: ReminderItem) => void;
    onRemindersViewExpandSidebar: () => void;
    onRemindersViewOpenMobileMenu: () => void;
    onMemoryViewSelectMemory: (id: string) => void;
    onMemoryViewUpdateMemory: (updated: MemoryItem) => void;
    onMemoryViewForgetMemory: (id: string) => void;
    onMemoryViewAddMemory: (item: Omit<MemoryItem, 'id'>) => void;
    onMemoryViewExploreInMap: (nodeId: string) => void;
    onMemoryViewAskMroyaAbout: (memory: MemoryItem) => void;
    onMemoryViewExpandSidebar: () => void;
    onMemoryViewOpenMobileMenu: () => void;
    onMemoryMapViewSelectNode: (nodeId: string | null) => void;
    onMemoryMapViewOpenMemory: (memoryId: string) => void;
    onMemoryMapViewAskAboutNode: (node: GraphNode) => void;
    onMemoryMapViewExpandSidebar: () => void;
    onMemoryMapViewOpenMobileMenu: () => void;
    onConnectionsSettingsViewToggleConnection: (id: string) => void;
    onConnectionsSettingsViewSelectPlan: (plan: SubscriptionPlan) => void;
    onConnectionsSettingsViewSelectTheme: (theme: ThemeMode) => void;
    onConnectionsSettingsViewChangeTab: (tab: 'connections' | 'profile' | 'plan' | 'appearance' | 'settings') => void;
    onConnectionsSettingsViewExpandSidebar: () => void;
    onConnectionsSettingsViewOpenMobileMenu: () => void;
    onClosePlanPreview: React.MouseEventHandler<HTMLButtonElement>;
    onPreviewFreePlan: React.MouseEventHandler<HTMLButtonElement>;
    onPreviewPremiumPlan: React.MouseEventHandler<HTMLButtonElement>;
    onReminderEditorModalClose: () => void;
}
