import React from 'react';
import { CheckCircle2, Sparkles, X, ArrowRight } from 'lucide-react';
import type { AiTask } from '../types/aiTasks';

export interface AiTaskCompletionToastProps {
  task: AiTask;
  onOpenDetails: (task: AiTask) => void;
  onDismiss: () => void;
}

export const AiTaskCompletionToast: React.FC<AiTaskCompletionToastProps> = ({
  task,
  onOpenDetails,
  onDismiss,
}) => {
  return (
    <aside
      aria-label="Уведомление о выполнении задачи AI"
      className="fixed top-16 right-4 sm:right-6 z-50 max-w-sm w-full bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] rounded-[14px] shadow-[var(--mroya-shadow-elevated)] p-3.5 flex items-start gap-3 animate-in fade-in slide-in-from-top-3 duration-200 transition-all select-none"
    >
      <div className="w-8 h-8 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
        <CheckCircle2 className="w-4 h-4" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <Sparkles className="w-3 h-3 text-[var(--mroya-brand-honey)]" />
          <span className="text-[11px] font-semibold text-[var(--mroya-brand-honey)] uppercase tracking-wider">
            AI выполнил задачу
          </span>
        </div>
        <p className="text-[13px] font-medium text-[var(--mroya-text)] line-clamp-1">
          {task.title}
        </p>
        <p className="text-[11.5px] text-[var(--mroya-text-muted)] line-clamp-2 mt-0.5 leading-snug">
          {task.resultSummary || 'Результат готов и применен.'}
        </p>

        <div className="flex items-center gap-2 mt-2">
          <button
            type="button"
            onClick={() => onOpenDetails(task)}
            className="text-[12px] font-semibold text-[var(--mroya-primary)] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>Посмотреть результат</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={onDismiss}
        aria-label="Закрыть уведомление"
        className="w-6 h-6 rounded-md inline-flex items-center justify-center text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)] transition-colors cursor-pointer shrink-0 -mr-1 -mt-1"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </aside>
  );
};
