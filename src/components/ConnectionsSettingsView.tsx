import type { AccountPresentation, TelegramPresentation } from '../types/workspace';
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
} from 'lucide-react';
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
export interface ConnectionsSettingsViewProps {
  live?: boolean;
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
}

export const ConnectionsSettingsView: React.FC<ConnectionsSettingsViewProps> = ({
  live=false,
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
}) => {
  const [nicknameDraft, setNicknameDraft] = React.useState(account.nickname || '');
  const [selectedTimezone, setSelectedTimezone] = React.useState(account.timezone || 'UTC');
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

  const availableTimezones = React.useMemo(() => {
    const list = [...COMMON_TIMEZONES];
    if (account.timezone && !list.some((tz) => tz.value === account.timezone || tz.label.startsWith(account.timezone))) {
      list.unshift({ value: account.timezone, label: account.timezone });
    }
    return list;
  }, [account.timezone]);

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
    setSelectedTimezone(nextTz);
    onChangeTimezone?.(nextTz);
  };
  const visibleConnections = live ? PLANNED_CONNECTIONS : connections;
  const tabs: {
    id: 'connections' | 'profile' | 'plan' | 'appearance' | 'settings';
    label: string;
  }[] = [
    { id: 'connections', label: 'Connected accounts' },
    { id: 'plan', label: 'My plan' },
    { id: 'appearance', label: 'Appearance' },
    { id: 'profile', label: 'Profile' },
    { id: 'settings', label: 'Memory preferences' },
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
                  const isTelegram=conn.id===(live?'telegram':'conn-telegram');
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
                    value={live ? account.timezone || '' : selectedTimezone}
                    disabled={live}
                    onChange={handleTimezoneChange}
                    className="w-full appearance-none rounded-[10px] border border-[var(--mroya-divider)] bg-[var(--mroya-bg)] px-3.5 py-2.5 pr-10 text-[13px] text-[var(--mroya-text)] hover:border-[var(--mroya-primary)]/50 focus:border-[var(--mroya-primary)] focus:outline-none transition-colors cursor-pointer"
                  >
                    {live && !account.timezone && <option value="">Not set</option>}
                    {availableTimezones.map((tz) => (
                      <option key={tz.value} value={tz.value} className="bg-[var(--mroya-surface)] text-[var(--mroya-text)]">
                        {tz.label}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-[var(--mroya-text-muted)]">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-[12px] text-[var(--mroya-text-muted)]">
                  {live ? 'Time zone is read-only. Editing is not available yet.' : 'Select your time zone so Mroya can accurately schedule reminders and coordinate calendar events.'}
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
          )}
        </div>
      </div>
    </div>
  );
};
