import React, { useState, useMemo } from 'react';
import {
  Inbox,
  Sparkles,
  Check,
  X,
  MessageSquare,
  Clock,
  CheckCircle2,
  RotateCcw,
  Search,
  Calendar as CalendarIcon,
  ChevronRight,
  Brain,
  Layers,
  ArrowRight,
  BookOpen,
  Send,
  MapPin,
  Menu,
  PanelLeft,
  ArrowLeft,
  ShieldCheck,
  Info,
  TrendingUp,
  History,
  CornerDownRight,
  User,
  Users,
} from 'lucide-react';
import type {
  PipelineEventItem,
  PipelineFilterStage,
  FastFilterDecision,
  PipelineStats,
} from '../types/inboxPipeline';
import { DEFAULT_PIPELINE_EVENTS, computePipelineStats } from '../data/inboxPipelineData';

export interface MemoryInboxViewProps {
  initialEvents?: PipelineEventItem[];
  isSidebarCollapsed?: boolean;
  onExpandSidebar?: () => void;
  onOpenMobileMenu?: () => void;
  onNavigateToMemory?: (memoryId?: string) => void;
}

export const MemoryInboxView: React.FC<MemoryInboxViewProps> = ({
  initialEvents,
  isSidebarCollapsed = false,
  onExpandSidebar,
  onOpenMobileMenu,
  onNavigateToMemory,
}) => {
  // Main view mode: 'attention' (Primary human-friendly view) | 'history' (Technical audit & progress)
  const [activeMainTab, setActiveMainTab] = useState<'attention' | 'history'>('attention');

  // All events repository (demonstration state)
  const [events, setEvents] = useState<PipelineEventItem[]>(() => initialEvents ?? DEFAULT_PIPELINE_EVENTS);

  // Set of dismissed/handled proposal IDs from the Attention screen
  const [handledAttentionIds, setHandledAttentionIds] = useState<Set<string>>(new Set());

  // Inline comment state: map of eventId -> draft comment text
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);

  // Selected event in technical History tab
  const [selectedEventId, setSelectedEventId] = useState<string | null>('pipe-evt-1');
  const [historyStageFilter, setHistoryStageFilter] = useState<PipelineFilterStage>('all');
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  // Transient feedback toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage((curr) => (curr === message ? null : curr));
    }, 3500);
  };

  // Recompute stats dynamically
  const stats: PipelineStats = useMemo(() => computePipelineStats(events), [events]);

  // Items currently waiting for user attention on the main screen
  // Must be in awaiting_confirmation status AND not dismissed in current session
  const attentionItems = useMemo(() => {
    return events.filter(
      (item) => item.status === 'awaiting_confirmation' && !handledAttentionIds.has(item.id)
    );
  }, [events, handledAttentionIds]);

  // Primary Action: «Да, запомнить» (Confirm proposal)
  const handleApprove = (item: PipelineEventItem) => {
    setHandledAttentionIds((prev) => new Set(prev).add(item.id));
    setEvents((prev) =>
      prev.map((evt) => {
        if (evt.id !== item.id) return evt;
        return {
          ...evt,
          status: 'committed',
          committedMemoryId: evt.committedMemoryId || `mem-${evt.id}`,
          history: [
            ...evt.history,
            {
              id: `h-${Date.now()}`,
              timestamp: 'Только что',
              stageName: 'Подтверждено пользователем',
              actor: 'user',
              actorLabel: 'Пользователь',
              description: 'Предложение одобрено и сохранено в долговременную память.',
            },
          ],
        };
      })
    );
    showToast('Сохранено в память');
  };

  // Primary Action: «Нет» (Decline proposal)
  const handleReject = (item: PipelineEventItem) => {
    setHandledAttentionIds((prev) => new Set(prev).add(item.id));
    setEvents((prev) =>
      prev.map((evt) => {
        if (evt.id !== item.id) return evt;
        return {
          ...evt,
          status: 'declined',
          history: [
            ...evt.history,
            {
              id: `h-${Date.now()}`,
              timestamp: 'Только что',
              stageName: 'Отклонено пользователем',
              actor: 'user',
              actorLabel: 'Пользователь',
              description: 'Предложение отклонено пользователем.',
            },
          ],
        };
      })
    );
    showToast('Предложение отклонено');
  };

  // Primary Action: «Комментарий» (Toggle inline comment field)
  const handleToggleComment = (eventId: string) => {
    setActiveCommentId((current) => (current === eventId ? null : eventId));
  };

  // Save proposal with user comment
  const handleSaveWithComment = (item: PipelineEventItem) => {
    const comment = commentDrafts[item.id]?.trim();
    setHandledAttentionIds((prev) => new Set(prev).add(item.id));
    setEvents((prev) =>
      prev.map((evt) => {
        if (evt.id !== item.id) return evt;
        return {
          ...evt,
          status: 'committed',
          committedMemoryId: evt.committedMemoryId || `mem-${evt.id}`,
          shortDescription: comment ? `${evt.shortDescription} (Заметка: ${comment})` : evt.shortDescription,
          history: [
            ...evt.history,
            {
              id: `h-${Date.now()}`,
              timestamp: 'Только что',
              stageName: 'Сохранено с комментарием',
              actor: 'user',
              actorLabel: 'Пользователь',
              description: comment
                ? `Сохранено с уточнением: «${comment}»`
                : 'Сохранено в долговременную память.',
            },
          ],
        };
      })
    );
    setActiveCommentId(null);
    showToast('Сохранено в память с вашим уточнением');
  };

  // Action in History Tab: Send mistakenly rejected event to deep analysis
  const handleSendToAnalysis = (eventId: string) => {
    setEvents((prev) =>
      prev.map((evt) => {
        if (evt.id !== eventId) return evt;
        return {
          ...evt,
          status: 'in_queue',
          fastFilter: {
            ...evt.fastFilter,
            decision: 'APPROVE',
            rationale: 'Передано на повторный анализ пользователем вручную.',
          },
          history: [
            ...evt.history,
            {
              id: `h-${Date.now()}`,
              timestamp: 'Только что',
              stageName: 'Повторный анализ',
              actor: 'user',
              actorLabel: 'Пользователь',
              description: 'Событие отправлено на глубокий анализ в обход автоматического отклонения.',
            },
          ],
        };
      })
    );
    showToast('Событие отправлено на повторный анализ');
  };

  // Reset demo state
  const handleResetDemoData = () => {
    setEvents(DEFAULT_PIPELINE_EVENTS);
    setHandledAttentionIds(new Set());
    setCommentDrafts({});
    setActiveCommentId(null);
    setSelectedEventId('pipe-evt-1');
    setHistoryStageFilter('all');
    setHistorySearchQuery('');
    showToast('Демо-предложения восстановлены');
  };

  // Filtered events for the History & Statuses tab
  const filteredHistoryEvents = useMemo(() => {
    return events.filter((item) => {
      if (historyStageFilter !== 'all') {
        if (historyStageFilter === 'fast_approved' && item.fastFilter.decision !== 'APPROVE') {
          return false;
        } else if (historyStageFilter !== 'fast_approved' && item.status !== historyStageFilter) {
          return false;
        }
      }

      if (historySearchQuery.trim()) {
        const q = historySearchQuery.toLowerCase().trim();
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchDesc = item.shortDescription.toLowerCase().includes(q);
        const matchLoc = item.sourceLocation?.toLowerCase().includes(q) ?? false;
        const matchRaw = item.rawEventSnippet.toLowerCase().includes(q);
        const matchAttendees = item.sourceAttendees?.some((a) => a.toLowerCase().includes(q)) ?? false;
        if (!matchTitle && !matchDesc && !matchLoc && !matchRaw && !matchAttendees) {
          return false;
        }
      }

      return true;
    });
  }, [events, historyStageFilter, historySearchQuery]);

  // Selected item in History tab
  const selectedHistoryEvent = useMemo(() => {
    return events.find((e) => e.id === selectedEventId) ?? filteredHistoryEvents[0] ?? events[0] ?? null;
  }, [events, selectedEventId, filteredHistoryEvents]);

  return (
    <div className="flex-1 flex flex-col h-full min-w-0 bg-[var(--mroya-bg)] overflow-hidden">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-[10px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] shadow-[var(--mroya-shadow-elevated)] text-[13px] font-medium text-[var(--mroya-text)] animate-in fade-in slide-in-from-bottom-2"
        >
          <Sparkles className="w-4 h-4 text-[var(--mroya-brand-honey)] shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header with Tab Switcher */}
      <header className="px-4 sm:px-6 py-3 border-b border-[var(--mroya-divider)] bg-[var(--mroya-surface)] flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {onOpenMobileMenu && (
            <button
              type="button"
              onClick={onOpenMobileMenu}
              className="lg:hidden p-1.5 rounded-[8px] text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)] transition-colors cursor-pointer"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          {isSidebarCollapsed && onExpandSidebar && (
            <button
              type="button"
              onClick={onExpandSidebar}
              className="hidden lg:flex p-1.5 rounded-[8px] text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)] transition-colors cursor-pointer"
              aria-label="Expand sidebar"
            >
              <PanelLeft className="w-5 h-5" />
            </button>
          )}

          {/* Tab Navigation: «Требуют внимания» vs «История и статусы» */}
          <nav aria-label="Memory Inbox tabs" className="flex items-center gap-1.5 bg-[var(--mroya-surface-muted)]/80 p-1 rounded-[10px] border border-[var(--mroya-divider)]/60">
            <button
              type="button"
              onClick={() => setActiveMainTab('attention')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-[7px] text-[13px] font-semibold transition-all cursor-pointer ${
                activeMainTab === 'attention'
                  ? 'bg-[var(--mroya-surface)] text-[var(--mroya-text)] shadow-sm'
                  : 'text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)]'
              }`}
            >
              <Inbox className="w-4 h-4 text-[var(--mroya-primary)]" />
              <span>Требуют внимания</span>
              {attentionItems.length > 0 ? (
                <span className="px-1.5 py-0.2 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 tabular-nums">
                  {attentionItems.length}
                </span>
              ) : (
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveMainTab('history')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[7px] text-[13px] font-semibold transition-all cursor-pointer ${
                activeMainTab === 'history'
                  ? 'bg-[var(--mroya-surface)] text-[var(--mroya-text)] shadow-sm'
                  : 'text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)]'
              }`}
            >
              <History className="w-4 h-4 text-[var(--mroya-text-muted)]" />
              <span>История и статусы</span>
            </button>
          </nav>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleResetDemoData}
            title="Восстановить демонстрационные карточки"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[12px] font-medium text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)] border border-[var(--mroya-divider)] transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Сброс демо</span>
          </button>
        </div>
      </header>

      {/* VIEW 1: ГЛАВНЫЙ ЭКРАН («Требуют внимания») */}
      {activeMainTab === 'attention' && (
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 min-h-0">
          <div className="max-w-2xl mx-auto w-full space-y-5">
            {/* Header description */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[var(--mroya-divider)]/60">
              <div>
                <h1 className="text-[20px] font-semibold text-[var(--mroya-text)] flex items-center gap-2">
                  <span>Требуют внимания</span>
                  {attentionItems.length > 0 && (
                    <span className="text-[13px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 tabular-nums">
                      {attentionItems.length}
                    </span>
                  )}
                </h1>
                <p className="text-[13px] text-[var(--mroya-text-muted)] mt-0.5">
                  AI обнаружил эти события в календаре и предлагает зафиксировать важные факты в памяти
                </p>
              </div>

              {attentionItems.length > 0 && (
                <div className="text-[12px] text-[var(--mroya-text-muted)] shrink-0 self-start sm:self-auto">
                  Осталось подтвердить: <span className="font-semibold text-[var(--mroya-text)]">{attentionItems.length}</span>
                </div>
              )}
            </div>

            {/* List of Proposal Cards */}
            {attentionItems.length > 0 ? (
              <div className="space-y-4">
                {attentionItems.map((item) => {
                  const isCommentOpen = activeCommentId === item.id;
                  const draftText = commentDrafts[item.id] ?? '';

                  return (
                    <article
                      key={item.id}
                      className="rounded-[14px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] p-5 sm:p-6 shadow-[var(--mroya-shadow-subtle)] space-y-4 transition-all animate-in fade-in slide-in-from-bottom-1 duration-200"
                    >
                      {/* Source Metadata */}
                      <div className="flex flex-wrap items-center gap-2 text-[12px] text-[var(--mroya-text-muted)]">
                        <span className="inline-flex items-center gap-1.5 font-medium text-[var(--mroya-text)]">
                          <CalendarIcon className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <span>Google Calendar</span>
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{item.sourceCalendarName || 'Календарь'}</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{item.sourceDate}</span>
                        {item.sourceLocation && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              <span>{item.sourceLocation}</span>
                            </span>
                          </>
                        )}
                      </div>

                      {/* Event Title */}
                      <h2 className="text-[17px] sm:text-[18px] font-semibold text-[var(--mroya-text)] leading-[24px]">
                        {item.title}
                      </h2>

                      {/* What AI wants to remember */}
                      <div className="p-4 rounded-[10px] bg-[var(--mroya-surface-muted)]/70 border border-[var(--mroya-divider)]/60 space-y-2">
                        <div className="text-[11.5px] font-semibold uppercase tracking-wider text-[var(--mroya-text-muted)] flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-[var(--mroya-brand-honey)] shrink-0" />
                          <span>Что AI предлагает запомнить:</span>
                        </div>

                        {item.deepAnalysis?.proposedSummary ? (
                          <p className="text-[14px] text-[var(--mroya-text)] leading-[22px]">
                            {item.deepAnalysis.proposedSummary}
                          </p>
                        ) : (
                          <p className="text-[14px] text-[var(--mroya-text)] leading-[22px]">
                            {item.shortDescription}
                          </p>
                        )}

                        {/* Extracted points */}
                        {item.deepAnalysis?.factsToExtract && item.deepAnalysis.factsToExtract.length > 0 && (
                          <ul className="pt-2 border-t border-[var(--mroya-divider)]/40 space-y-1.5">
                            {item.deepAnalysis.factsToExtract.map((fact, idx) => (
                              <li
                                key={idx}
                                className="flex items-start gap-2 text-[13px] text-[var(--mroya-text)] leading-[19px]"
                              >
                                <span className="text-[var(--mroya-primary)] font-bold mt-0.5">·</span>
                                <span>{fact}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      {/* Expandable Inline Comment Field */}
                      {isCommentOpen && (
                        <div className="p-3.5 rounded-[10px] bg-[var(--mroya-bg)] border border-[var(--mroya-divider)] space-y-2.5 animate-in fade-in">
                          <div className="text-[12px] font-medium text-[var(--mroya-text)] flex items-center gap-1.5">
                            <MessageSquare className="w-3.5 h-3.5 text-[var(--mroya-primary)]" />
                            <span>Ваш комментарий или уточнение к записи:</span>
                          </div>
                          <textarea
                            rows={2}
                            value={draftText}
                            onChange={(e) =>
                              setCommentDrafts((prev) => ({
                                ...prev,
                                [item.id]: e.target.value,
                              }))
                            }
                            placeholder="Например: Запомнить только дату, без модели техники... или Добавь номер телефона..."
                            className="w-full p-2.5 text-[13px] rounded-[8px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] text-[var(--mroya-text)] placeholder-[var(--mroya-text-muted)] focus:outline-none focus:border-[var(--mroya-primary)]"
                          />
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleToggleComment(item.id)}
                              className="px-3 py-1.5 text-[12px] font-medium text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] cursor-pointer"
                            >
                              Отмена
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveWithComment(item)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[7px] bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-semibold cursor-pointer shadow-sm transition-colors"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Сохранить с комментарием</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Three Main Action Buttons: «Да», «Нет», «Комментарий» */}
                      <div className="pt-2 flex flex-wrap items-center gap-2.5">
                        {/* Button 1: «Да» */}
                        <button
                          type="button"
                          onClick={() => handleApprove(item)}
                          className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-[9px] bg-emerald-600 hover:bg-emerald-700 text-white text-[13.5px] font-semibold transition-all cursor-pointer shadow-sm active:scale-[0.98]"
                        >
                          <Check className="w-4 h-4 stroke-[2.5]" />
                          <span>Да</span>
                        </button>

                        {/* Button 2: «Нет» */}
                        <button
                          type="button"
                          onClick={() => handleReject(item)}
                          className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-[9px] bg-[var(--mroya-surface-muted)] hover:bg-rose-500/15 text-[var(--mroya-text)] hover:text-rose-600 dark:hover:text-rose-400 border border-[var(--mroya-divider)] text-[13.5px] font-medium transition-colors cursor-pointer active:scale-[0.98]"
                        >
                          <X className="w-4 h-4" />
                          <span>Нет</span>
                        </button>

                        {/* Button 3: «Комментарий» */}
                        <button
                          type="button"
                          onClick={() => handleToggleComment(item.id)}
                          className={`w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-[9px] border text-[13.5px] font-medium transition-colors cursor-pointer ${
                            isCommentOpen
                              ? 'bg-[var(--mroya-surface-active)] text-[var(--mroya-primary)] border-[var(--mroya-primary)]/50'
                              : 'bg-[var(--mroya-surface-muted)] hover:bg-[var(--mroya-surface-active)] text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] border-[var(--mroya-divider)]'
                          }`}
                        >
                          <MessageSquare className="w-4 h-4" />
                          <span>Комментарий</span>
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              /* Delightful Empty State: «Всё разобрано! Пока ничего не требует вашего внимания» */
              <div className="py-14 px-6 rounded-[16px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] text-center space-y-4 shadow-[var(--mroya-shadow-subtle)] animate-in fade-in duration-300">
                <div className="w-16 h-16 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-9 h-9 stroke-[2]" />
                </div>

                <div className="space-y-1.5 max-w-md mx-auto">
                  <h2 className="text-[20px] sm:text-[22px] font-semibold text-[var(--mroya-text)]">
                    Всё разобрано!
                  </h2>
                  <p className="text-[14.5px] text-[var(--mroya-text-muted)] leading-[22px]">
                    Пока ничего не требует вашего внимания
                  </p>
                </div>

                <p className="text-[12.5px] text-[var(--mroya-text-muted)] max-w-sm mx-auto leading-[18px]">
                  AI продолжит сканировать новые события календаря в фоновом режиме и подготовит предложения, как только появятся важные даты или договоренности.
                </p>

                <div className="pt-3 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={handleResetDemoData}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[9px] bg-[var(--mroya-primary)] hover:bg-[var(--mroya-primary-hover)] text-[var(--mroya-on-primary)] text-[13px] font-semibold transition-colors cursor-pointer shadow-sm"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Сбросить демо / начать заново</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveMainTab('history')}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[9px] bg-[var(--mroya-surface-muted)] hover:bg-[var(--mroya-surface-active)] text-[var(--mroya-text)] border border-[var(--mroya-divider)] text-[13px] font-semibold transition-colors cursor-pointer"
                  >
                    <History className="w-3.5 h-3.5 text-[var(--mroya-text-muted)]" />
                    <span>Посмотреть историю и статусы</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 2: ДОПОЛНИТЕЛЬНАЯ ВКЛАДКА («История и статусы») */}
      {activeMainTab === 'history' && (
        <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
          {/* SECTION 1: Общий прогресс обработки & статистика */}
          <section className="p-4 sm:p-6 border-b border-[var(--mroya-divider)] bg-[var(--mroya-surface)] shrink-0 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
              <div>
                <h2 className="text-[14px] font-semibold text-[var(--mroya-text)] flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-[var(--mroya-primary)]" />
                  <span>Прогресс обработки событий</span>
                </h2>
                <p className="text-[12px] text-[var(--mroya-text-muted)]">
                  Технический аудит фильтрации и очередей извлечения контекста из календаря
                </p>
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[8px] bg-[var(--mroya-surface-muted)] border border-[var(--mroya-divider)] text-[11.5px] text-[var(--mroya-text-muted)] self-start md:self-auto">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Правило фильтра 1: сомнительное всегда одобряется (APPROVE)</span>
              </div>
            </div>

            {/* 7 Compact Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
              {/* 1. Всего событий */}
              <div
                onClick={() => setHistoryStageFilter('all')}
                className={`p-3 rounded-[10px] border transition-all cursor-pointer ${
                  historyStageFilter === 'all'
                    ? 'border-[var(--mroya-primary)] bg-[var(--mroya-primary)]/5 shadow-sm'
                    : 'border-[var(--mroya-divider)] bg-[var(--mroya-bg)] hover:bg-[var(--mroya-surface-muted)]'
                }`}
              >
                <div className="text-[11px] font-medium text-[var(--mroya-text-muted)] truncate">
                  Всего событий
                </div>
                <div className="mt-1 text-[20px] font-bold text-[var(--mroya-text)] tabular-nums">
                  {stats.totalDetected}
                </div>
                <div className="text-[10.5px] text-[var(--mroya-text-muted)] flex items-center gap-1 mt-0.5">
                  <span>в календаре</span>
                </div>
              </div>

              {/* 2. Ожидают проверки AI */}
              <div
                onClick={() => setHistoryStageFilter('pending_check')}
                className={`p-3 rounded-[10px] border transition-all cursor-pointer ${
                  historyStageFilter === 'pending_check'
                    ? 'border-sky-500 bg-sky-500/10 shadow-sm'
                    : 'border-[var(--mroya-divider)] bg-[var(--mroya-bg)] hover:bg-[var(--mroya-surface-muted)]'
                }`}
              >
                <div className="text-[11px] font-medium text-[var(--mroya-text-muted)] truncate">
                  Ожидают проверки
                </div>
                <div className="mt-1 text-[20px] font-bold text-sky-600 dark:text-sky-400 tabular-nums">
                  {stats.pendingCheck}
                </div>
                <div className="text-[10.5px] text-[var(--mroya-text-muted)] flex items-center gap-1 mt-0.5">
                  <Clock className="w-3 h-3 text-sky-500" />
                  <span>быстрый фильтр</span>
                </div>
              </div>

              {/* 3. Отобрано AI */}
              <div
                onClick={() => setHistoryStageFilter('fast_approved')}
                className={`p-3 rounded-[10px] border transition-all cursor-pointer ${
                  historyStageFilter === 'fast_approved'
                    ? 'border-emerald-500 bg-emerald-500/10 shadow-sm'
                    : 'border-[var(--mroya-divider)] bg-[var(--mroya-bg)] hover:bg-[var(--mroya-surface-muted)]'
                }`}
              >
                <div className="text-[11px] font-medium text-[var(--mroya-text-muted)] truncate">
                  Отобрано AI
                </div>
                <div className="mt-1 text-[20px] font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {stats.fastApproved}
                </div>
                <div className="text-[10.5px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
                  <Check className="w-3 h-3" />
                  <span>APPROVE</span>
                </div>
              </div>

              {/* 4. Отклонено AI */}
              <div
                onClick={() => setHistoryStageFilter('fast_rejected')}
                className={`p-3 rounded-[10px] border transition-all cursor-pointer ${
                  historyStageFilter === 'fast_rejected'
                    ? 'border-zinc-500 bg-zinc-500/10 shadow-sm'
                    : 'border-[var(--mroya-divider)] bg-[var(--mroya-bg)] hover:bg-[var(--mroya-surface-muted)]'
                }`}
              >
                <div className="text-[11px] font-medium text-[var(--mroya-text-muted)] truncate">
                  Отклонено AI
                </div>
                <div className="mt-1 text-[20px] font-bold text-[var(--mroya-text-muted)] tabular-nums">
                  {stats.fastRejected}
                </div>
                <div className="text-[10.5px] text-[var(--mroya-text-muted)] flex items-center gap-1 mt-0.5">
                  <X className="w-3 h-3 text-zinc-500" />
                  <span>REJECT (шум)</span>
                </div>
              </div>

              {/* 5. В очереди глубокого анализа */}
              <div
                onClick={() => setHistoryStageFilter('in_queue')}
                className={`p-3 rounded-[10px] border transition-all cursor-pointer ${
                  historyStageFilter === 'in_queue'
                    ? 'border-indigo-500 bg-indigo-500/10 shadow-sm'
                    : 'border-[var(--mroya-divider)] bg-[var(--mroya-bg)] hover:bg-[var(--mroya-surface-muted)]'
                }`}
              >
                <div className="text-[11px] font-medium text-[var(--mroya-text-muted)] truncate">
                  В очереди анализа
                </div>
                <div className="mt-1 text-[20px] font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                  {stats.inDeepQueue}
                </div>
                <div className="text-[10.5px] text-indigo-600 dark:text-indigo-400 flex items-center gap-1 mt-0.5">
                  <Brain className="w-3 h-3" />
                  <span>глубокий анализ</span>
                </div>
              </div>

              {/* 6. Ожидают подтверждения */}
              <div
                onClick={() => setHistoryStageFilter('awaiting_confirmation')}
                className={`p-3 rounded-[10px] border transition-all cursor-pointer ${
                  historyStageFilter === 'awaiting_confirmation'
                    ? 'border-amber-500 bg-amber-500/10 shadow-sm ring-1 ring-amber-500/30'
                    : 'border-[var(--mroya-divider)] bg-[var(--mroya-bg)] hover:bg-[var(--mroya-surface-muted)]'
                }`}
              >
                <div className="text-[11px] font-medium text-[var(--mroya-text-muted)] truncate">
                  На подтверждении
                </div>
                <div className="mt-1 text-[20px] font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                  {stats.awaitingConfirmation}
                </div>
                <div className="text-[10.5px] text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-0.5">
                  <Inbox className="w-3 h-3" />
                  <span>требуют решения</span>
                </div>
              </div>

              {/* 7. Успешно сохранено */}
              <div
                onClick={() => setHistoryStageFilter('committed')}
                className={`p-3 rounded-[10px] border transition-all cursor-pointer ${
                  historyStageFilter === 'committed'
                    ? 'border-emerald-600 bg-emerald-600/10 shadow-sm'
                    : 'border-[var(--mroya-divider)] bg-[var(--mroya-bg)] hover:bg-[var(--mroya-surface-muted)]'
                }`}
              >
                <div className="text-[11px] font-medium text-[var(--mroya-text-muted)] truncate">
                  В памяти
                </div>
                <div className="mt-1 text-[20px] font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
                  {stats.committed}
                </div>
                <div className="text-[10.5px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>сохранено</span>
                </div>
              </div>
            </div>

            {/* Visual Pipeline Flow */}
            <div className="pt-2">
              <div className="text-[11.5px] font-semibold text-[var(--mroya-text-muted)] uppercase tracking-wider mb-2">
                Стадии конвейера
              </div>
              <div className="flex flex-wrap items-center gap-1 sm:gap-2 text-[12px]">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-[var(--mroya-surface-muted)] border border-[var(--mroya-divider)] font-medium text-[var(--mroya-text)]">
                  <CalendarIcon className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span>1. Обнаружение</span>
                  <span className="text-[11px] text-[var(--mroya-text-muted)] tabular-nums">
                    ({stats.totalDetected})
                  </span>
                </div>

                <ChevronRight className="w-3.5 h-3.5 text-[var(--mroya-text-muted)] shrink-0" />

                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-[var(--mroya-surface-muted)] border border-[var(--mroya-divider)] font-medium text-[var(--mroya-text)]">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>2. Быстрый фильтр (APPROVE / REJECT)</span>
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums">
                    +{stats.fastApproved}
                  </span>
                  <span className="text-[11px] text-[var(--mroya-text-muted)] tabular-nums">
                    /-{stats.fastRejected}
                  </span>
                </div>

                <ChevronRight className="w-3.5 h-3.5 text-[var(--mroya-text-muted)] shrink-0" />

                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-[var(--mroya-surface-muted)] border border-[var(--mroya-divider)] font-medium text-[var(--mroya-text)]">
                  <Brain className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  <span>3. Глубокий анализ</span>
                  <span className="text-[11px] text-[var(--mroya-text-muted)] tabular-nums">
                    ({stats.inDeepQueue + stats.awaitingConfirmation + stats.committed})
                  </span>
                </div>

                <ChevronRight className="w-3.5 h-3.5 text-[var(--mroya-text-muted)] shrink-0" />

                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-amber-500/10 border border-amber-500/30 font-medium text-amber-700 dark:text-amber-300">
                  <Inbox className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>4. Подтверждение</span>
                  <span className="text-[11px] font-bold tabular-nums">
                    ({stats.awaitingConfirmation})
                  </span>
                </div>

                <ChevronRight className="w-3.5 h-3.5 text-[var(--mroya-text-muted)] shrink-0" />

                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-emerald-500/10 border border-emerald-500/30 font-medium text-emerald-700 dark:text-emerald-300">
                  <BookOpen className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>5. Сохранение</span>
                  <span className="text-[11px] font-bold tabular-nums">
                    ({stats.committed})
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Master-Detail Split Screen Container */}
          <div className="flex-1 flex min-h-0 overflow-hidden">
            {/* Master List: All events in History */}
            <section
              className={`w-full lg:w-[420px] xl:w-[460px] flex flex-col border-r border-[var(--mroya-divider)] bg-[var(--mroya-surface)] shrink-0 ${
                mobileDetailOpen ? 'hidden lg:flex' : 'flex'
              }`}
            >
              {/* Search & Filter Header */}
              <div className="p-3.5 border-b border-[var(--mroya-divider)] space-y-2.5">
                <div className="relative">
                  <Search className="w-4 h-4 text-[var(--mroya-text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={historySearchQuery}
                    onChange={(e) => setHistorySearchQuery(e.target.value)}
                    placeholder="Поиск по истории событий…"
                    className="w-full pl-9 pr-8 py-1.5 text-[13px] rounded-[8px] bg-[var(--mroya-bg)] border border-[var(--mroya-divider)] text-[var(--mroya-text)] placeholder-[var(--mroya-text-muted)] focus:outline-none focus:border-[var(--mroya-primary)]"
                  />
                  {historySearchQuery && (
                    <button
                      type="button"
                      onClick={() => setHistorySearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)]"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Status Filter Tabs */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none text-[12px]">
                  <button
                    type="button"
                    onClick={() => setHistoryStageFilter('all')}
                    className={`px-2.5 py-1 rounded-[6px] font-medium whitespace-nowrap cursor-pointer transition-colors ${
                      historyStageFilter === 'all'
                        ? 'bg-[var(--mroya-primary)] text-[var(--mroya-on-primary)]'
                        : 'text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)]'
                    }`}
                  >
                    Все ({stats.totalDetected})
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistoryStageFilter('fast_rejected')}
                    className={`px-2.5 py-1 rounded-[6px] font-medium whitespace-nowrap cursor-pointer transition-colors ${
                      historyStageFilter === 'fast_rejected'
                        ? 'bg-zinc-700 text-white dark:bg-zinc-600'
                        : 'text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)]'
                    }`}
                  >
                    Отклонено AI ({stats.fastRejected})
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistoryStageFilter('in_queue')}
                    className={`px-2.5 py-1 rounded-[6px] font-medium whitespace-nowrap cursor-pointer transition-colors ${
                      historyStageFilter === 'in_queue'
                        ? 'bg-indigo-600 text-white dark:bg-indigo-500'
                        : 'text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)]'
                    }`}
                  >
                    В очереди ({stats.inDeepQueue})
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistoryStageFilter('committed')}
                    className={`px-2.5 py-1 rounded-[6px] font-medium whitespace-nowrap cursor-pointer transition-colors ${
                      historyStageFilter === 'committed'
                        ? 'bg-emerald-600 text-white dark:bg-emerald-500'
                        : 'text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)]'
                    }`}
                  >
                    В памяти ({stats.committed})
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistoryStageFilter('pending_check')}
                    className={`px-2.5 py-1 rounded-[6px] font-medium whitespace-nowrap cursor-pointer transition-colors ${
                      historyStageFilter === 'pending_check'
                        ? 'bg-sky-600 text-white dark:bg-sky-500'
                        : 'text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)]'
                    }`}
                  >
                    Ожидают ({stats.pendingCheck})
                  </button>
                </div>
              </div>

              {/* Events List */}
              <div className="flex-1 overflow-y-auto divide-y divide-[var(--mroya-divider)] min-h-0">
                {filteredHistoryEvents.length === 0 ? (
                  <div className="p-8 text-center space-y-2">
                    <Inbox className="w-8 h-8 text-[var(--mroya-text-muted)] mx-auto opacity-50" />
                    <p className="text-[13px] font-medium text-[var(--mroya-text)]">
                      Записи не найдены
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setHistoryStageFilter('all');
                        setHistorySearchQuery('');
                      }}
                      className="mt-2 text-[12px] text-[var(--mroya-primary)] font-medium hover:underline cursor-pointer"
                    >
                      Показать все записи
                    </button>
                  </div>
                ) : (
                  filteredHistoryEvents.map((item) => {
                    const isSelected = selectedHistoryEvent?.id === item.id;
                    const isApproved = item.fastFilter.decision === 'APPROVE';
                    const isRejected = item.fastFilter.decision === 'REJECT';
                    const isPending = item.status === 'pending_check';
                    const isCommitted = item.status === 'committed';

                    return (
                      <article
                        key={item.id}
                        onClick={() => {
                          setSelectedEventId(item.id);
                          setMobileDetailOpen(true);
                        }}
                        className={`p-3.5 transition-colors cursor-pointer text-left relative ${
                          isSelected
                            ? 'bg-[var(--mroya-surface-active)] ring-1 ring-inset ring-[var(--mroya-primary)]/40'
                            : 'hover:bg-[var(--mroya-surface-muted)]/70'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 text-[11.5px] text-[var(--mroya-text-muted)] mb-1.5">
                          <div className="flex items-center gap-1.5 truncate">
                            <CalendarIcon className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                            <span className="font-medium text-[var(--mroya-text)] truncate">
                              {item.sourceCalendarName || 'Календарь'}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="truncate">{item.sourceDate}</span>
                          </div>

                          <div className="shrink-0">
                            {isApproved && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                                <Check className="w-2.5 h-2.5" />
                                <span>APPROVE</span>
                              </span>
                            )}
                            {isRejected && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-semibold bg-zinc-500/15 text-zinc-600 dark:text-zinc-400">
                                <X className="w-2.5 h-2.5" />
                                <span>REJECT</span>
                              </span>
                            )}
                            {isPending && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-medium bg-sky-500/15 text-sky-700 dark:text-sky-300">
                                <Clock className="w-2.5 h-2.5" />
                                <span>AI очередь</span>
                              </span>
                            )}
                          </div>
                        </div>

                        <h3 className="text-[13.5px] font-semibold text-[var(--mroya-text)] leading-[19px] line-clamp-2">
                          {item.title}
                        </h3>

                        <p className="mt-1 text-[12px] text-[var(--mroya-text-muted)] leading-[17px] line-clamp-2">
                          {item.shortDescription}
                        </p>

                        <div className="mt-2.5 flex items-center justify-between gap-2 pt-2 border-t border-[var(--mroya-divider)]/40 text-[11px]">
                          <div>
                            {isCommitted && (
                              <span className="inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Сохранено в память</span>
                              </span>
                            )}
                            {item.status === 'in_queue' && (
                              <span className="inline-flex items-center gap-1 font-medium text-indigo-600 dark:text-indigo-400">
                                <Brain className="w-3 h-3" />
                                <span>Глубокий анализ</span>
                              </span>
                            )}
                            {item.status === 'fast_rejected' && (
                              <span className="text-[var(--mroya-text-muted)]">
                                Отклонено (шум)
                              </span>
                            )}
                            {item.status === 'declined' && (
                              <span className="text-[var(--mroya-text-muted)]">
                                Отклонено пользователем
                              </span>
                            )}
                          </div>

                          {item.fastFilter.confidence > 0 && (
                            <span className="text-[10.5px] text-[var(--mroya-text-muted)] tabular-nums">
                              Уверенность: {item.fastFilter.confidence}%
                            </span>
                          )}
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </section>

            {/* Detail View for selected History Item */}
            <main
              className={`flex-1 flex flex-col bg-[var(--mroya-bg)] min-w-0 overflow-y-auto ${
                mobileDetailOpen ? 'flex' : 'hidden lg:flex'
              }`}
            >
              {selectedHistoryEvent ? (
                <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-4xl">
                  {/* Mobile Back Button */}
                  <div className="lg:hidden flex items-center justify-between gap-2 pb-3 border-b border-[var(--mroya-divider)]">
                    <button
                      type="button"
                      onClick={() => setMobileDetailOpen(false)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] text-[12px] font-semibold text-[var(--mroya-text)] cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Назад к списку</span>
                    </button>
                    <span className="text-[12px] text-[var(--mroya-text-muted)]">
                      Запись #{selectedHistoryEvent.id.replace('pipe-evt-', '')}
                    </span>
                  </div>

                  {/* Header Card with Actions */}
                  <div className="p-4 sm:p-5 rounded-[12px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] shadow-[var(--mroya-shadow-subtle)] space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2 text-[12px] text-[var(--mroya-text-muted)]">
                          <span className="inline-flex items-center gap-1 font-medium text-[var(--mroya-text)]">
                            <CalendarIcon className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                            <span>{selectedHistoryEvent.sourceCalendarName}</span>
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{selectedHistoryEvent.sourceDate}</span>
                          {selectedHistoryEvent.sourceLocation && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                <span>{selectedHistoryEvent.sourceLocation}</span>
                              </span>
                            </>
                          )}
                        </div>

                        <h2 className="text-[18px] sm:text-[20px] font-semibold text-[var(--mroya-text)] leading-[26px]">
                          {selectedHistoryEvent.title}
                        </h2>
                      </div>

                      {/* Status Badge */}
                      <div className="shrink-0 self-start sm:self-center">
                        {selectedHistoryEvent.status === 'committed' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold bg-emerald-600/15 text-emerald-700 dark:text-emerald-300 border border-emerald-600/30">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span>Сохранено в память</span>
                          </span>
                        )}
                        {selectedHistoryEvent.status === 'fast_rejected' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border border-zinc-500/30">
                            <X className="w-3.5 h-3.5" />
                            <span>Отклонено AI (шум)</span>
                          </span>
                        )}
                        {selectedHistoryEvent.status === 'in_queue' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30">
                            <Brain className="w-3.5 h-3.5" />
                            <span>В очереди глубокого анализа</span>
                          </span>
                        )}
                        {selectedHistoryEvent.status === 'pending_check' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Ожидает первого фильтра AI</span>
                          </span>
                        )}
                        {selectedHistoryEvent.status === 'declined' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border border-zinc-500/30">
                            <X className="w-3.5 h-3.5" />
                            <span>Отклонено пользователем</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action button in History: Re-send to deep analysis */}
                    <div className="pt-3 border-t border-[var(--mroya-divider)] flex flex-wrap items-center gap-2.5">
                      {selectedHistoryEvent.status === 'fast_rejected' && (
                        <button
                          type="button"
                          onClick={() => handleSendToAnalysis(selectedHistoryEvent.id)}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-[8px] bg-[var(--mroya-primary)] hover:bg-[var(--mroya-primary-hover)] text-[var(--mroya-on-primary)] text-[13px] font-semibold shadow-sm transition-colors cursor-pointer"
                        >
                          <Send className="w-4 h-4" />
                          <span>Передать на анализ</span>
                        </button>
                      )}

                      {selectedHistoryEvent.status === 'committed' && (
                        <button
                          type="button"
                          onClick={() => {
                            if (onNavigateToMemory) {
                              onNavigateToMemory(selectedHistoryEvent.committedMemoryId);
                            }
                            showToast('Переход в раздел Memory…');
                          }}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-[8px] bg-[var(--mroya-surface-muted)] hover:bg-[var(--mroya-surface-active)] text-[var(--mroya-primary)] border border-[var(--mroya-divider)] text-[13px] font-semibold transition-colors cursor-pointer"
                        >
                          <BookOpen className="w-4 h-4" />
                          <span>Открыть в Memory</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Details Cards */}
                  <div className="grid grid-cols-1 gap-5">
                    {/* Source event */}
                    <div className="p-5 rounded-[12px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] space-y-3">
                      <div className="text-[13px] font-semibold text-[var(--mroya-text)] flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4 text-blue-500" />
                        <span>Исходное событие из календаря</span>
                      </div>
                      <div className="p-3.5 rounded-[8px] bg-[var(--mroya-bg)] border border-[var(--mroya-divider)] text-[13px] text-[var(--mroya-text)] leading-[21px]">
                        {selectedHistoryEvent.rawEventSnippet}
                      </div>
                    </div>

                    {/* AI Filter Decision */}
                    <div className="p-5 rounded-[12px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-[13px] font-semibold text-[var(--mroya-text)] flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-[var(--mroya-brand-honey)]" />
                          <span>Решение первого AI-фильтра (Tier 1: Fast Filter)</span>
                        </div>
                        {selectedHistoryEvent.fastFilter.decision === 'APPROVE' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] text-[11.5px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                            <Check className="w-3.5 h-3.5" />
                            <span>APPROVE</span>
                          </span>
                        )}
                        {selectedHistoryEvent.fastFilter.decision === 'REJECT' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] text-[11.5px] font-bold bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border border-zinc-500/30">
                            <X className="w-3.5 h-3.5" />
                            <span>REJECT (шум)</span>
                          </span>
                        )}
                      </div>

                      <div className="p-3.5 rounded-[10px] bg-[var(--mroya-surface-muted)] border border-[var(--mroya-divider)] space-y-1">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mroya-text-muted)]">
                          Обоснование:
                        </div>
                        <p className="text-[13px] text-[var(--mroya-text)] leading-[20px]">
                          {selectedHistoryEvent.fastFilter.rationale}
                        </p>
                      </div>
                    </div>

                    {/* Proposed memory info */}
                    <div className="p-5 rounded-[12px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] space-y-3">
                      <div className="text-[13px] font-semibold text-[var(--mroya-text)] flex items-center gap-2">
                        <Brain className="w-4 h-4 text-indigo-500" />
                        <span>Предлагаемая информация для памяти</span>
                      </div>
                      {selectedHistoryEvent.deepAnalysis ? (
                        <div className="space-y-3">
                          <div className="text-[15px] font-semibold text-[var(--mroya-text)]">
                            {selectedHistoryEvent.deepAnalysis.proposedTitle}
                          </div>
                          <p className="text-[13px] text-[var(--mroya-text)] leading-[21px]">
                            {selectedHistoryEvent.deepAnalysis.proposedSummary}
                          </p>
                          <div className="space-y-1.5">
                            {selectedHistoryEvent.deepAnalysis.factsToExtract.map((fact, idx) => (
                              <div
                                key={idx}
                                className="flex items-start gap-2 p-2.5 rounded-[8px] bg-[var(--mroya-bg)] border border-[var(--mroya-divider)] text-[12.5px] text-[var(--mroya-text)]"
                              >
                                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                                <span>{fact}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-[13px] text-[var(--mroya-text-muted)]">
                          {selectedHistoryEvent.status === 'fast_rejected'
                            ? 'Событие отклонено первым фильтром — глубокий анализ не проводился.'
                            : 'Событие находится в очереди глубокого анализа.'}
                        </p>
                      )}
                    </div>

                    {/* Timeline audit log */}
                    <div className="p-5 rounded-[12px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] space-y-3">
                      <div className="text-[13px] font-semibold text-[var(--mroya-text)] flex items-center gap-2">
                        <Layers className="w-4 h-4 text-[var(--mroya-primary)]" />
                        <span>История обработки (Audit Log)</span>
                      </div>
                      <div className="relative pl-6 space-y-3 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[2px] before:bg-[var(--mroya-divider)]">
                        {selectedHistoryEvent.history.map((hist) => (
                          <div key={hist.id} className="relative text-[12px]">
                            <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-[var(--mroya-primary)] ring-4 ring-[var(--mroya-surface)]" />
                            <div className="flex items-center gap-2 text-[11px] text-[var(--mroya-text-muted)]">
                              <span className="font-semibold text-[var(--mroya-text)]">
                                {hist.stageName}
                              </span>
                              <span>·</span>
                              <span>{hist.actorLabel}</span>
                              <span>·</span>
                              <span>{hist.timestamp}</span>
                            </div>
                            <p className="mt-0.5 text-[12.5px] text-[var(--mroya-text)]">
                              {hist.description}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center p-8 text-center text-[var(--mroya-text-muted)]">
                  Выберите запись для просмотра
                </div>
              )}
            </main>
          </div>
        </div>
      )}
    </div>
  );
};
