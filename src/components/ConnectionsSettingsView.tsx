import {CalendarAnalysisPanel} from './CalendarAnalysisPanel';
import {timezoneChoices} from '../utils/timezones';
import type { AccountPresentation, NotificationPresentation, NotificationPreview, TelegramPresentation, TimezonePresentation, WorkspaceModel } from '../types/workspace';
import type {AppLanguage} from '../types/api';
import {tr} from '../i18n';
import {currentLocale} from '../i18n/format';
import React from 'react';
import {
  Link2,
  Sun,
  Moon,
  Monitor,
  Sparkles,
  Check,
  User,
  Shield,
  Menu,
  ChevronDown,
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
export interface ConnectionsSettingsViewProps extends Pick<WorkspaceModel,
  'connectionSamples'|'googleCalendarAvailable'|'googleCalendarBusy'|'googleCalendarNotice'|'googleCalendarError'|'googleConnections'|'selectedGoogleConnectionId'|'onSelectGoogleConnection'|'onRefreshGoogleCalendar'|'onConnectAnotherGoogleCalendar'|
  'gcalSyncState'|'autoSync'|'lastSyncedTime'|'syncSummary'|'googleCalendarEmail'|'importedCalendars'|'exportCalendar'|
  'onConnectGoogleCalendar'|'onDisconnectGoogleCalendar'|'onSyncNowGoogleCalendar'|'onToggleAutoSyncGoogleCalendar'|'onSetGcalSyncState'|'onChangeImportedCalendars'|'onChangeExportCalendar'> {
  calendarAnalysis?:import('../types/calendarAnalysis').CalendarAnalysisPresentation;
  notifications?:NotificationPresentation;
  notificationPreview?:NotificationPreview;
  live?: boolean;
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
  onOpenMobileMenu: () => void;
  onSaveNickname?: (nickname: string) => void;
  onClearNickname?: () => void;
  onChangeTimezone?: (timezone: string) => void;
  showModelReasoning?: boolean;
  onToggleShowModelReasoning?: (enabled: boolean) => void;
}

export const ConnectionsSettingsView: React.FC<ConnectionsSettingsViewProps> = ({
  calendarAnalysis,live=false,connectionSamples,timezoneSettings,notifications,notificationPreview,
  googleCalendarAvailable=false,googleCalendarBusy=false,googleCalendarNotice,googleCalendarError,googleConnections=[],selectedGoogleConnectionId,
  onSelectGoogleConnection,onRefreshGoogleCalendar,onConnectAnotherGoogleCalendar,
  gcalSyncState='disconnected',autoSync=false,lastSyncedTime='',syncSummary=null,googleCalendarEmail='',
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
  onOpenMobileMenu,
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
  const visibleConnections = live ? plannedConnections() : connections;
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
          <button
            type="button"
            onClick={onOpenMobileMenu}
            aria-label={tr('openNavigation',{ns:'connections'})}
            className="lg:hidden inline-flex items-center justify-center w-9 h-9 rounded-lg text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)]"
          >
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="text-[16px] font-semibold text-[var(--mroya-text)] truncate">
            {tr('header',{ns:'connections'})}
          </h1>
        </div>
      </header>

      {/* Sub-navigation bar */}
      <div className="px-4 sm:px-6 py-2.5 border-b border-[var(--mroya-divider)] flex items-center gap-1.5 overflow-x-auto">
        {tabs.map((t) => (
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

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-[820px] mx-auto space-y-6">
          {preferenceSave && <div className="text-[13px] text-[var(--mroya-text-muted)]" aria-live="polite">
            {preferenceSave.status==='saving' && <p role="status">{tr('savingAccount',{ns:'connections'})}</p>}
            {preferenceSave.status==='unsaved' && <><p role="alert">{tr('changesNotSaved',{ns:'connections'})}</p><button type="button" onClick={preferenceSave.onRetry} className="underline mt-2">{tr('retrySaving',{ns:'connections'})}</button></>}
          </div>}
          {activeTab === 'connections' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-[18px] font-semibold text-[var(--mroya-text)]">
                  {tr('externalServices',{ns:'connections'})}
                </h2>
                <p className="text-[13px] text-[var(--mroya-text-muted)] mt-0.5">
                  {tr('externalServicesHelp',{ns:'connections'})}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {visibleConnections.map((conn) => {
                  // Explicit catalogue mapping: Studio and live IDs are deliberately different.
                  const isTelegram=conn.id===(live?'telegram':connectionSamples?.telegramId);
                  const isGoogleCalendar = (!live||googleCalendarAvailable) && conn.id===(live?'google-calendar':connectionSamples?.googleCalendarId);
                  const category=localizedConnectionCategory(conn);
                  const description=localizedConnectionDescription(conn);

                  // Shared Google Calendar card: demo props or confirmed backend data.
                  if (isGoogleCalendar) {
                    const isConnected = gcalSyncState !== 'disconnected';
                    const canSync = !googleCalendarBusy&&['connected_auto_off','connected_auto_on'].includes(gcalSyncState);
                    const selectedConnection=googleConnections.find(item=>item.id===selectedGoogleConnectionId);
                    const canConfigure=!googleCalendarBusy&&(canSync||live&&gcalSyncState==='sync_error');
                    const calendars=live?(selectedConnection?.calendars??[]):(connectionSamples?.calendars??[]);

                    return (
                      <div
                        key={conn.id}
                        className="p-5 rounded-[12px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] flex flex-col sm:flex-row sm:items-start justify-between gap-4"
                      >
                        <div className="w-full space-y-4">
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

                        {/* Card Header & Status */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--mroya-divider)]/60">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-[10px] bg-[var(--mroya-surface-muted)] border border-[var(--mroya-divider)] flex items-center justify-center shrink-0">
                              <CalendarIcon className="w-5 h-5 text-[var(--mroya-primary)]" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-[16px] font-bold text-[var(--mroya-text)]">
                              {conn.name}
                                </h3>
                                <span className="text-[12px] text-[var(--mroya-text-muted)]">
                              · {category}
                                </span>
                              </div>
                              <p className="text-[12.5px] text-[var(--mroya-text-muted)]">
                                Two-way schedule synchronization with Mroya calendar
                              </p>
                            </div>
                          </div>

                          {/* Top Status Pill */}
                          <div className="shrink-0">
                            {gcalSyncState === 'disconnected' && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-medium bg-[var(--mroya-surface-muted)] text-[var(--mroya-text-muted)] border border-[var(--mroya-divider)]">
                                <span className="w-2 h-2 rounded-full bg-[var(--mroya-text-muted)]" />
                              <span>{tr('disconnected',{ns:'connections'})}</span>
                              </span>
                            )}
                            {gcalSyncState === 'connecting' && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-semibold bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                                <RefreshCw className="w-3 h-3 animate-spin text-blue-600 dark:text-blue-400" />
                              <span>{tr('connecting',{ns:'connections'})}</span>
                              </span>
                            )}
                            {gcalSyncState === 'initial_syncing' && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-semibold bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                                <RefreshCw className="w-3 h-3 animate-spin text-blue-600 dark:text-blue-400" />
                              <span>{tr('initialSync',{ns:'connections'})}</span>
                              </span>
                            )}
                            {gcalSyncState === 'connected_auto_off' && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{tr('connectedSyncOff',{ns:'connections'})}</span>
                              </span>
                            )}
                            {gcalSyncState === 'connected_auto_on' && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{tr('connectedSyncOn',{ns:'connections'})}</span>
                              </span>
                            )}
                            {gcalSyncState === 'syncing' && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-semibold bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                                <RefreshCw className="w-3 h-3 animate-spin text-blue-600 dark:text-blue-400" />
                              <span>{tr('synchronizing',{ns:'connections'})}</span>
                              </span>
                            )}
                            {gcalSyncState === 'sync_error' && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                                <AlertTriangle className="w-3.5 h-3.5" />
                              <span>{tr('syncError',{ns:'connections'})}</span>
                              </span>
                            )}
                            {gcalSyncState === 'conflict' && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                                <AlertCircle className="w-3.5 h-3.5" />
                              <span>{tr('conflictDetected',{ns:'connections'})}</span>
                              </span>
                            )}
                            {gcalSyncState === 'reconnect_required' && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                                <AlertTriangle className="w-3.5 h-3.5" />
                              <span>{tr('reconnectRequired',{ns:'connections'})}</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* DISCONNECTED STATE VIEW */}
                        {gcalSyncState === 'disconnected' && (
                          <div className="space-y-4 pt-1 animate-in fade-in duration-150">
                            <p className="text-[13px] text-[var(--mroya-text-muted)] leading-[21px]">
                              {tr('connectGoogleDescription',{ns:'connections'})}
                            </p>
                            <ul className="space-y-1.5">
                              {conn.capabilities.map((cap, i) => (
                                <li
                                  key={i}
                                  className="text-[12.5px] text-[var(--mroya-text)] flex items-center gap-2"
                                >
                                  <Check className="w-3.5 h-3.5 text-[var(--mroya-primary)] shrink-0" />
                                  <span>{localizedConnectionCapability(conn,cap)}</span>
                                </li>
                              ))}
                            </ul>
                            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-[var(--mroya-divider)]/40">
                              <p className="text-[11.5px] text-[var(--mroya-text-muted)]">
                                {tr('localEventsRemain',{ns:'connections'})}
                              </p>
                              <button
                                type="button"
                                onClick={handleConnectGcal}
                                disabled={googleCalendarBusy}
                                className="px-5 py-2.5 rounded-[8px] bg-[var(--mroya-primary)] hover:bg-[var(--mroya-primary-hover)] text-[var(--mroya-on-primary)] text-[13px] font-semibold transition-all cursor-pointer whitespace-nowrap shadow-xs shrink-0 self-start sm:self-center"
                              >
                                {tr('connectGoogleCalendar',{ns:'connections'})}
                              </button>
                            </div>
                          </div>
                        )}

                        {live&&<div className="space-y-2">
                          {googleConnections.length>0&&<select aria-label={tr('googleAccount',{ns:'connections'})} value={selectedGoogleConnectionId??''} disabled={googleCalendarBusy} onChange={e=>onSelectGoogleConnection?.(e.target.value)} className="w-full px-3 py-2 rounded-[8px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] text-[13px] text-[var(--mroya-text)]">
                            {googleConnections.map(account=><option key={account.id} value={account.id}>{account.email||tr('googleAccountName',{ns:'connections'})} · {tr(account.status==='connected'?'googleStatusConnected':account.status==='reconnect'?'googleStatusReconnect':'googleStatusDisconnected',{ns:'connections'})}</option>)}
                          </select>}
                          {googleConnections.length>0&&<button disabled={googleCalendarBusy} onClick={onConnectAnotherGoogleCalendar} className="text-[12px] font-semibold text-[var(--mroya-primary)] hover:underline">{tr('connectGoogleAccount',{ns:'connections'})}</button>}
                          {(googleCalendarBusy||googleCalendarError||googleCalendarNotice)&&<p role={googleCalendarError?'alert':'status'} className="text-[12px] text-[var(--mroya-text-muted)]">
                            {googleCalendarError?tr('requestFailed',{ns:'common'}):(googleCalendarBusy?tr('awaitingBackend',{ns:'connections'}):googleCalendarNotice)}
                            <button disabled={googleCalendarBusy} onClick={onRefreshGoogleCalendar} className="ml-3 underline">{tr('checkStatus',{ns:'connections'})}</button>
                          </p>}
                        </div>}

                        {/* CONNECTING STATE VIEW */}
                        {gcalSyncState === 'connecting' && (
                          <div className="py-6 flex flex-col items-center justify-center text-center space-y-3 animate-in fade-in">
                            <RefreshCw className="w-7 h-7 text-[var(--mroya-primary)] animate-spin" />
                            <div className="space-y-1">
                              <h4 className="text-[14px] font-semibold text-[var(--mroya-text)]">
                                {tr('connectingGoogleCalendar',{ns:'connections'})}
                              </h4>
                              <p className="text-[12px] text-[var(--mroya-text-muted)]">
                                {tr('authorizingGoogleAccount',{ns:'connections',email:googleCalendarEmail})}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* INITIAL SYNCING STATE VIEW */}
                        {gcalSyncState === 'initial_syncing' && (
                          <div className="p-4 rounded-[12px] bg-blue-500/10 border border-blue-500/25 space-y-2.5 animate-in fade-in">
                            <div className="flex items-center gap-2.5 text-blue-700 dark:text-blue-300">
                              <RefreshCw className="w-4.5 h-4.5 animate-spin shrink-0 text-blue-600 dark:text-blue-400" />
                              <h4 className="text-[14px] font-bold">
                                {tr('initialSynchronization',{ns:'connections'})}
                              </h4>
                            </div>
                            <p className="text-[13px] text-blue-800 dark:text-blue-200 leading-[19px]">
                              {tr('initialSynchronizationDescription',{ns:'connections'})}
                            </p>
                            <p className="text-[11.5px] text-[var(--mroya-text-muted)] pt-1 border-t border-blue-500/20">
                              {tr('initialSynchronizationNote',{ns:'connections'})}
                            </p>
                          </div>
                        )}

                        {/* CONNECTED & SUB-STATES (Auto-off, Auto-on, Syncing, Error, Conflict, Reconnect) */}
                        {isConnected && gcalSyncState !== 'connecting' && (
                          <div className="space-y-4 pt-1">
                            <p className="text-xs text-[var(--mroya-text-muted)] leading-relaxed">{tr('calendarStudyNotice',{ns:'connections'})}</p>
                            {/* Connected Account & Last Synced Display */}
                            <div className="p-3.5 rounded-[10px] bg-[var(--mroya-surface-muted)]/50 border border-[var(--mroya-divider)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] flex items-center justify-center font-bold text-[12px] text-[var(--mroya-primary)] shrink-0">
                                  G
                                </div>
                                <div>
                                  <div className="text-[13px] font-semibold text-[var(--mroya-text)]">
                                    {googleCalendarEmail}
                                  </div>
                                  <div className="text-[11.5px] text-[var(--mroya-text-muted)]">
                                    {tr('connectedGoogleAccount',{ns:'connections'})}
                                  </div>
                                </div>
                              </div>
                              <div className="text-[12px] text-[var(--mroya-text-muted)] sm:text-right">
                                <span className="font-medium text-[var(--mroya-text)]">{tr('lastSynced',{ns:'connections'})}</span> {lastSyncedTime||tr('notYet',{ns:'connections'})}
                              </div>
                            </div>

                            {/* SPECIAL NOTICES & BANNERS */}
                            {gcalSyncState === 'sync_error' && (
                              <div className="p-3.5 rounded-[10px] bg-amber-500/10 border border-amber-500/25 space-y-2 animate-in fade-in">
                                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
                                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                                  <span className="text-[13px] font-bold">{tr('syncErrorTitle',{ns:'connections'})}</span>
                                </div>
                                <p className="text-[12.5px] text-amber-800/90 dark:text-amber-300/90 leading-[18px]">
                                  {live?(googleCalendarNotice||tr('syncProblemFallback',{ns:'connections'})):tr('calendarNetworkErrorFallback',{ns:'connections'})}
                                </p>
                                <div className="pt-1 flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={handleSyncNow}
                                    disabled={googleCalendarBusy}
                                    className="px-3 py-1.5 rounded-[6px] bg-[var(--mroya-surface)] hover:bg-[var(--mroya-surface-muted)] border border-[var(--mroya-divider)] text-[12px] font-semibold text-[var(--mroya-text)] cursor-pointer"
                                  >
                                    {tr('retrySync',{ns:'connections'})}
                                  </button>
                                </div>
                              </div>
                            )}

                            {gcalSyncState === 'conflict' && (
                              <div className="p-3.5 rounded-[10px] bg-amber-500/10 border border-amber-500/25 space-y-2 animate-in fade-in">
                                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
                                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                                  <span className="text-[13px] font-bold">{tr('syncConflictTitle',{ns:'connections'})}</span>
                                </div>
                                <p className="text-[12.5px] text-amber-800/90 dark:text-amber-300/90 leading-[18px]">
                                  {tr('conflictingChangesDescription',{ns:'connections'})}
                                </p>
                                <div className="pt-1">
                                  <span className="text-[12px] text-[var(--mroya-text-muted)]">{tr('noConflictResolution',{ns:'connections'})}</span>
                                </div>
                              </div>
                            )}

                            {gcalSyncState === 'reconnect_required' && (
                              <div className="p-3.5 rounded-[10px] bg-amber-500/10 border border-amber-500/25 space-y-2 animate-in fade-in">
                                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
                                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                                  <span className="text-[13px] font-bold">{tr('reconnectRequired',{ns:'connections'})}</span>
                                </div>
                                <p className="text-[12.5px] text-amber-800/90 dark:text-amber-300/90 leading-[18px]">
                              {tr('googleAuthorizationExpired',{ns:'connections'})}
                                </p>
                                <div className="pt-1">
                                  <button
                                    type="button"
                                    onClick={handleConnectGcal}
                                disabled={googleCalendarBusy}
                                    className="px-3.5 py-1.5 rounded-[8px] bg-[var(--mroya-primary)] hover:bg-[var(--mroya-primary-hover)] text-white text-[12.5px] font-semibold cursor-pointer"
                                  >
                                    {tr('reconnectGoogleCalendar',{ns:'connections'})}
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Sync Result Summary (After completion) */}
                            {syncSummary && canSync && (
                              <div className="p-3 rounded-[10px] bg-[var(--mroya-surface-muted)]/60 border border-[var(--mroya-divider)] flex flex-wrap items-center justify-between gap-2 text-[12.5px]">
                                <div className="flex items-center gap-2 text-[var(--mroya-text)]">
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                  <span>
                                    <strong>{syncSummary.imported}</strong> {tr('eventsImported',{ns:'connections'})} · <strong>{syncSummary.exported}</strong> {tr('eventsExported',{ns:'connections'})}
                                  </span>
                                </div>
                                <span className="text-[11.5px] text-[var(--mroya-text-muted)]">
                                  {tr('lastSyncedValue',{ns:'connections',date:syncSummary.lastSynced})}
                                </span>
                              </div>
                            )}

                            {/* 3. LIST OF GOOGLE CALENDARS FOR IMPORT */}
                            <div className="space-y-2">
                              <label className="block text-[12.5px] font-semibold text-[var(--mroya-text)]">
                                {tr('googleCalendarsToImport',{ns:'connections'})}
                              </label>
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
                            </div>

                            {/* 4. CALENDAR SELECTION FOR EXPORTING MROYA EVENTS */}
                            <div className="space-y-1.5">
                              <label className="block text-[12.5px] font-semibold text-[var(--mroya-text)]">
                                {tr('exportMroyaEventsTo',{ns:'connections'})}
                              </label>
                              <select
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

                            {/* 5. AUTOMATIC SYNC TOGGLE SWITCH (ON / OFF, default OFF) */}
                            <div className="p-3.5 rounded-[10px] bg-[var(--mroya-surface-muted)]/50 border border-[var(--mroya-divider)] flex items-center justify-between gap-4">
                              <div className="space-y-0.5">
                                <div className="text-[13px] font-semibold text-[var(--mroya-text)] flex items-center gap-2">
                                  <span>{tr('automaticSync',{ns:'connections'})}</span>
                                  <span
                                    className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded ${
                                      autoSync
                                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                        : 'bg-[var(--mroya-surface-muted)] text-[var(--mroya-text-muted)] border border-[var(--mroya-divider)]'
                                    }`}
                                  >
                                      {autoSync ? tr('on',{ns:'common'}) : tr('off',{ns:'common'})}
                                  </span>
                                </div>
                                <p className="text-[12px] text-[var(--mroya-text-muted)] leading-[17px]">
                                  {tr('automaticSyncDescription',{ns:'connections'})}
                                </p>
                              </div>
                              <button
                                type="button"
                                role="switch"
                                aria-checked={autoSync}
                                disabled={googleCalendarBusy||(live?selectedConnection?.status!=='connected':!canSync)}
                                onClick={handleToggleAutoSync}
                                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                  autoSync ? 'bg-[var(--mroya-primary)]' : 'bg-[var(--mroya-divider)]'
                                }`}
                              >
                                <span
                                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                                    autoSync ? 'translate-x-5' : 'translate-x-0'
                                  }`}
                                />
                              </button>
                            </div>

                            {/* 6. SYNC NOW & 8. DISCONNECT ACTION BUTTONS */}
                            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-[var(--mroya-divider)]/60">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  disabled={!canSync}
                                  onClick={handleSyncNow}
                                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[8px] bg-[var(--mroya-surface-muted)] hover:bg-[var(--mroya-surface-active)] text-[13px] font-semibold text-[var(--mroya-text)] border border-[var(--mroya-divider)] transition-colors cursor-pointer disabled:opacity-60"
                                >
                                  <RefreshCw className={`w-3.5 h-3.5 ${gcalSyncState === 'syncing' ? 'animate-spin text-[var(--mroya-primary)]' : ''}`} />
                                  <span>{gcalSyncState === 'syncing' ? tr('syncingNow',{ns:'connections'}) : tr('syncNow',{ns:'connections'})}</span>
                                </button>
                                <span className="text-[11.5px] text-[var(--mroya-text-muted)]">
                                  {lastSyncedTime||tr('notYet',{ns:'connections'})}
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={handleDisconnectGcal}
                                disabled={googleCalendarBusy}
                                className="px-3.5 py-1.5 rounded-[8px] text-[12.5px] font-medium text-[var(--mroya-text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer self-start sm:self-center"
                              >
                                {tr('disconnect',{ns:'connections'})}
                              </button>
                            </div>
                            <CalendarAnalysisPanel analysis={calendarAnalysis}/>
                          </div>
                        )}
                        </div>
                      </div>
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
                    <div className="space-y-2">
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
                                    <span>{notifications?.available?tr('serviceUnavailable',{ns:'connections'}):tr('soon',{ns:'connections'})}</span>
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

                    <button
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
                    </button>
                  </div>
                );})}
              </div>

            </div>
          )}

          {activeTab === 'plan' && (
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

          {activeTab === 'profile' && (
            <div className="p-5 sm:p-6 rounded-[12px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] space-y-5">
              {/* Profile identity header */}
              <div className="flex items-center gap-3.5 pb-4 border-b border-[var(--mroya-divider)]">
                <div className="w-12 h-12 rounded-full bg-[var(--mroya-surface-active)] border border-[var(--mroya-divider)] flex items-center justify-center text-[16px] font-semibold text-[var(--mroya-primary)] shrink-0">
                  {account.initials}
                </div>
                <div className="min-w-0">
                  <h2 className="text-[16px] font-semibold text-[var(--mroya-text)] truncate">
                    {account.displayName}
                  </h2>
                  <p className="text-[13px] text-[var(--mroya-text-muted)] truncate">
                    {account.email}{account.description ? ` · ${account.description}` : ''}
                  </p>
                </div>
              </div>

              {/* Nickname section */}
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

              {/* Time zone section */}
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
                    {!timezoneSettings.apiReady&&<p>{tr('timezoneUnavailable',{ns:'connections'})}</p>}
                  </div>}

                <p className="text-[12px] text-[var(--mroya-text-muted)]">
                  {live ? (timezoneSettings?.apiReady?tr('confirmedTimezoneHelp',{ns:'connections'}):tr('timezoneReadOnly',{ns:'connections'})) : tr('timezoneTitle',{ns:'connections'})}
                </p>
              </div>

              {/* Interface language */}
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

              {/* Personal space summary */}
              <div className="pt-3 border-t border-[var(--mroya-divider)] text-[13px]">
                <div className="text-[var(--mroya-text-muted)]">{tr('personalSpace',{ns:'connections'})}</div>
                <div className="font-medium text-[var(--mroya-text)] mt-0.5">
                  {account.spaceDescription || tr('personalSpaceFallback',{ns:'connections'})}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
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

                {/* Chat preview */}
                <div className="pt-4 border-t border-[var(--mroya-divider)] space-y-3">
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
                </div>
              </div>

              <div className="p-5 rounded-[12px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] space-y-4">
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
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
