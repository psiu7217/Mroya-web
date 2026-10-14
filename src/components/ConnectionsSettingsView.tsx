import type { AccountPresentation } from '../types/workspace';
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
} from 'lucide-react';
import {
  ServiceConnection,
  SubscriptionPlan,
  ThemeMode,
} from '../types/mroya';

export interface ConnectionsSettingsViewProps {
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
}

export const ConnectionsSettingsView: React.FC<ConnectionsSettingsViewProps> = ({
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
}) => {
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
                {connections.map((conn) => (
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
                        {conn.connected
                          ? `Connected (${conn.accountLabel || 'Active in prototype'})`
                          : 'Disconnected'}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onToggleConnection(conn.id)}
                      className={`px-4 py-2 rounded-full text-[13px] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        conn.connected
                          ? 'bg-[var(--mroya-surface-muted)] hover:bg-[var(--mroya-surface-active)] text-[var(--mroya-text)] border border-[var(--mroya-divider)]'
                          : 'bg-[var(--mroya-primary)] hover:bg-[var(--mroya-primary-hover)] text-[var(--mroya-on-primary)]'
                      }`}
                    >
                      {conn.connected ? 'Disconnect preview' : `Connect ${conn.name}`}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'plan' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-[18px] font-semibold text-[var(--mroya-text)]">
                  Subscription & plan preview
                </h2>
                <p className="text-[13px] text-[var(--mroya-text-muted)] mt-0.5">
                  Switch between the Free and Mroya Premium states to preview how the interface adapts.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Free State Card */}
                <div
                  className={`p-5 rounded-[12px] border flex flex-col justify-between space-y-4 ${
                    plan === 'free'
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
                    onClick={() => onSelectPlan('free')}
                    className={`w-full py-2.5 px-4 rounded-full text-[13px] font-semibold transition-colors cursor-pointer ${
                      plan === 'free'
                        ? 'bg-[var(--mroya-surface-active)] text-[var(--mroya-text)]'
                        : 'bg-[var(--mroya-surface-muted)] hover:bg-[var(--mroya-surface-active)] text-[var(--mroya-text)]'
                    }`}
                  >
                    {plan === 'free' ? 'Current active preview (Free)' : 'Preview Free state'}
                  </button>
                </div>

                {/* Premium State Card */}
                <div
                  className={`p-5 rounded-[12px] border flex flex-col justify-between space-y-4 ${
                    plan === 'premium'
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
                    onClick={() => onSelectPlan('premium')}
                    className={`w-full py-2.5 px-4 rounded-full text-[13px] font-semibold transition-colors cursor-pointer ${
                      plan === 'premium'
                        ? 'bg-[var(--mroya-surface-active)] text-[var(--mroya-text)]'
                        : 'bg-[var(--mroya-primary)] hover:bg-[var(--mroya-primary-hover)] text-[var(--mroya-on-primary)]'
                    }`}
                  >
                    {plan === 'premium'
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
            <div className="p-5 rounded-[12px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] space-y-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-full bg-[var(--mroya-surface-active)] border border-[var(--mroya-divider)] flex items-center justify-center text-[16px] font-semibold text-[var(--mroya-primary)]">
                  {account.initials}
                </div>
                <div>
                  <h2 className="text-[16px] font-semibold text-[var(--mroya-text)]">
                    {account.displayName}
                  </h2>
                  <p className="text-[13px] text-[var(--mroya-text-muted)]">
                    {account.email} · {account.description}
                  </p>
                </div>
              </div>
              <div className="pt-3 border-t border-[var(--mroya-divider)] grid grid-cols-1 sm:grid-cols-2 gap-4 text-[13px]">
                <div>
                  <div className="text-[var(--mroya-text-muted)]">Personal space</div>
                  <div className="font-medium text-[var(--mroya-text)]">
                    {account.spaceDescription}
                  </div>
                </div>
                <div>
                  <div className="text-[var(--mroya-text-muted)]">Time zone</div>
                  <div className="font-medium text-[var(--mroya-text)]">
                    {account.timezone}
                  </div>
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
                Every fact Mroya remembers includes a verifiable source citation and date. You can edit or permanently forget any memory at any time from the Memory section or directly from chat citations.
              </p>
              <div className="pt-2 border-t border-[var(--mroya-divider)] flex items-center justify-between text-[13px]">
                <span className="font-medium text-[var(--mroya-text)]">
                  Show inline &ldquo;Saved to memory&rdquo; confirmations in chat
                </span>
                <span className="text-[var(--mroya-primary)] font-semibold">Enabled</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
