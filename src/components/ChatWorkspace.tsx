import type { AccountPresentation } from '../types/workspace';
import React, { useState, useRef, useEffect } from 'react';
import {
  Menu,
  PanelLeftOpen,
  PanelRight,
  Paperclip,
  ArrowUp,
  Check,
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
} from 'lucide-react';
import { BrandMark } from './BrandMark';
import {
  Conversation,
  ChatAction,
  SubscriptionPlan,
  ThemeMode,
} from '../types/mroya';

export interface ChatWorkspaceProps {
  account: AccountPresentation;
  live?: boolean;
  intro?: React.ReactNode;
  onSignIn?: () => void;
  onUnavailable?: () => void;
  pending?: boolean;
  samples?: {memoryPrompt:string;attachmentName:string;voicePhrases:string[]};
  memoriesCount: number;
  conversation: Conversation | null;
  onSendMessage: (content: string, attachmentName?: string) => void;
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
}

const STARTER_SUGGESTIONS = [
  'What do you remember about me?',
  "What's coming up this week?",
  'Remember something important',
];

export const ChatWorkspace: React.FC<ChatWorkspaceProps> = ({
  account, live=false, intro, onSignIn, onUnavailable, pending=false, samples,
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
}) => {
  const [input, setInput] = useState('');
  const [attachedFile, setAttachedFile] = useState<string | null>(null);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [mobileUserMenuOpen, setMobileUserMenuOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState('');

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const headerMenuRef = useRef<HTMLDivElement>(null);
  const mobileUserMenuRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const timerIntervalRef = useRef<any>(null);

  const sampleVoicePhrases = samples?.voicePhrases ?? [];
  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = () => {
    if (onUnavailable) {onUnavailable();return;}
    setIsRecording(true);
    setRecordingSeconds(0);
    setLiveTranscript('');

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    timerIntervalRef.current = setInterval(() => {
      setRecordingSeconds((prev) => prev + 1);
    }, 1000);

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'ru-RU,en-US';

        recognition.onresult = (event: any) => {
          let current = '';
          for (let i = 0; i < event.results.length; i++) {
            current += event.results[i][0].transcript;
          }
          if (current.trim()) {
            setLiveTranscript(current);
          }
        };

        recognition.onerror = () => {
          // Keep graceful simulated transcription if permission blocked
        };

        recognition.start();
        recognitionRef.current = recognition;
      } catch (err) {
        console.warn('SpeechRecognition init error:', err);
      }
    }
  };

  const stopRecordingInternal = (): string => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
      recognitionRef.current = null;
    }
    setIsRecording(false);

    const finalPhrase =
      liveTranscript.trim() ||
      sampleVoicePhrases[Math.floor(Math.random() * sampleVoicePhrases.length)];
    setLiveTranscript('');
    setRecordingSeconds(0);
    return finalPhrase;
  };

  const handleStopAndInsertText = () => {
    const text = stopRecordingInternal();
    if (text) {
      setInput((prev) => (prev ? `${prev} ${text}` : text));
      textareaRef.current?.focus();
    }
  };

  const handleStopAndSend = () => {
    const text = stopRecordingInternal();
    if (text.trim()) {
      onSendMessage(text.trim());
      setInput('');
      setAttachedFile(null);
    }
  };

  const handleCancelRecording = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
      recognitionRef.current = null;
    }
    setIsRecording(false);
    setLiveTranscript('');
    setRecordingSeconds(0);
  };

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
    };
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [conversation?.messages.length, conversation?.id]);

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
    if (pending || (!trimmed && !attachedFile)) return;
    onSendMessage(
      trimmed || `Shared attachment: ${attachedFile}`,
      attachedFile || undefined
    );
    setInput('');
    setAttachedFile(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleStarterClick = (promptText: string) => {
    if (promptText === 'Remember something important') {
      setInput(
        samples?.memoryPrompt ?? 'Remember that '
      );
      textareaRef.current?.focus();
    } else {
      onSendMessage(promptText);
    }
  };

  const handleAttachSample = () => {
    if (!samples) {onUnavailable?.();return;}
    if (attachedFile) {
      setAttachedFile(null);
    } else {
      setAttachedFile(samples.attachmentName);
      textareaRef.current?.focus();
    }
  };

  const hasMessages = conversation && conversation.messages.length > 0;

  return (
    <div className="flex-1 flex flex-col h-full min-w-0 bg-[var(--mroya-bg)] text-[var(--mroya-text)]">
      {/* Compact Workspace Header */}
      <header className="h-[58px] px-4 sm:px-6 border-b border-[var(--mroya-divider)] flex items-center justify-between gap-4 shrink-0 bg-[var(--mroya-surface)] shadow-xs z-20">
        {/* Left: Mobile Burger + Mroya Brand Logo | Desktop Sidebar toggles + Conversation title */}
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Mobile Left: Burger + Mroya Logo right next to it */}
          <div className="flex lg:hidden items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenMobileMenu}
              aria-label="Open navigation menu"
              className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)] transition-colors cursor-pointer shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={onNewChat}
              className="group flex items-center gap-2 text-left rounded-lg py-1 px-1.5 -ml-1 hover:bg-[var(--mroya-surface-muted)] transition-colors cursor-pointer select-none"
              title="Mroya (бел. «мроя») — светлая мара, летуценне і памяць"
            >
              <BrandMark size="sm" glow />
              <div className="flex flex-col min-w-0">
                <span className="text-[16px] font-bold tracking-[-0.02em] text-[var(--mroya-text)] leading-none group-hover:text-[var(--mroya-primary)] transition-colors">
                  Mroya
                </span>
                <span className="text-[8.5px] font-semibold tracking-[0.05em] text-[var(--mroya-text-muted)] leading-tight mt-0.5 opacity-75 uppercase">
                  мроя · dream & memory
                </span>
              </div>
            </button>
          </div>

          {/* Desktop Left: Sidebar collapse toggle + Conversation title + Personal space indicator */}
          <div className="hidden lg:flex items-center gap-2.5 min-w-0">
            {isSidebarCollapsed && (
              <button
                type="button"
                onClick={onExpandSidebar}
                title="Expand sidebar"
                aria-label="Expand sidebar"
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)] transition-colors cursor-pointer"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
            )}

            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-[15px] font-semibold text-[var(--mroya-text)] truncate">
                {conversation ? conversation.title : 'New chat'}
              </h1>
              <span
                className="text-[var(--mroya-text-muted)]"
                aria-hidden="true"
              >
                ·
              </span>
              <span className="text-[13px] text-[var(--mroya-text-muted)] whitespace-nowrap">
                Personal space
              </span>
            </div>
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Mobile Right: User avatar with dropdown containing all menu options */}
          <div className="relative lg:hidden" ref={mobileUserMenuRef}>
            <button
              type="button"
              onClick={() => setMobileUserMenuOpen((prev) => !prev)}
              aria-expanded={mobileUserMenuOpen}
              aria-label="User account and options"
              className="w-8 h-8 rounded-full bg-[var(--mroya-surface-active)] border border-[var(--mroya-divider)] flex items-center justify-center text-[12px] font-bold text-[var(--mroya-primary)] hover:opacity-90 transition-opacity cursor-pointer shadow-2xs"
            >
              {account.initials}
            </button>

            {mobileUserMenuOpen && (
              <div
                role="menu"
                aria-label="Mobile user menu"
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
                        {live ? 'Personal workspace' : plan === 'premium' ? 'Mroya Premium' : 'Free Plan'}
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
                      {plan === 'premium' ? 'Manage' : 'Upgrade'}
                    </button>
                  </div>
                </div>

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
                    <span>New chat</span>
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
                      <span>Memory details</span>
                    </span>
                    <span className="text-[11px] text-[var(--mroya-text-muted)] font-medium">
                      {isContextPanelOpen ? 'Open' : 'Closed'}
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
                      <span>Appearance</span>
                    </span>
                    <span className="text-[11px] text-[var(--mroya-text-muted)] capitalize font-medium">
                      {theme} mode
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
                      <span>Settings & accounts</span>
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
                <span>{live ? 'Account' : 'Free'}</span>
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={onOpenPlanModal}
                  className="px-2.5 py-1 rounded-full text-[12px] font-semibold text-[var(--mroya-primary)] hover:bg-[var(--mroya-surface-active)] transition-colors cursor-pointer whitespace-nowrap"
                >
                  Upgrade
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
              title={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
              aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
              className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)] transition-colors cursor-pointer"
            >
              {theme === 'light' ? (
                <Moon className="w-4 h-4" />
              ) : (
                <Sun className="w-4 h-4" />
              )}
            </button>

            {/* Toggle Contextual Memory Panel */}
            <button
              type="button"
              onClick={onToggleContextPanel}
              title={isContextPanelOpen ? 'Hide memory details' : 'Show memory details'}
              aria-label="Toggle memory details panel"
              aria-pressed={isContextPanelOpen}
              className={`h-8 px-2.5 rounded-lg inline-flex items-center gap-1.5 text-[12px] font-medium transition-colors cursor-pointer ${
                isContextPanelOpen
                  ? 'bg-[var(--mroya-surface-active)] text-[var(--mroya-text)]'
                  : 'text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)]'
              }`}
            >
              <PanelRight className="w-4 h-4" />
              <span>Memory details</span>
            </button>

            {/* Contextual header menu */}
            <div className="relative" ref={headerMenuRef}>
              <button
                type="button"
                onClick={() => setHeaderMenuOpen((v) => !v)}
                aria-label="Conversation options"
                className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)] transition-colors cursor-pointer"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
              {headerMenuOpen && (
                <div className="absolute right-0 mt-1.5 w-48 py-1 rounded-[10px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] shadow-[var(--mroya-shadow-elevated)] z-40">
                  <button
                    type="button"
                    onClick={() => {
                      setHeaderMenuOpen(false);
                      onNewChat();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)] text-left cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-[var(--mroya-text-muted)]" />
                    <span>Start new chat</span>
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
                    <span>{isContextPanelOpen ? 'Hide' : 'Show'} related memories</span>
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
                      {live ? 'Subscription unavailable' : <>Switch to {plan === 'free' ? 'Premium' : 'Free'} preview</>}
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Scrollable Conversation Area */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-8 py-5 sm:py-8">
        <div className="max-w-[740px] mx-auto">
          {intro}
          {hasMessages ? (
            <div className="space-y-6 sm:space-y-8 pb-6">
              {conversation.messages.map((msg) => {
                if (msg.sender === 'user') {
                  return (
                    <div key={msg.id} className="flex flex-col items-end">
                      <div className="max-w-[88%] sm:max-w-[78%] px-4 py-3 rounded-[14px] rounded-br-[4px] bg-[var(--mroya-surface-active)] border border-[var(--mroya-divider)] text-[15px] leading-[23px] text-[var(--mroya-text)] shadow-xs">
                        {msg.content}
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
                      <span
                        className="text-[11px] text-[var(--mroya-text-muted)]"
                        aria-hidden="true"
                      >
                        ·
                      </span>
                      <span className="text-[11px] text-[var(--mroya-text-muted)] tabular-nums">
                        {msg.timestamp}
                      </span>
                      {msg.status && msg.status!=='completed' && <span role="status" className="text-xs text-[var(--mroya-text-muted)]">{msg.status==='failed'?'Reply failed':msg.status==='streaming'?'Receiving reply…':'Processing…'}</span>}
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
                            Review
                          </button>
                        </div>
                      )}

                      {/* Primary Assistant Response Card: full width, zero left indent on mobile */}
                      <div className="w-full p-3.5 sm:p-5 rounded-[12px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] shadow-[var(--mroya-shadow-subtle)] space-y-3.5">
                        <p className="text-[15px] sm:text-[16px] leading-[24px] sm:leading-[25px] text-[var(--mroya-text)]">
                          {msg.content}
                        </p>

                        {msg.signInPrompt && onSignIn && <button type="button" onClick={onSignIn} className="rounded-full px-5 py-2 bg-[var(--mroya-primary)] text-[var(--mroya-on-primary)] text-sm font-medium">Sign in</button>}
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
                                          ? 'Added to Oct 16 calendar'
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
                  </div>
                );
              })}
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
                Good afternoon. What&apos;s on your mind?
              </h2>
              <p className="text-[14px] text-[var(--mroya-text-muted)] max-w-md mb-8">
                {live ? 'Ask about your conversations, or tell Mroya something to remember.' : 'Ask about past conversations, client agreements, upcoming deadlines, or tell Mroya something new to remember.'}
              </p>

              {/* 3 Subtle Starter Suggestions */}
              <div className="flex flex-wrap items-center justify-center gap-2.5 max-w-xl">
                {STARTER_SUGGESTIONS.map((suggestion) => (
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
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-[8px] bg-[var(--mroya-surface-muted)] border border-[var(--mroya-divider)] text-[12px] text-[var(--mroya-text)]">
                  <FileText className="w-3.5 h-3.5 text-[var(--mroya-primary)]" />
                  <span className="font-medium">{attachedFile}</span>
                  <button
                    type="button"
                    onClick={() => setAttachedFile(null)}
                    aria-label="Remove attachment"
                    className="text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            <div className="px-3.5 pt-3 pb-2">
              <label htmlFor="mroya-chat-composer" className="sr-only">
                Message Mroya
              </label>
              <textarea
                id="mroya-chat-composer"
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Mroya anything..."
                className="w-full resize-none bg-transparent text-[15px] leading-[22px] text-[var(--mroya-text)] placeholder:text-[var(--mroya-text-muted)] border-0 border-none outline-none focus:outline-none focus:border-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 max-h-40"
              />
            </div>

            {isRecording ? (
              /* Active Voice Recording State: Waveform animation + timer + Stop & Send actions */
              <div className="p-2.5 sm:p-3 bg-[var(--mroya-surface-active)]/50 rounded-b-[12px] flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-[var(--mroya-divider)]">
                {/* Left: Recording indicator, timer, waveform, live speech preview */}
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

                  {/* Live speech preview */}
                  <div className="text-[12px] text-[var(--mroya-text)] truncate min-w-0">
                    {liveTranscript ? (
                      <span className="italic font-medium">&ldquo;{liveTranscript}&rdquo;</span>
                    ) : (
                      <span className="text-[var(--mroya-text-muted)]">Запись голоса... говорите сообщение</span>
                    )}
                  </div>
                </div>

                {/* Right: Actions (Cancel, Stop -> Insert text, Send -> Auto-send) */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={handleCancelRecording}
                    title="Отменить запись"
                    aria-label="Отменить запись"
                    className="p-1.5 rounded-lg text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)] transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>

                  {/* Button: Остановить запись (голос в текст без отправки) */}
                  <button
                    type="button"
                    onClick={handleStopAndInsertText}
                    title="Остановить запись и вставить текст в сообщение"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--mroya-surface)] hover:bg-[var(--mroya-surface-muted)] border border-[var(--mroya-divider)] text-[12px] font-semibold text-[var(--mroya-text)] transition-colors cursor-pointer shadow-2xs whitespace-nowrap"
                  >
                    <Square className="w-3.5 h-3.5 text-[var(--mroya-primary)] fill-current" />
                    <span>Остановить</span>
                  </button>

                  {/* Button: Отправить запись (голос в текст + авто-отправка) */}
                  <button
                    type="button"
                    onClick={handleStopAndSend}
                    title="Перевести голос в текст и сразу отправить"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[var(--mroya-primary)] hover:bg-[var(--mroya-primary-hover)] text-[var(--mroya-on-primary)] text-[12px] font-semibold transition-colors cursor-pointer shadow-xs whitespace-nowrap"
                  >
                    <ArrowUp className="w-3.5 h-3.5 stroke-[2.4]" />
                    <span>Отправить</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Normal toolbar: Attach, Voice Mic, Recalling memory hint, Send */
              <div className="flex items-center justify-between px-3 pb-2.5 pt-1">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleAttachSample}
                    title="Attach note or document"
                    aria-label="Attach note or document"
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] text-[12px] font-medium transition-colors cursor-pointer ${
                      attachedFile
                        ? 'bg-[var(--mroya-surface-active)] text-[var(--mroya-primary)]'
                        : 'text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)]'
                    }`}
                  >
                    <Paperclip className="w-4 h-4" />
                    <span className="hidden sm:inline">Attach</span>
                  </button>

                  {/* Voice recording button */}
                  <button
                    type="button"
                    onClick={startRecording}
                    title="Записать голосовое сообщение (переводится в текст)"
                    aria-label="Записать голосовое сообщение"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] text-[12px] font-medium text-[var(--mroya-text-muted)] hover:text-[var(--mroya-primary)] hover:bg-[var(--mroya-surface-muted)] transition-colors cursor-pointer"
                  >
                    <Mic className="w-4 h-4 text-[var(--mroya-primary)]" />
                    <span className="hidden sm:inline">Голос</span>
                  </button>

                  <span className="text-[12px] text-[var(--mroya-text-muted)] hidden sm:inline pl-1">
                    Recalling across {memoriesCount} saved memories · Enter to send
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={pending || (!input.trim() && !attachedFile)}
                  aria-label="Send message"
                  className="w-9 h-9 rounded-full bg-[var(--mroya-primary)] hover:bg-[var(--mroya-primary-hover)] disabled:opacity-35 disabled:pointer-events-none text-[var(--mroya-on-primary)] inline-flex items-center justify-center transition-colors cursor-pointer shrink-0"
                >
                  <ArrowUp className="w-4 h-4 stroke-[2.4]" />
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};
