import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  X,
  Clock,
  Loader2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Ban,
  RotateCcw,
  Copy,
  Check,
  Send,
  Play,
  ChevronRight,
} from 'lucide-react';
import type { AiTask, AiTaskStatus } from '../types/aiTasks';

export interface AiTasksDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: AiTask[];
  onUpdateTask: (updatedTask: AiTask) => void;
  onSimulateComplete: () => void;
  onResetTasks?: () => void;
  highlightTaskId?: string | null;
}

export type CompactTab = 'active' | 'completed' | 'issues';

export const AiTasksDrawer: React.FC<AiTasksDrawerProps> = ({
  isOpen,
  onClose,
  tasks,
  onUpdateTask,
  onSimulateComplete,
  highlightTaskId,
}) => {
  const [activeTab, setActiveTab] = useState<CompactTab>('active');
  const [copiedTaskId, setCopiedTaskId] = useState<string | null>(null);
  const [customReplyTaskId, setCustomReplyTaskId] = useState<string | null>(null);
  const [customReplyText, setCustomReplyText] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Filter tasks: NO 'all' tab per user requirement.
  const filteredTasks = tasks.filter((task) => {
    switch (activeTab) {
      case 'active':
        return ['running', 'queued', 'needs_clarification'].includes(task.status);
      case 'completed':
        return task.status === 'completed';
      case 'issues':
        return ['error', 'cancelled'].includes(task.status);
      default:
        return true;
    }
  });

  // Sort tasks: items requiring clarification MUST be pinned to the top and highlighted
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    if (a.status === 'needs_clarification' && b.status !== 'needs_clarification') return -1;
    if (b.status === 'needs_clarification' && a.status !== 'needs_clarification') return 1;
    if (a.status === 'running' && b.status !== 'running') return -1;
    if (b.status === 'running' && a.status !== 'running') return 1;
    return 0;
  });

  const activeCount = tasks.filter((t) =>
    ['running', 'queued', 'needs_clarification'].includes(t.status)
  ).length;
  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const issuesCount = tasks.filter((t) => ['error', 'cancelled'].includes(t.status)).length;

  const handleAnswerClarification = (task: AiTask, answer: string) => {
    onUpdateTask({
      ...task,
      status: 'running',
      clarificationAnswer: answer,
      progressPercent: 35,
      currentStep: `Выбран вариант «${answer}». Продолжение обработки...`,
      updatedAt: 'Только что',
    });
    setCustomReplyTaskId(null);
    setCustomReplyText('');
  };

  const handleRetryTask = (task: AiTask) => {
    onUpdateTask({
      ...task,
      status: 'running',
      progressPercent: 20,
      currentStep: 'Повторный запуск...',
      errorMessage: undefined,
      updatedAt: 'Только что',
    });
  };

  const handleCopyLogs = (task: AiTask) => {
    const errorPayload = `[AI Task Error Report]
ID: ${task.id}
Задача: ${task.title}
Статус: ${task.status}
Ошибка: ${task.errorMessage || 'Неизвестная ошибка'}
Запрос пользователя: ${task.userPrompt}
Время: ${task.updatedAt || task.createdAt}`;

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(errorPayload).catch(() => {});
    } else {
      try {
        const ta = document.createElement('textarea');
        ta.value = errorPayload;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      } catch (e) {}
    }
    setCopiedTaskId(task.id);
    setTimeout(() => setCopiedTaskId(null), 2000);
  };

  const renderStatusBadge = (status: AiTaskStatus) => {
    switch (status) {
      case 'queued':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-400">
            <Clock className="w-3 h-3" />
            <span>В очереди</span>
          </span>
        );
      case 'running':
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-600 dark:text-blue-400">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Выполняется</span>
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-3 h-3" />
            <span>Завершена</span>
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
            <AlertCircle className="w-3 h-3" />
            <span>Ошибка</span>
          </span>
        );
      case 'needs_clarification':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 dark:text-amber-300">
            <HelpCircle className="w-3 h-3" />
            <span>Требует уточнения</span>
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--mroya-text-muted)]">
            <Ban className="w-3 h-3" />
            <span>Отменена</span>
          </span>
        );
    }
  };

  return (
    <div
      role="dialog"
      aria-label="Задачи AI"
      aria-modal="true"
      className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-[1px] transition-opacity"
    >
      {/* Backdrop */}
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      {/* Drawer Container (Compact, minimal, mobile-optimized) */}
      <div className="relative z-10 w-full sm:max-w-[420px] h-full bg-[var(--mroya-surface)] border-l border-[var(--mroya-divider)] shadow-[var(--mroya-shadow-elevated)] flex flex-col min-h-0 animate-in slide-in-from-right-4 duration-150">
        
        {/* Compact Header */}
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-[var(--mroya-divider)] bg-[var(--mroya-surface)] shrink-0 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[var(--mroya-brand-honey)]" />
              <h2 className="text-[15px] font-semibold text-[var(--mroya-text)]">
                Задачи AI
              </h2>
              {activeCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-700 dark:text-blue-300">
                  {activeCount}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onSimulateComplete}
                title="Смоделировать завершение задачи"
                className="px-2 py-0.5 rounded text-[11px] font-medium text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)] transition-colors cursor-pointer inline-flex items-center gap-1"
              >
                <Play className="w-2.5 h-2.5 text-emerald-600" />
                <span className="hidden sm:inline">Тест</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Закрыть"
                className="w-7 h-7 rounded-lg inline-flex items-center justify-center text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Clean Compact Tabs (NO 'all' tab) */}
          <div className="flex items-center gap-1 pt-0.5">
            <button
              type="button"
              onClick={() => setActiveTab('active')}
              className={`px-3 py-1 rounded-full text-[11.5px] font-semibold transition-colors cursor-pointer ${
                activeTab === 'active'
                  ? 'bg-[var(--mroya-surface-active)] text-[var(--mroya-text)]'
                  : 'text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)]'
              }`}
            >
              Активные ({activeCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('completed')}
              className={`px-3 py-1 rounded-full text-[11.5px] font-semibold transition-colors cursor-pointer ${
                activeTab === 'completed'
                  ? 'bg-[var(--mroya-surface-active)] text-[var(--mroya-text)]'
                  : 'text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)]'
              }`}
            >
              Завершенные ({completedCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('issues')}
              className={`px-3 py-1 rounded-full text-[11.5px] font-semibold transition-colors cursor-pointer ${
                activeTab === 'issues'
                  ? 'bg-[var(--mroya-surface-active)] text-[var(--mroya-text)]'
                  : 'text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)]'
              }`}
            >
              Ошибки ({issuesCount})
            </button>
          </div>
        </div>

        {/* Task Cards List (Minimal, compact, uncluttered) */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5 min-h-0">
          {sortedTasks.length === 0 ? (
            <div className="py-12 text-center text-[12px] text-[var(--mroya-text-muted)]">
              Нет задач в этой категории
            </div>
          ) : (
            sortedTasks.map((task) => {
              const isClarifying = task.status === 'needs_clarification';
              const isError = task.status === 'error';
              const isRunning = task.status === 'running';
              const isHighlighted = highlightTaskId === task.id;

              return (
                <div
                  key={task.id}
                  className={`p-3 rounded-[12px] border transition-all ${
                    isClarifying
                      ? 'border-amber-500/50 bg-amber-500/8 dark:bg-amber-950/20 ring-1 ring-amber-500/20'
                      : isHighlighted
                      ? 'border-[var(--mroya-primary)] bg-[var(--mroya-surface-active)]/40'
                      : 'border-[var(--mroya-divider)] bg-[var(--mroya-surface)]'
                  } space-y-2 text-[13px] shadow-2xs`}
                >
                  {/* Top line: Status + Time */}
                  <div className="flex items-center justify-between gap-2">
                    {renderStatusBadge(task.status)}
                    <span className="text-[11px] text-[var(--mroya-text-muted)] tabular-nums">
                      {task.updatedAt || task.createdAt}
                    </span>
                  </div>

                  {/* Task title */}
                  <p className="font-semibold text-[var(--mroya-text)] leading-snug">
                    {task.title}
                  </p>

                  {/* Running state progress */}
                  {isRunning && (
                    <div className="space-y-1.5 pt-0.5">
                      <div className="flex items-center justify-between text-[11px] text-[var(--mroya-text-muted)]">
                        <span className="truncate">{task.currentStep || 'Обработка...'}</span>
                        <span className="tabular-nums font-semibold shrink-0 ml-1">
                          {task.progressPercent ?? 50}%
                        </span>
                      </div>
                      <div className="w-full h-1 rounded-full bg-[var(--mroya-surface-muted)] overflow-hidden">
                        <div
                          className="h-full bg-blue-600 rounded-full transition-all duration-300"
                          style={{ width: `${task.progressPercent ?? 50}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Needs clarification: pinned & highlighted with quick buttons */}
                  {isClarifying && (
                    <div className="pt-1 space-y-2 border-t border-amber-500/20">
                      <p className="text-[12px] text-[var(--mroya-text)] font-medium">
                        {task.clarificationQuestion}
                      </p>

                      {task.clarificationOptions && task.clarificationOptions.length > 0 && (
                        <div className="flex flex-col gap-1.5 pt-0.5">
                          {task.clarificationOptions.map((opt) => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => handleAnswerClarification(task, opt)}
                              className="w-full py-1.5 px-2.5 rounded-lg text-left text-[11.5px] font-semibold bg-[var(--mroya-surface)] hover:bg-[var(--mroya-surface-active)] text-[var(--mroya-text)] border border-amber-500/30 flex items-center justify-between transition-colors cursor-pointer"
                            >
                              <span>{opt}</span>
                              <ChevronRight className="w-3.5 h-3.5 text-[var(--mroya-text-muted)]" />
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Custom answer inline input */}
                      {customReplyTaskId === task.id ? (
                        <div className="flex items-center gap-1.5 pt-1">
                          <input
                            type="text"
                            value={customReplyText}
                            onChange={(e) => setCustomReplyText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && customReplyText.trim()) {
                                handleAnswerClarification(task, customReplyText.trim());
                              }
                            }}
                            placeholder="Напишите ответ..."
                            className="flex-1 px-2.5 py-1 rounded-md text-[11.5px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] text-[var(--mroya-text)] focus:outline-none"
                            autoFocus
                          />
                          <button
                            type="button"
                            disabled={!customReplyText.trim()}
                            onClick={() => handleAnswerClarification(task, customReplyText.trim())}
                            className="px-2 py-1 rounded-md bg-[var(--mroya-primary)] text-[var(--mroya-on-primary)] text-[11px] font-semibold disabled:opacity-40 cursor-pointer"
                          >
                            <Send className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setCustomReplyTaskId(task.id)}
                          className="text-[11px] text-[var(--mroya-primary)] hover:underline font-medium cursor-pointer"
                        >
                          Другой вариант...
                        </button>
                      )}
                    </div>
                  )}

                  {/* Completed result */}
                  {task.status === 'completed' && task.resultSummary && (
                    <p className="text-[12px] text-[var(--mroya-text-muted)] leading-snug">
                      {task.resultSummary}
                    </p>
                  )}

                  {/* Error state with retry and copy logs buttons */}
                  {isError && (
                    <div className="space-y-2 pt-1 border-t border-[var(--mroya-divider)]">
                      <p className="text-[11.5px] text-rose-700 dark:text-rose-400 leading-snug">
                        {task.errorMessage || 'Произошла ошибка при выполнении задачи.'}
                      </p>

                      <div className="flex items-center justify-end gap-2 pt-0.5">
                        <button
                          type="button"
                          onClick={() => handleCopyLogs(task)}
                          title="Скопировать сообщение и диагностику ошибки"
                          className="px-2 py-1 rounded-md text-[11.5px] font-medium text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)] transition-colors cursor-pointer inline-flex items-center gap-1"
                        >
                          {copiedTaskId === task.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span className="text-emerald-600 font-semibold">Скопировано</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Копировать логи</span>
                            </>
                          )}
                        </button>

                        {task.canRetry && (
                          <button
                            type="button"
                            onClick={() => handleRetryTask(task)}
                            className="px-2.5 py-1 rounded-md bg-[var(--mroya-surface-active)] hover:bg-[var(--mroya-surface-muted)] text-[var(--mroya-text)] text-[11.5px] font-semibold transition-colors cursor-pointer inline-flex items-center gap-1"
                          >
                            <RotateCcw className="w-3 h-3 text-[var(--mroya-brand-honey)]" />
                            <span>Повторить</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
};
