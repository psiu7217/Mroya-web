import {appendDictation} from '../utils/dictation';
import type {SpeechPresentation} from '../types/speech';
import type {InstallPresentation} from '../types/install';
import type { AccountPresentation, ChatDiagnostics } from '../types/workspace';
import React, { useState, useRef, useEffect } from 'react';
import {
  Menu,
  Download,
  PanelLeftOpen,
  PanelRight,
  Paperclip,
  ArrowUp,
  Check,
  Copy,
  Calendar,
  BookOpen,
  Share2,
  Sparkles,
  Sun,
  Moon,
  MoreHorizontal,
  FileText,
  X,
  Plus,
  User,
  Settings,
  Mic,
  Square,
  Bell,
  AlertTriangle,
  Flag,
  Terminal,
} from 'lucide-react';
import { AssistantMarkdown } from './AssistantMarkdown';
import { BrandMark } from './BrandMark';
import {tr} from '../i18n';
import { ModelReasoningBlock } from './ModelReasoningBlock';
import { ChatActivityTimeline } from './ChatActivityTimeline';
import {
  ChatMessage,
  Conversation,
  ChatAction,
  SubscriptionPlan,
  ThemeMode,
} from '../types/mroya';
import { AiTaskCompletionToast } from './AiTaskCompletionToast';
import { AiTaskConfirmationCard } from './AiTaskConfirmationCard';
import type { AiTasksPresentation } from '../types/aiTasks';

export interface ChatWorkspaceProps {
  speech?: SpeechPresentation;
  install?: InstallPresentation;
  aiTasks?: AiTasksPresentation;
  account: AccountPresentation;
  live?: boolean;
  intro?: React.ReactNode;
  onSignIn?: () => void;
  onUnavailable?: () => void;
  pending?: boolean;
  samples?: {memoryPrompt:string;attachmentName:string;voicePhrases:string[]};
  memoriesCount: number;
  conversation: Conversation | null;
  onSendMessage: (content: string, attachmentName?: string) => void | boolean | Promise<boolean>;
  onCitationClick: (memoryId: string) => void;
  onActionClick: (action: ChatAction) => void;
  addedActionIds: string[];
  isSidebarCollapsed: boolean;
  onExpandSidebar: () => void;
  onOpenMobileMenu: () => void;
  isContextPanelOpen: boolean;
  onToggleContextPanel: () => void;
  plan: SubscriptionPlan;
  onTogglePlan: () => void;
  onOpenPlanModal: () => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onNewChat: () => void;
  onOpenSettingsTab?: (tab: 'profile' | 'plan' | 'connections' | 'appearance' | 'settings') => void;
  diagnostics?:ChatDiagnostics;
  isAdmin?: boolean;
  isThinking?: boolean;
}

export const ChatWorkspace: React.FC<ChatWorkspaceProps> = ({
  speech, install, aiTasks, account, live=false, intro, onSignIn, onUnavailable, pending=false, samples,
  memoriesCount,
  conversation,
  onSendMessage,
  onCitationClick,
  onActionClick,
  addedActionIds,
  isSidebarCollapsed,
  onExpandSidebar,
  onOpenMobileMenu,
  isContextPanelOpen,
  onToggleContextPanel,
  plan,
  onTogglePlan,
  onOpenPlanModal,
  theme,
  onToggleTheme,
  onNewChat,
  onOpenSettingsTab,
  diagnostics,
  isAdmin = true,
  isThinking = false,
}) => {
  const starterSuggestions=[tr('starterRememberMe',{ns:'chat'}),tr('starterUpcoming',{ns:'chat'}),tr('starterRemember',{ns:'chat'})];
  const [input, setInput] = useState('');
  const [attachedFile, setAttachedFile] = useState<string | null>(null);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [mobileUserMenuOpen, setMobileUserMenuOpen] = useState(false);
  const isRecording = speech?.phase === 'recording';
  const voiceBusy = !!speech && speech.phase !== 'idle';
  const recordingSeconds = speech?.seconds ?? 0;
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [localThinking, setLocalThinking] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const tasks = aiTasks?.tasks ?? [];
  const completedToastTask = aiTasks?.completedTask;
  const openTasks = () => aiTasks?.onOpen();
  const activeTasksCount = tasks.filter(t => ['awaiting_review','pending_confirmation','running','queued','needs_clarification'].includes(t.status)).length;
  const hasRunningTasks = tasks.some(t => t.status === 'running');

  const submission = useRef(false), draftRevision = useRef(0);
  const previousChat = useRef(conversation?.id ?? null);

  useEffect(() => {
    const id = conversation?.id ?? null;
    if (id === previousChat.current) return;
    const fromEmpty = previousChat.current === null && id !== null;
    previousChat.current = id;
    if (!fromEmpty) {
      handleCancelRecording();
      draftRevision.current++; setInput(''); setAttachedFile(null); setLocalThinking(false);
    }
    setCopiedMessageId(null); setHeaderMenuOpen(false); setMobileUserMenuOpen(false);
  }, [conversation?.id]);

  const submitMessage = async (content: string, attachmentName?: string) => {
    if (pending || voiceBusy || submission.current) return;
    submission.current = true;
    const revision = draftRevision.current;
    setSubmitting(true); setLocalThinking(true);
    try {
      const accepted = await onSendMessage(content, attachmentName);
      if (accepted === false) { setLocalThinking(false); return; }
      if (revision === draftRevision.current) { setInput(''); setAttachedFile(null); }
    } catch {
      setLocalThinking(false);
    } finally { submission.current = false; setSubmitting(false); }
  };

  useEffect(() => {
    if (conversation?.messages.length) {
      const last = conversation.messages[conversation.messages.length - 1];
      if (last.sender === 'assistant') {
        setLocalThinking(false);
      }
    }
  }, [conversation?.messages]);

  const handleReportIssue = (message:ChatMessage) => diagnostics?.onReport(message);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const headerMenuRef = useRef<HTMLDivElement>(null);
  const mobileUserMenuRef = useRef<HTMLDivElement>(null);
  const copyTimeoutRef = useRef<any>(null);

  const handleCopyMessage = (id: string, text: string) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    } else {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      } catch (e) {}
    }
    if (copyTimeoutRef.current) {
      clearTimeout(copyTimeoutRef.current);
    }
    setCopiedMessageId(id);
    copyTimeoutRef.current = setTimeout(() => {
      setCopiedMessageId(null);
    }, 2000);
  };

  const handleCopyAdminDiagnostics = (message:ChatMessage) => diagnostics?.onCopy(message);

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = () => {
    if (speech) { speech.onStart(); return; }
    if (onSignIn) { onSignIn(); return; }
    onUnavailable?.();
  };
  const handleCancelRecording = () => speech?.onCancel();
  const handleStopAndInsertText = () => speech?.onStop();

  useEffect(() => {
    if (!speech?.text) return;
    draftRevision.current++;
    setInput(previous => appendDictation(previous, speech.text!));
    speech.onInserted();
    textareaRef.current?.focus();
  }, [speech?.text, speech?.onInserted]);

  useEffect(() => () => {
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target as Node)) {
        setHeaderMenuOpen(false);
      }
      if (mobileUserMenuRef.current && !mobileUserMenuRef.current.contains(e.target as Node)) {
        setMobileUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const lastMsg = conversation?.messages && conversation.messages.length > 0 ? conversation.messages[conversation.messages.length - 1] : undefined;
  const isLastUser = lastMsg?.sender === 'user';
  const showThinking = (isThinking || localThinking) && isLastUser;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [conversation?.messages.length, conversation?.id, showThinking]);

  // Auto-resize multiline textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = input.trim();
    if (pending || voiceBusy || (!trimmed && !attachedFile)) return;
    void submitMessage(
      trimmed || `Shared attachment: ${attachedFile}`,
      attachedFile || undefined
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleStarterClick = (promptText: string) => {
    if (promptText === tr('starterRemember',{ns:'chat'})) {
      draftRevision.current++;
      setInput(
        samples?.memoryPrompt ?? tr('starterPromptInput',{ns:'chat'})
      );
      textareaRef.current?.focus();
    } else {
      void submitMessage(promptText);
    }
  };

  const handleAttachSample = () => {
    if (!samples) {onUnavailable?.();return;}
    draftRevision.current++;
    if (attachedFile) {
      setAttachedFile(null);
    } else {
      setAttachedFile(samples.attachmentName);
      textareaRef.current?.focus();
    }
  };

  const hasMessages = conversation && conversation.messages.length > 0;

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 min-w-0 bg-[var(--mroya-bg)] text-[var(--mroya-text)]">
      {/* Compact Workspace Header */}
      <header className="h-[58px] px-4 sm:px-6 border-b border-[var(--mroya-divider)] flex items-center justify-between gap-4 shrink-0 bg-[var(--mroya-surface)] shadow-xs z-20">
        {/* Left: Mobile Burger + Mroya Brand Logo | Desktop Sidebar toggles + Conversation title */}
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Mobile Left: Burger + Mroya Logo right next to it */}
          <div className="flex lg:hidden items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenMobileMenu}
              aria-label={tr('openNavigation',{ns:'common'})}
              className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)] transition-colors cursor-pointer shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={onNewChat}
              className="group flex items-center gap-2 text-left rounded-lg py-1 px-1.5 -ml-1 hover:bg-[var(--mroya-surface-muted)] transition-colors cursor-pointer select-none"
              title={tr('brandMeaning',{ns:'common'})}
            >
              <BrandMark size="sm" glow />
              <div className="flex flex-col min-w-0">
                <span className="text-[16px] font-bold tracking-[-0.02em] text-[var(--mroya-text)] leading-none group-hover:text-[var(--mroya-primary)] transition-colors">
                  Mroya
                </span>
                <span className="text-[8.5px] font-semibold tracking-[0.05em] text-[var(--mroya-text-muted)] leading-tight mt-0.5 opacity-75 uppercase">
                  {tr('brandTagline',{ns:'common'})}
                </span>
              </div>
            </button>
          </div>

          {/* Desktop Left: Conversation title + Personal space indicator */}
          <div className="hidden lg:flex items-center gap-2.5 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-[15px] font-semibold text-[var(--mroya-text)] truncate">
                {conversation ? conversation.title : tr('newChat',{ns:'chat'})}
              </h1>
              <span
                className="text-[var(--mroya-text-muted)]"
                aria-hidden="true"
              >
                ·
              </span>
              <span className="text-[13px] text-[var(--mroya-text-muted)] whitespace-nowrap">
                {tr('personalWorkspace',{ns:'chat'})}
              </span>
            </div>
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-2 shrink-0">
          {install?.showMobile && <button type="button" onClick={install.onInstall}
            aria-label={tr('installApp',{ns:'common'})} title={tr('installApp',{ns:'common'})}
            className="lg:hidden w-9 h-9 rounded-lg inline-flex items-center justify-center text-[var(--mroya-primary)] hover:bg-[var(--mroya-surface-muted)] cursor-pointer">
            <Download className="w-5 h-5"/>
          </button>}
          {/* Mobile AI Tasks Trigger Button */}
          <button
            type="button"
            onClick={openTasks}
            aria-label={tr('taskPanelTitle',{ns:'chat'})}
            title={`${tr('taskPanelTitle',{ns:'chat'})} (${activeTasksCount})`}
            className="relative lg:hidden w-8 h-8 rounded-lg inline-flex items-center justify-center text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)] transition-colors cursor-pointer"
          >
            {hasRunningTasks ? (
              <span className="relative flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-blue-500" />
              </span>
            ) : (
              <Sparkles className="w-4 h-4 text-[var(--mroya-brand-honey)]" />
            )}
            {activeTasksCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                {activeTasksCount}
              </span>
            )}
          </button>

          {/* Mobile Right: User avatar with dropdown containing all menu options */}
          <div className="relative lg:hidden" ref={mobileUserMenuRef}>
            <button
              type="button"
              onClick={() => setMobileUserMenuOpen((prev) => !prev)}
              aria-expanded={mobileUserMenuOpen}
              aria-label={tr('accountOptions',{ns:'chat'})}
              className="w-8 h-8 rounded-full bg-[var(--mroya-surface-active)] border border-[var(--mroya-divider)] flex items-center justify-center text-[12px] font-bold text-[var(--mroya-primary)] hover:opacity-90 transition-opacity cursor-pointer shadow-2xs"
            >
              {account.initials}
            </button>

            {mobileUserMenuOpen && (
              <div
                role="menu"
                aria-label={tr('mobileUserMenu',{ns:'chat'})}
                className="absolute right-0 mt-2 w-64 py-1 rounded-[12px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] shadow-[var(--mroya-shadow-elevated)] z-50 animate-in fade-in zoom-in-95 duration-100"
              >
                {/* User Header */}
                <div className="px-3.5 py-2.5 border-b border-[var(--mroya-divider)] bg-[var(--mroya-surface-muted)]/40 rounded-t-[12px]">
                  <div className="text-[13px] font-semibold text-[var(--mroya-text)]">
                    {account.displayName}
                  </div>
                  <div className="text-[11px] text-[var(--mroya-text-muted)] truncate">
                    {account.email}
                  </div>
                </div>

                {/* Plan Status & Upgrade */}
                <div className="p-2 border-b border-[var(--mroya-divider)]">
                  <div className="flex items-center justify-between px-2.5 py-1.5 rounded-[8px] bg-[var(--mroya-surface-muted)] text-[12px]">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Sparkles className="w-3.5 h-3.5 text-[var(--mroya-brand-honey)] shrink-0" />
                      <span className="font-semibold text-[var(--mroya-text)] truncate">
                        {live ? tr('personalWorkspace',{ns:'chat'}) : plan === 'premium' ? 'Mroya Premium' : tr('freePlan',{ns:'chat'})}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setMobileUserMenuOpen(false);
                        onOpenPlanModal();
                      }}
                      className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[var(--mroya-primary)] text-[var(--mroya-on-primary)] hover:bg-[var(--mroya-primary-hover)] transition-colors cursor-pointer shrink-0"
                    >
                      {plan === 'premium' ? tr('manage',{ns:'chat'}) : tr('upgrade',{ns:'chat'})}
                    </button>
                  </div>
                </div>

                {install && !install.installed && <button type="button" role="menuitem"
                  onClick={() => { setMobileUserMenuOpen(false); install.onInstall(); }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)] text-left cursor-pointer">
                  <Download className="w-4 h-4 text-[var(--mroya-primary)]"/><span>{tr('installApp',{ns:'common'})}</span>
                </button>}
                {/* All Menu Options inside mobile dropdown */}
                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => {
                      setMobileUserMenuOpen(false);
                      onNewChat();
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)] transition-colors text-left cursor-pointer"
                  >
                    <Plus className="w-4 h-4 text-[var(--mroya-text-muted)]" />
                    <span>{tr('newChat',{ns:'chat'})}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMobileUserMenuOpen(false);
                      onToggleContextPanel();
                    }}
                    className="w-full flex items-center justify-between px-3.5 py-2 text-[13px] text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)] transition-colors text-left cursor-pointer"
                  >
                    <span className="flex items-center gap-2.5">
                      <BookOpen className="w-4 h-4 text-[var(--mroya-text-muted)]" />
                      <span>{tr('memoryDetails',{ns:'chat'})}</span>
                    </span>
                    <span className="text-[11px] text-[var(--mroya-text-muted)] font-medium">
                      {isContextPanelOpen ? tr('open',{ns:'chat'}) : tr('closed',{ns:'chat'})}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMobileUserMenuOpen(false);
                      openTasks();
                    }}
                    className="w-full flex items-center justify-between px-3.5 py-2 text-[13px] text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)] transition-colors text-left cursor-pointer"
                  >
                    <span className="flex items-center gap-2.5">
                      <Sparkles className="w-4 h-4 text-[var(--mroya-brand-honey)]" />
                      <span>Задачи AI</span>
                    </span>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[var(--mroya-surface-active)] text-[var(--mroya-text)]">
                      {activeTasksCount}
                    </span>
                  </button>

                  <button
                    type="button"
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
                      <span>{tr('appearance',{ns:'chat'})}</span>
                    </span>
                    <span className="text-[11px] text-[var(--mroya-text-muted)] capitalize font-medium">
                      {tr('themeMode',{ns:'chat',theme})}
                    </span>
                  </button>

                  {onOpenSettingsTab && (
                    <button
                      type="button"
                      onClick={() => {
                        setMobileUserMenuOpen(false);
                        onOpenSettingsTab('settings');
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)] transition-colors text-left cursor-pointer"
                    >
                      <Settings className="w-4 h-4 text-[var(--mroya-text-muted)]" />
                      <span>{tr('settingsAccounts',{ns:'chat'})}</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Desktop Right Controls (hidden on mobile) */}
          <div className="hidden lg:flex items-center gap-2">
            {/* Subscription state indicator & demo switch */}
            {plan === 'free' ? (
              <div className="flex items-center gap-1.5 text-[12px] text-[var(--mroya-text-muted)]">
                <span>{live ? tr('account',{ns:'chat'}) : tr('free',{ns:'chat'})}</span>
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={onOpenPlanModal}
                  className="px-2.5 py-1 rounded-full text-[12px] font-semibold text-[var(--mroya-primary)] hover:bg-[var(--mroya-surface-active)] transition-colors cursor-pointer whitespace-nowrap"
                >
                  {tr('upgrade',{ns:'chat'})}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onOpenPlanModal}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-semibold text-[var(--mroya-text)] bg-[var(--mroya-surface-active)] hover:opacity-90 transition-opacity cursor-pointer whitespace-nowrap"
              >
                <Sparkles className="w-3.5 h-3.5 text-[var(--mroya-brand-honey)]" />
                <span>Mroya Premium</span>
              </button>
            )}

            {/* Theme Switcher */}
            <button
              type="button"
              onClick={onToggleTheme}
              title={theme === 'light' ? tr('switchDark',{ns:'chat'}) : tr('switchLight',{ns:'chat'})}
              aria-label={theme === 'light' ? tr('switchDark',{ns:'chat'}) : tr('switchLight',{ns:'chat'})}
              className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)] transition-colors cursor-pointer"
            >
              {theme === 'light' ? (
                <Moon className="w-4 h-4" />
              ) : (
                <Sun className="w-4 h-4" />
              )}
            </button>

            {/* Background AI Tasks Trigger Button */}
            <button
              type="button"
              onClick={openTasks}
              title={`${tr('taskPanelTitle',{ns:'chat'})} (${activeTasksCount})`}
              aria-label={tr('taskPanelTitle',{ns:'chat'})}
              className="h-8 px-2.5 rounded-lg inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)] transition-colors cursor-pointer"
            >
              {hasRunningTasks ? (
                <span className="relative flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-blue-500" />
                </span>
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-[var(--mroya-brand-honey)]" />
              )}
              <span>{tr('taskPanelTitle',{ns:'chat'})}</span>
              {activeTasksCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10.5px] font-bold bg-blue-500/15 text-blue-700 dark:text-blue-300">
                  {activeTasksCount}
                </span>
              )}
            </button>

            {/* Toggle Contextual Memory Panel */}
            <button
              type="button"
              onClick={onToggleContextPanel}
              title={isContextPanelOpen ? tr('hideMemoryDetails',{ns:'chat'}) : tr('showMemoryDetails',{ns:'chat'})}
              aria-label={tr('toggleMemoryDetails',{ns:'chat'})}
              aria-pressed={isContextPanelOpen}
              className={`h-8 px-2.5 rounded-lg inline-flex items-center gap-1.5 text-[12px] font-medium transition-colors cursor-pointer ${
                isContextPanelOpen
                  ? 'bg-[var(--mroya-surface-active)] text-[var(--mroya-text)]'
                  : 'text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)]'
              }`}
            >
              <PanelRight className="w-4 h-4" />
              <span>{tr('memoryDetails',{ns:'chat'})}</span>
            </button>

            {/* Contextual header menu */}
            <div className="relative" ref={headerMenuRef}>
              <button
                type="button"
                onClick={() => setHeaderMenuOpen((v) => !v)}
                aria-label={tr('conversationOptions',{ns:'chat'})}
                className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)] transition-colors cursor-pointer"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
              {headerMenuOpen && (
                <div className="absolute right-0 mt-1.5 w-52 py-1 rounded-[10px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] shadow-[var(--mroya-shadow-elevated)] z-40">
                  {install && !install.installed && <button type="button"
                    onClick={() => { setHeaderMenuOpen(false); install.onInstall(); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)] text-left cursor-pointer">
                    <Download className="w-3.5 h-3.5 text-[var(--mroya-primary)]"/><span>{tr('installApp',{ns:'common'})}</span>
                  </button>}
                  <button
                    type="button"
                    onClick={() => {
                      setHeaderMenuOpen(false);
                      onNewChat();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)] text-left cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-[var(--mroya-text-muted)]" />
                    <span>{tr('startNewChat',{ns:'chat'})}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setHeaderMenuOpen(false);
                      openTasks();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)] text-left cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[var(--mroya-brand-honey)]" />
                    <span>{tr('taskPanelTitle',{ns:'chat'})} ({activeTasksCount})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setHeaderMenuOpen(false);
                      onToggleContextPanel();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)] text-left cursor-pointer"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-[var(--mroya-text-muted)]" />
                    <span>{isContextPanelOpen ? tr('hideRelatedMemories',{ns:'chat'}) : tr('showRelatedMemories',{ns:'chat'})}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setHeaderMenuOpen(false);
                      onTogglePlan();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)] text-left cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[var(--mroya-brand-honey)]" />
                    <span>
                      {live ? tr('subscriptionUnavailable',{ns:'chat'}) : tr('switchPlanPreview',{ns:'chat',plan:plan === 'free' ? tr('premium',{ns:'chat'}) : tr('free',{ns:'chat'})})}
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Scrollable Conversation Area */}
      <div className="flex-1 min-h-0 min-w-0 overflow-y-auto px-3 sm:px-8 py-5 sm:py-8">
        <div className="max-w-[740px] mx-auto">
          {intro}
          {hasMessages ? (
            <div className="space-y-6 sm:space-y-8 pb-6">
              {conversation.messages.map((msg) => {
                const actionState=diagnostics?.forMessage(msg);
                const reporting=actionState?.reporting===true,reported=actionState?.reported===true,copied=actionState?.copied===true;
                if (msg.sender === 'user') {
                  return (
                    <div key={msg.id} className="flex flex-col items-end">
                      <div className="min-w-0 max-w-[88%] sm:max-w-[78%] px-4 py-3 rounded-[14px] rounded-br-[4px] bg-[var(--mroya-surface-active)] border border-[var(--mroya-divider)] text-[15px] leading-[23px] text-[var(--mroya-text)] shadow-xs">
                        <AssistantMarkdown content={msg.content} variant="user" />
                      </div>
                      <span className="mt-1 text-[11px] text-[var(--mroya-text-muted)] tabular-nums">
                        {msg.timestamp}
                      </span>
                    </div>
                  );
                }

                // Assistant message (Mroya): top header with icon + Mroya, full width response below
                return (
                  <div key={msg.id} className="w-full space-y-2.5 sm:space-y-3">
                    <div className="flex items-center gap-2">
                      <BrandMark size="sm" />
                      <span className="text-[13px] font-semibold text-[var(--mroya-text)]">
                        Mroya
                      </span>
                      {msg.status && msg.status !== 'completed' && (
                        <span
                          role="status"
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                            msg.status === 'failed'
                              ? 'bg-[var(--mroya-surface-muted)] text-[var(--mroya-error)] border border-[var(--mroya-error)]/30'
                              : 'text-[var(--mroya-text-muted)]'
                          }`}
                        >
                          {msg.status === 'failed' && (
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--mroya-error)] shrink-0" />
                          )}
                          {msg.status === 'failed'
                            ? tr('replyFailed',{ns:'chat'})
                            : msg.status === 'streaming'
                            ? tr('receivingReply',{ns:'chat'})
                            : tr('processing',{ns:'chat'})}
                        </span>
                      )}
                    </div>

                      {/* Optional "Saved to memory" quiet acknowledgement */}
                      {msg.savedMemoryNotice && (
                        <div className="inline-flex items-center gap-2 text-[12px] text-[var(--mroya-text-muted)] py-1 px-2.5 rounded-[8px] bg-[var(--mroya-surface-muted)] border border-[var(--mroya-divider)]">
                          <Check className="w-3.5 h-3.5 text-[var(--mroya-primary)] shrink-0" />
                          <span>{msg.savedMemoryNotice.summary}</span>
                          <span aria-hidden="true">·</span>
                          <button
                            type="button"
                            onClick={() =>
                              onCitationClick(msg.savedMemoryNotice!.memoryId)
                            }
                            className="font-semibold text-[var(--mroya-primary)] hover:underline cursor-pointer"
                          >
                            {tr('review',{ns:'chat'})}
                          </button>
                        </div>
                      )}

                      {/* Optional model reasoning block when model provides reasoning */}
                      {msg.timeline?.some(entry=>entry.kind==='tool') ? (
                        <ChatActivityTimeline entries={msg.timeline} isStreaming={msg.status==='streaming'}/>
                      ) : msg.reasoning && (
                        <ModelReasoningBlock
                          reasoning={msg.reasoning}
                          isStreaming={msg.status === 'streaming'}
                          defaultExpanded={true}
                        />
                      )}

                      {/* Primary Assistant Response Card: full width, zero left indent on mobile */}
                      <div className={`w-full p-3.5 sm:p-5 rounded-[12px] bg-[var(--mroya-surface)] border shadow-[var(--mroya-shadow-subtle)] space-y-3.5 ${
                        msg.status === 'failed'
                          ? 'border-[var(--mroya-error)]/40'
                          : 'border-[var(--mroya-divider)]'
                      }`}>
                        {msg.status === 'failed' && (
                          <div className="p-3.5 rounded-[10px] bg-[var(--mroya-surface-muted)]/70 border border-[var(--mroya-error)]/25 space-y-2.5">
                            <div className="flex items-start gap-2.5">
                              <AlertTriangle className="w-4 h-4 text-[var(--mroya-error)] shrink-0 mt-0.5" />
                              <div className="flex-1 min-w-0">
                                <div className="text-[13px] font-semibold text-[var(--mroya-text)]">
                                  {tr('replyFailed',{ns:'chat'})}
                                </div>
                                <p className="text-[12.5px] leading-relaxed text-[var(--mroya-text-muted)] mt-0.5">
                                  {tr('assistantError',{ns:'chat'})}
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2.5 pl-6.5">
                              {(!live || actionState?.available) && <button
                                type="button"
                                onClick={() => handleReportIssue(msg)}
                                disabled={!actionState?.available || reporting || reported}
                                aria-label={tr('reportIssue',{ns:'chat'})}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[7px] text-[12px] font-medium transition-colors cursor-pointer select-none ${
                                  reported
                                    ? 'bg-[var(--mroya-surface-active)] text-[var(--mroya-primary)] border border-[var(--mroya-divider)] cursor-default'
                                    : 'bg-[var(--mroya-surface)] hover:bg-[var(--mroya-surface-active)] text-[var(--mroya-text)] border border-[var(--mroya-divider)] shadow-2xs'
                                }`}
                              >
                                {reporting ? (
                                  <>
                                    <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
                                    <span>{tr('sendingReport',{ns:'chat'})}</span>
                                  </>
                                ) : reported ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 text-[var(--mroya-primary)] shrink-0" />
                                    <span>{tr('reportSent',{ns:'chat'})}</span>
                                  </>
                                ) : (
                                  <>
                                    <Flag className="w-3.5 h-3.5 text-[var(--mroya-text-muted)] shrink-0" />
                                    <span>{tr('reportIssueLabel',{ns:'chat'})}</span>
                                  </>
                                )}
                              </button>}

                              {(live ? actionState?.available : isAdmin) && (
                                <button
                                  type="button"
                                  onClick={() => handleCopyAdminDiagnostics(msg)}
                                  disabled={!actionState?.available || actionState.copying}
                                  title={tr('adminDiagnosticsTitle',{ns:'chat'})}
                                  aria-label={tr('copyDiagnostics',{ns:'chat'})}
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[7px] text-[12px] font-medium transition-colors cursor-pointer select-none ${
                                    copied
                                      ? 'bg-[var(--mroya-surface-active)] text-[var(--mroya-primary)] border border-[var(--mroya-divider)] cursor-default'
                                      : 'bg-[var(--mroya-surface)] hover:bg-[var(--mroya-surface-active)] text-[var(--mroya-text)] border border-[var(--mroya-divider)] shadow-2xs'
                                  }`}
                                >
                                  {copied ? (
                                    <>
                                      <Check className="w-3.5 h-3.5 text-[var(--mroya-primary)] shrink-0" />
                                      <span>{tr('diagnosticsCopied',{ns:'chat'})}</span>
                                    </>
                                  ) : (
                                    <>
                                      <Terminal className="w-3.5 h-3.5 text-[var(--mroya-text-muted)] shrink-0" />
                                      <span>{tr('copyDiagnostics',{ns:'chat'})}</span>
                                    </>
                                  )}
                                </button>
                              )}

                              {reported && (
                                <span className="text-[11px] text-[var(--mroya-text-muted)] animate-in fade-in duration-150">
                                  {tr('thankYouReport',{ns:'chat'})}
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        <AssistantMarkdown content={msg.content} />

                        {msg.signInPrompt && onSignIn && <button type="button" onClick={onSignIn} className="rounded-full px-5 py-2 bg-[var(--mroya-primary)] text-[var(--mroya-on-primary)] text-sm font-medium">{tr('signIn',{ns:'chat'})}</button>}
                        {/* Structured recalled details if present */}
                        {msg.structuredPoints && msg.structuredPoints.length > 0 && (
                          <div className="pt-3 border-t border-[var(--mroya-divider)]/70 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
                            {msg.structuredPoints.map((pt, idx) => (
                              <div key={idx} className="space-y-0.5">
                                <div className="text-[12px] text-[var(--mroya-text-muted)]">
                                  {pt.label}
                                </div>
                                <div className="text-[13px] font-medium text-[var(--mroya-text)] tabular-nums">
                                  {pt.value}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Source References & Follow-up Actions beneath the response */}
                        {((msg.citations && msg.citations.length > 0) ||
                          (msg.actions && msg.actions.length > 0)) && (
                          <div className="pt-3 border-t border-[var(--mroya-divider)]/70 flex flex-wrap items-center justify-between gap-y-2 gap-x-4 text-[12px]">
                            {/* Unboxed metadata citations with typographic separators */}
                            {msg.citations && msg.citations.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1.5 text-[var(--mroya-text-muted)]">
                                {msg.citations.map((cit, i) => (
                                  <React.Fragment key={cit.memoryId + i}>
                                    {i > 0 && <span aria-hidden="true">·</span>}
                                    <button
                                      type="button"
                                      onClick={() => onCitationClick(cit.memoryId)}
                                      className="hover:text-[var(--mroya-primary)] hover:underline transition-colors cursor-pointer tabular-nums"
                                    >
                                      {cit.label}
                                    </button>
                                  </React.Fragment>
                                ))}
                              </div>
                            )}

                            {/* Interactive follow-up actions */}
                            {msg.actions && msg.actions.length > 0 && (
                              <div className="flex flex-wrap items-center gap-2">
                                {msg.actions.map((act) => {
                                  const isAdded = addedActionIds.includes(act.id);
                                  return (
                                    <button
                                      key={act.id}
                                      type="button"
                                      onClick={() => onActionClick(act)}
                                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] text-[12px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                                        isAdded
                                          ? 'bg-[var(--mroya-surface-active)] text-[var(--mroya-primary)]'
                                          : 'bg-[var(--mroya-surface-muted)] hover:bg-[var(--mroya-surface-active)] text-[var(--mroya-primary)]'
                                      }`}
                                    >
                                      {act.type === 'add-calendar' &&
                                        (isAdded ? (
                                          <Check className="w-3.5 h-3.5" />
                                        ) : (
                                          <Calendar className="w-3.5 h-3.5" />
                                        ))}
                                      {act.type === 'view-memory' && (
                                        <BookOpen className="w-3.5 h-3.5" />
                                      )}
                                      {act.type === 'show-memories' && (
                                        <BookOpen className="w-3.5 h-3.5" />
                                      )}
                                      {act.type === 'open-map' && (
                                        <Share2 className="w-3.5 h-3.5" />
                                      )}
                                      {act.type === 'view-reminder' && (
                                        <Bell className="w-3.5 h-3.5" />
                                      )}
                                      {act.type === 'open-calendar-event' && (
                                        <Calendar className="w-3.5 h-3.5" />
                                      )}
                                      <span>
                                        {isAdded && act.type === 'add-calendar'
                                          ? tr('addedCalendarDate',{ns:'chat'})
                                          : act.label}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Prepared task receipts bound to this answer (canonical server data only). */}
                      {live && msg.tasks && msg.tasks.length > 0 && (
                        <AiTaskConfirmationCard
                          tasks={msg.tasks}
                          beginReview={aiTasks?.beginReview}
                          approveTask={aiTasks?.approveTask}
                          revokeTask={aiTasks?.revokeTask}
                          refreshTask={aiTasks?.refreshTask}
                          onEditSubmit={(description, comment) =>
                            onSendMessage(tr('taskEditMessageTemplate',{ns:'chat',description,comment}))
                          }
                        />
                      )}

                      {/* Assistant message footer: Copy icon · Time */}
                      <div className="flex items-center gap-1.5 px-0.5 text-[11px] text-[var(--mroya-text-muted)]">
                        <button
                          type="button"
                          onClick={() => handleCopyMessage(msg.id, msg.content)}
                          aria-label={copiedMessageId === msg.id ? tr('copied',{ns:'common'}) : tr('copyResponse',{ns:'chat'})}
                          title={copiedMessageId === msg.id ? tr('copiedBang',{ns:'chat'}) : tr('copy',{ns:'chat'})}
                          className="inline-flex items-center justify-center p-1 -ml-1 rounded-[6px] text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)] transition-colors cursor-pointer"
                        >
                          {copiedMessageId === msg.id ? (
                            <Check className="w-3.5 h-3.5 text-[var(--mroya-primary)]" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <span aria-hidden="true" className="select-none">·</span>
                        <span className="tabular-nums">{msg.timestamp}</span>
                      </div>
                  </div>
                );
              })}
              {showThinking && (
                <div className="w-full space-y-2.5 sm:space-y-3 animate-in fade-in duration-200">
                  <div className="flex items-center gap-2">
                    <BrandMark size="sm" />
                    <span className="text-[13px] font-semibold text-[var(--mroya-text)]">
                      Mroya
                    </span>
                  </div>

                  <div className="w-fit min-w-[72px] px-4 py-3 rounded-[12px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] shadow-[var(--mroya-shadow-subtle)] flex items-center justify-center">
                    <div role="status" aria-label={tr('thinking',{ns:'chat'})} className="flex items-center gap-1.5 py-0.5">
                      <span className="guest-dot" />
                      <span className="guest-dot" />
                      <span className="guest-dot" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          ) : intro ? null : (
            /* Restrained Empty New Conversation State */
            <div className="min-h-[58vh] flex flex-col items-center justify-center text-center px-4">
              <BrandMark size="lg" glow className="mb-5" />
              <h2
                className="text-[24px] sm:text-[28px] font-semibold tracking-[-0.02em] text-[var(--mroya-text)] mb-2"
                style={{ textWrap: 'balance' }}
              >
                {tr('goodAfternoon',{ns:'chat'})}
              </h2>
              <p className="text-[14px] text-[var(--mroya-text-muted)] max-w-md mb-8">
                {live ? tr('askConversationsRemember',{ns:'chat'}) : tr('askPastConversations',{ns:'chat'})}
              </p>

              {/* 3 Subtle Starter Suggestions */}
              <div className="flex flex-wrap items-center justify-center gap-2.5 max-w-xl">
                {starterSuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => handleStarterClick(suggestion)}
                    className="px-4 py-2.5 rounded-[10px] bg-[var(--mroya-surface)] hover:bg-[var(--mroya-surface-active)] border border-[var(--mroya-divider)] text-[13px] font-medium text-[var(--mroya-text)] transition-colors shadow-2xs cursor-pointer"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Fixed Bottom Message Composer */}
      <div className="px-3 sm:px-8 pb-4 pt-2 bg-[var(--mroya-bg)] shrink-0">
        <div className="max-w-[740px] mx-auto">
          <form
            onSubmit={handleSubmit}
            className="rounded-[12px] bg-[var(--mroya-surface)] border-0 border-none outline-none ring-0 focus-within:border-none focus-within:outline-none focus-within:ring-0 shadow-[var(--mroya-shadow-subtle)] transition-all"
          >
            {/* Optional attached document preview */}
            {attachedFile && (
              <div className="px-3.5 pt-3 pb-1 flex items-center gap-2">
                <div className="inline-flex max-w-full items-center gap-2 px-2.5 py-1 rounded-[8px] bg-[var(--mroya-surface-muted)] border border-[var(--mroya-divider)] text-[12px] text-[var(--mroya-text)]">
                  <FileText className="w-3.5 h-3.5 text-[var(--mroya-primary)]" />
                  <span className="font-medium truncate min-w-0">{attachedFile}</span>
                  <button
                    type="button"
                    onClick={() => setAttachedFile(null)}
                    aria-label={tr('removeAttachment',{ns:'chat'})}
                    className="text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            <div className="px-3.5 pt-3 pb-2">
              <label htmlFor="mroya-chat-composer" className="sr-only">
                {tr('messageLabel',{ns:'chat'})}
              </label>
              <textarea
                id="mroya-chat-composer"
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={(e) => { draftRevision.current++; setInput(e.target.value); }}
                onKeyDown={handleKeyDown}
                placeholder={tr('askPlaceholder',{ns:'chat'})}
                className="w-full resize-none bg-transparent text-[15px] leading-[22px] text-[var(--mroya-text)] placeholder:text-[var(--mroya-text-muted)] border-0 border-none outline-none focus:outline-none focus:border-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 max-h-40"
              />
            </div>

            {isRecording ? (
              /* Active Voice Recording State: Waveform animation + timer + Stop and Cancel actions */
              <div className="p-2.5 sm:p-3 bg-[var(--mroya-surface-active)]/50 rounded-b-[12px] flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-[var(--mroya-divider)]">
                {/* Left: Recording indicator, timer and waveform */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                    </span>
                    <span className="text-[12px] font-semibold text-red-600 dark:text-red-400 tabular-nums font-mono">
                      {formatTime(recordingSeconds)}
                    </span>
                  </div>

                  {/* Animated sound wave bars */}
                  <div className="flex items-center gap-1 h-5 shrink-0" aria-hidden="true">
                    <span className="w-1 bg-[var(--mroya-primary)] rounded-full animate-pulse h-2.5"></span>
                    <span className="w-1 bg-[var(--mroya-primary)] rounded-full animate-bounce h-4"></span>
                    <span className="w-1 bg-[var(--mroya-primary)] rounded-full animate-pulse h-3"></span>
                    <span className="w-1 bg-[var(--mroya-primary)] rounded-full animate-bounce h-5"></span>
                    <span className="w-1 bg-[var(--mroya-primary)] rounded-full animate-pulse h-3.5"></span>
                  </div>

                  {/* Recording hint */}
                  <div className="text-[12px] text-[var(--mroya-text)] truncate min-w-0">
                    <span className="text-[var(--mroya-text-muted)]">{tr('voiceRecording',{ns:'chat'})}</span>
                  </div>
                </div>

                {/* Right: Cancel or stop and transcribe */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={handleCancelRecording}
                    title={tr('cancelRecording',{ns:'chat'})}
                    aria-label={tr('cancelRecording',{ns:'chat'})}
                    className="p-1.5 rounded-lg text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)] transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>

                  {/* Button: Остановить запись (голос в текст без отправки) */}
                  <button
                    type="button"
                    onClick={handleStopAndInsertText}
                    title={tr('stopRecordingInsert',{ns:'chat'})}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--mroya-surface)] hover:bg-[var(--mroya-surface-muted)] border border-[var(--mroya-divider)] text-[12px] font-semibold text-[var(--mroya-text)] transition-colors cursor-pointer shadow-2xs whitespace-nowrap"
                  >
                    <Square className="w-3.5 h-3.5 text-[var(--mroya-primary)] fill-current" />
                    <span>{tr('stop',{ns:'chat'})}</span>
                  </button>
                </div>
              </div>
            ) : voiceBusy ? (
              <div role="status" className="flex items-center justify-between px-3 pb-3 text-[13px] text-[var(--mroya-text-muted)]">
                <span className="animate-pulse">{tr(speech?.phase==='requesting'?'voiceRequesting':'voiceTranscribing',{ns:'chat'})}</span>
                <button type="button" onClick={handleCancelRecording} className="p-2 rounded-lg hover:bg-[var(--mroya-surface-muted)]" aria-label={tr('cancelRecording',{ns:'chat'})}><X className="w-4 h-4" /></button>
              </div>
            ) : (
              /* Normal toolbar: Attach, Voice Mic, Recalling memory hint, Send */
              <div className="flex items-center justify-between px-3 pb-2.5 pt-1">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleAttachSample}
                    title={tr('attachNote',{ns:'chat'})}
                    aria-label={tr('attachNote',{ns:'chat'})}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] text-[12px] font-medium transition-colors cursor-pointer ${
                      attachedFile
                        ? 'bg-[var(--mroya-surface-active)] text-[var(--mroya-primary)]'
                        : 'text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)]'
                    }`}
                  >
                    <Paperclip className="w-4 h-4" />
                    <span className="hidden sm:inline">{tr('attach',{ns:'chat'})}</span>
                  </button>

                  {/* Voice recording button */}
                  <button
                    type="button"
                    onClick={startRecording}
                    disabled={pending || submitting || (!speech && !onSignIn && !onUnavailable)}
                    title={tr('recordVoiceHelp',{ns:'chat'})}
                    aria-label={tr('recordVoice',{ns:'chat'})}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] text-[12px] font-medium text-[var(--mroya-text-muted)] hover:text-[var(--mroya-primary)] hover:bg-[var(--mroya-surface-muted)] transition-colors cursor-pointer"
                  >
                    <Mic className="w-4 h-4 text-[var(--mroya-primary)]" />
                    <span className="hidden sm:inline">{tr('voice',{ns:'chat'})}</span>
                  </button>

                  <span className="text-[12px] text-[var(--mroya-text-muted)] hidden sm:inline pl-1">
                    {tr('recallingMemories',{ns:'chat',count:memoriesCount})}
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={pending || submitting || voiceBusy || (!input.trim() && !attachedFile)}
                  aria-label={tr('sendMessage',{ns:'chat'})}
                  className="w-9 h-9 rounded-full bg-[var(--mroya-primary)] hover:bg-[var(--mroya-primary-hover)] disabled:opacity-35 disabled:pointer-events-none text-[var(--mroya-on-primary)] inline-flex items-center justify-center transition-colors cursor-pointer shrink-0"
                >
                  <ArrowUp className="w-4 h-4 stroke-[2.4]" />
                </button>
              </div>
            )}
            {speech?.error && <div role="alert" className="px-3 pb-3 text-[13px] text-[var(--mroya-text)]">
              {tr(voiceErrorKey(speech.error),{ns:'chat'})}
              <button type="button" onClick={startRecording} className="ml-2 underline text-[var(--mroya-primary)]">{tr('voiceRetry',{ns:'chat'})}</button>
            </div>}
          </form>
        </div>
      </div>

      {/* Floating notification when a background AI task finishes */}
      {completedToastTask && (
        <AiTaskCompletionToast
          task={completedToastTask}
          onOpenDetails={() => {
            aiTasks?.onOpen(completedToastTask.id);
            aiTasks?.onDetails(completedToastTask.id);
            aiTasks?.onDismiss();
          }}
          onDismiss={() => aiTasks?.onDismiss()}
        />
      )}


    </div>
  );
};

function voiceErrorKey(code:string):string {
  if(code==='unsupported')return 'voiceUnsupported';
  if(code==='permission')return 'voicePermission';
  if(code==='speech_rate_limited'||code==='speech_provider_busy')return 'voiceRateLimited';
  if(code==='speech_timeout')return 'voiceTimeout';
  if(code==='speech_empty')return 'voiceEmpty';
  if(code==='audio_too_large'||code==='audio_too_long'||code==='request_too_large')return 'voiceLimit';
  if(code==='speech_not_configured'||code==='http_error')return 'voiceUnavailable';
  if(code==='authentication_required')return 'voiceSignIn';
  if(code==='csrf_failed')return 'voiceCsrf';
  return 'voiceError';
}
