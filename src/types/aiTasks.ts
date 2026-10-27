export type AiTaskStatus =
  | 'pending_confirmation' // Server-anchored 15s window; canonical deadline below.
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'needs_clarification'
  | 'cancelled';

export type AiTaskTarget = 'memory' | 'calendar' | 'notes';

export interface AiTaskResultLink {
  label: string;
  targetSection: 'memory' | 'calendar' | 'notes';
  targetId?: string;
}

export interface AiTask {
  id: string;
  title: string;
  target: AiTaskTarget;
  status: AiTaskStatus;
  userPrompt: string;
  createdAt: string;
  updatedAt: string;
  /** Server UTC deadline of the confirmation window; absent for legacy rows. */
  confirmDeadlineAt?: string;
  completedAt?: string;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  progressPercent?: number; // 0..100 for running tasks
  currentStep?: string; // Human-readable sub-step
  queuePosition?: number; // 1, 2, ...
  estimatedWait?: string; // e.g. "~40 сек"
  resultSummary?: string; // Summary of what AI achieved
  resultLink?: AiTaskResultLink;
  clarificationQuestion?: string; // Prompt asked by AI
  clarificationOptions?: string[]; // Quick response options
  clarificationAnswer?: string; // User's submitted reply
  errorMessage?: string; // Cause of error
  canRetry?: boolean;
}

export interface AiTasksPage { tasks: AiTask[]; nextOffset: number | null }
export interface AiTasksPresentation {
  tasks: AiTask[]; loading: boolean; error: string | null; hasMore: boolean;
  completedTask: AiTask | null;
  executingTaskId?: string | null; onExecute?: (id: string) => void;
  /** Chat confirmation card bindings; canonical server reads always win. */
  approveTask?: (id: string) => Promise<AiTask>;
  revokeTask?: (id: string) => Promise<AiTask>;
  refreshTask?: (id: string) => Promise<AiTask>;
  onOpen: () => void; onClose: () => void; onRefresh: () => void;
  onMore: () => void; onDetails: (id: string) => void; onDismiss: () => void;
}
