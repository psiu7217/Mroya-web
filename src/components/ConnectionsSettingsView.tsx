import {timezoneChoices} from '../utils/timezones';
import type { AccountPresentation, NotificationPresentation, NotificationPreview, TelegramPresentation, TimezonePresentation, WorkspaceModel } from '../types/workspace';
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
  PanelLeftOpen,
  ChevronDown,
  Brain,
  Calendar as CalendarIcon,
  RefreshCw,
  AlertTriangle,
  AlertCircle,
  RotateCw,
  CheckCircle2,
  ArrowRightLeft,
  ExternalLink,
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

const COMMON_TIMEZONES = [
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { value: 'Europe/London', label: 'Europe/London (GMT / BST)' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin (CET / CEST)' },
  { value: 'Europe/Warsaw', label: 'Europe/Warsaw (CET / CEST)' },
  { value: 'Europe/Stockholm', label: 'Europe/Stockholm (CET / CEST)' },
  { value: 'Europe/Kyiv', label: 'Europe/Kyiv (EET / EEST)' },
  { value: 'Europe/Vilnius', label: 'Europe/Vilnius (EET / EEST)' },
  { value: 'Europe/Minsk', label: 'Europe/Minsk (MSK, UTC+3)' },
  { value: 'Europe/Moscow', label: 'Europe/Moscow (MSK, UTC+3)' },
  { value: 'Europe/Istanbul', label: 'Europe/Istanbul (TRT, UTC+3)' },
  { value: 'Asia/Tbilisi', label: 'Asia/Tbilisi (GET, UTC+4)' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (GST, UTC+4)' },
  { value: 'Asia/Almaty', label: 'Asia/Almaty (UTC+5)' },
  { value: 'Asia/Tashkent', label: 'Asia/Tashkent (UZT, UTC+5)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (SGT, UTC+8)' },
  { value: 'Asia/Hong_Kong', label: 'Asia/Hong_Kong (HKT, UTC+8)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST, UTC+9)' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney (AEST / AEDT)' },
  { value: 'America/New_York', label: 'America/New_York (EST / EDT)' },
  { value: 'America/Chicago', label: 'America/Chicago (CST / CDT)' },
  { value: 'America/Denver', label: 'America/Denver (MST / MDT)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PST / PDT)' },
  { value: 'America/Sao_Paulo', label: 'America/Sao_Paulo (BRT, UTC-3)' },
];

// Public service catalogue only: no fictional account IDs, connection state or user data.
const PLANNED_CONNECTIONS: ServiceConnection[] = [
  {id:'google-calendar',name:'Google Calendar',category:'Calendar & Scheduling',description:'Calendar connections are not available yet.',connected:false,capabilities:[]},
  {id:'telegram',name:'Telegram',category:'Personal text chat',description:'Chat privately with Mroya in Telegram using your existing account.',connected:false,capabilities:['Personal text chat with Mroya','Shared conversation history between Web and Telegram','Shared personal memory','Telegram replies only to messages sent in Telegram']},
  {id:'gmail',name:'Google Mail (Context Forwarding)',category:'Email & Proposals',description:'Email connections are not available yet.',connected:false,capabilities:[]},
];
export interface ConnectionsSettingsViewProps extends Pick<WorkspaceModel,
  'connectionSamples'|'googleCalendarAvailable'|'googleCalendarBusy'|'googleCalendarNotice'|'googleCalendarError'|'googleConnections'|'selectedGoogleConnectionId'|'onSelectGoogleConnection'|'onRefreshGoogleCalendar'|'onConnectAnotherGoogleCalendar'|
  'gcalSyncState'|'autoSync'|'lastSyncedTime'|'syncSummary'|'googleCalendarEmail'|'importedCalendars'|'exportCalendar'|
  'onConnectGoogleCalendar'|'onDisconnectGoogleCalendar'|'onSyncNowGoogleCalendar'|'onToggleAutoSyncGoogleCalendar'|'onSetGcalSyncState'|'onChangeImportedCalendars'|'onChangeExportCalendar'> {
  designIntelligence?:import('../types/workspace').DesignIntelligencePreviews;
  notifications?:NotificationPresentation;
  notificationPreview?:NotificationPreview;
  live?: boolean;
  timezoneSettings?:TimezonePresentation;
  telegram?: TelegramPresentation;
  preferenceSave?: {status:'saved'|'saving'|'unsaved';error:string|null;onRetry:()=>void};
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
  live=false,connectionSamples,timezoneSettings,designIntelligence,notifications,notificationPreview,
  googleCalendarAvailable=false,googleCalendarBusy=false,googleCalendarNotice,googleCalendarError,googleConnections=[],selectedGoogleConnectionId,
  onSelectGoogleConnection,onRefreshGoogleCalendar,onConnectAnotherGoogleCalendar,
  gcalSyncState='disconnected',autoSync=false,lastSyncedTime='',syncSummary=null,googleCalendarEmail='',
  importedCalendars=[],exportCalendar='',onChangeImportedCalendars,onChangeExportCalendar,
  onConnectGoogleCalendar:handleConnectGcal,onDisconnectGoogleCalendar:handleDisconnectGcal,
  onSyncNowGoogleCalendar:handleSyncNow,onToggleAutoSyncGoogleCalendar:handleToggleAutoSync,onSetGcalSyncState,
  telegram,
  preferenceSave,
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
  const [saveStatus, setSaveStatus] = React.useState<string | null>(null);
  const [nicknameSubmitted, setNicknameSubmitted] = React.useState(false);
  const nicknameEdited = React.useRef(false);
  const nicknameStatus = live
    ? nicknameSubmitted && preferenceSave
      ? preferenceSave.status==='saving' ? 'Saving…' : preferenceSave.status==='unsaved' ? 'Not saved' : 'Saved'
      : null
    : saveStatus;

  React.useEffect(() => {
    if (!nicknameEdited.current) setNicknameDraft(account.nickname || '');
  }, [account.nickname]);

  React.useEffect(() => {
    setSelectedTimezone(account.timezone || 'UTC');
  }, [account.timezone]);

  const availableTimezones = React.useMemo(()=>timezoneChoices(account.timezone,timezoneValue,COMMON_TIMEZONES),[account.timezone,timezoneValue]);

  const handleSaveNickname = () => {
    const value = nicknameDraft.trim();
    if (Array.from(value).length > 80) {
      if (live) { setNicknameSubmitted(true); onSaveNickname?.(value); }
      else setSaveStatus('Nickname must be at most 80 characters.');
      return;
    }
    nicknameEdited.current = false;
    setNicknameDraft(value);
    if (live) { setNicknameSubmitted(true); onSaveNickname?.(value); return; }
    onSaveNickname?.(value);
    setSaveStatus('Saved');
    setTimeout(() => setSaveStatus(null), 2000);
  };

  const handleClearNickname = () => {
    nicknameEdited.current = false;
    setNicknameDraft('');
    if (live) { setNicknameSubmitted(true); onClearNickname?.(); return; }
    onClearNickname?.();
    setSaveStatus('Cleared');
    setTimeout(() => setSaveStatus(null), 2000);
  };

  const handleTimezoneChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextTz = e.target.value;
    if(nextTz==='__custom__'){setCustomTimezoneOpen(true);return;}
    setCustomTimezoneOpen(false);setSelectedTimezone(nextTz);
    (onChangeTimezone??timezoneSettings?.onChange)?.(nextTz);
  };

  const notificationBusy=!!notifications&&(notifications.loading||notifications.saving||notifications.testing);
  const notificationStatus=notifications?.loading?'Loading':notifications?.saving?'Saving':notifications?.testing?'Sending'
    :!notifications?.available?'Unavailable'
    :notifications.lastTest&&notifications.lastTestStatus?({pending:'Queued',processing:'Processing',retry:'Retrying',sent:'Delivered',failed:'Failed',cancelled:'Cancelled',expired:'Expired'} as const)[notifications.lastTestStatus]
    :!notifications.enabled?'Disabled':!notifications.connected?'Disconnected':!notifications.configured?'Unavailable':notifications.deliveryReady?'Ready':'NotReady';
  const notificationError=notifications?.error||(notifications?.lastTestStatus==='failed'?'Delivery failed'+(notifications.lastTest?.deliveries[0].error_code?' · '+notifications.lastTest.deliveries[0].error_code:''):null);
  const SourcesPreview=designIntelligence?.Sources,AutonomyPreview=designIntelligence?.Autonomy;
  const visibleConnections = live ? PLANNED_CONNECTIONS : connections;
  const tabs: {
    id: 'connections' | 'profile' | 'plan' | 'appearance' | 'settings';
    label: string;
  }[] = [
    { id: 'connections', label: 'Connected accounts' },
    { id: 'plan', label: 'My plan' },
    { id: 'appearance', label: 'Appearance' },
    { id: 'profile', label: 'Profile' },
    { id: 'settings', label: 'Assistant preferences' },
  ];

  return (
    <div className="flex-1 flex flex-col h-full min-w-0 bg-[var(--mroya-bg)] text-[var(--mroya-text)]">
      {/* Header */}
      <header className="h-[58px] px-4 sm:px-6 border-b border-[var(--mroya-divider)] flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            aria-label="Open navigation"
            className="lg:hidden inline-flex items-center justify-center w-9 h-9 rounded-lg text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)]"
          >
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="text-[16px] font-semibold text-[var(--mroya-text)] truncate">
            Connections & Account
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
            {preferenceSave.status==='saving' && <p role="status">Saving account settings…</p>}
            {preferenceSave.status==='unsaved' && <><p role="alert">These changes are not saved on the server.</p>{preferenceSave.error && <p role="alert" className="text-[var(--mroya-error)]">{preferenceSave.error}</p>}<button type="button" onClick={preferenceSave.onRetry} className="underline mt-2">Retry saving</button></>}
          </div>}
          {activeTab === 'connections' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-[18px] font-semibold text-[var(--mroya-text)]">
                  External services & context sources
                </h2>
                <p className="text-[13px] text-[var(--mroya-text-muted)] mt-0.5">
                  Connect your calendar and messaging channels so Mroya can remember commitments and answer questions with full context.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {visibleConnections.map((conn) => {
                  // Explicit catalogue mapping: Studio and live IDs are deliberately different.
                  const isTelegram=conn.id===(live?'telegram':connectionSamples?.telegramId);
                  const isGoogleCalendar = (!live||googleCalendarAvailable) && conn.id===(live?'google-calendar':connectionSamples?.googleCalendarId);

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
                              <span>Design Mode · Sync state switcher</span>
                            </span>
                            <span className="text-[11px] text-[var(--mroya-text-muted)]">
                              Click any scenario to preview UI
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
                                {st.label}
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
                                  · {conn.category}
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
                                <span>Disconnected</span>
                              </span>
                            )}
                            {gcalSyncState === 'connecting' && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-semibold bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                                <RefreshCw className="w-3 h-3 animate-spin text-blue-600 dark:text-blue-400" />
                                <span>Connecting…</span>
                              </span>
                            )}
                            {gcalSyncState === 'initial_syncing' && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-semibold bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                                <RefreshCw className="w-3 h-3 animate-spin text-blue-600 dark:text-blue-400" />
                                <span>Initial sync in progress</span>
                              </span>
                            )}
                            {gcalSyncState === 'connected_auto_off' && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Connected · Auto-sync OFF</span>
                              </span>
                            )}
                            {gcalSyncState === 'connected_auto_on' && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Connected · Auto-sync ON</span>
                              </span>
                            )}
                            {gcalSyncState === 'syncing' && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-semibold bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                                <RefreshCw className="w-3 h-3 animate-spin text-blue-600 dark:text-blue-400" />
                                <span>Synchronizing…</span>
                              </span>
                            )}
                            {gcalSyncState === 'sync_error' && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                <span>Sync error</span>
                              </span>
                            )}
                            {gcalSyncState === 'conflict' && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                                <AlertCircle className="w-3.5 h-3.5" />
                                <span>Conflict detected</span>
                              </span>
                            )}
                            {gcalSyncState === 'reconnect_required' && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                <span>Reconnect required</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* DISCONNECTED STATE VIEW */}
                        {gcalSyncState === 'disconnected' && (
                          <div className="space-y-4 pt-1 animate-in fade-in duration-150">
                            <p className="text-[13px] text-[var(--mroya-text-muted)] leading-[21px]">
                              Connect your Google Calendar for two-way synchronization with Mroya. Your schedule, client meetings, and deadlines will be cross-referenced automatically while protecting morning deep work before 11:00 AM.
                            </p>
                            <ul className="space-y-1.5">
                              {conn.capabilities.map((cap, i) => (
                                <li
                                  key={i}
                                  className="text-[12.5px] text-[var(--mroya-text)] flex items-center gap-2"
                                >
                                  <Check className="w-3.5 h-3.5 text-[var(--mroya-primary)] shrink-0" />
                                  <span>{cap}</span>
                                </li>
                              ))}
                            </ul>
                            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-[var(--mroya-divider)]/40">
                              <p className="text-[11.5px] text-[var(--mroya-text-muted)]">
                                Local events created in Mroya remain stored securely even when disconnected.
                              </p>
                              <button
                                type="button"
                                onClick={handleConnectGcal}
                                disabled={googleCalendarBusy}
                                className="px-5 py-2.5 rounded-[8px] bg-[var(--mroya-primary)] hover:bg-[var(--mroya-primary-hover)] text-[var(--mroya-on-primary)] text-[13px] font-semibold transition-all cursor-pointer whitespace-nowrap shadow-xs shrink-0 self-start sm:self-center"
                              >
                                Connect Google Calendar
                              </button>
                            </div>
                          </div>
                        )}

                        {live&&<div className="space-y-2">
                          {googleConnections.length>0&&<select aria-label="Google Calendar account" value={selectedGoogleConnectionId??''} disabled={googleCalendarBusy} onChange={e=>onSelectGoogleConnection?.(e.target.value)} className="w-full px-3 py-2 rounded-[8px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] text-[13px] text-[var(--mroya-text)]">
                            {googleConnections.map(account=><option key={account.id} value={account.id}>{account.email||'Google account'} · {account.status}</option>)}
                          </select>}
                          {googleConnections.length>0&&<button disabled={googleCalendarBusy} onClick={onConnectAnotherGoogleCalendar} className="text-[12px] font-semibold text-[var(--mroya-primary)] hover:underline">Connect another Google account</button>}
                          {(googleCalendarBusy||googleCalendarError||googleCalendarNotice)&&<p role={googleCalendarError?'alert':'status'} className="text-[12px] text-[var(--mroya-text-muted)]">
                            {googleCalendarError??(googleCalendarBusy?'Waiting for backend confirmation…':googleCalendarNotice)}
                            <button disabled={googleCalendarBusy} onClick={onRefreshGoogleCalendar} className="ml-3 underline">Check status</button>
                          </p>}
                        </div>}

                        {/* CONNECTING STATE VIEW */}
                        {gcalSyncState === 'connecting' && (
                          <div className="py-6 flex flex-col items-center justify-center text-center space-y-3 animate-in fade-in">
                            <RefreshCw className="w-7 h-7 text-[var(--mroya-primary)] animate-spin" />
                            <div className="space-y-1">
                              <h4 className="text-[14px] font-semibold text-[var(--mroya-text)]">
                                Connecting to Google Calendar…
                              </h4>
                              <p className="text-[12px] text-[var(--mroya-text-muted)]">
                                Authorizing account {googleCalendarEmail} and preparing two-way channel
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
                                Initial synchronization in progress
                              </h4>
                            </div>
                            <p className="text-[13px] text-blue-800 dark:text-blue-200 leading-[19px]">
                              Importing Google Calendar events and exporting your existing Mroya events.
                            </p>
                            <p className="text-[11.5px] text-[var(--mroya-text-muted)] pt-1 border-t border-blue-500/20">
                              A one-time initial synchronization runs automatically after authorization, independent of the Automatic sync setting.
                            </p>
                          </div>
                        )}

                        {/* CONNECTED & SUB-STATES (Auto-off, Auto-on, Syncing, Error, Conflict, Reconnect) */}
                        {isConnected && gcalSyncState !== 'connecting' && (
                          <div className="space-y-4 pt-1">
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
                                    Connected Google Account
                                  </div>
                                </div>
                              </div>
                              <div className="text-[12px] text-[var(--mroya-text-muted)] sm:text-right">
                                <span className="font-medium text-[var(--mroya-text)]">Last synced:</span> {lastSyncedTime||'Not yet'}
                              </div>
                            </div>

                            {/* SPECIAL NOTICES & BANNERS */}
                            {gcalSyncState === 'sync_error' && (
                              <div className="p-3.5 rounded-[10px] bg-amber-500/10 border border-amber-500/25 space-y-2 animate-in fade-in">
                                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
                                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                                  <span className="text-[13px] font-bold">Synchronization error</span>
                                </div>
                                <p className="text-[12.5px] text-amber-800/90 dark:text-amber-300/90 leading-[18px]">
                                  {live?(googleCalendarNotice||'The backend reported a synchronization problem. Check status before retrying.'): 'Unable to reach Google Calendar API (network timeout). Your local Mroya commitments are preserved and safe.'}
                                </p>
                                <div className="pt-1 flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={handleSyncNow}
                                    disabled={googleCalendarBusy}
                                    className="px-3 py-1.5 rounded-[6px] bg-[var(--mroya-surface)] hover:bg-[var(--mroya-surface-muted)] border border-[var(--mroya-divider)] text-[12px] font-semibold text-[var(--mroya-text)] cursor-pointer"
                                  >
                                    Retry sync
                                  </button>
                                </div>
                              </div>
                            )}

                            {gcalSyncState === 'conflict' && (
                              <div className="p-3.5 rounded-[10px] bg-amber-500/10 border border-amber-500/25 space-y-2 animate-in fade-in">
                                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
                                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                                  <span className="text-[13px] font-bold">Sync conflict detected</span>
                                </div>
                                <p className="text-[12.5px] text-amber-800/90 dark:text-amber-300/90 leading-[18px]">
                                  Conflicting changes were detected. Conflict information is retained by the backend; synchronization is paused until resolution. No duplicate events are created automatically.
                                </p>
                                <div className="pt-1">
                                  <span className="text-[12px] text-[var(--mroya-text-muted)]">No conflict-resolution endpoint is connected. Resolve support is not available here.</span>
                                </div>
                              </div>
                            )}

                            {gcalSyncState === 'reconnect_required' && (
                              <div className="p-3.5 rounded-[10px] bg-amber-500/10 border border-amber-500/25 space-y-2 animate-in fade-in">
                                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
                                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                                  <span className="text-[13px] font-bold">Reconnect required</span>
                                </div>
                                <p className="text-[12.5px] text-amber-800/90 dark:text-amber-300/90 leading-[18px]">
                                  Google Calendar authorization credentials expired or were revoked. Reconnect your account to resume automatic syncing.
                                </p>
                                <div className="pt-1">
                                  <button
                                    type="button"
                                    onClick={handleConnectGcal}
                                disabled={googleCalendarBusy}
                                    className="px-3.5 py-1.5 rounded-[8px] bg-[var(--mroya-primary)] hover:bg-[var(--mroya-primary-hover)] text-white text-[12.5px] font-semibold cursor-pointer"
                                  >
                                    Reconnect Google Calendar
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
                                    <strong>{syncSummary.imported}</strong> events imported · <strong>{syncSummary.exported}</strong> events exported
                                  </span>
                                </div>
                                <span className="text-[11.5px] text-[var(--mroya-text-muted)]">
                                  Last synced: {syncSummary.lastSynced}
                                </span>
                              </div>
                            )}

                            {/* 3. LIST OF GOOGLE CALENDARS FOR IMPORT */}
                            <div className="space-y-2">
                              <label className="block text-[12.5px] font-semibold text-[var(--mroya-text)]">
                                Google Calendars to import:
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
                                          {live?(cal.available?'Available'+(cal.read_only?' · Read-only':''):'Unavailable'):('desc' in cal?cal.desc:'')}
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
                                      {importedCalendars.includes(cal.id) ? 'Active' : 'Ignored'}
                                    </span>
                                  </label>
                                ))}
                              </div>
                            </div>

                            {/* 4. CALENDAR SELECTION FOR EXPORTING MROYA EVENTS */}
                            <div className="space-y-1.5">
                              <label className="block text-[12.5px] font-semibold text-[var(--mroya-text)]">
                                Export Mroya events to:
                              </label>
                              <select
                                value={exportCalendar}
                                disabled={!canConfigure}
                                onChange={(e) => onChangeExportCalendar?.(e.target.value)}
                                className="w-full px-3 py-2 rounded-[8px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] text-[13px] text-[var(--mroya-text)] focus:outline-none focus:border-[var(--mroya-primary)] cursor-pointer"
                              >
                                {live&&<option value="">Choose export calendar</option>}
                                {calendars.filter(cal=>cal.available&&!cal.read_only&&(!('exportable' in cal)||cal.exportable)).map(cal=><option key={cal.id} value={cal.id}>{cal.name}</option>)}
                              </select>
                              <p className="text-[11.5px] text-[var(--mroya-text-muted)]">
                                Mroya events use this calendar for export after a successful sync; automatic sync must be enabled for automatic export.
                              </p>
                            </div>

                            {/* 5. AUTOMATIC SYNC TOGGLE SWITCH (ON / OFF, default OFF) */}
                            <div className="p-3.5 rounded-[10px] bg-[var(--mroya-surface-muted)]/50 border border-[var(--mroya-divider)] flex items-center justify-between gap-4">
                              <div className="space-y-0.5">
                                <div className="text-[13px] font-semibold text-[var(--mroya-text)] flex items-center gap-2">
                                  <span>Automatic sync</span>
                                  <span
                                    className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded ${
                                      autoSync
                                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                        : 'bg-[var(--mroya-surface-muted)] text-[var(--mroya-text-muted)] border border-[var(--mroya-divider)]'
                                    }`}
                                  >
                                    {autoSync ? 'ON' : 'OFF'}
                                  </span>
                                </div>
                                <p className="text-[12px] text-[var(--mroya-text-muted)] leading-[17px]">
                                  Automatic sync is OFF by default. It controls continuous background exchange of schedule changes.
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
                                  <span>{gcalSyncState === 'syncing' ? 'Syncing now…' : 'Sync now'}</span>
                                </button>
                                <span className="text-[11.5px] text-[var(--mroya-text-muted)]">
                                  {lastSyncedTime||'Not yet'}
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={handleDisconnectGcal}
                                disabled={googleCalendarBusy}
                                className="px-3.5 py-1.5 rounded-[8px] text-[12.5px] font-medium text-[var(--mroya-text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer self-start sm:self-center"
                              >
                                Disconnect
                              </button>
                            </div>
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
                    ? !state||state.phase==='loading'?'Checking Telegram connection…'
                      : state.phase==='creating'?'Creating Telegram link…'
                      : state.phase==='disconnecting'?'Disconnecting Telegram…'
                      : state.checking?'Checking Telegram connection…'
                      : connected?'Connected'+(state.status?.telegram_username?' (@'+state.status.telegram_username.replace(/^@/,'')+')':'')
                      : state.phase==='expired'?'Link expired'
                      : pending?state.openFallback?'Waiting for Telegram. Open Telegram and press Start, then check connection.':'Waiting for Telegram. Press Start in the Telegram tab, then return to Mroya.'
                      : unavailable?'Telegram connection is temporarily unavailable.'
                      : state.status?'Disconnected':'Telegram connection has not been checked.'
                    : live?'Not available yet':conn.connected?'Connected ('+(conn.accountLabel||'Active in prototype')+')':'Disconnected';
                  const buttonLabel=live&&isTelegram
                    ? !state||busy?'Please wait…':state.error?'Retry':connected?'Disconnect':pending?'Check connection':state.phase==='expired'?'Generate new link':unavailable?'Check connection':'Connect Telegram'
                    :live?'Coming soon':conn.connected?'Disconnect preview':'Connect '+conn.name;
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
                          {conn.name}
                        </span>
                        <span className="text-[12px] text-[var(--mroya-text-muted)]">
                          · {conn.category}
                        </span>
                      </div>
                      <p className="text-[13px] text-[var(--mroya-text-muted)] leading-[20px]">
                        {conn.description}
                      </p>
                      <ul className="space-y-1 pt-1">
                        {conn.capabilities.map((cap, i) => (
                          <li
                            key={i}
                            className="text-[12px] text-[var(--mroya-text)] flex items-center gap-2"
                          >
                            <Check className="w-3.5 h-3.5 text-[var(--mroya-primary)] shrink-0" />
                            <span>{cap}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="text-[12px] text-[var(--mroya-text-muted)] pt-1">
                        {status}
                      </div>
                      {state?.link && state.openFallback && <a href={state.link.url} target="_blank" rel="noopener noreferrer" className="inline-block px-4 py-2 rounded-full text-[13px] font-semibold bg-[var(--mroya-primary)] hover:bg-[var(--mroya-primary-hover)] text-[var(--mroya-on-primary)] whitespace-nowrap">Open Telegram</a>}
                      {state?.link && state.openFallback && <p role="status" className="text-[12px] text-[var(--mroya-text-muted)]">Telegram could not open automatically. Your browser may have blocked the tab. Use Open Telegram to continue.</p>}
                      {state?.error && <p role="alert" className="text-[12px] text-[var(--mroya-error)]">{state.error}</p>}

                      {/* Telegram notifications visual management block */}
                      {isTelegram && (
                        <div className="mt-4 pt-4 border-t border-[var(--mroya-divider)] space-y-3">
                          {/* Design Mode Scenario Toolbar for Notifications */}
                          {!live && notifications?.simulated && notificationPreview && (
                            <div className="p-2.5 rounded-[8px] bg-[var(--mroya-surface-muted)]/70 border border-[var(--mroya-divider)] space-y-1.5">
                              <div className="flex items-center justify-between text-[11px] text-[var(--mroya-text-muted)] font-semibold">
                                <span className="flex items-center gap-1 text-[var(--mroya-brand-honey)]">
                                  <Sparkles className="w-3 h-3" />
                                  <span>Состояния Telegram Notifications:</span>
                                </span>
                                <span className="font-normal opacity-80">Simulation · Переключение для дизайн-ревью</span>
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
                                    {st.label}
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
                                <span>Telegram notifications</span>
                              </h4>
                              <p className="text-[12px] text-[var(--mroya-text-muted)] mt-0.5">
                                Receive notifications from Mroya in Telegram
                              </p>
                            </div>

                            {/* Switch: Notifications */}
                            <label className="flex items-center gap-2 cursor-pointer select-none shrink-0">
                              <span className="text-[12px] font-medium text-[var(--mroya-text)] hidden sm:inline">
                                Notifications
                              </span>
                              <div className="relative inline-flex items-center">
                                <input
                                  type="checkbox"
                                  aria-label="Telegram notifications"
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
                                <span className="text-[var(--mroya-text-muted)]">Статус:</span>
                                {['Loading','Saving','Sending'].includes(notificationStatus) && (
                                  <span className="inline-flex items-center gap-1.5 font-medium text-[var(--mroya-text)]">
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-[var(--mroya-primary)]" />
                                    <span>{notificationStatus==='Saving'?'Saving notification settings…':notificationStatus==='Loading'?'Loading notification settings…':'Sending test notification…'}</span>
                                  </span>
                                )}
                                {notificationStatus === 'Ready' && (
                                  <span className="inline-flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>Ready · Bot connected</span>
                                  </span>
                                )}
                                {['Queued','Processing','Retrying'].includes(notificationStatus) && (
                                  <span className="inline-flex items-center gap-1.5 font-medium text-amber-600 dark:text-amber-400">
                                    <Clock className="w-3.5 h-3.5" />
                                    <span>{notificationStatus}</span>
                                  </span>
                                )}
                                {notificationStatus === 'Delivered' && (
                                  <span className="inline-flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Delivered to Telegram</span>
                                  </span>
                                )}
                                {notificationStatus === 'Failed' && (
                                  <span className="inline-flex items-center gap-1.5 font-medium text-red-600 dark:text-red-400">
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    <span>Delivery failed</span>
                                  </span>
                                )}
                                {notificationStatus === 'Unavailable' && (
                                  <span className="inline-flex items-center gap-1.5 font-medium text-zinc-500">
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                    <span>Service unavailable</span>
                                  </span>
                                )}
                                {['Disabled','Disconnected','NotReady','Cancelled','Expired'].includes(notificationStatus) && (
                                  <span className="inline-flex items-center gap-1.5 font-medium text-[var(--mroya-text-muted)]">
                                    <span>{notificationStatus==='Disabled'?'Notifications disabled':notificationStatus==='Disconnected'?'Telegram disconnected':notificationStatus==='NotReady'?'Delivery not ready':notificationStatus}</span>
                                  </span>
                                )}
                              </div>

                              {/* Compact Refresh and Test Buttons */}
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  title="Refresh status"
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
                                  Send test notification
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
                                  Retry
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

              {!live && SourcesPreview && <SourcesPreview/>}

            </div>
          )}

          {activeTab === 'plan' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-[18px] font-semibold text-[var(--mroya-text)]">
                  {live ? 'Subscription & plan' : 'Subscription & plan preview'}
                </h2>
                <p className="text-[13px] text-[var(--mroya-text-muted)] mt-0.5">
                  {live ? 'Subscription management is not available yet.' : 'Switch between the Free and Mroya Premium states to preview how the interface adapts.'}
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
                      Default tier
                    </div>
                    <h3 className="text-[18px] font-semibold text-[var(--mroya-text)]">
                      Mroya Free
                    </h3>
                    <p className="text-[13px] text-[var(--mroya-text-muted)] leading-[20px]">
                      Natural conversation, personal memory capture, source citations, and calendar scheduling.
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
                    {live ? 'Coming soon' : plan === 'free' ? 'Current active preview (Free)' : 'Preview Free state'}
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
                      <span>For client-facing professionals</span>
                    </div>
                    <h3 className="text-[18px] font-semibold text-[var(--mroya-text)]">
                      Mroya Premium
                    </h3>
                    <p className="text-[13px] text-[var(--mroya-text-muted)] leading-[20px]">
                      Extended long-term relationship recall, multi-account calendar & Telegram sync, and full Memory Map exploration.
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
                    {live ? 'Coming soon' : plan === 'premium'
                      ? 'Current active preview (Premium)'
                      : 'Preview Mroya Premium'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="p-5 rounded-[12px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] space-y-4">
              <div>
                <h2 className="text-[16px] font-semibold text-[var(--mroya-text)]">
                  Theme & visual palette
                </h2>
                <p className="text-[13px] text-[var(--mroya-text-muted)]">
                  Pale Honey Linen & Sand Oat light palette (#FBF8F3) or Deep Wood dark palette (#171513).
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button type="button" onClick={() => onSelectTheme('system')} aria-pressed={theme==='system'} className={`p-4 rounded-[10px] border text-left flex items-center justify-between cursor-pointer ${theme==='system'?'bg-[var(--mroya-surface-active)] border-[var(--mroya-primary)]':'bg-[var(--mroya-surface-muted)] border-[var(--mroya-divider)]'}`}>
                  <div className="flex items-center gap-3"><Monitor className="w-4 h-4 text-[var(--mroya-primary)]"/><div><div className="text-[14px] font-semibold">System theme</div><div className="text-[12px] text-[var(--mroya-text-muted)]">Follow device appearance</div></div></div>{theme==='system'&&<Check className="w-4 h-4 text-[var(--mroya-primary)]"/>}
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
                        Light theme
                      </div>
                      <div className="text-[12px] text-[var(--mroya-text-muted)]">
                        Warm linen #FBF8F3 & honey #7E5301
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
                        Dark theme
                      </div>
                      <div className="text-[12px] text-[var(--mroya-text-muted)]">
                        Deep wood #171513 & warm gold #ECC682
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
                    Nickname
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
                    placeholder="Enter your nickname"
                    className="flex-1 min-w-[200px] rounded-[10px] border border-[var(--mroya-divider)] bg-[var(--mroya-bg)] px-3.5 py-2 text-[13px] text-[var(--mroya-text)] placeholder-[var(--mroya-text-muted)] hover:border-[var(--mroya-primary)]/50 focus:border-[var(--mroya-primary)] focus:outline-none transition-colors"
                  />
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleSaveNickname}
                      className="px-4 py-2 rounded-full text-[13px] font-semibold bg-[var(--mroya-primary)] hover:bg-[var(--mroya-primary-hover)] text-[var(--mroya-on-primary)] transition-colors cursor-pointer"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={handleClearNickname}
                      className="px-3 py-2 rounded-full text-[12px] font-medium text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)] border border-[var(--mroya-divider)] transition-colors cursor-pointer"
                      title="Clear nickname"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <p className="text-[12px] text-[var(--mroya-text-muted)]">
                  How Mroya addresses you in personal conversations and greetings.
                </p>
              </div>

              {/* Time zone section */}
              <div className="space-y-2 pt-3 border-t border-[var(--mroya-divider)]">
                <label htmlFor="mroya-timezone-select" className="block text-[13px] font-semibold text-[var(--mroya-text)]">
                  Time zone
                </label>
                <div className="relative">
                  <select
                    id="mroya-timezone-select"
                    value={timezoneValue}
                    disabled={live&&!timezoneSettings?.apiReady}
                    onChange={handleTimezoneChange}
                    className="w-full appearance-none rounded-[10px] border border-[var(--mroya-divider)] bg-[var(--mroya-bg)] px-3.5 py-2.5 pr-10 text-[13px] text-[var(--mroya-text)] hover:border-[var(--mroya-primary)]/50 focus:border-[var(--mroya-primary)] focus:outline-none transition-colors cursor-pointer"
                  >
                    {!timezoneValue&&<option value="">Not set</option>}
                    {availableTimezones.map((tz) => (
                      <option key={tz.value} value={tz.value} className="bg-[var(--mroya-surface)] text-[var(--mroya-text)]">
                        {tz.label}
                      </option>
                    ))}
                    <option value="__custom__">Other IANA timezone…</option>
                    </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-[var(--mroya-text-muted)]">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                  </div>
                  {customTimezoneOpen&&<div className="flex items-center gap-2">
                    <input aria-label="Custom IANA timezone" value={customTimezone} onChange={event=>setCustomTimezone(event.target.value)} placeholder="e.g. Pacific/Chatham" disabled={live&&!timezoneSettings?.apiReady} className="w-full px-3 py-2 rounded-[8px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] text-[13px] text-[var(--mroya-text)]"/>
                    <button type="button" disabled={!customTimezone.trim()||live&&!timezoneSettings?.apiReady} onClick={()=>{const value=customTimezone.trim();setSelectedTimezone(value);(onChangeTimezone??timezoneSettings?.onChange)?.(value);}} className="px-3 py-2 rounded-[8px] bg-[var(--mroya-primary)] text-[var(--mroya-on-primary)] text-[13px]">Use timezone</button>
                  </div>}
                  {live&&timezoneSettings&&<div aria-live="polite" className="text-[12px] text-[var(--mroya-text-muted)]">
                    {timezoneSettings.status==='saving'&&<p role="status">Saving timezone…</p>}
                    {timezoneSettings.status==='saved'&&timezoneSettings.timezone&&<p role="status">Saved · {timezoneSettings.timezone}</p>}
                    {timezoneSettings.status==='error'&&<><p role="alert">{timezoneSettings.error}</p>{timezoneSettings.apiReady&&<button type="button" onClick={timezoneSettings.onRetry} className="underline mt-2">Retry timezone</button>}</>}
                    {!timezoneSettings.apiReady&&<p>Timezone editing is waiting for the backend API integration. Your existing setting is preserved.</p>}
                  </div>}

                <p className="text-[12px] text-[var(--mroya-text-muted)]">
                  {live ? (timezoneSettings?.apiReady?'Confirmed timezone applies to future events. Existing events keep their original timezone.':'Time zone is read-only until the backend timezone API is connected.') : 'Select your time zone so Mroya can accurately schedule reminders and coordinate calendar events.'}
                </p>
              </div>

              {/* Personal space summary */}
              <div className="pt-3 border-t border-[var(--mroya-divider)] text-[13px]">
                <div className="text-[var(--mroya-text-muted)]">Personal space</div>
                <div className="font-medium text-[var(--mroya-text)] mt-0.5">
                  {account.spaceDescription || 'Personal space'}
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
                      Assistant preferences
                    </h2>
                    <p className="text-[12.5px] text-[var(--mroya-text-muted)] mt-0.5">
                      Configure AI assistant behavior and model reasoning display.
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
                        Show model reasoning
                      </span>
                      <p className="text-[12px] text-[var(--mroya-text-muted)] leading-[18px]">
                        See the model&apos;s reasoning as it is generated, when available. Not all AI models provide visible reasoning.
                      </p>
                    </div>
                  </label>
                </div>

                {/* Chat preview */}
                <div className="pt-4 border-t border-[var(--mroya-divider)] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-[13px] font-semibold text-[var(--mroya-text)]">
                      Chat preview
                    </div>
                    <span className="text-[11.5px] text-[var(--mroya-text-muted)]">
                      {showModelReasoning ? 'Preview with reasoning' : 'Standard preview'}
                    </span>
                  </div>

                  <div className="p-4 rounded-[12px] bg-[var(--mroya-bg)] border border-[var(--mroya-divider)] space-y-3.5">
                    {/* User message example */}
                    <div className="flex flex-col items-end">
                      <div className="max-w-[88%] sm:max-w-[78%] px-3.5 py-2.5 rounded-[14px] rounded-br-[4px] bg-[var(--mroya-surface-active)] border border-[var(--mroya-divider)] text-[13.5px] leading-[21px] text-[var(--mroya-text)] shadow-xs">
                        Запомни, что у меня есть друг Сашка.
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
                            'Пользователь сообщил информацию о друге. Нужно проверить, есть ли этот человек в существующей памяти.',
                            'Перед сохранением нового факта необходимо выполнить поиск.',
                            'Поиск не обнаружил подходящей записи. Можно перейти к созданию нового факта.',
                            'Теперь необходимо сохранить сведения и дождаться подтверждения.',
                          ]}
                          isIllustrativeExample={true}
                          defaultExpanded={true}
                        />
                      )}

                      {/* Final Assistant Response */}
                      <div className="w-full p-3.5 rounded-[12px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] shadow-[var(--mroya-shadow-subtle)] text-[13.5px] leading-[21px] text-[var(--mroya-text)]">
                        Запомнила, что у тебя есть друг Сашка.
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {!live && AutonomyPreview && <AutonomyPreview/>}

              <div className="p-5 rounded-[12px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] space-y-4">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-[var(--mroya-primary)]" />
                  <h2 className="text-[16px] font-semibold text-[var(--mroya-text)]">
                    Memory transparency & control
                  </h2>
                </div>
                <p className="text-[13px] text-[var(--mroya-text-muted)] leading-[20px]">
                  {live ? 'Ask Mroya in chat to update or forget memories. Memory preference controls are not available yet.' : 'Every fact Mroya remembers includes a verifiable source citation and date. You can edit or permanently forget any memory at any time from the Memory section or directly from chat citations.'}
                </p>
                <div className="pt-2 border-t border-[var(--mroya-divider)] flex items-center justify-between text-[13px]">
                  <span className="font-medium text-[var(--mroya-text)]">
                    Show inline &ldquo;Saved to memory&rdquo; confirmations in chat
                  </span>
                  <span className="text-[var(--mroya-primary)] font-semibold">{live ? 'Coming soon' : 'Enabled'}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
