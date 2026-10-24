import React, { useState, useMemo } from 'react';
import {
  Inbox,
  Sparkles,
  Check,
  X,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Search,
  Filter,
  Calendar as CalendarIcon,
  ChevronRight,
  Brain,
  Layers,
  ArrowRight,
  BookOpen,
  Send,
  User,
  Users,
  MapPin,
  Tag,
  Menu,
  PanelLeft,
  ArrowLeft,
  ShieldCheck,
  Info,
  HelpCircle,
  TrendingUp,
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
  // Event records state (pure UI demonstration state)
  const [events, setEvents] = useState<PipelineEventItem[]>(() => initialEvents ?? DEFAULT_PIPELINE_EVENTS);
  const [selectedEventId, setSelectedEventId] = useState<string | null>('pipe-evt-1');
  const [activeStageFilter, setActiveStageFilter] = useState<PipelineFilterStage>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  // Show transient toast
  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage((current) => (current === message ? null : current));
    }, 3500);
  };

  // Recompute statistics dynamically
  const stats: PipelineStats = useMemo(() => computePipelineStats(events), [events]);

  // Filtered events
  const filteredEvents = useMemo(() => {
    return events.filter((item) => {
      // Stage filter
      if (activeStageFilter !== 'all') {
        if (activeStageFilter === 'fast_approved' && item.fastFilter.decision !== 'APPROVE') {
          return false;
        } else if (activeStageFilter !== 'fast_approved' && item.status !== activeStageFilter) {
          return false;
        }
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
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
  }, [events, activeStageFilter, searchQuery]);

  // Active selected event
  const selectedEvent = useMemo(() => {
    return events.find((e) => e.id === selectedEventId) ?? filteredEvents[0] ?? events[0] ?? null;
  }, [events, selectedEventId, filteredEvents]);

  // Action: Send rejected event to deep analysis
  const handleSendToAnalysis = (eventId: string) => {
    setEvents((prev) =>
      prev.map((evt) => {
        if (evt.id !== eventId) return evt;
        const now = 'Только что';
        return {
          ...evt,
          status: 'in_queue',
          fastFilter: {
            ...evt.fastFilter,
            decision: 'APPROVE',
            rationale: 'Передано на анализ пользователем вручную (исправление первичной классификации).',
          },
          history: [
            ...evt.history,
            {
              id: `h-${Date.now()}`,
              timestamp: now,
              stageName: 'Ручная отправка на анализ',
              actor: 'user',
              actorLabel: 'Пользователь',
              description: 'Событие передано на глубокий анализ в обход автоматического отклонения.',
            },
          ],
        };
      })
    );
    showToast('Событие успешно отправлено в очередь глубокого анализа');
  };

  // Action: Confirm proposed memory
  const handleConfirmProposal = (eventId: string) => {
    setEvents((prev) =>
      prev.map((evt) => {
        if (evt.id !== eventId) return evt;
        const now = 'Только что';
        return {
          ...evt,
          status: 'committed',
          committedMemoryId: evt.committedMemoryId || `mem-${evt.id}`,
          history: [
            ...evt.history,
            {
              id: `h-${Date.now()}`,
              timestamp: now,
              stageName: 'Подтверждено пользователем',
              actor: 'user',
              actorLabel: 'Пользователь',
              description: 'Предложение одобрено и зафиксировано в долговременной памяти.',
            },
          ],
        };
      })
    );
    showToast('Предложение подтверждено и сохранено в долговременную память');
  };

  // Action: Decline proposed memory
  const handleDeclineProposal = (eventId: string) => {
    setEvents((prev) =>
      prev.map((evt) => {
        if (evt.id !== eventId) return evt;
        const now = 'Только что';
        return {
          ...evt,
          status: 'declined',
          history: [
            ...evt.history,
            {
              id: `h-${Date.now()}`,
              timestamp: now,
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

  // Action: Reset demo data
  const handleResetDemoData = () => {
    setEvents(DEFAULT_PIPELINE_EVENTS);
    setSelectedEventId('pipe-evt-1');
    setActiveStageFilter('all');
    setSearchQuery('');
    showToast('Демонстрационные данные сброшены к начальному состоянию');
  };

  return (
    <div className="flex-1 flex flex-col h-full min-w-0 bg-[var(--mroya-bg)] overflow-hidden">
      {/* Toast notification */}
      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-[10px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] shadow-[var(--mroya-shadow-elevated)] text-[13px] font-medium text-[var(--mroya-text)] animate-in fade-in slide-in-from-bottom-2"
        >
          <Sparkles className="w-4 h-4 text-[var(--mroya-brand-honey)] shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header */}
      <header className="px-4 sm:px-6 py-3.5 border-b border-[var(--mroya-divider)] bg-[var(--mroya-surface)] flex items-center justify-between gap-3 shrink-0">
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

          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-[8px] bg-[var(--mroya-primary)]/10 text-[var(--mroya-primary)] flex items-center justify-center shrink-0">
              <Inbox className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-[16px] sm:text-[18px] font-semibold text-[var(--mroya-text)] truncate">
                  Memory Inbox
                </h1>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[var(--mroya-surface-muted)] text-[var(--mroya-text-muted)] border border-[var(--mroya-divider)] hidden sm:inline-block">
                  Предложения в память
                </span>
              </div>
              <p className="text-[12px] text-[var(--mroya-text-muted)] truncate hidden sm:block">
                События из календаря, отобранные AI для сохранения в долговременную память
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleResetDemoData}
            title="Сбросить демонстрационные данные"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[12px] font-medium text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)] border border-[var(--mroya-divider)] transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Сброс демо</span>
          </button>
        </div>
      </header>

      {/* Main Scrollable Content */}
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
                Автоматический двухступенчатый конвейер извлечения персонального контекста из календаря
              </p>
            </div>

            {/* AI Fast Filter Rule Pill Notice */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[8px] bg-[var(--mroya-surface-muted)] border border-[var(--mroya-divider)] text-[11.5px] text-[var(--mroya-text-muted)] self-start md:self-auto">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Правило фильтра 1: сомнительное всегда одобряется (APPROVE)</span>
            </div>
          </div>

          {/* 7 Compact Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
            {/* 1. Всего обнаружено */}
            <div
              onClick={() => setActiveStageFilter('all')}
              className={`p-3 rounded-[10px] border transition-all cursor-pointer ${
                activeStageFilter === 'all'
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
              onClick={() => setActiveStageFilter('pending_check')}
              className={`p-3 rounded-[10px] border transition-all cursor-pointer ${
                activeStageFilter === 'pending_check'
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
              onClick={() => setActiveStageFilter('fast_approved')}
              className={`p-3 rounded-[10px] border transition-all cursor-pointer ${
                activeStageFilter === 'fast_approved'
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
              onClick={() => setActiveStageFilter('fast_rejected')}
              className={`p-3 rounded-[10px] border transition-all cursor-pointer ${
                activeStageFilter === 'fast_rejected'
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
              onClick={() => setActiveStageFilter('in_queue')}
              className={`p-3 rounded-[10px] border transition-all cursor-pointer ${
                activeStageFilter === 'in_queue'
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
              onClick={() => setActiveStageFilter('awaiting_confirmation')}
              className={`p-3 rounded-[10px] border transition-all cursor-pointer ${
                activeStageFilter === 'awaiting_confirmation'
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
              onClick={() => setActiveStageFilter('committed')}
              className={`p-3 rounded-[10px] border transition-all cursor-pointer ${
                activeStageFilter === 'committed'
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
              {/* Step 1 */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-[var(--mroya-surface-muted)] border border-[var(--mroya-divider)] font-medium text-[var(--mroya-text)]">
                <CalendarIcon className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span>1. Обнаружение</span>
                <span className="text-[11px] text-[var(--mroya-text-muted)] tabular-nums">
                  ({stats.totalDetected})
                </span>
              </div>

              <ChevronRight className="w-3.5 h-3.5 text-[var(--mroya-text-muted)] shrink-0" />

              {/* Step 2 */}
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

              {/* Step 3 */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-[var(--mroya-surface-muted)] border border-[var(--mroya-divider)] font-medium text-[var(--mroya-text)]">
                <Brain className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span>3. Глубокий анализ</span>
                <span className="text-[11px] text-[var(--mroya-text-muted)] tabular-nums">
                  ({stats.inDeepQueue + stats.awaitingConfirmation + stats.committed})
                </span>
              </div>

              <ChevronRight className="w-3.5 h-3.5 text-[var(--mroya-text-muted)] shrink-0" />

              {/* Step 4 */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-amber-500/10 border border-amber-500/30 font-medium text-amber-700 dark:text-amber-300">
                <Inbox className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>4. Подтверждение</span>
                <span className="text-[11px] font-bold tabular-nums">
                  ({stats.awaitingConfirmation})
                </span>
              </div>

              <ChevronRight className="w-3.5 h-3.5 text-[var(--mroya-text-muted)] shrink-0" />

              {/* Step 5 */}
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
          {/* SECTION 2: Список событий и предложений (Master List) */}
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
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск по событиям, описанию, участникам…"
                  className="w-full pl-9 pr-8 py-1.5 text-[13px] rounded-[8px] bg-[var(--mroya-bg)] border border-[var(--mroya-divider)] text-[var(--mroya-text)] placeholder-[var(--mroya-text-muted)] focus:outline-none focus:border-[var(--mroya-primary)]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
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
                  onClick={() => setActiveStageFilter('all')}
                  className={`px-2.5 py-1 rounded-[6px] font-medium whitespace-nowrap cursor-pointer transition-colors ${
                    activeStageFilter === 'all'
                      ? 'bg-[var(--mroya-primary)] text-[var(--mroya-on-primary)]'
                      : 'text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)]'
                  }`}
                >
                  Все ({stats.totalDetected})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveStageFilter('awaiting_confirmation')}
                  className={`px-2.5 py-1 rounded-[6px] font-medium whitespace-nowrap cursor-pointer transition-colors ${
                    activeStageFilter === 'awaiting_confirmation'
                      ? 'bg-amber-600 text-white dark:bg-amber-500'
                      : 'text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)]'
                  }`}
                >
                  На подтверждении ({stats.awaitingConfirmation})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveStageFilter('in_queue')}
                  className={`px-2.5 py-1 rounded-[6px] font-medium whitespace-nowrap cursor-pointer transition-colors ${
                    activeStageFilter === 'in_queue'
                      ? 'bg-indigo-600 text-white dark:bg-indigo-500'
                      : 'text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)]'
                  }`}
                >
                  В очереди ({stats.inDeepQueue})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveStageFilter('fast_rejected')}
                  className={`px-2.5 py-1 rounded-[6px] font-medium whitespace-nowrap cursor-pointer transition-colors ${
                    activeStageFilter === 'fast_rejected'
                      ? 'bg-zinc-700 text-white dark:bg-zinc-600'
                      : 'text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)]'
                  }`}
                >
                  Отклонено ({stats.fastRejected})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveStageFilter('pending_check')}
                  className={`px-2.5 py-1 rounded-[6px] font-medium whitespace-nowrap cursor-pointer transition-colors ${
                    activeStageFilter === 'pending_check'
                      ? 'bg-sky-600 text-white dark:bg-sky-500'
                      : 'text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)]'
                  }`}
                >
                  Ожидают ({stats.pendingCheck})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveStageFilter('committed')}
                  className={`px-2.5 py-1 rounded-[6px] font-medium whitespace-nowrap cursor-pointer transition-colors ${
                    activeStageFilter === 'committed'
                      ? 'bg-emerald-600 text-white dark:bg-emerald-500'
                      : 'text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)]'
                  }`}
                >
                  В памяти ({stats.committed})
                </button>
              </div>
            </div>

            {/* Events List */}
            <div className="flex-1 overflow-y-auto divide-y divide-[var(--mroya-divider)] min-h-0">
              {filteredEvents.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <Inbox className="w-8 h-8 text-[var(--mroya-text-muted)] mx-auto opacity-50" />
                  <p className="text-[13px] font-medium text-[var(--mroya-text)]">
                    Записи не найдены
                  </p>
                  <p className="text-[12px] text-[var(--mroya-text-muted)]">
                    Попробуйте изменить поисковый запрос или фильтр по стадиям.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveStageFilter('all');
                      setSearchQuery('');
                    }}
                    className="mt-2 text-[12px] text-[var(--mroya-primary)] font-medium hover:underline cursor-pointer"
                  >
                    Показать все записи
                  </button>
                </div>
              ) : (
                filteredEvents.map((item) => {
                  const isSelected = selectedEvent?.id === item.id;
                  const isApproved = item.fastFilter.decision === 'APPROVE';
                  const isRejected = item.fastFilter.decision === 'REJECT';
                  const isPending = item.status === 'pending_check';
                  const isAwaiting = item.status === 'awaiting_confirmation';
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
                      {/* Top row: Source badge, date, status */}
                      <div className="flex items-center justify-between gap-2 text-[11.5px] text-[var(--mroya-text-muted)] mb-1.5">
                        <div className="flex items-center gap-1.5 truncate">
                          <CalendarIcon className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <span className="font-medium text-[var(--mroya-text)] truncate">
                            {item.sourceCalendarName || 'Календарь'}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="truncate">{item.sourceDate}</span>
                        </div>

                        {/* Fast Filter Indicator */}
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

                      {/* Title */}
                      <h3 className="text-[13.5px] font-semibold text-[var(--mroya-text)] leading-[19px] line-clamp-2">
                        {item.title}
                      </h3>

                      {/* Short Description */}
                      <p className="mt-1 text-[12px] text-[var(--mroya-text-muted)] leading-[17px] line-clamp-2">
                        {item.shortDescription}
                      </p>

                      {/* Bottom status badge row */}
                      <div className="mt-2.5 flex items-center justify-between gap-2 pt-2 border-t border-[var(--mroya-divider)]/40 text-[11px]">
                        <div>
                          {isAwaiting && (
                            <span className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
                              <Inbox className="w-3 h-3" />
                              <span>Ожидает подтверждения</span>
                            </span>
                          )}
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

                        {/* Confidence score */}
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

          {/* SECTION 3 & 4: Подробности записи и действия (Detail View) */}
          <main
            className={`flex-1 flex flex-col bg-[var(--mroya-bg)] min-w-0 overflow-y-auto ${
              mobileDetailOpen ? 'flex' : 'hidden lg:flex'
            }`}
          >
            {selectedEvent ? (
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
                    Запись #{selectedEvent.id.replace('pipe-evt-', '')}
                  </span>
                </div>

                {/* Top Action Banner / Status Card */}
                <div className="p-4 sm:p-5 rounded-[12px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] shadow-[var(--mroya-shadow-subtle)] space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-[12px] text-[var(--mroya-text-muted)]">
                        <span className="inline-flex items-center gap-1 font-medium text-[var(--mroya-text)]">
                          <CalendarIcon className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <span>{selectedEvent.sourceCalendarName}</span>
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{selectedEvent.sourceDate}</span>
                        {selectedEvent.sourceLocation && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              <span>{selectedEvent.sourceLocation}</span>
                            </span>
                          </>
                        )}
                      </div>

                      <h2 className="text-[18px] sm:text-[20px] font-semibold text-[var(--mroya-text)] leading-[26px]">
                        {selectedEvent.title}
                      </h2>
                    </div>

                    {/* Status Badge */}
                    <div className="shrink-0 self-start sm:self-center">
                      {selectedEvent.status === 'awaiting_confirmation' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                          <Inbox className="w-3.5 h-3.5" />
                          <span>Ожидает вашего подтверждения</span>
                        </span>
                      )}
                      {selectedEvent.status === 'committed' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold bg-emerald-600/15 text-emerald-700 dark:text-emerald-300 border border-emerald-600/30">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>Сохранено в память</span>
                        </span>
                      )}
                      {selectedEvent.status === 'fast_rejected' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border border-zinc-500/30">
                          <X className="w-3.5 h-3.5" />
                          <span>Отклонено AI (шум)</span>
                        </span>
                      )}
                      {selectedEvent.status === 'in_queue' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30">
                          <Brain className="w-3.5 h-3.5" />
                          <span>В очереди глубокого анализа</span>
                        </span>
                      )}
                      {selectedEvent.status === 'pending_check' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Ожидает первого фильтра AI</span>
                        </span>
                      )}
                      {selectedEvent.status === 'declined' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border border-zinc-500/30">
                          <X className="w-3.5 h-3.5" />
                          <span>Отклонено пользователем</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* USER ACTION BUTTONS */}
                  <div className="pt-3 border-t border-[var(--mroya-divider)] flex flex-wrap items-center gap-2.5">
                    {/* Action: Send to analysis for mistakenly rejected */}
                    {selectedEvent.status === 'fast_rejected' && (
                      <button
                        type="button"
                        onClick={() => handleSendToAnalysis(selectedEvent.id)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-[8px] bg-[var(--mroya-primary)] hover:bg-[var(--mroya-primary-hover)] text-[var(--mroya-on-primary)] text-[13px] font-semibold shadow-sm transition-colors cursor-pointer"
                      >
                        <Send className="w-4 h-4" />
                        <span>Передать на анализ</span>
                      </button>
                    )}

                    {/* Action: Confirm & Decline for awaiting confirmation */}
                    {selectedEvent.status === 'awaiting_confirmation' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleConfirmProposal(selectedEvent.id)}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-[8px] bg-emerald-600 hover:bg-emerald-700 text-white text-[13px] font-semibold shadow-sm transition-colors cursor-pointer"
                        >
                          <Check className="w-4 h-4" />
                          <span>Подтвердить и сохранить в память</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeclineProposal(selectedEvent.id)}
                          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-[8px] bg-[var(--mroya-surface-muted)] hover:bg-rose-500/15 text-[var(--mroya-text)] hover:text-rose-600 dark:hover:text-rose-400 text-[13px] font-medium border border-[var(--mroya-divider)] transition-colors cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                          <span>Отклонить</span>
                        </button>
                      </>
                    )}

                    {/* Action: Open in Memory for committed */}
                    {selectedEvent.status === 'committed' && (
                      <button
                        type="button"
                        onClick={() => {
                          if (onNavigateToMemory) {
                            onNavigateToMemory(selectedEvent.committedMemoryId);
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

                    {selectedEvent.status === 'in_queue' && (
                      <div className="text-[12.5px] text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 font-medium">
                        <Brain className="w-4 h-4 animate-pulse" />
                        <span>Событие находится в очереди глубокого извлечения фактов…</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Grid of Details: 1. Исходное событие, 2. Решение AI, 3. Предложение в память */}
                <div className="grid grid-cols-1 gap-5">
                  {/* CARD 1: Исходное событие */}
                  <div className="p-5 rounded-[12px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-[13px] font-semibold text-[var(--mroya-text)] flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4 text-blue-500" />
                        <span>Исходное событие из календаря</span>
                      </div>
                      <span className="text-[11px] font-medium text-[var(--mroya-text-muted)]">
                        Google Calendar
                      </span>
                    </div>

                    <div className="p-3.5 rounded-[8px] bg-[var(--mroya-bg)] border border-[var(--mroya-divider)] text-[13px] text-[var(--mroya-text)] leading-[21px]">
                      {selectedEvent.rawEventSnippet}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-[12px]">
                      <div>
                        <div className="text-[11px] font-medium text-[var(--mroya-text-muted)] mb-0.5">
                          Календарь и аккаунт
                        </div>
                        <div className="text-[var(--mroya-text)] font-medium">
                          {selectedEvent.sourceCalendarName} ({selectedEvent.sourceAccount})
                        </div>
                      </div>

                      {selectedEvent.sourceAttendees && selectedEvent.sourceAttendees.length > 0 && (
                        <div>
                          <div className="text-[11px] font-medium text-[var(--mroya-text-muted)] mb-0.5">
                            Участники встречи
                          </div>
                          <div className="text-[var(--mroya-text)]">
                            {selectedEvent.sourceAttendees.join(' · ')}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* CARD 2: Решение AI (Первый быстрый фильтр) */}
                  <div className="p-5 rounded-[12px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-[13px] font-semibold text-[var(--mroya-text)] flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-[var(--mroya-brand-honey)]" />
                        <span>Решение первого AI-фильтра (Tier 1: Fast Filter)</span>
                      </div>

                      {/* Decision Pill */}
                      <div>
                        {selectedEvent.fastFilter.decision === 'APPROVE' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] text-[11.5px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                            <Check className="w-3.5 h-3.5" />
                            <span>APPROVE (передать на глубокий анализ)</span>
                          </span>
                        )}
                        {selectedEvent.fastFilter.decision === 'REJECT' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] text-[11.5px] font-bold bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border border-zinc-500/30">
                            <X className="w-3.5 h-3.5" />
                            <span>REJECT (отклонить как шум)</span>
                          </span>
                        )}
                        {selectedEvent.fastFilter.decision === 'PENDING' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] text-[11.5px] font-medium bg-sky-500/15 text-sky-700 dark:text-sky-300">
                            <Clock className="w-3.5 h-3.5" />
                            <span>В процессе оценки</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* AI Logic Explanation Banner */}
                    <div className="p-3.5 rounded-[10px] bg-[var(--mroya-surface-muted)] border border-[var(--mroya-divider)] space-y-1.5">
                      <div className="flex items-center justify-between text-[11.5px] text-[var(--mroya-text-muted)]">
                        <span className="font-semibold uppercase tracking-wider text-[var(--mroya-text)]">
                          Обоснование модели:
                        </span>
                        {selectedEvent.fastFilter.confidence > 0 && (
                          <span className="font-medium tabular-nums">
                            Уверенность: {selectedEvent.fastFilter.confidence}%
                          </span>
                        )}
                      </div>
                      <p className="text-[13px] text-[var(--mroya-text)] leading-[21px]">
                        {selectedEvent.fastFilter.rationale}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-[12px]">
                      <div>
                        <div className="text-[11px] font-medium text-[var(--mroya-text-muted)] mb-0.5">
                          Сработавшее правило классификатора
                        </div>
                        <div className="text-[var(--mroya-text)] font-medium">
                          {selectedEvent.fastFilter.ruleMatched}
                        </div>
                      </div>

                      <div>
                        <div className="text-[11px] font-medium text-[var(--mroya-text-muted)] mb-0.5">
                          Принцип фильтрации
                        </div>
                        <div className="text-[var(--mroya-text-muted)]">
                          {selectedEvent.fastFilter.isDoubtfulDefaultApprove
                            ? 'Сомнительное событие — одобрено для предотвращения ложного пропуска.'
                            : 'Бинарное решение: отсечение явного шума перед тяжелыми моделями.'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* CARD 3: Предлагаемая информация для памяти (Deep Analysis) */}
                  <div className="p-5 rounded-[12px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-[13px] font-semibold text-[var(--mroya-text)] flex items-center gap-2">
                        <Brain className="w-4 h-4 text-indigo-500" />
                        <span>Предлагаемая информация для памяти (AI Deep Analysis)</span>
                      </div>
                      {selectedEvent.deepAnalysis && (
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                          {selectedEvent.deepAnalysis.proposedCategory}
                        </span>
                      )}
                    </div>

                    {selectedEvent.deepAnalysis ? (
                      <div className="space-y-3.5">
                        <div className="space-y-1">
                          <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mroya-text-muted)]">
                            Предлагаемый заголовок
                          </div>
                          <div className="text-[15px] font-semibold text-[var(--mroya-text)]">
                            {selectedEvent.deepAnalysis.proposedTitle}
                          </div>
                          <p className="text-[13px] text-[var(--mroya-text)] leading-[21px]">
                            {selectedEvent.deepAnalysis.proposedSummary}
                          </p>
                        </div>

                        {/* Extracted Facts */}
                        <div className="space-y-1.5">
                          <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mroya-text-muted)]">
                            Факты, подготовленные для сохранения в память:
                          </div>
                          <div className="space-y-1.5">
                            {selectedEvent.deepAnalysis.factsToExtract.map((fact, idx) => (
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

                        {/* Connected Entities */}
                        {selectedEvent.deepAnalysis.connectedEntities.length > 0 && (
                          <div className="space-y-1 pt-1">
                            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mroya-text-muted)]">
                              Связанные сущности (Entities):
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {selectedEvent.deepAnalysis.connectedEntities.map((ent, i) => (
                                <span
                                  key={i}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[6px] bg-[var(--mroya-surface-muted)] border border-[var(--mroya-divider)] text-[11.5px] font-medium text-[var(--mroya-text)]"
                                >
                                  <Users className="w-3 h-3 text-[var(--mroya-primary)]" />
                                  <span>{ent}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-4 rounded-[8px] bg-[var(--mroya-surface-muted)] border border-[var(--mroya-divider)] text-center space-y-1">
                        <Info className="w-4 h-4 text-[var(--mroya-text-muted)] mx-auto" />
                        <p className="text-[12.5px] text-[var(--mroya-text)] font-medium">
                          {selectedEvent.status === 'fast_rejected'
                            ? 'Событие отклонено первым фильтром — глубокий анализ не проводился.'
                            : 'Событие находится в очереди на глубокий анализ моделей второго уровня.'}
                        </p>
                        {selectedEvent.status === 'fast_rejected' && (
                          <p className="text-[11.5px] text-[var(--mroya-text-muted)]">
                            Нажмите «Передать на анализ» выше, если AI ошибся и событие полезно.
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* CARD 4: История обработки (Audit Log / History Timeline) */}
                  <div className="p-5 rounded-[12px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] space-y-3">
                    <div className="text-[13px] font-semibold text-[var(--mroya-text)] flex items-center gap-2">
                      <Layers className="w-4 h-4 text-[var(--mroya-primary)]" />
                      <span>История обработки (Audit Log)</span>
                    </div>

                    <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[2px] before:bg-[var(--mroya-divider)]">
                      {selectedEvent.history.map((hist) => (
                        <div key={hist.id} className="relative text-[12px]">
                          {/* Dot indicator */}
                          <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-[var(--mroya-primary)] ring-4 ring-[var(--mroya-surface)]" />

                          <div className="flex flex-wrap items-center gap-2 text-[11.5px]">
                            <span className="font-semibold text-[var(--mroya-text)]">
                              {hist.stageName}
                            </span>
                            <span aria-hidden="true" className="text-[var(--mroya-text-muted)]">
                              ·
                            </span>
                            <span className="text-[var(--mroya-text-muted)]">
                              {hist.actorLabel}
                            </span>
                            <span aria-hidden="true" className="text-[var(--mroya-text-muted)]">
                              ·
                            </span>
                            <span className="text-[var(--mroya-text-muted)] tabular-nums">
                              {hist.timestamp}
                            </span>
                          </div>

                          <p className="mt-1 text-[12.5px] text-[var(--mroya-text)] leading-[18px]">
                            {hist.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center p-8 text-center">
                <div className="space-y-2 max-w-sm">
                  <Inbox className="w-10 h-10 text-[var(--mroya-text-muted)] mx-auto opacity-40" />
                  <h3 className="text-[15px] font-semibold text-[var(--mroya-text)]">
                    Выберите запись для просмотра
                  </h3>
                  <p className="text-[12.5px] text-[var(--mroya-text-muted)]">
                    Нажмите на любое событие из списка слева, чтобы ознакомиться с подробностями решения AI и предложить факты в память.
                  </p>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};
