export type AiTaskStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'error'
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
  completedAt?: string;
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
