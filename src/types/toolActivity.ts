export type ToolActivityStatus = 'running' | 'success' | 'failed' | 'skipped';

export interface ToolActivity {
  id: string;
  name: string;
  label?: string;
  description?: string;
  status: ToolActivityStatus;
  duration?: string;
  input?: Record<string, unknown> | string | null;
  output?: Record<string, unknown> | string | null;
  isTruncated?: boolean;
}

export type ReasoningTimelineItem =
  | { type: 'reasoning'; text: string }
  | { type: 'tool'; activity: ToolActivity };
