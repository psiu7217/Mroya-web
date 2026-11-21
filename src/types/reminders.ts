export const reminderRepeats = ['once', 'daily', 'weekly', 'monthly', 'yearly'] as const;
export type ReminderRepeat = typeof reminderRepeats[number];

export interface ReminderInput {
  text: string;
  date: string;
  time: string;
  repeat: ReminderRepeat;
  timezone: string;
}

export interface ReminderRecord extends ReminderInput {
  id: string;
  version: number;
  status: 'scheduled' | 'finished' | 'cancelled';
  next_run_at: string | null;
  last_outcome: 'queued' | 'skipped' | null;
}

export interface RemindersPage {
  reminders: ReminderRecord[];
  next_offset: number | null;
}

export type ReminderChange =
  | { kind: 'create'; submissionId: string; input: ReminderInput }
  | { kind: 'edit'; id: string; version: number; input: ReminderInput }
  | { kind: 'cancel'; id: string; version: number };

export interface RemindersPresentation {
  rows: ReminderRecord[];
  timezone: string;
  loaded: boolean;
  loading: boolean;
  busy: boolean;
  error: string | null;
  hasMore: boolean;
  onRefresh: () => void;
  onMore: () => void;
  onChange: (change: ReminderChange) => Promise<boolean>;
}
