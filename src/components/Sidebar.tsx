import type { AccountPresentation } from '../types/workspace';
import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  Search,
  MessageSquare,
  Calendar,
  BookOpen,
  Share2,
  Link2,
  PanelLeftClose,
  User,
  CreditCard,
  Settings,
  Sun,
  Moon,
  LogOut,
  X,
  ChevronUp,
  Bell,
} from 'lucide-react';
import { BrandMark } from './BrandMark';
import {
  Conversation,
  NavSection,
  SubscriptionPlan,
  ThemeMode,
} from '../types/mroya';

export interface SidebarProps {
  account: AccountPresentation;
  onSignIn?: () => void;
  onLogout?: () => void;
  live?: boolean;
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  plan: SubscriptionPlan;
  onTogglePlan: () => void;
  onOpenPlanModal: () => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  memoriesCount: number;
  upcomingEventsCount: number;
  pendingRemindersCount: number;
  onOpenSettingsTab: (tab: 'profile' | 'plan' | 'connections' | 'appearance' | 'settings') => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  account, onSignIn, onLogout, live=false,
  activeSection,
  onSelectSection,
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  plan,
  onTogglePlan,
  onOpenPlanModal,
  theme,
  onToggleTheme,
  isCollapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
  memoriesCount,
  upcomingEventsCount,
  pendingRemindersCount,
  onOpenSettingsTab,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [logoutToast, setLogoutToast] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setAccountMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredConversations = conversations.filter((conv) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      conv.title.toLowerCase().includes(q) ||
      conv.messages.some((m) => m.content.toLowerCase().includes(q))
    );
  });

  const groups: ('Today' | 'Previous 7 Days' | 'Earlier in October')[] = [
    'Today',
    'Previous 7 Days',
    'Earlier in October',
  ];

  const navItems: {
    id: NavSection;
    label: string;
    icon: React.FC<{ className?: string }>;
    meta?: string;
  }[] = [
    { id: 'chat', label: 'Chat', icon: MessageSquare },
    {
      id: 'calendar',
      label: 'Calendar',
      icon: Calendar,
      meta: upcomingEventsCount > 0 ? String(upcomingEventsCount) : undefined,
    },
    {
      id: 'reminders',
      label: 'Reminders',
      icon: Bell,
      meta: pendingRemindersCount > 0 ? String(pendingRemindersCount) : undefined,
    },
    {
      id: 'memory',
      label: 'Memory',
      icon: BookOpen,
      meta: String(memoriesCount),
    },
    { id: 'memory-map', label: 'Memory Map', icon: Share2 },
    { id: 'connections', label: 'Connections', icon: Link2 },
  ];

  const sidebarContent = (
    <aside
      aria-label="Primary Sidebar Navigation"
      className="flex flex-col h-full w-[264px] bg-[var(--mroya-surface-muted)] border-r border-[var(--mroya-divider)] text-[var(--mroya-text)] select-none shrink-0"
    >
      {/* Top Header: Brand Mark & Wordmark + Collapse Button */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <button
          type="button"
          onClick={() => {
            onSelectSection('chat');
            onCloseMobile();
          }}
          className="group flex items-center gap-2.5 text-left rounded-xl py-1 px-1.5 -ml-1 hover:bg-[var(--mroya-surface-active)]/50 active:scale-[0.98] transition-all duration-150 cursor-pointer"
          title="Mroya (бел. «мроя») — светлая мара, летуценне і памяць"
        >
          <BrandMark size="md" glow />
          <div className="flex flex-col min-w-0">
            <span className="text-[17.5px] font-bold tracking-[-0.03em] text-[var(--mroya-text)] leading-none group-hover:text-[var(--mroya-primary)] transition-colors whitespace-nowrap">
              Mroya
            </span>
            <span className="text-[9.5px] font-semibold tracking-[0.05em] text-[var(--mroya-text-muted)] leading-tight mt-1 opacity-75 uppercase flex items-center gap-1 whitespace-nowrap">
              <span>мроя</span>
              <span className="w-1 h-1 rounded-full bg-[var(--mroya-brand-honey)] opacity-70" />
              <span>dream · memory</span>
            </span>
          </div>
        </button>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onToggleCollapse}
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
            className="hidden lg:inline-flex items-center justify-center w-8 h-8 rounded-lg text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-active)] transition-colors"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onCloseMobile}
            title="Close navigation"
            aria-label="Close navigation"
            className="lg:hidden inline-flex items-center justify-center w-8 h-8 rounded-lg text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-active)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Prominent + New Chat Action & Search Conversations */}
      <div className="px-3.5 space-y-2.5 pb-3">
        <button
          type="button"
          onClick={() => {
            onNewChat();
            onCloseMobile();
          }}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-full bg-[var(--mroya-primary)] hover:bg-[var(--mroya-primary-hover)] text-[var(--mroya-on-primary)] text-[14px] font-semibold transition-colors shadow-xs cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-4 h-4 stroke-[2.2]" />
          <span>New chat</span>
        </button>

        <div className="relative">
          <Search
            className="w-3.5 h-3.5 text-[var(--mroya-text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            aria-label="Search conversations"
            className="w-full pl-8 pr-7 py-1.5 text-[13px] bg-[var(--mroya-surface)] text-[var(--mroya-text)] placeholder:text-[var(--mroya-text-muted)] border border-[var(--mroya-divider)] focus:border-[var(--mroya-input-outline)] rounded-[8px] transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Primary Navigation */}
      <nav aria-label="Main sections" className="px-2.5 pb-3 border-b border-[var(--mroya-divider)]">
        <ul className="space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    onSelectSection(item.id);
                    onCloseMobile();
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-[8px] text-[14px] transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[var(--mroya-surface-active)] text-[var(--mroya-text)] font-semibold'
                      : 'text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface)]/60 font-medium'
                  }`}
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-[var(--mroya-primary)]' : 'text-[var(--mroya-text-muted)]'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.meta && (
                    <span className="text-[12px] text-[var(--mroya-text-muted)] tabular-nums">
                      {item.meta}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
          {(live || onSignIn) && <li><button type="button" onClick={()=>{onOpenSettingsTab('settings');onCloseMobile();}} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[8px] text-[14px] text-[var(--mroya-text-muted)] hover:bg-[var(--mroya-surface)]"><Settings className="w-4 h-4"/>Settings</button></li>}
        </ul>
      </nav>

      {/* Recent Conversations History */}
      <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4">
        {groups.map((groupName) => {
          const items = filteredConversations.filter((c) => c.group === groupName);
          if (items.length === 0) return null;
          return (
            <div key={groupName}>
              <div className="px-2.5 pb-1.5 text-[12px] font-medium text-[var(--mroya-text-muted)]">
                {groupName}
              </div>
              <ul className="space-y-0.5">
                {items.map((conv) => {
                  const isCurrent =
                    activeSection === 'chat' && activeConversationId === conv.id;
                  return (
                    <li key={conv.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onSelectConversation(conv.id);
                          onSelectSection('chat');
                          onCloseMobile();
                        }}
                        className={`w-full text-left px-2.5 py-2 rounded-[8px] text-[13px] leading-[18px] transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                          isCurrent
                            ? 'bg-[var(--mroya-surface-active)] text-[var(--mroya-text)] font-semibold'
                            : 'text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface)]/50'
                        }`}
                      >
                        <span className="truncate">{conv.title}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}

        {filteredConversations.length === 0 && (
          <div className="px-3 py-6 text-center">
            <p className="text-[13px] text-[var(--mroya-text-muted)]">
              {searchQuery ? <>No conversations matching &ldquo;{searchQuery}&rdquo;</> : 'Your conversations will appear here.'}
            </p>
          </div>
        )}
      </div>

      {/* Bottom Area: User Account Menu */}
      <div className="p-3 border-t border-[var(--mroya-divider)] bg-[var(--mroya-surface-muted)]">
        {/* User Profile & Account Menu Popover */}
        <div className="relative" ref={menuRef}>
          {accountMenuOpen && (
            <div
              role="menu"
              aria-label="Account menu"
              className="absolute bottom-full left-0 right-0 mb-2 py-1.5 rounded-[12px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] shadow-[var(--mroya-shadow-elevated)] z-50"
            >
              <div className="px-3.5 py-2 border-b border-[var(--mroya-divider)]">
                <div className="text-[13px] font-semibold text-[var(--mroya-text)]">
                  {onSignIn ? 'Sign in' : account.displayName}
                </div>
                <div className="text-[12px] text-[var(--mroya-text-muted)] truncate">
                  {account.email} · {plan === 'premium' ? 'Mroya Premium' : 'Free'}
                </div>
              </div>

              <div className="py-1">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setAccountMenuOpen(false);
                    onOpenSettingsTab('profile');
                    onCloseMobile();
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)] transition-colors text-left cursor-pointer"
                >
                  <User className="w-4 h-4 text-[var(--mroya-text-muted)]" />
                  <span>Profile</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setAccountMenuOpen(false);
                    onOpenPlanModal();
                  }}
                  className="w-full flex items-center justify-between px-3.5 py-2 text-[13px] text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)] transition-colors text-left cursor-pointer"
                >
                  <span className="flex items-center gap-2.5">
                    <CreditCard className="w-4 h-4 text-[var(--mroya-text-muted)]" />
                    <span>My plan</span>
                  </span>
                  <span className="text-[12px] text-[var(--mroya-text-muted)]">
                    {plan === 'premium' ? 'Premium' : 'Free'}
                  </span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setAccountMenuOpen(false);
                    onOpenSettingsTab('settings');
                    onCloseMobile();
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)] transition-colors text-left cursor-pointer"
                >
                  <Settings className="w-4 h-4 text-[var(--mroya-text-muted)]" />
                  <span>Settings</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setAccountMenuOpen(false);
                    onSelectSection('connections');
                    onCloseMobile();
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)] transition-colors text-left cursor-pointer"
                >
                  <Link2 className="w-4 h-4 text-[var(--mroya-text-muted)]" />
                  <span>Connected accounts</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onToggleTheme();
                  }}
                  className="w-full flex items-center justify-between px-3.5 py-2 text-[13px] text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)] transition-colors text-left cursor-pointer"
                >
                  <span className="flex items-center gap-2.5">
                    {theme === 'light' ? (
                      <Moon className="w-4 h-4 text-[var(--mroya-text-muted)]" />
                    ) : (
                      <Sun className="w-4 h-4 text-[var(--mroya-text-muted)]" />
                    )}
                    <span>Appearance</span>
                  </span>
                  <span className="text-[12px] text-[var(--mroya-text-muted)] capitalize">
                    {theme} mode
                  </span>
                </button>
              </div>

              <div className="pt-1 border-t border-[var(--mroya-divider)]">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setAccountMenuOpen(false);
                    if (onLogout) {onLogout();return;}
                    if (onSignIn) {onSignIn();return;}
                    setLogoutToast(true);
                    setTimeout(() => setLogoutToast(false), 3000);
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-[var(--mroya-error)] hover:bg-[var(--mroya-surface-muted)] transition-colors text-left cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log out</span>
                </button>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => onSignIn ? onSignIn() : setAccountMenuOpen((prev) => !prev)}
            aria-expanded={accountMenuOpen}
            aria-haspopup="menu"
            className="w-full flex items-center justify-between px-2.5 py-2 rounded-[10px] hover:bg-[var(--mroya-surface-active)] transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-[var(--mroya-surface-active)] border border-[var(--mroya-divider)] flex items-center justify-center text-[13px] font-semibold text-[var(--mroya-primary)] shrink-0">
                {account.initials}
              </div>
              <div className="text-left min-w-0">
                <div className="text-[13px] font-semibold text-[var(--mroya-text)] truncate">
                  {onSignIn ? 'Sign in' : account.displayName}
                </div>
                <div className="text-[11px] text-[var(--mroya-text-muted)] truncate">
                  Personal space
                </div>
              </div>
            </div>
            <ChevronUp
              className={`w-4 h-4 text-[var(--mroya-text-muted)] transition-transform duration-150 ${
                accountMenuOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {logoutToast && (
            <div className="mt-1.5 px-3 py-1.5 rounded-[8px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] text-[12px] text-[var(--mroya-text-muted)]">
              Prototype preview — session stays active.
            </div>
          )}
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      {!isCollapsed && <div className="hidden lg:block h-full shrink-0">{sidebarContent}</div>}

      {/* Mobile Navigation Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-[1px]"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full">{sidebarContent}</div>
        </div>
      )}
    </>
  );
};
