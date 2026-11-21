import {WorkspaceMenuButton} from './WorkspaceMenuButton';
import {PrivacyControls} from './PrivacyControls';
import {MemoryReviewPanel} from './MemoryReviewPanel';
import {CalendarAnalysisPanel} from './CalendarAnalysisPanel';
import {MemoryTransferSettings} from './MemoryTransferSettings';
import type {MemoryTransferPresentation} from '../types/memoryTransfer';
import {timezoneChoices} from '../utils/timezones';
import type { AccountPresentation, NotificationPresentation, NotificationPreview, TelegramPresentation, TimezonePresentation, SettingsPage, SettingsNavigation, WorkspaceModel } from '../types/workspace';
import type {AppLanguage} from '../types/api';
import {tr} from '../i18n';
import {currentLocale} from '../i18n/format';
import React from 'react';
import {
  Link2,
  Sun,
  Moon,
  Monitor,
  Menu,
  Sparkles,
  Check,
  User,
  Shield,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  CreditCard,
  Languages,
  Archive,
  Send,
  Brain,
  Calendar as CalendarIcon,
  RefreshCw,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Bell,
  Clock,
} from 'lucide-react';
import { BrandMark } from './BrandMark';
import { ModelReasoningBlock } from './ModelReasoningBlock';
import {
  ServiceConnection,
  SubscriptionPlan,
  ThemeMode,
} from '../types/mroya';

const COMMON_TIMEZONE_IDS = ['UTC','Europe/London','Europe/Berlin','Europe/Warsaw','Europe/Stockholm','Europe/Kyiv','Europe/Vilnius','Europe/Minsk','Europe/Moscow','Europe/Istanbul','Asia/Tbilisi','Asia/Dubai','Asia/Almaty','Asia/Tashkent','Asia/Singapore','Asia/Hong_Kong','Asia/Tokyo','Australia/Sydney','America/New_York','America/Chicago','America/Denver','America/Los_Angeles','America/Sao_Paulo'];

// Public service catalogue only: no fictional account IDs, connection state or user data.
const plannedConnections = (): ServiceConnection[] => [
  {id:'google-calendar',name:'Google Calendar',category:tr('calendarCategory',{ns:'connections'}),description:tr('calendarUnavailable',{ns:'connections'}),connected:false,capabilities:[]},
  {id:'telegram',name:'Telegram',category:tr('personalChatCategory',{ns:'connections'}),description:tr('telegramDescription',{ns:'connections'}),connected:false,capabilities:[tr('telegramCapabilityChat',{ns:'connections'}),tr('telegramCapabilityHistory',{ns:'connections'}),tr('telegramCapabilityMemory',{ns:'connections'}),tr('telegramCapabilityReplies',{ns:'connections'})]},
  {id:'gmail',name:tr('googleMailName',{ns:'connections'}),category:tr('emailCategory',{ns:'connections'}),description:tr('gmailUnavailable',{ns:'connections'}),connected:false,capabilities:[]},
];
const localizedConnectionName=(connection:ServiceConnection)=>connection.id==='gmail'?tr('googleMailName',{ns:'connections'}):connection.name;
const localizedConnectionCategory=(connection:ServiceConnection)=>connection.id==='google-calendar'?tr('calendarCategory',{ns:'connections'}):connection.id==='telegram'?tr('personalChatCategory',{ns:'connections'}):connection.id==='gmail'?tr('emailCategory',{ns:'connections'}):connection.category;
const localizedConnectionDescription=(connection:ServiceConnection)=>connection.id==='google-calendar'?tr('calendarUnavailable',{ns:'connections'}):connection.id==='telegram'?tr('telegramDescription',{ns:'connections'}):connection.id==='gmail'?tr('gmailUnavailable',{ns:'connections'}):connection.description;
const localizedConnectionCapability=(connection:ServiceConnection,capability:string)=>{
  if(connection.id!=='telegram')return capability;
  const index=connection.capabilities.indexOf(capability);
  return [tr('telegramCapabilityChat',{ns:'connections'}),tr('telegramCapabilityHistory',{ns:'connections'}),tr('telegramCapabilityMemory',{ns:'connections'}),tr('telegramCapabilityReplies',{ns:'connections'})][index]??capability;
};
const syncScenarioLabel=(id:string)=>{
  const keys:Record<string,string>={disconnected:'disconnected',connecting:'connecting',initial_syncing:'initialSync',connected_auto_off:'connectedSyncOff',connected_auto_on:'connectedSyncOn',syncing:'synchronizing',sync_error:'syncError',conflict:'conflictDetected',reconnect_required:'reconnectRequired'};
  return tr(keys[id]??id,{ns:'connections'});
};
const notificationScenarioLabel=(id:string)=>{
  const keys:Record<string,string>={disconnected:'disconnected',disabled:'notificationDisabled',enabled:'botReady',queued:'notificationQueued',delivered:'notificationDelivered',failed:'notificationFailed',unavailable:'notificationUnavailable',loading:'notificationLoading'};
  return tr(keys[id]??id,{ns:'connections'});
};
const settingsIcons = {
  home:Menu, profile:User, name:User, timezone:Clock, plan:CreditCard, appearance:Sun,
  language:Languages, chat:Brain, notifications:Bell, connections:Link2, telegram:Send,
  google:CalendarIcon, 'calendar-selection':CalendarIcon, 'memory-transfer':Archive, privacy:Shield,
};
const settingsLabels:Record<SettingsPage,string> = {
  home:'tabsSettings', profile:'tabsProfile', name:'nickname', timezone:'timezone', plan:'tabsPlan',
  appearance:'tabsAppearance', language:'language', chat:'chatSettings', notifications:'notifications',
  connections:'tabsConnections', telegram:'settingsTelegram', google:'settingsGoogle',
  'calendar-selection':'configureCalendars', 'memory-transfer':'memoryTransferTitle', privacy:'privacySettings',
};
const settingsLabel = (page:SettingsPage)=>tr(settingsLabels[page],{ns:'connections'});
function SettingsRows({pages,onOpen}:{pages:SettingsPage[];onOpen:(page:SettingsPage)=>void}) {
  return <ul className="divide-y divide-[var(--mroya-divider)] rounded-xl border border-[var(--mroya-divider)] bg-[var(--mroya-surface)]">
    {pages.map(page=>{
      const Icon=settingsIcons[page];
      return <li key={page}>
        <button type="button" onClick={()=>onOpen(page)} className="flex min-h-12 w-full items-center gap-3 rounded-lg px-3.5 py-3 text-left text-sm font-medium hover:bg-[var(--mroya-surface-muted)]">
          <Icon aria-hidden="true" className="size-5 shrink-0 text-[var(--mroya-primary)]"/>
          <span className="min-w-0 flex-1">{settingsLabel(page)}</span>
          <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-[var(--mroya-text-muted)]"/>
        </button>
      </li>;
    })}
  </ul>;
}

export interface ConnectionsSettingsViewProps extends Pick<WorkspaceModel,
  'connectionSamples'|'googleCalendarAvailable'|'googleCalendarBusy'|'googleCalendarOAuthNotice'|'googleCalendarError'|'googleConnections'|'selectedGoogleConnectionId'|'onSelectGoogleConnection'|'onRefreshGoogleCalendar'|'onConnectAnotherGoogleCalendar'|
  'gcalSyncState'|'autoSync'|'googleCalendarEmail'|'importedCalendars'|'exportCalendar'|
  'onConnectGoogleCalendar'|'onDisconnectGoogleCalendar'|'onSyncNowGoogleCalendar'|'onToggleAutoSyncGoogleCalendar'|'onSetGcalSyncState'|'onChangeImportedCalendars'|'onChangeExportCalendar'> {
  settingsNavigation?:SettingsNavigation;
  onLogout?:()=>void;
  privacy?:import('../types/privacy').PrivacyPresentation;
  memoryReview?:import('../types/memoryReview').ReviewPresentation;
  calendarAnalysis?:import('../types/calendarAnalysis').CalendarAnalysisPresentation;
  memoryTransfer?:MemoryTransferPresentation;
  notifications?:NotificationPresentation;
  notificationPreview?:NotificationPreview;
  live?: boolean;
  showGoogleCalendar?: boolean;
  timezoneSettings?:TimezonePresentation;
  telegram?: TelegramPresentation;
  preferenceSave?: {status:'saved'|'saving'|'unsaved';error:string|null;onRetry:()=>void};
  languageSave?: {status:'saved'|'saving'|'unsaved';error:string|null;onRetry:()=>void};
  language?:AppLanguage;
  onChangeLanguage?:(language:AppLanguage)=>void;
  account: AccountPresentation;
  connections: ServiceConnection[];
  onToggleConnection: (id: string) => void;
  plan: SubscriptionPlan;
  onSelectPlan: (plan: SubscriptionPlan) => void;
  theme: ThemeMode;
  onSelectTheme: (theme: ThemeMode) => void;
  activeTab: 'connections' | 'profile' | 'plan' | 'appearance' | 'settings';
  onChangeTab: (tab: 'connections' | 'profile' | 'plan' | 'appearance' | 'settings') => void;
  isSidebarCollapsed: boolean;
  onExpandSidebar: () => void;
  onSaveNickname?: (nickname: string) => void;
  onClearNickname?: () => void;
  onChangeTimezone?: (timezone: string) => void;
  showModelReasoning?: boolean;
  onToggleShowModelReasoning?: (enabled: boolean) => void;
}

export const ConnectionsSettingsView: React.FC<ConnectionsSettingsViewProps> = ({
  memoryTransfer,settingsNavigation,onLogout,
  calendarAnalysis,memoryReview,privacy,live=false,showGoogleCalendar=true,connectionSamples,timezoneSettings,notifications,notificationPreview,
  googleCalendarAvailable=false,googleCalendarBusy=false,googleCalendarOAuthNotice,googleCalendarError,googleConnections=[],selectedGoogleConnectionId,
  onSelectGoogleConnection,onRefreshGoogleCalendar,onConnectAnotherGoogleCalendar,
  gcalSyncState='disconnected',autoSync=false,googleCalendarEmail='',
  importedCalendars=[],exportCalendar='',onChangeImportedCalendars,onChangeExportCalendar,
  onConnectGoogleCalendar:handleConnectGcal,onDisconnectGoogleCalendar:handleDisconnectGcal,
  onSyncNowGoogleCalendar:handleSyncNow,onToggleAutoSyncGoogleCalendar:handleToggleAutoSync,onSetGcalSyncState,
  telegram,
  preferenceSave,
  languageSave,language='en',onChangeLanguage,
  account,
  connections,
  onToggleConnection,
  plan,
  onSelectPlan,
  theme,
  onSelectTheme,
  activeTab,
  onChangeTab,
  isSidebarCollapsed,
  onExpandSidebar,
  onSaveNickname,
  onClearNickname,
  onChangeTimezone,
  showModelReasoning: controlledShowModelReasoning,
  onToggleShowModelReasoning,
}) => {
  const [localShowModelReasoning, setLocalShowModelReasoning] = React.useState(false);
  const showModelReasoning = controlledShowModelReasoning ?? localShowModelReasoning;
  const handleToggleShowModelReasoning = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = e.target.checked;
    setLocalShowModelReasoning(nextVal);
    onToggleShowModelReasoning?.(nextVal);
  };
  const [nicknameDraft, setNicknameDraft] = React.useState(account.nickname || '');
  const [selectedTimezone, setSelectedTimezone] = React.useState(account.timezone || 'UTC');
  const [customTimezone,setCustomTimezone]=React.useState('');
  const [customTimezoneOpen,setCustomTimezoneOpen]=React.useState(false);
  const timezoneValue=live?(timezoneSettings?.draft??account.timezone??''):selectedTimezone;
  const [saveStatus, setSaveStatus] = React.useState<'saved'|'cleared'|'nicknameTooLong'|null>(null);
  const [nicknameSubmitted, setNicknameSubmitted] = React.useState(false);
  const nicknameEdited = React.useRef(false);
  const nicknameStatus = live
    ? nicknameSubmitted && preferenceSave
      ? preferenceSave.status==='saving' ? tr('saving',{ns:'common'}) : preferenceSave.status==='unsaved' ? preferenceSave.error==='Nickname must be at most 80 characters.'?tr('nicknameTooLong',{ns:'connections'}):tr('notSaved',{ns:'connections'}) : tr('saved',{ns:'connections'})
      : null
      : saveStatus?tr(saveStatus,{ns:'connections'}):null;

  React.useEffect(() => {
    if (!nicknameEdited.current) setNicknameDraft(account.nickname || '');
  }, [account.nickname]);

  React.useEffect(() => {
    setSelectedTimezone(account.timezone || 'UTC');
  }, [account.timezone]);

  const availableTimezones = React.useMemo(()=>timezoneChoices(account.timezone,timezoneValue,COMMON_TIMEZONE_IDS.map(value=>({value,label:value}))).map(({value})=>{
    try{const name=new Intl.DateTimeFormat(currentLocale(),{timeZone:value,timeZoneName:'longGeneric'}).formatToParts(new Date()).find(part=>part.type==='timeZoneName')?.value;return {value,label:name?`${value} (${name})`:value};}
    catch{return {value,label:value};}
  }),[account.timezone,timezoneValue,currentLocale()]);

  const handleSaveNickname = () => {
    const value = nicknameDraft.trim();
    if (Array.from(value).length > 80) {
      if (live) { setNicknameSubmitted(true); onSaveNickname?.(value); }
      else setSaveStatus('nicknameTooLong');
      return;
    }
    nicknameEdited.current = false;
    setNicknameDraft(value);
    if (live) { setNicknameSubmitted(true); onSaveNickname?.(value); return; }
    onSaveNickname?.(value);
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus(null), 2000);
  };

  const handleClearNickname = () => {
    nicknameEdited.current = false;
    setNicknameDraft('');
    if (live) { setNicknameSubmitted(true); onClearNickname?.(); return; }
    onClearNickname?.();
    setSaveStatus('cleared');
    setTimeout(() => setSaveStatus(null), 2000);
  };

  const handleTimezoneChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextTz = e.target.value;
    if(nextTz==='__custom__'){setCustomTimezoneOpen(true);return;}
    setCustomTimezoneOpen(false);setSelectedTimezone(nextTz);
    (onChangeTimezone??timezoneSettings?.onChange)?.(nextTz);
  };

  const notificationBusy=!!notifications&&(notifications.loading||notifications.saving||notifications.testing);
  const notificationState=notifications?.loading?'loading':notifications?.saving?'saving':notifications?.testing?'sending'
    :!notifications?.available?'unavailable'
    :notifications.lastTest&&notifications.lastTestStatus?notifications.lastTestStatus
    :!notifications.enabled?'disabled':!notifications.connected?'disconnected':!notifications.configured?'unavailable':notifications.deliveryReady?'ready':'notReady';
  const notificationStatus=notificationState==='saving'?tr('saving',{ns:'common'}):tr(({loading:'notificationLoading',sending:'notificationSending',unavailable:'notificationUnavailable',pending:'notificationQueued',processing:'notificationProcessing',retry:'notificationRetrying',sent:'notificationDelivered',failed:'notificationFailed',cancelled:'notificationCancelled',expired:'notificationExpired',disabled:'notificationDisabled',disconnected:'disconnected',ready:'botReady',notReady:'notificationNotReady'} as Record<string,string>)[notificationState]??'notificationUnavailable',{ns:'connections'});
  const notificationError=notifications?.error?tr('requestFailed',{ns:'common'}):notifications?.lastTestStatus==='failed'?tr('deliveryFailed',{ns:'connections'}):null;
  const page=settingsNavigation?.page;
  const service=page==='google'||page==='calendar-selection'?'google-calendar':page==='telegram'||page==='notifications'?'telegram':null;
  const visibleConnections = live ? plannedConnections().filter(c=>c.id==='telegram'||(c.id==='google-calendar'&&showGoogleCalendar&&googleCalendarAvailable)).filter(c=>!page||c.id===service) : connections;
  const tabs: {
    id: 'connections' | 'profile' | 'plan' | 'appearance' | 'settings';
    label: string;
  }[] = [
    { id: 'connections', label: tr('tabsConnections',{ns:'connections'}) },
    { id: 'plan', label: tr('tabsPlan',{ns:'connections'}) },
    { id: 'appearance', label: tr('tabsAppearance',{ns:'connections'}) },
    { id: 'profile', label: tr('tabsProfile',{ns:'connections'}) },
    { id: 'settings', label: tr('assistantPreferences',{ns:'connections'}) },
  ];

  return (
    <div className="flex-1 flex flex-col h-full min-w-0 bg-[var(--mroya-bg)] text-[var(--mroya-text)]">
      {/* Header */}
      <header className="h-[58px] px-4 sm:px-6 border-b border-[var(--mroya-divider)] flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <WorkspaceMenuButton/>
          {settingsNavigation && <button type="button" aria-label={tr('back',{ns:'connections'})} onClick={settingsNavigation.back} className="grid size-9 shrink-0 place-items-center rounded-lg hover:bg-[var(--mroya-surface-muted)]"><ArrowLeft aria-hidden="true" className="size-5"/></button>}
          <h1 className="text-[16px] font-semibold text-[var(--mroya-text)] truncate">
            {page?settingsLabel(page):tr('header',{ns:'connections'})}
          </h1>
        </div>
      </header>

      {/* Sub-navigation bar */}
      {!settingsNavigation && <div className="px-4 sm:px-6 py-2.5 border-b border-[var(--mroya-divider)] flex flex-wrap lg:flex-nowrap items-center gap-1.5 lg:overflow-x-auto">
        {tabs.filter(t=>!live||!['plan','settings'].includes(t.id)).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onChangeTab(t.id)}
            className={`px-3.5 py-1.5 rounded-[8px] text-[13px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === t.id
                ? 'bg-[var(--mroya-surface-active)] text-[var(--mroya-text)] font-semibold'
                : 'text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      }
      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-[820px] mx-auto space-y-6">
          {preferenceSave && <div className="text-[13px] text-[var(--mroya-text-muted)]" aria-live="polite">
            {preferenceSave.status==='saving' && <p role="status">{tr('savingAccount',{ns:'connections'})}</p>}
            {preferenceSave.status==='unsaved' && <><p role="alert">{tr('changesNotSaved',{ns:'connections'})}</p><button type="button" onClick={preferenceSave.onRetry} className="underline mt-2">{tr('retrySaving',{ns:'connections'})}</button></>}
          </div>}
          {settingsNavigation && page==='home' && <>
            <SettingsRows pages={['profile','plan','appearance','language','chat']} onOpen={settingsNavigation.open}/>
            <SettingsRows pages={['notifications','connections',...(memoryTransfer?['memory-transfer' as const]:[]),...(settingsNavigation.showPrivacy?['privacy' as const]:[])]} onOpen={settingsNavigation.open}/>
          </>}
          {settingsNavigation && page==='connections' && (
            <SettingsRows pages={showGoogleCalendar?['telegram','google']:['telegram']} onOpen={settingsNavigation.open}/>
          )}
          {settingsNavigation && page==='memory-transfer' && memoryTransfer && <MemoryTransferSettings transfer={memoryTransfer}/>}
          {page==='plan' && <div className="rounded-xl border border-[var(--mroya-divider)] bg-[var(--mroya-surface)] p-4">
            <p className="font-medium">{tr(plan==='premium'?'premium':'free',{ns:'sidebar'})}</p>
            <p className="mt-1 text-sm text-[var(--mroya-text-muted)]">{tr('subscriptionUnavailable',{ns:'connections'})}</p>
          </div>}
          {(page==='privacy'||!page&&activeTab==='connections')&&live&&privacy&&<PrivacyControls privacy={privacy}/>}
          {page==='google'&&!googleCalendarAvailable&&<p className="text-sm text-[var(--mroya-text-muted)]">{tr('calendarUnavailable',{ns:'connections'})}</p>}
          {(!page&&activeTab==='connections'||service!==null) && (
            <div className="space-y-4">
              {!page&&<div>
                <h2 className="text-[18px] font-semibold text-[var(--mroya-text)]">
                  {tr('externalServices',{ns:'connections'})}
                </h2>
                <p className="text-[13px] text-[var(--mroya-text-muted)] mt-0.5">
                  {tr('externalServicesHelp',{ns:'connections'})}
                </p>
              </div>}

              <div className="grid grid-cols-1 gap-4">
                {visibleConnections.map((conn) => {
                  // Explicit catalogue mapping: Studio and live IDs are deliberately different.
                  const isTelegram=conn.id===(live?'telegram':connectionSamples?.telegramId);
                  const isGoogleCalendar = (!live||googleCalendarAvailable) && conn.id===(live?'google-calendar':connectionSamples?.googleCalendarId);
                  const category=localizedConnectionCategory(conn);
                  const description=localizedConnectionDescription(conn);

                  // Shared Google Calendar card: demo props or confirmed backend data.
                  if (isGoogleCalendar) {
                    const selectedConnection = googleConnections.find(account => account.id === selectedGoogleConnectionId);
                    const needsReconnect = gcalSyncState === 'reconnect_required';
                    const isConnecting = gcalSyncState === 'connecting';
                    const isSyncing = gcalSyncState === 'initial_syncing' || gcalSyncState === 'syncing';
                    const isConnected = live
                      ? selectedConnection?.status === 'connected'
                      : !['disconnected', 'connecting', 'reconnect_required'].includes(gcalSyncState);
                    const idle = ['connected_auto_off', 'connected_auto_on'].includes(gcalSyncState);
                    const syncHasError = gcalSyncState === 'sync_error';
                    const canSync = isConnected && !googleCalendarBusy && (idle || syncHasError);
                    const canConfigure = isConnected && !googleCalendarBusy && (idle || (live && syncHasError));
                    let extraStatus: string | null = null;
                    if (isSyncing) extraStatus = 'googleSyncPending';
                    if (gcalSyncState === 'conflict') extraStatus = 'googleSyncActionRequired';
                    if (syncHasError) {
                      const status = selectedConnection?.sync_status;
                      extraStatus = status === 'partial' ? 'googleSyncPartial'
                        : status === 'needs_destination' ? 'googleSyncChooseExport'
                        : 'googleSyncActionRequired';
                    }
                    const calendars=live?(selectedConnection?.calendars??[]):(connectionSamples?.calendars??[]);

                    return (
                      <section
                        key={conn.id}
                        aria-label={conn.name}
                        className="p-5 space-y-4 rounded-[12px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)]"
                      >
                        {/* Design Mode State Switcher Toolbar */}
                        {!live&&connectionSamples&&<div className="p-3 rounded-[10px] bg-[var(--mroya-surface-muted)]/70 border border-[var(--mroya-divider)] space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold tracking-wider uppercase text-[var(--mroya-text-muted)] flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-[var(--mroya-brand-honey)]" />
                              <span>{tr('designSyncSwitcher',{ns:'connections'})}</span>
                            </span>
                            <span className="text-[11px] text-[var(--mroya-text-muted)]">
                              {tr('clickPreview',{ns:'connections'})}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {connectionSamples.scenarios.map((st) => (
                              <button
                                key={st.id}
                                type="button"
                                onClick={() => onSetGcalSyncState?.(st.id)}
                                className={`px-2.5 py-1 rounded-[6px] text-[11px] font-medium transition-all cursor-pointer border ${
                                  gcalSyncState === st.id
                                    ? 'bg-[var(--mroya-primary)] text-white border-[var(--mroya-primary)] font-semibold shadow-2xs'
                                    : 'bg-[var(--mroya-surface)] text-[var(--mroya-text)] border-[var(--mroya-divider)] hover:bg-[var(--mroya-surface-muted)]'
                                }`}
                              >
                                {syncScenarioLabel(st.id)}
                              </button>
                            ))}
                          </div>
                        </div>}

                        {page!=='calendar-selection' && <>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex min-w-0 items-start gap-3">
                            <div className="w-10 h-10 rounded-[10px] bg-[var(--mroya-surface-muted)] border border-[var(--mroya-divider)] flex items-center justify-center shrink-0">
                              <CalendarIcon aria-hidden="true" className="w-5 h-5 text-[var(--mroya-primary)]" />
                            </div>
                            <div className="min-w-0 space-y-1">
                              <h3 className="text-[16px] font-bold text-[var(--mroya-text)]">{conn.name}</h3>
                              {(isConnected || needsReconnect) && googleConnections.length <= 1 && googleCalendarEmail && (
                                <p className="text-[12px] text-[var(--mroya-text-muted)] break-all">{googleCalendarEmail}</p>
                              )}
                              <div role="status" className="text-[12.5px] text-[var(--mroya-text-muted)]">
                                {isConnected && tr(autoSync ? 'connectedSyncOn' : 'connectedSyncOff', {ns:'connections'})}
                                {isConnecting && tr('connecting', {ns:'connections'})}
                                {needsReconnect && tr('reconnectRequired', {ns:'connections'})}
                                {extraStatus && (
                                  <p className={isSyncing ? '' : 'text-amber-700 dark:text-amber-300'}>
                                    {tr(extraStatus, {ns:'connections'})}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                          {!isConnected && !isConnecting && (
                            <button
                              type="button"
                              onClick={handleConnectGcal}
                              disabled={googleCalendarBusy}
                              className="px-4 py-2 rounded-[8px] bg-[var(--mroya-primary)] hover:bg-[var(--mroya-primary-hover)] text-[var(--mroya-on-primary)] text-[13px] font-semibold disabled:opacity-60"
                            >
                              {tr(googleCalendarBusy ? 'connecting' : needsReconnect ? 'googleReconnectAction' : 'googleConnectAction', {ns:'connections'})}
                            </button>
                          )}
                        </div>

                        {live && (googleConnections.length > 1 || isConnected) && (
                          <div className="flex flex-wrap items-center gap-2">
                            {googleConnections.length > 1 && (
                              <select
                                aria-label={tr('googleAccount', {ns:'connections'})}
                                value={selectedGoogleConnectionId ?? ''}
                                disabled={googleCalendarBusy}
                                onChange={e => onSelectGoogleConnection?.(e.target.value)}
                                className="min-w-0 max-w-full px-3 py-2 rounded-[8px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] text-[13px] text-[var(--mroya-text)]"
                              >
                                {googleConnections.map(account => (
                                  <option key={account.id} value={account.id}>{account.email || tr('googleAccountName', {ns:'connections'})}</option>
                                ))}
                              </select>
                            )}
                            {isConnected && (
                              <button type="button" disabled={googleCalendarBusy} onClick={onConnectAnotherGoogleCalendar} className="text-[12px] font-semibold text-[var(--mroya-primary)] hover:underline disabled:opacity-60">
                                {tr('connectGoogleAccount', {ns:'connections'})}
                              </button>
                            )}
                          </div>
                        )}

                        {googleCalendarOAuthNotice && <p role="status" className="text-[12px] text-[var(--mroya-text-muted)]">{googleCalendarOAuthNotice}</p>}
                        {googleCalendarError && (
                          <div className="flex flex-wrap items-center gap-2 text-[12px] text-[var(--mroya-text-muted)]">
                            <p role="alert">{tr('requestFailed', {ns:'common'})}</p>
                            <button type="button" disabled={googleCalendarBusy} onClick={onRefreshGoogleCalendar} className="underline">{tr('checkStatus', {ns:'connections'})}</button>
                          </div>
                        )}

                        </>}
                        {isConnected&&settingsNavigation&&page==='google'&&<SettingsRows pages={['calendar-selection']} onOpen={settingsNavigation.open}/>}
                        {isConnected && (
                          <div className="space-y-4">
                            {(!page||page==='calendar-selection') && <>
                            <fieldset className="min-w-0">
                              <legend className="mb-2 text-[12.5px] font-semibold text-[var(--mroya-text)]">
                                {tr('googleCalendarsToImport',{ns:'connections'})}
                              </legend>
                              <div className="space-y-1.5">
                                {calendars.map((cal) => (
                                  <label
                                    key={cal.id}
                                    className="flex items-center justify-between p-2.5 rounded-[8px] bg-[var(--mroya-surface)] hover:bg-[var(--mroya-surface-muted)] border border-[var(--mroya-divider)] cursor-pointer transition-colors"
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <input
                                        type="checkbox"
                                        checked={importedCalendars.includes(cal.id)}
                                        disabled={!canConfigure||!cal.available}
                                        onChange={() => onChangeImportedCalendars?.(importedCalendars.includes(cal.id) ? importedCalendars.filter(id=>id!==cal.id) : [...importedCalendars,cal.id])}
                                        className="w-4 h-4 rounded text-[var(--mroya-primary)] accent-[var(--mroya-primary)] cursor-pointer"
                                      />
                                      <div className="min-w-0">
                                        <div className="text-[13px] font-medium text-[var(--mroya-text)] truncate">
                                          {cal.name}
                                        </div>
                                        <div className="text-[11px] text-[var(--mroya-text-muted)] truncate">
                                          {live?(cal.available?tr('available',{ns:'connections'})+(cal.read_only?' · '+tr('readOnly',{ns:'connections'}):''):tr('unavailable',{ns:'connections'})):('desc' in cal?cal.desc:'')}
                                        </div>
                                      </div>
                                    </div>
                                    <span
                                      className={`text-[11px] font-medium shrink-0 ml-2 ${
                                        importedCalendars.includes(cal.id)
                                          ? 'text-[var(--mroya-primary)]'
                                          : 'text-[var(--mroya-text-muted)]'
                                      }`}
                                    >
                                      {importedCalendars.includes(cal.id) ? tr('active',{ns:'connections'}) : tr('ignored',{ns:'connections'})}
                                    </span>
                                  </label>
                                ))}
                              </div>
                            </fieldset>

                            <div className="space-y-1.5">
                              <label htmlFor="google-calendar-export" className="block text-[12.5px] font-semibold text-[var(--mroya-text)]">
                                {tr('exportMroyaEventsTo',{ns:'connections'})}
                              </label>
                              <select
                                id="google-calendar-export"
                                value={exportCalendar}
                                disabled={!canConfigure}
                                onChange={(e) => onChangeExportCalendar?.(e.target.value)}
                                className="w-full px-3 py-2 rounded-[8px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] text-[13px] text-[var(--mroya-text)] focus:outline-none focus:border-[var(--mroya-primary)] cursor-pointer"
                              >
                                {live&&<option value="">{tr('chooseExportCalendar',{ns:'connections'})}</option>}
                                {calendars.filter(cal=>cal.available&&!cal.read_only&&(!('exportable' in cal)||cal.exportable)).map(cal=><option key={cal.id} value={cal.id}>{cal.name}</option>)}
                              </select>
                              <p className="text-[11.5px] text-[var(--mroya-text-muted)]">
                                {tr('exportCalendarHelp',{ns:'connections'})}
                              </p>
                            </div>

                            </>}
                            {page!=='calendar-selection'&&<>
                            <div className="p-3 rounded-[10px] bg-[var(--mroya-surface-muted)]/50 border border-[var(--mroya-divider)] flex items-center justify-between gap-3 text-[13px] font-semibold text-[var(--mroya-text)]">
                              <span id="google-calendar-auto-sync">{tr('automaticSync', {ns:'connections'})}</span>
                              <button
                                type="button"
                                role="switch"
                                aria-labelledby="google-calendar-auto-sync"
                                aria-checked={autoSync}
                                disabled={googleCalendarBusy || (!live && !idle)}
                                onClick={handleToggleAutoSync}
                                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors disabled:opacity-60 ${autoSync ? 'bg-[var(--mroya-primary)]' : 'bg-[var(--mroya-divider)]'}`}
                              >
                                <span aria-hidden="true" className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${autoSync ? 'translate-x-5' : 'translate-x-0'}`} />
                              </button>
                            </div>

                            <button
                              type="button"
                              disabled={!canSync}
                              onClick={handleSyncNow}
                              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[8px] bg-[var(--mroya-surface-muted)] hover:bg-[var(--mroya-surface-active)] text-[13px] font-semibold text-[var(--mroya-text)] border border-[var(--mroya-divider)] transition-colors disabled:opacity-60"
                            >
                              <RefreshCw aria-hidden="true" className={`w-3.5 h-3.5 ${isSyncing ? 'motion-safe:animate-spin' : ''}`} />
                              {tr('syncNow', {ns:'connections'})}
                            </button>
                            <CalendarAnalysisPanel analysis={calendarAnalysis}/>
                            {memoryReview&&<MemoryReviewPanel review={memoryReview}/>}
                            </>}
                          </div>
                        )}
                        {page!=='calendar-selection' && (isConnected || needsReconnect) && (
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(tr('googleDisconnectConfirm', {ns:'connections'}))) handleDisconnectGcal?.();
                            }}
                            disabled={googleCalendarBusy}
                            className="px-3.5 py-1.5 rounded-[8px] text-[12.5px] font-medium text-[var(--mroya-text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-60"
                          >
                            {tr('disconnect', {ns:'connections'})}
                          </button>
                        )}
                      </section>
                    );
                  }

                  // Non-Google Calendar or live catalogue connection card
                  const state=live&&isTelegram?telegram:undefined;
                  const connected=state?.status?.connected??(!live&&conn.connected);
                  const busy=live&&isTelegram&&(!state||state.checking||state.phase==='loading'||state.phase==='creating'||state.phase==='disconnecting');
                  const pending=!!state?.link;
                  const unavailable=!!state?.status&&!state.status.configured&&!connected;
                  const status=live&&isTelegram
                    ? !state||state.phase==='loading'?tr('checkingTelegram',{ns:'connections'})
                      : state.phase==='creating'?tr('creatingTelegramLink',{ns:'connections'})
                      : state.phase==='disconnecting'?tr('disconnectingTelegram',{ns:'connections'})
                      : state.checking?tr('checkingTelegram',{ns:'connections'})
                      : connected?state.status?.telegram_username?tr('connectedTelegramUser',{ns:'connections',username:state.status.telegram_username.replace(/^@/,'')}):tr('connectedTelegram',{ns:'connections'})
                      : state.phase==='expired'?tr('telegramLinkExpired',{ns:'connections'})
                      : pending?state.openFallback?tr('telegramWaitingFallback',{ns:'connections'}):tr('telegramWaiting',{ns:'connections'})
                      : unavailable?tr('telegramTemporarilyUnavailable',{ns:'connections'})
                      : state.status?tr('disconnected',{ns:'connections'}):tr('telegramNotChecked',{ns:'connections'})
                    : live?tr('unavailableSoon',{ns:'connections'}):conn.connected?tr('connectedAccount',{ns:'connections',account:conn.accountLabel||tr('activeInPrototype',{ns:'connections'})}):tr('disconnected',{ns:'connections'});
                  const buttonLabel=live&&isTelegram
                    ? !state||busy?tr('pleaseWait',{ns:'connections'}):state.error?tr('retry',{ns:'connections'}):connected?tr('disconnect',{ns:'connections'}):pending?tr('checkConnection',{ns:'connections'}):state.phase==='expired'?tr('generateNewLink',{ns:'connections'}):unavailable?tr('checkConnection',{ns:'connections'}):tr('connectTelegram',{ns:'connections'})
                    :live?tr('comingSoon',{ns:'connections'}):conn.connected?tr('disconnectPreview',{ns:'connections'}):tr('connectService',{ns:'connections',name:localizedConnectionName(conn)});
                  const action=live&&isTelegram
                    ? state?.error?state.onRetry:connected?state?.onDisconnect:pending||unavailable?state?.onCheck:state?.onConnect
                    :()=>onToggleConnection(conn.id);
                  return (
                  <div
                    key={conn.id}
                    className="p-5 rounded-[12px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] flex flex-col sm:flex-row sm:items-start justify-between gap-4"
                  >
                    <div className="space-y-2 min-w-0 flex-1">
                      {page!=='notifications'&&<>
                      <div className="flex items-center gap-2">
                        <Link2 className="w-4 h-4 text-[var(--mroya-primary)]" />
                        <span className="text-[15px] font-semibold text-[var(--mroya-text)]">
                          {localizedConnectionName(conn)}
                        </span>
                        <span className="text-[12px] text-[var(--mroya-text-muted)]">
                          · {localizedConnectionCategory(conn)}
                        </span>
                      </div>
                      <p className="text-[13px] text-[var(--mroya-text-muted)] leading-[20px]">
                        {localizedConnectionDescription(conn)}
                      </p>
                      <ul className="space-y-1 pt-1">
                        {conn.capabilities.map((cap, i) => (
                          <li
                            key={i}
                            className="text-[12px] text-[var(--mroya-text)] flex items-center gap-2"
                          >
                            <Check className="w-3.5 h-3.5 text-[var(--mroya-primary)] shrink-0" />
                            <span>{localizedConnectionCapability(conn,cap)}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="text-[12px] text-[var(--mroya-text-muted)] pt-1">
                        {status}
                      </div>
                      {state?.link && state.openFallback && <a href={state.link.url} target="_blank" rel="noopener noreferrer" className="inline-block px-4 py-2 rounded-full text-[13px] font-semibold bg-[var(--mroya-primary)] hover:bg-[var(--mroya-primary-hover)] text-[var(--mroya-on-primary)] whitespace-nowrap">{tr('openTelegram',{ns:'connections'})}</a>}
                    {state?.link && state.openFallback && <p role="status" className="text-[12px] text-[var(--mroya-text-muted)]">{tr('telegramPopupBlocked',{ns:'connections'})}</p>}
                      {state?.error && <p role="alert" className="text-[12px] text-[var(--mroya-error)]">{tr('requestFailed',{ns:'common'})}</p>}

                      </>}
                      {/* Telegram notifications visual management block */}
                      {isTelegram && (
                        <div className="mt-4 pt-4 border-t border-[var(--mroya-divider)] space-y-3">
                          {/* Design Mode Scenario Toolbar for Notifications */}
                          {!live && notifications?.simulated && notificationPreview && (
                            <div className="p-2.5 rounded-[8px] bg-[var(--mroya-surface-muted)]/70 border border-[var(--mroya-divider)] space-y-1.5">
                              <div className="flex items-center justify-between text-[11px] text-[var(--mroya-text-muted)] font-semibold">
                                <span className="flex items-center gap-1 text-[var(--mroya-brand-honey)]">
                                  <Sparkles className="w-3 h-3" />
                                  <span>{tr('telegramStates',{ns:'connections'})}</span>
                                </span>
                                <span className="font-normal opacity-80">{tr('designSimulation',{ns:'connections'})}</span>
                              </div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {notificationPreview.scenarios.map((st) => (
                                  <button
                                    key={st.id}
                                    type="button"
                                    onClick={() => notificationPreview.onSelect(st.id)}
                                    className={`px-2 py-0.5 rounded-[5px] text-[11px] font-medium border transition-colors cursor-pointer ${
                                      notificationPreview.selected === st.id
                                        ? 'bg-[var(--mroya-primary)] text-[var(--mroya-on-primary)] border-[var(--mroya-primary)] font-semibold shadow-2xs'
                                        : 'bg-[var(--mroya-surface)] text-[var(--mroya-text)] border-[var(--mroya-divider)] hover:bg-[var(--mroya-surface-muted)]'
                                    }`}
                                  >
                                    {notificationScenarioLabel(st.id)}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Section Header */}
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h4 className="text-[14px] font-semibold text-[var(--mroya-text)] flex items-center gap-1.5">
                                <Bell className="w-4 h-4 text-[var(--mroya-primary)]" />
                                <span>{tr('telegramNotifications',{ns:'connections'})}</span>
                              </h4>
                              <p className="text-[12px] text-[var(--mroya-text-muted)] mt-0.5">
                                {tr('receiveTelegramNotifications',{ns:'connections'})}
                              </p>
                            </div>

                            {/* Switch: Notifications */}
                            <label className="flex items-center gap-2 cursor-pointer select-none shrink-0">
                              <span className="text-[12px] font-medium text-[var(--mroya-text)] hidden sm:inline">
                                {tr('notifications',{ns:'connections'})}
                              </span>
                              <div className="relative inline-flex items-center">
                                <input
                                  type="checkbox"
                                  aria-label={tr('telegramNotifications',{ns:'connections'})}
                                  checked={notifications?.enabled??false}
                                  disabled={!notifications?.available||notificationBusy||(!notifications.enabled&&!notifications.canEnable)}
                                  onChange={(e) => {void notifications?.onToggleTelegram(e.target.checked);}}
                                  className="sr-only peer"
                                />
                                <div className="w-9 h-5 bg-[var(--mroya-surface-muted)] border border-[var(--mroya-divider)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[var(--mroya-text)] peer-checked:after:bg-[var(--mroya-on-primary)] peer-checked:bg-[var(--mroya-primary)] after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
                              </div>
                            </label>
                          </div>

                          {/* Status Area and Test Action Row */}
                          <div className="p-3 rounded-[10px] bg-[var(--mroya-surface-muted)]/50 border border-[var(--mroya-divider)] space-y-2.5">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              {/* Status of last notification */}
                              <div className="flex items-center gap-2 text-[12px]">
                                <span className="text-[var(--mroya-text-muted)]">{tr('notificationStatus',{ns:'connections'})}</span>
                                {['loading','saving','sending'].includes(notificationState) && (
                                  <span className="inline-flex items-center gap-1.5 font-medium text-[var(--mroya-text)]">
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-[var(--mroya-primary)]" />
                                    <span>{notificationState==='saving'?tr('savingNotificationSettings',{ns:'connections'}):notificationState==='loading'?tr('loadingNotificationSettings',{ns:'connections'}):tr('sendingTestNotification',{ns:'connections'})}</span>
                                  </span>
                                )}
                                {notificationState === 'ready' && (
                                  <span className="inline-flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>{tr('botReady',{ns:'connections'})}</span>
                                  </span>
                                )}
                                {['pending','processing','retry'].includes(notificationState) && (
                                  <span className="inline-flex items-center gap-1.5 font-medium text-amber-600 dark:text-amber-400">
                                    <Clock className="w-3.5 h-3.5" />
                                    <span>{notificationStatus}</span>
                                  </span>
                                )}
                                {notificationState === 'sent' && (
                                  <span className="inline-flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
                                    <Check className="w-3.5 h-3.5" />
                                    <span>{tr('deliveredTelegram',{ns:'connections'})}</span>
                                  </span>
                                )}
                                {notificationState === 'failed' && (
                                  <span className="inline-flex items-center gap-1.5 font-medium text-red-600 dark:text-red-400">
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    <span>{tr('deliveryFailed',{ns:'connections'})}</span>
                                  </span>
                                )}
                                {notificationState === 'unavailable' && (
                                  <span className="inline-flex items-center gap-1.5 font-medium text-zinc-500">
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                    <span>{tr(live||notifications?.available?'serviceUnavailable':'soon',{ns:'connections'})}</span>
                                  </span>
                                )}
                                {['disabled','disconnected','notReady','cancelled','expired'].includes(notificationState) && (
                                  <span className="inline-flex items-center gap-1.5 font-medium text-[var(--mroya-text-muted)]">
                                    <span>{notificationStatus}</span>
                                  </span>
                                )}
                              </div>

                              {/* Compact Refresh and Test Buttons */}
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  title={tr('refreshStatus',{ns:'connections'})}
                                  disabled={!notifications?.available||notificationBusy}
                                  onClick={() => {void notifications?.onRefresh();}}
                                  className="p-1.5 rounded-[6px] hover:bg-[var(--mroya-surface-active)] text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] border border-[var(--mroya-divider)] transition-colors cursor-pointer"
                                >
                                  <RefreshCw className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={!notifications?.canSendTest||notificationBusy}
                                  onClick={() => {void notifications?.onSendTest();}}
                                  className="px-3 py-1.5 rounded-full text-[12px] font-semibold bg-[var(--mroya-primary)] hover:bg-[var(--mroya-primary-hover)] disabled:opacity-50 text-[var(--mroya-on-primary)] transition-colors cursor-pointer shadow-xs whitespace-nowrap"
                                >
                                  {tr('sendTestNotification',{ns:'connections'})}
                                </button>
                              </div>
                            </div>

                            {/* Error display and Retry area */}
                            {notificationError && (
                              <div className="pt-2 border-t border-red-500/20 flex items-center justify-between gap-2 text-[12px] text-red-600 dark:text-red-400">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                  <span className="truncate">{notificationError}</span>
                                </div>
                                <button
                                  type="button"
                                  disabled={notificationBusy}
                                  onClick={() => {void notifications?.onRetry();}}
                                  className="px-2.5 py-1 rounded-[6px] bg-red-600 hover:bg-red-700 text-white font-semibold text-[11px] shrink-0 cursor-pointer shadow-xs"
                                >
                                  {tr('retry',{ns:'connections'})}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {page!=='notifications'&&<button
                      type="button"
                      disabled={live&&(!isTelegram||busy)}
                      onClick={action}
                      className={`px-4 py-2 rounded-full text-[13px] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        connected
                          ? 'bg-[var(--mroya-surface-muted)] hover:bg-[var(--mroya-surface-active)] text-[var(--mroya-text)] border border-[var(--mroya-divider)]'
                          : 'bg-[var(--mroya-primary)] hover:bg-[var(--mroya-primary-hover)] text-[var(--mroya-on-primary)]'
                      }`}
                    >
                      {buttonLabel}
                    </button>}
                  </div>
                );})}
              </div>

            </div>
          )}


          {!live && activeTab === 'plan' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-[18px] font-semibold text-[var(--mroya-text)]">
                  {live ? tr('subscriptionAndPlan',{ns:'connections'}) : tr('subscriptionAndPlanPreview',{ns:'connections'})}
                </h2>
                <p className="text-[13px] text-[var(--mroya-text-muted)] mt-0.5">
                  {live ? tr('subscriptionUnavailable',{ns:'connections'}) : tr('planPreviewDescription',{ns:'connections'})}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Free State Card */}
                <div
                  className={`p-5 rounded-[12px] border flex flex-col justify-between space-y-4 ${
                    !live && plan === 'free'
                      ? 'bg-[var(--mroya-surface)] border-[var(--mroya-primary)]'
                      : 'bg-[var(--mroya-surface)] border-[var(--mroya-divider)]'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="text-[12px] font-medium text-[var(--mroya-text-muted)]">
                      {tr('defaultTier',{ns:'connections'})}
                    </div>
                    <h3 className="text-[18px] font-semibold text-[var(--mroya-text)]">
                      Mroya Free
                    </h3>
                    <p className="text-[13px] text-[var(--mroya-text-muted)] leading-[20px]">
                      {tr('freePlanDescription',{ns:'connections'})}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={live}
                    onClick={() => onSelectPlan('free')}
                    className={`w-full py-2.5 px-4 rounded-full text-[13px] font-semibold transition-colors cursor-pointer ${
                      !live && plan === 'free'
                        ? 'bg-[var(--mroya-surface-active)] text-[var(--mroya-text)]'
                        : 'bg-[var(--mroya-surface-muted)] hover:bg-[var(--mroya-surface-active)] text-[var(--mroya-text)]'
                    }`}
                  >
                    {live ? tr('comingSoon',{ns:'connections'}) : plan === 'free' ? tr('currentPreviewFree',{ns:'connections'}) : tr('previewFreeState',{ns:'connections'})}
                  </button>
                </div>

                {/* Premium State Card */}
                <div
                  className={`p-5 rounded-[12px] border flex flex-col justify-between space-y-4 ${
                    !live && plan === 'premium'
                      ? 'bg-[var(--mroya-surface)] border-[var(--mroya-brand-honey)]'
                      : 'bg-[var(--mroya-surface)] border-[var(--mroya-divider)]'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--mroya-primary)]">
                      <Sparkles className="w-3.5 h-3.5 text-[var(--mroya-brand-honey)]" />
                        <span>{tr('clientFacing',{ns:'connections'})}</span>
                    </div>
                    <h3 className="text-[18px] font-semibold text-[var(--mroya-text)]">
                      Mroya Premium
                    </h3>
                    <p className="text-[13px] text-[var(--mroya-text-muted)] leading-[20px]">
                      {tr('premiumPlanDescription',{ns:'connections'})}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={live}
                    onClick={() => onSelectPlan('premium')}
                    className={`w-full py-2.5 px-4 rounded-full text-[13px] font-semibold transition-colors cursor-pointer ${
                      !live && plan === 'premium'
                        ? 'bg-[var(--mroya-surface-active)] text-[var(--mroya-text)]'
                        : 'bg-[var(--mroya-primary)] hover:bg-[var(--mroya-primary-hover)] text-[var(--mroya-on-primary)]'
                    }`}
                  >
                    {live ? tr('comingSoon',{ns:'connections'}) : plan === 'premium'
                      ? tr('currentPreviewPremium',{ns:'connections'})
                      : tr('previewMroyaPremium',{ns:'connections'})}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="p-5 rounded-[12px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] space-y-4">
              <div>
                <h2 className="text-[16px] font-semibold text-[var(--mroya-text)]">
                  {tr('themePalette',{ns:'connections'})}
                </h2>
                <p className="text-[13px] text-[var(--mroya-text-muted)]">
                  {tr('paletteDescription',{ns:'connections'})}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button type="button" onClick={() => onSelectTheme('system')} aria-pressed={theme==='system'} className={`p-4 rounded-[10px] border text-left flex items-center justify-between cursor-pointer ${theme==='system'?'bg-[var(--mroya-surface-active)] border-[var(--mroya-primary)]':'bg-[var(--mroya-surface-muted)] border-[var(--mroya-divider)]'}`}>
                  <div className="flex items-center gap-3"><Monitor className="w-4 h-4 text-[var(--mroya-primary)]"/><div><div className="text-[14px] font-semibold">{tr('systemTheme',{ns:'connections'})}</div><div className="text-[12px] text-[var(--mroya-text-muted)]">{tr('followDevice',{ns:'connections'})}</div></div></div>{theme==='system'&&<Check className="w-4 h-4 text-[var(--mroya-primary)]"/>}
                </button>
                <button
                  type="button"
                  onClick={() => onSelectTheme('light')}
                  className={`p-4 rounded-[10px] border text-left flex items-center justify-between cursor-pointer ${
                    theme === 'light'
                      ? 'bg-[var(--mroya-surface-active)] border-[var(--mroya-primary)]'
                      : 'bg-[var(--mroya-surface-muted)] border-[var(--mroya-divider)]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Sun className="w-4 h-4 text-[var(--mroya-primary)]" />
                    <div>
                      <div className="text-[14px] font-semibold text-[var(--mroya-text)]">
                        {tr('lightTheme',{ns:'connections'})}
                      </div>
                      <div className="text-[12px] text-[var(--mroya-text-muted)]">
                        {tr('lightPalette',{ns:'connections'})}
                      </div>
                    </div>
                  </div>
                  {theme === 'light' && <Check className="w-4 h-4 text-[var(--mroya-primary)]" />}
                </button>

                <button
                  type="button"
                  onClick={() => onSelectTheme('dark')}
                  className={`p-4 rounded-[10px] border text-left flex items-center justify-between cursor-pointer ${
                    theme === 'dark'
                      ? 'bg-[var(--mroya-surface-active)] border-[var(--mroya-primary)]'
                      : 'bg-[var(--mroya-surface-muted)] border-[var(--mroya-divider)]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Moon className="w-4 h-4 text-[var(--mroya-primary)]" />
                    <div>
                      <div className="text-[14px] font-semibold text-[var(--mroya-text)]">
                        {tr('darkTheme',{ns:'connections'})}
                      </div>
                      <div className="text-[12px] text-[var(--mroya-text-muted)]">
                        {tr('darkPalette',{ns:'connections'})}
                      </div>
                    </div>
                  </div>
                  {theme === 'dark' && <Check className="w-4 h-4 text-[var(--mroya-primary)]" />}
                </button>
              </div>
            </div>
          )}

          {(!page&&activeTab==='profile'||page==='profile'||page==='name'||page==='timezone'||page==='language') && (
            <div className="p-5 sm:p-6 rounded-[12px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] space-y-5">
              {(!page||page==='profile')&&<>
              <div className="flex items-center gap-3.5 pb-4 border-b border-[var(--mroya-divider)]">
                <div className="w-12 h-12 rounded-full bg-[var(--mroya-surface-active)] border border-[var(--mroya-divider)] flex items-center justify-center text-[16px] font-semibold text-[var(--mroya-primary)] shrink-0">
                  {account.initials}
                </div>
                <div className="min-w-0">
                  <h2 className="text-[16px] font-semibold text-[var(--mroya-text)] truncate">
                    {account.displayName}
                  </h2>
                  <p className="text-[13px] text-[var(--mroya-text-muted)] break-words [overflow-wrap:anywhere] lg:truncate">
                    {account.email}{account.description ? ` · ${account.description}` : ''}
                  </p>
                </div>
              </div>

              {settingsNavigation && <>
                <SettingsRows pages={['name','timezone']} onOpen={settingsNavigation.open}/>
                {onLogout&&<button type="button" className="text-sm font-medium text-[var(--mroya-error)]" onClick={onLogout}>{tr('signOut',{ns:'connections'})}</button>}
              </>}
              </>}
              {!page&&memoryTransfer && <MemoryTransferSettings transfer={memoryTransfer} />}

              {(!page||page==='name') && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="mroya-profile-nickname" className="block text-[13px] font-semibold text-[var(--mroya-text)]">
                    {tr('nickname',{ns:'connections'})}
                  </label>
                  {nicknameStatus && (
                    <span className="text-[12px] font-medium text-[var(--mroya-primary)]">
                      {nicknameStatus}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                  <input
                    id="mroya-profile-nickname"
                    type="text"
                    autoComplete="nickname"
                    value={nicknameDraft}
                    onChange={(e) => { nicknameEdited.current = true; setNicknameSubmitted(false); setSaveStatus(null); setNicknameDraft(e.target.value); }}
                    placeholder={tr('nicknamePlaceholder',{ns:'connections'})}
                    className="flex-1 min-w-[200px] rounded-[10px] border border-[var(--mroya-divider)] bg-[var(--mroya-bg)] px-3.5 py-2 text-[13px] text-[var(--mroya-text)] placeholder-[var(--mroya-text-muted)] hover:border-[var(--mroya-primary)]/50 focus:border-[var(--mroya-primary)] focus:outline-none transition-colors"
                  />
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleSaveNickname}
                      className="px-4 py-2 rounded-full text-[13px] font-semibold bg-[var(--mroya-primary)] hover:bg-[var(--mroya-primary-hover)] text-[var(--mroya-on-primary)] transition-colors cursor-pointer"
                    >
                      {tr('save',{ns:'common'})}
                    </button>
                    <button
                      type="button"
                      onClick={handleClearNickname}
                      className="px-3 py-2 rounded-full text-[12px] font-medium text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)] border border-[var(--mroya-divider)] transition-colors cursor-pointer"
                      title={tr('clearNickname',{ns:'connections'})}
                    >
                      {tr('clear',{ns:'common'})}
                    </button>
                  </div>
                </div>
                <p className="text-[12px] text-[var(--mroya-text-muted)]">
                  {tr('nicknameHelp',{ns:'connections'})}
                </p>
              </div>

              )}
              {(!page||page==='timezone') && (
              <div className="space-y-2 pt-3 border-t border-[var(--mroya-divider)]">
                <label htmlFor="mroya-timezone-select" className="block text-[13px] font-semibold text-[var(--mroya-text)]">
                  {tr('timezone',{ns:'connections'})}
                </label>
                <div className="relative">
                  <select
                    id="mroya-timezone-select"
                    value={timezoneValue}
                    disabled={live&&!timezoneSettings?.apiReady}
                    onChange={handleTimezoneChange}
                    className="w-full appearance-none rounded-[10px] border border-[var(--mroya-divider)] bg-[var(--mroya-bg)] px-3.5 py-2.5 pr-10 text-[13px] text-[var(--mroya-text)] hover:border-[var(--mroya-primary)]/50 focus:border-[var(--mroya-primary)] focus:outline-none transition-colors cursor-pointer"
                  >
                    {!timezoneValue&&<option value="">{tr('notSet',{ns:'common'})}</option>}
                    {availableTimezones.map((tz) => (
                      <option key={tz.value} value={tz.value} className="bg-[var(--mroya-surface)] text-[var(--mroya-text)]">
                        {tz.label}
                      </option>
                    ))}
                    <option value="__custom__">{tr('otherTimezone',{ns:'connections'})}</option>
                    </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-[var(--mroya-text-muted)]">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                  </div>
                  {customTimezoneOpen&&<div className="flex items-center gap-2">
                    <input aria-label={tr('customTimezone',{ns:'connections'})} value={customTimezone} onChange={event=>setCustomTimezone(event.target.value)} placeholder={tr('timezonePlaceholder',{ns:'connections'})} disabled={live&&!timezoneSettings?.apiReady} className="w-full px-3 py-2 rounded-[8px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] text-[13px] text-[var(--mroya-text)]"/>
                    <button type="button" disabled={!customTimezone.trim()||live&&!timezoneSettings?.apiReady} onClick={()=>{const value=customTimezone.trim();setSelectedTimezone(value);(onChangeTimezone??timezoneSettings?.onChange)?.(value);}} className="px-3 py-2 rounded-[8px] bg-[var(--mroya-primary)] text-[var(--mroya-on-primary)] text-[13px]">{tr('useTimezone',{ns:'connections'})}</button>
                  </div>}
                  {live&&timezoneSettings&&<div aria-live="polite" className="text-[12px] text-[var(--mroya-text-muted)]">
                    {timezoneSettings.status==='saving'&&<p role="status">{tr('savingTimezone',{ns:'connections'})}</p>}
                    {timezoneSettings.status==='saved'&&timezoneSettings.timezone&&<p role="status">{tr('savedTimezone',{ns:'connections',timezone:timezoneSettings.timezone})}</p>}
                    {timezoneSettings.status==='error'&&<><p role="alert">{tr('timezoneNotSaved',{ns:'connections'})}</p>{timezoneSettings.apiReady&&<button type="button" onClick={timezoneSettings.onRetry} className="underline mt-2">{tr('retryTimezone',{ns:'connections'})}</button>}</>}
                  </div>}

                <p className="text-[12px] text-[var(--mroya-text-muted)]">
                  {live ? (timezoneSettings?.apiReady?tr('confirmedTimezoneHelp',{ns:'connections'}):tr('timezoneReadOnly',{ns:'connections'})) : tr('timezoneTitle',{ns:'connections'})}
                </p>
              </div>

              )}
              {(!page||page==='language') && (
              <div className="space-y-2 pt-3 border-t border-[var(--mroya-divider)]">
                <label htmlFor="mroya-language-select" className="block text-[13px] font-semibold text-[var(--mroya-text)]">
                  {tr('language',{ns:'connections'})}
                </label>
                <select
                  id="mroya-language-select"
                  value={language}
                  disabled={!onChangeLanguage}
                  onChange={event=>onChangeLanguage?.(event.target.value as AppLanguage)}
                  className="w-full appearance-none rounded-[10px] border border-[var(--mroya-divider)] bg-[var(--mroya-bg)] px-3.5 py-2.5 text-[13px] text-[var(--mroya-text)] hover:border-[var(--mroya-primary)]/50 focus:border-[var(--mroya-primary)] focus:outline-none transition-colors cursor-pointer"
                  aria-describedby="mroya-language-help mroya-language-status"
                >
                  <option value="en">English</option>
                  <option value="ru">Русский</option>
                </select>
                <p id="mroya-language-help" className="text-[12px] text-[var(--mroya-text-muted)]">
                  {tr('languageHelp',{ns:'connections'})}
                </p>
                <div id="mroya-language-status" aria-live="polite" className="text-[12px] text-[var(--mroya-text-muted)]">
                  {languageSave?.status==='saving'&&<p role="status">{tr('savingLanguage',{ns:'connections'})}</p>}
                  {languageSave?.status==='saved'&&<p role="status">{tr('savedLanguage',{ns:'connections'})}</p>}
                  {languageSave?.status==='unsaved'&&<div role="alert"><p>{tr('languageNotSaved',{ns:'connections'})}</p><button type="button" onClick={languageSave.onRetry} className="underline mt-2">{tr('retryLanguage',{ns:'connections'})}</button></div>}
                    {!live&&<p role="status">{tr('savedLanguage',{ns:'connections'})}</p>}
                </div>
              </div>

              )}
              {!page&&<div className="pt-3 border-t border-[var(--mroya-divider)] text-[13px]">
                <div className="text-[var(--mroya-text-muted)]">{tr('personalSpace',{ns:'connections'})}</div>
                <div className="font-medium text-[var(--mroya-text)] mt-0.5">
                  {account.spaceDescription || tr('personalSpaceFallback',{ns:'connections'})}
                </div>
              </div>}
            </div>
          )}

          {(page==='chat'||!live&&activeTab==='settings') && (
            <div className="space-y-5">
              <div className="p-5 rounded-[12px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] space-y-5">
                <div className="flex items-center gap-2.5">
                  <Brain className="w-5 h-5 text-[var(--mroya-brand-honey)]" />
                  <div>
                    <h2 className="text-[16px] font-semibold text-[var(--mroya-text)]">
                      {tr('assistantPreferences',{ns:'connections'})}
                    </h2>
                    <p className="text-[12.5px] text-[var(--mroya-text-muted)] mt-0.5">
                      {tr('assistantPreferencesDescription',{ns:'connections'})}
                    </p>
                  </div>
                </div>

                {/* Show model reasoning setting */}
                <div className="pt-4 border-t border-[var(--mroya-divider)]">
                  <label className="flex items-start gap-3 cursor-pointer group select-none">
                    <input
                      type="checkbox"
                      checked={showModelReasoning}
                      onChange={handleToggleShowModelReasoning}
                      className="mt-0.5 w-4 h-4 rounded border-[var(--mroya-divider)] text-[var(--mroya-primary)] accent-[var(--mroya-primary)] focus:ring-[var(--mroya-primary)] cursor-pointer"
                    />
                    <div className="space-y-0.5">
                      <span className="text-[13.5px] font-medium text-[var(--mroya-text)] group-hover:text-[var(--mroya-text)]">
                        {tr('showReasoning',{ns:'connections'})}
                      </span>
                      <p className="text-[12px] text-[var(--mroya-text-muted)] leading-[18px]">
                        {tr('modelReasoningDescription',{ns:'connections'})}
                      </p>
                    </div>
                  </label>
                </div>

                {!page&&<div className="pt-4 border-t border-[var(--mroya-divider)] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-[13px] font-semibold text-[var(--mroya-text)]">
                      {tr('chatPreview',{ns:'connections'})}
                    </div>
                    <span className="text-[11.5px] text-[var(--mroya-text-muted)]">
                      {showModelReasoning ? tr('previewWithReasoning',{ns:'connections'}) : tr('standardPreview',{ns:'connections'})}
                    </span>
                  </div>

                  <div className="p-4 rounded-[12px] bg-[var(--mroya-bg)] border border-[var(--mroya-divider)] space-y-3.5">
                    {/* User message example */}
                    <div className="flex flex-col items-end">
                      <div className="max-w-[88%] sm:max-w-[78%] px-3.5 py-2.5 rounded-[14px] rounded-br-[4px] bg-[var(--mroya-surface-active)] border border-[var(--mroya-divider)] text-[13.5px] leading-[21px] text-[var(--mroya-text)] shadow-xs">
                        {tr('previewUserMessage',{ns:'connections'})}
                      </div>
                      <span className="mt-1 text-[11px] text-[var(--mroya-text-muted)] tabular-nums">
                        12:00
                      </span>
                    </div>

                    {/* Assistant message example */}
                    <div className="w-full space-y-2.5">
                      <div className="flex items-center gap-2">
                        <BrandMark size="sm" />
                        <span className="text-[13px] font-semibold text-[var(--mroya-text)]">
                          Mroya
                        </span>
                      </div>

                      {/* Model reasoning block (visible only when Show model reasoning is ON) */}
                      {showModelReasoning && (
                        <ModelReasoningBlock
                          reasoning={[
                            tr('previewReasoning1',{ns:'connections'}),
                            tr('previewReasoning2',{ns:'connections'}),
                            tr('previewReasoning3',{ns:'connections'}),
                            tr('previewReasoning4',{ns:'connections'}),
                          ]}
                          isIllustrativeExample={true}
                          defaultExpanded={true}
                        />
                      )}

                      {/* Final Assistant Response */}
                      <div className="w-full p-3.5 rounded-[12px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] shadow-[var(--mroya-shadow-subtle)] text-[13.5px] leading-[21px] text-[var(--mroya-text)]">
                        {tr('previewAssistantMessage',{ns:'connections'})}
                      </div>
                    </div>
                  </div>
                </div>}
              </div>

              {!page&&<div className="p-5 rounded-[12px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] space-y-4">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-[var(--mroya-primary)]" />
                    <h2 className="text-[16px] font-semibold text-[var(--mroya-text)]">
                    {tr('memoryTransparency',{ns:'connections'})}
                  </h2>
                </div>
                <p className="text-[13px] text-[var(--mroya-text-muted)] leading-[20px]">
                  {live ? tr('memoryPreferenceUnavailable',{ns:'connections'}) : tr('memoryTransparencyDescription',{ns:'connections'})}
                </p>
                <div className="pt-2 border-t border-[var(--mroya-divider)] flex items-center justify-between text-[13px]">
                  <span className="font-medium text-[var(--mroya-text)]">
                    {tr('inlineMemoryConfirmation',{ns:'connections'})}
                  </span>
                  <span className="text-[var(--mroya-primary)] font-semibold">{live ? tr('comingSoon',{ns:'connections'}) : tr('enabled',{ns:'connections'})}</span>
                </div>
              </div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
