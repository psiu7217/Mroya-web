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
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-react';
import { BrandMark } from './BrandMark';
import {
  ConversationListItem,
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
  conversations: ConversationListItem[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onRenameConversation?: (id: string, newTitle: string) => void | boolean | Promise<boolean>;
  onDeleteConversation?: (id: string) => void | boolean | Promise<boolean>;
  conversationLocked?: boolean;
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
  account,
  onSignIn,
  onLogout,
  live = false,
  activeSection,
  onSelectSection,
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  onRenameConversation,
  onDeleteConversation,
  conversationLocked = false,
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
  const [saving, setSaving] = useState(false);
  const actionPending = useRef(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [logoutToast, setLogoutToast] = useState(false);
  const [openMenuConvId, setOpenMenuConvId] = useState<string | null>(null);
  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [deletingConversation, setDeletingConversation] = useState<ConversationListItem | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);
  const convMenuRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const cancelDeleteBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setAccountMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!openMenuConvId) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (convMenuRef.current && !convMenuRef.current.contains(e.target as Node)) {
        setOpenMenuConvId(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenMenuConvId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openMenuConvId]);

  useEffect(() => {
    if (editingConvId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [editingConvId]);

  useEffect(() => {
    if (!deletingConversation) return;
    cancelDeleteBtnRef.current?.focus();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !actionPending.current) {
        setDeletingConversation(null);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [deletingConversation]);

  const handleStartRename = (conv: ConversationListItem) => {
    setOpenMenuConvId(null);
    setEditingConvId(conv.id);
    setEditingTitle(conv.title);
  };

  const handleSaveRename = async (id: string) => {
    if (actionPending.current || conversationLocked || !editingTitle.trim()) return;
    actionPending.current = true;setSaving(true);
    try {
      if(!onRenameConversation)return;
      const success = await onRenameConversation(id, editingTitle);
      if (success !== false) {setEditingConvId(null);setEditingTitle('');}
    } finally {actionPending.current = false;setSaving(false);}
  };

  const handleCancelRename = () => {
    if(actionPending.current)return;
    setEditingConvId(null);
    setEditingTitle('');
  };

  const handleOpenDelete = (conv: ConversationListItem) => {
    setOpenMenuConvId(null);
    setDeletingConversation(conv);
  };

  const handleConfirmDelete = async () => {
    if (!deletingConversation || actionPending.current || conversationLocked) return;
    actionPending.current = true;setSaving(true);
    try {
      if(!onDeleteConversation)return;
      const success = await onDeleteConversation(deletingConversation.id);
      if(success !== false)setDeletingConversation(null);
    } finally {actionPending.current = false;setSaving(false);}
  };

  const filteredConversations = conversations.filter(conv => conv.title.toLowerCase().includes(searchQuery.trim().toLowerCase()));
  const groups = [...new Set(filteredConversations.map(c => c.group || 'Today'))];

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

  const renderAccountPopover = (isNarrow: boolean) => (
    <div
      role="menu"
      aria-label="Account menu"
      className={`absolute py-1.5 rounded-[12px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] shadow-[var(--mroya-shadow-elevated)] z-50 ${
        isNarrow
          ? 'bottom-0 left-12 w-60 mb-0'
          : 'bottom-full left-0 right-0 mb-2'
      }`}
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
            onOpenSettingsTab('plan');
            onCloseMobile();
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
            onOpenSettingsTab('connections');
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
            if (onLogout) {
              onLogout();
              return;
            }
            if (onSignIn) {
              onSignIn();
              return;
            }
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
  );

  const renderSidebar = (collapsed: boolean) => {
    if (collapsed) {
      return (
        <aside
          aria-label="Primary Sidebar Navigation"
          className="flex flex-col h-full w-[68px] bg-[var(--mroya-surface-muted)] border-r border-[var(--mroya-divider)] text-[var(--mroya-text)] select-none shrink-0"
        >
          {/* Top Header: Brand Mark (Click logo to expand sidebar) */}
          <div className="h-[68px] flex items-center justify-center px-3.5 pt-4 pb-3 shrink-0">
            <button
              type="button"
              onClick={onToggleCollapse}
              className="group flex items-center justify-center rounded-xl py-1 px-1.5 hover:bg-[var(--mroya-surface-active)]/50 active:scale-[0.96] transition-all cursor-ew-resize"
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              <BrandMark size="md" glow />
            </button>
          </div>

          {/* Prominent + New Chat Action & Search (aligned with expanded) */}
          <div className="px-3.5 space-y-2.5 pb-3 flex flex-col items-center shrink-0">
            <button
              type="button"
              onClick={() => {
                if(conversationLocked)return;
              onNewChat();
                onCloseMobile();
              }}
              disabled={conversationLocked}
              title="New chat"
              aria-label="New chat"
              className="w-10 h-10 rounded-full bg-[var(--mroya-primary)] hover:bg-[var(--mroya-primary-hover)] active:scale-[0.96] text-[var(--mroya-on-primary)] flex items-center justify-center transition-all shadow-xs cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4 stroke-[2.2]" />
            </button>

            <button
              type="button"
              onClick={onToggleCollapse}
              title="Search conversations (click to expand)"
              aria-label="Search conversations"
              className="w-10 h-8 rounded-[8px] flex items-center justify-center text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface)] transition-all cursor-pointer border border-transparent hover:border-[var(--mroya-divider)] shrink-0"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>

          {/* Primary Navigation Icons (aligned with expanded) */}
          <nav aria-label="Main sections" className="px-2.5 pb-3 border-b border-[var(--mroya-divider)] w-full shrink-0">
            <ul className="space-y-1 flex flex-col items-center">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <li key={item.id} className="w-full flex justify-center">
                    <button
                      type="button"
                      onClick={() => {
                        if (item.id === 'connections') onOpenSettingsTab('connections');
                        else onSelectSection(item.id);
                        onCloseMobile();
                      }}
                      title={item.label + (item.meta ? ` (${item.meta})` : '')}
                      aria-label={item.label}
                      className={`relative w-10 h-9 rounded-[8px] flex items-center justify-center transition-all cursor-pointer ${
                        isActive
                          ? 'bg-[var(--mroya-surface-active)] text-[var(--mroya-primary)] font-semibold shadow-xs'
                          : 'text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface)]/60'
                      }`}
                    >
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          isActive ? 'text-[var(--mroya-primary)]' : 'text-[var(--mroya-text-muted)]'
                        }`}
                      />
                      {item.meta && (
                        <span
                          className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[var(--mroya-brand-honey)] ring-2 ring-[var(--mroya-surface-muted)]"
                          title={`${item.label}: ${item.meta}`}
                        />
                      )}
                    </button>
                  </li>
                );
              })}

            </ul>
          </nav>

          {/* Empty clickable area between last nav item and user block to expand sidebar */}
          <div
            onClick={onToggleCollapse}
            role="button"
            tabIndex={0}
            title="Click to expand sidebar"
            aria-label="Click to expand sidebar"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onToggleCollapse();
              }
            }}
            className="flex-1 w-full cursor-ew-resize hover:bg-[var(--mroya-surface-active)]/20 transition-colors"
          />

          {/* Bottom Area: User Account Menu (aligned with expanded) */}
          <div className="h-[72px] p-3 border-t border-[var(--mroya-divider)] bg-[var(--mroya-surface-muted)] flex items-center justify-center shrink-0">
            <div className="relative" ref={menuRef}>
              {accountMenuOpen && renderAccountPopover(true)}

              <button
                type="button"
                onClick={() => (onSignIn ? onSignIn() : setAccountMenuOpen((prev) => !prev))}
                aria-expanded={accountMenuOpen}
                aria-haspopup="menu"
                title={onSignIn ? 'Sign in' : account.displayName}
                aria-label={onSignIn ? 'Sign in' : account.displayName}
                className="w-12 h-12 rounded-[10px] flex items-center justify-center hover:bg-[var(--mroya-surface-active)] active:scale-[0.96] transition-colors cursor-pointer"
              >
                <div className="w-8 h-8 rounded-full bg-[var(--mroya-surface-active)] border border-[var(--mroya-divider)] flex items-center justify-center text-[13px] font-semibold text-[var(--mroya-primary)] shrink-0">
                  {account.initials || <User className="w-4 h-4 text-[var(--mroya-primary)]" />}
                </div>
              </button>

              {logoutToast && (
                <div className="absolute bottom-full left-12 mb-2 w-48 px-3 py-1.5 rounded-[8px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] text-[12px] text-[var(--mroya-text-muted)] shadow-[var(--mroya-shadow-elevated)] z-50">
                  Prototype preview — session stays active.
                </div>
              )}
            </div>
          </div>
        </aside>
      );
    }

    return (
      <aside
        aria-label="Primary Sidebar Navigation"
        className="flex flex-col h-full w-[264px] bg-[var(--mroya-surface-muted)] border-r border-[var(--mroya-divider)] text-[var(--mroya-text)] select-none shrink-0"
      >
        {/* Top Header: Brand Mark & Wordmark + Collapse Button */}
        <div className="h-[68px] flex items-center justify-between px-4 pt-4 pb-3 shrink-0">
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
              className="hidden lg:inline-flex items-center justify-center w-8 h-8 rounded-lg text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-active)] transition-colors cursor-pointer"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onCloseMobile}
              title="Close navigation"
              aria-label="Close navigation"
              className="lg:hidden inline-flex items-center justify-center w-8 h-8 rounded-lg text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-active)] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Prominent + New Chat Action & Search Conversations */}
        <div className="px-3.5 space-y-2.5 pb-3 shrink-0">
          <button
            type="button"
            disabled={conversationLocked}
            onClick={() => {
              if(conversationLocked)return;
              onNewChat();
              onCloseMobile();
            }}
            className="w-full h-10 flex items-center justify-center gap-2 px-4 rounded-full bg-[var(--mroya-primary)] hover:bg-[var(--mroya-primary-hover)] active:scale-[0.98] text-[var(--mroya-on-primary)] text-[14px] font-semibold transition-all shadow-xs cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4 stroke-[2.2]" />
            <span>New chat</span>
          </button>

          <div className="relative h-8">
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
              className="w-full h-8 pl-8 pr-7 py-1 text-[13px] bg-[var(--mroya-surface)] text-[var(--mroya-text)] placeholder:text-[var(--mroya-text-muted)] border border-[var(--mroya-divider)] focus:border-[var(--mroya-input-outline)] rounded-[8px] transition-colors"
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
        <nav aria-label="Main sections" className="px-2.5 pb-3 border-b border-[var(--mroya-divider)] shrink-0">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (item.id === 'connections') onOpenSettingsTab('connections');
                        else onSelectSection(item.id);
                      onCloseMobile();
                    }}
                    className={`w-full h-9 flex items-center justify-between px-3 rounded-[8px] text-[14px] transition-colors cursor-pointer ${
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

          </ul>
        </nav>

        {/* Recent Conversations History */}
        <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4">
          {Array.from(
            new Set([...groups, ...filteredConversations.map((c) => c.group || 'Today')])
          ).map((groupName) => {
            const items = filteredConversations.filter(
              (c) => (c.group || 'Today') === groupName
            );
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
                    const isEditing = editingConvId === conv.id;
                    const isMenuOpen = openMenuConvId === conv.id;

                    if (isEditing) {
                      return (
                        <li key={conv.id} className="py-0.5">
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              handleSaveRename(conv.id);
                            }}
                            className="p-1.5 rounded-[8px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] shadow-xs space-y-1.5"
                          >
                            <input
                              ref={renameInputRef}
                              type="text"
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Escape') {
                                  e.stopPropagation();
                                  handleCancelRename();
                                }
                              }}
                              aria-label="Conversation title"
                              className="w-full h-7 px-2 text-[13px] bg-transparent text-[var(--mroya-text)] border border-[var(--mroya-divider)] focus:border-[var(--mroya-primary)] rounded-[6px] outline-none transition-colors"
                            />
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={handleCancelRename}
                                disabled={saving}
                                className="h-6 px-2 rounded-[5px] border border-[var(--mroya-divider)] hover:bg-[var(--mroya-surface-muted)] text-[11.5px] font-medium text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] transition-colors cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                disabled={saving || conversationLocked || !editingTitle.trim()}
                                className="h-6 px-2.5 rounded-[5px] bg-[var(--mroya-primary)] hover:bg-[var(--mroya-primary-hover)] text-[var(--mroya-on-primary)] text-[11.5px] font-semibold transition-colors cursor-pointer disabled:opacity-40"
                              >
                                {saving ? 'Saving…' : 'Save'}
                              </button>
                            </div>
                          </form>
                        </li>
                      );
                    }

                    return (
                      <li key={conv.id} className="relative group/conv">
                        <div
                          className={`relative w-full flex items-center justify-between rounded-[8px] transition-colors ${
                            isCurrent
                              ? 'bg-[var(--mroya-surface-active)] text-[var(--mroya-text)] font-semibold'
                              : 'text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface)]/50'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              if(conversationLocked)return;
                              onSelectConversation(conv.id);
                              onSelectSection('chat');
                              onCloseMobile();
                            }}
                            disabled={conversationLocked}
                            className="flex-1 min-w-0 text-left px-2.5 py-2 text-[13px] leading-[18px] cursor-pointer focus:outline-none"
                          >
                            <span className="truncate block">{conv.title}</span>
                          </button>

                          {/* Subtle three-dot menu trigger */}
                          <div className="relative shrink-0 flex items-center pr-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuConvId(isMenuOpen ? null : conv.id);
                              }}
                              aria-label={`Options for ${conv.title}`}
                              aria-haspopup="menu"
                              aria-expanded={isMenuOpen}
                              title="Conversation options"
                              className={`p-1 rounded-[6px] transition-all cursor-pointer ${
                                isMenuOpen
                                  ? 'opacity-100 bg-[var(--mroya-surface-muted)] text-[var(--mroya-text)]'
                                  : 'opacity-0 group-hover/conv:opacity-100 focus:opacity-100 max-lg:opacity-75 hover:bg-[var(--mroya-surface-muted)] text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)]'
                              }`}
                            >
                              <MoreHorizontal className="w-3.5 h-3.5" />
                            </button>

                            {/* Dropdown Menu */}
                            {isMenuOpen && (
                              <div
                                ref={convMenuRef}
                                role="menu"
                                aria-label="Conversation actions"
                                className="absolute right-0 top-full mt-1 w-32 py-1 rounded-[10px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] shadow-[var(--mroya-shadow-elevated)] z-50 animate-in fade-in zoom-in-95 duration-100"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if(!conversationLocked)handleStartRename(conv);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)] transition-colors text-left cursor-pointer"
                                >
                                  <Pencil className="w-3.5 h-3.5 text-[var(--mroya-text-muted)] shrink-0" />
                                  <span>Rename</span>
                                </button>
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if(!conversationLocked)handleOpenDelete(conv);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-[var(--mroya-error)] hover:bg-[var(--mroya-surface-muted)] transition-colors text-left cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-[var(--mroya-error)] shrink-0" />
                                  <span>Delete</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
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
                {searchQuery ? (
                  <>No conversations matching &ldquo;{searchQuery}&rdquo;</>
                ) : (
                  'Your conversations will appear here.'
                )}
              </p>
            </div>
          )}
        </div>

        {/* Bottom Area: User Account Menu */}
        <div className="h-[72px] p-3 border-t border-[var(--mroya-divider)] bg-[var(--mroya-surface-muted)] flex items-center shrink-0">
          {/* User Profile & Account Menu Popover */}
          <div className="relative w-full" ref={menuRef}>
            {accountMenuOpen && renderAccountPopover(false)}

            <button
              type="button"
              onClick={() => (onSignIn ? onSignIn() : setAccountMenuOpen((prev) => !prev))}
              aria-expanded={accountMenuOpen}
              aria-haspopup="menu"
              className="w-full h-12 flex items-center justify-between px-2.5 rounded-[10px] hover:bg-[var(--mroya-surface-active)] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-[var(--mroya-surface-active)] border border-[var(--mroya-divider)] flex items-center justify-center text-[13px] font-semibold text-[var(--mroya-primary)] shrink-0">
                  {account.initials || <User className="w-4 h-4 text-[var(--mroya-primary)]" />}
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
  };

  return (
    <>
      {/* Desktop Persistent Sidebar (expanded 264px or collapsed 68px rail with main icons) */}
      <div className="hidden lg:block h-full shrink-0">
        {renderSidebar(isCollapsed)}
      </div>

      {/* Mobile Navigation Drawer (always full width when open) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-[1px]"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full">{renderSidebar(false)}</div>
        </div>
      )}

      {/* Delete Conversation Confirmation Dialog */}
      {deletingConversation && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-chat-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => {if(!actionPending.current)setDeletingConversation(null);}}
        >
          <div
            className="w-full max-w-[420px] rounded-[14px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] p-5 sm:p-6 shadow-[var(--mroya-shadow-elevated)] space-y-4 animate-in zoom-in-95 duration-150 text-[var(--mroya-text)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <h3
                  id="delete-chat-dialog-title"
                  className="text-[16px] font-semibold text-[var(--mroya-text)] tracking-[-0.01em]"
                >
                  Delete conversation?
                </h3>
                <p className="text-[12px] text-[var(--mroya-text-muted)] truncate max-w-[300px]">
                  {deletingConversation.title}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {if(!actionPending.current)setDeletingConversation(null);}}
                aria-label="Close dialog"
                className="p-1 rounded-[6px] text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[13.5px] leading-[20px] text-[var(--mroya-text-muted)]">
              Permanently delete this chat and all its messages? This cannot be undone. Your saved memories will not be affected.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                ref={cancelDeleteBtnRef}
                onClick={() => {if(!actionPending.current)setDeletingConversation(null);}}
                className="px-3.5 py-2 rounded-[8px] border border-[var(--mroya-divider)] bg-[var(--mroya-surface)] hover:bg-[var(--mroya-surface-muted)] text-[13px] font-medium text-[var(--mroya-text)] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving || conversationLocked}
                onClick={handleConfirmDelete}
                className="px-3.5 py-2 rounded-[8px] bg-[var(--mroya-error)] hover:opacity-90 active:scale-[0.98] text-white text-[13px] font-semibold transition-all cursor-pointer shadow-2xs"
              >
                {saving ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
