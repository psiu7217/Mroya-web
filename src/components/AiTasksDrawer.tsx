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
  Copy,
  Check,
} from 'lucide-react';
import type { AiTask, AiTaskStatus } from '../types/aiTasks';

export interface AiTasksDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: AiTask[];
  loading?: boolean; error?: string | null; hasMore?: boolean;
  onRefresh?: () => void; onMore?: () => void; onDetails?: (id: string) => void;
  highlightTaskId?: string | null;
  executingTaskId?: string | null; onExecute?: (id: string) => void;
}

const localDate = (value:string) => {
  const date=new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(undefined,{dateStyle:'short',timeStyle:'medium'}).format(date) : value;
};
function TaskTiming({task}:{task:AiTask}){
  const [now,setNow]=useState(Date.now);
  useEffect(()=>{
    if(task.status!=='running'||!task.startedAt)return;
    setNow(Date.now());const timer=setInterval(()=>setNow(Date.now()),1000);
    return ()=>clearInterval(timer);
  },[task.status,task.startedAt]);
  if(!task.startedAt)return null;
  const ms=task.durationMs??(task.finishedAt?Date.parse(task.finishedAt):now)-Date.parse(task.startedAt);
  const seconds=new Intl.NumberFormat('ru-RU',{minimumFractionDigits:1,maximumFractionDigits:1}).format(Math.max(0,ms)/1000);
  return <p className="text-[11px] text-[var(--mroya-text-muted)]">{task.status==='running'?`Прошло ${seconds} сек.`:task.status==='completed'?`Выполнено за ${seconds} сек.`:`Время выполнения: ${seconds} сек.`}</p>;
}

export type CompactTab = 'active' | 'completed' | 'issues';

export const AiTasksDrawer: React.FC<AiTasksDrawerProps> = ({
  isOpen,
  onClose,
  tasks,
  loading, error, hasMore, onRefresh, onMore, onDetails,
  highlightTaskId, executingTaskId, onExecute,
}) => {
  const [activeTab, setActiveTab] = useState<CompactTab>('active');
  const [copiedTaskId, setCopiedTaskId] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    const task = tasks.find(t => t.id === highlightTaskId);
    if (task) setActiveTab(task.status === 'completed' ? 'completed' : ['failed','cancelled'].includes(task.status) ? 'issues' : 'active');
  }, [highlightTaskId, isOpen]);

  if (!isOpen) return null;

  // Filter tasks: NO 'all' tab per user requirement.
  const filteredTasks = tasks.filter((task) => {
    switch (activeTab) {
      case 'active':
        return ['pending_confirmation', 'running', 'queued', 'needs_clarification'].includes(task.status);
      case 'completed':
        return task.status === 'completed';
      case 'issues':
        return ['failed', 'cancelled'].includes(task.status);
      default:
        return true;
    }
  });

  // Sort tasks: items requiring clarification MUST be pinned to the top and highlighted
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    if (a.status === 'pending_confirmation' && b.status !== 'pending_confirmation') return -1;
    if (b.status === 'pending_confirmation' && a.status !== 'pending_confirmation') return 1;
    if (a.status === 'needs_clarification' && b.status !== 'needs_clarification') return -1;
    if (b.status === 'needs_clarification' && a.status !== 'needs_clarification') return 1;
    if (a.status === 'running' && b.status !== 'running') return -1;
    if (b.status === 'running' && a.status !== 'running') return 1;
    return 0;
  });

  const activeCount = tasks.filter((t) =>
    ['pending_confirmation', 'running', 'queued', 'needs_clarification'].includes(t.status)
  ).length;
  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const issuesCount = tasks.filter((t) => ['failed', 'cancelled'].includes(t.status)).length;

  const handleCopyLogs = (task: AiTask) => {
    const errorPayload = `[AI Task Error Report]
ID: ${task.id}
Задача: ${task.title}
Статус: ${task.status}
Ошибка: ${task.errorMessage || 'Неизвестная ошибка'}
Запрос пользователя: ${task.userPrompt}
Время: ${localDate(task.updatedAt || task.createdAt)}`;

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
      case 'pending_confirmation':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-400">
            <Clock className="w-3 h-3" />
            <span>Ожидает подтверждения</span>
          </span>
        );
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
      case 'failed':
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
          {error && <p role="alert" className="text-xs text-rose-600">{error} <button onClick={onRefresh}>Обновить</button></p>}
          {loading && tasks.length === 0 && <p role="status" className="text-xs">Загрузка задач…</p>}
          {sortedTasks.length === 0 && !loading && !error ? (
            <div className="py-12 text-center text-[12px] text-[var(--mroya-text-muted)]">
              Нет задач в этой категории
            </div>
          ) : (
            sortedTasks.map((task) => {
              const isClarifying = task.status === 'needs_clarification';
              const isError = task.status === 'failed';
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
                      {localDate(task.updatedAt || task.createdAt)}
                    </span>
                  </div>

                  {/* Task title */}
                  <p className="font-semibold text-[var(--mroya-text)] leading-snug">
                    {task.title}
                  </p>
                  <p className="text-[11px] text-[var(--mroya-text-muted)]">{{memory:'Memory',calendar:'Calendar',notes:'Notes'}[task.target]} · {task.id}</p>
                  <button type="button" onClick={() => onDetails?.(task.id)} className="text-[11px] text-[var(--mroya-primary)]">Обновить детали</button>
                  <p className="text-[11px] text-[var(--mroya-text-muted)]">Создана: {localDate(task.createdAt)}</p>

                  <TaskTiming task={task} />
                  {task.status==='queued' && onExecute && <button type="button"
                    onClick={()=>onExecute(task.id)}
                    disabled={!!executingTaskId||tasks.some(t=>t.status==='running')}
                    className="px-2.5 py-1 rounded-md bg-[var(--mroya-surface-active)] text-[var(--mroya-text)] text-[11.5px] font-semibold disabled:opacity-40 cursor-pointer">
                    {executingTaskId===task.id?'Запуск…':'Выполнить'}
                  </button>}
                  {isRunning && <p className="text-[12px] text-[var(--mroya-text-muted)]">Выполняется</p>}
                  {isClarifying && <p className="text-[12px] text-[var(--mroya-text-muted)]">{task.errorMessage==='execution_outcome_unknown'?'Результат операции не подтверждён. Не запускайте её повторно.':'Требует уточнения. Ответ через панель пока недоступен.'}{task.errorMessage && ` (${task.errorMessage})`}</p>}
                  {/* Completed result */}
                  {task.resultSummary && (
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

                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
          {hasMore && <button type="button" disabled={loading} onClick={onMore} className="w-full py-2 text-xs text-[var(--mroya-primary)]">Загрузить ещё</button>}
        </div>

      </div>
    </div>
  );
};
