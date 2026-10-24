export type NavSection = 'chat' | 'calendar' | 'reminders' | 'memory' | 'memory-inbox' | 'memory-map' | 'connections' | 'notes';

export type SubscriptionPlan = 'free' | 'premium';

export type ThemeMode = 'system' | 'light' | 'dark';

export interface MemoryCitation {
  memoryId: string;
  label: string;
  date: string;
  sourceType: 'Conversation' | 'Call Notes' | 'Email Thread' | 'Calendar Event' | 'Direct Note';
  relatedEventId?: string;
  relatedNodeId?: string;
}

export type ReminderOffset =
  | 'at_time' // 0 minutes
  | '5_min'   // 5 minutes
  | '15_min'  // 15 minutes
  | '30_min'  // 30 minutes
  | '1_hour'  // 60 minutes
  | '1_day'   // 1440 minutes
  | 'custom';

export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  interval?: number; // e.g. every 1 day, every 3 days, every 2 weeks
  weekdays?: number[]; // 0 = Sun, 1 = Mon, ..., 6 = Sat
  endCondition?: 'never' | 'on_date' | 'after_count';
  endDate?: string; // YYYY-MM-DD
  endCount?: number;
  humanReadable?: string;
}

export interface ReminderItem {
  id: string;
  title: string;
  type: 'standalone' | 'calendar_linked';
  date: string; // YYYY-MM-DD (next occurrence date)
  time: string; // HH:mm (calculated notification time)
  calendarEventId?: string;
  offsetMinutes?: number; // 0, 5, 15, 30, 60, 1440, etc.
  channel: 'telegram';
  status: 'scheduled' | 'completed' | 'paused' | 'cancelled';
  notes?: string;
  syncedWithGoogle?: boolean;
  lastSyncedNote?: string;
  createdAt: string;
  recurrence?: RecurrenceRule; // For standalone reminders ONLY (linked reminders inherit from parent event)
  completedOccurrencesCount?: number;
  lastCompletedDate?: string;
}

export interface ChatAction {
  id: string;
  label: string;
  type: 'add-calendar' | 'show-memories' | 'open-map' | 'view-memory' | 'view-reminder' | 'open-calendar-event';
  targetMemoryId?: string;
  targetNodeId?: string;
  targetReminderId?: string;
  targetEventId?: string;
  calendarPayload?: {
    title: string;
    date: string;
    time: string;
    category: 'deadline' | 'meeting' | 'reminder';
    person?: string;
  };
  reminderPayload?: {
    title: string;
    date: string;
    time: string;
    offsetMinutes?: number;
    calendarEventId?: string;
  };
}

// Controller-local presentation. Server fields originate only in validated SSE projections.
export interface ToolPayload {text:string;format:'text'|'json';truncated?:boolean}
export interface ToolTimelineEntry {
  kind:'tool';id:string;sequence:number;toolKind:string;title:string;
  status:'success'|'failure'|'neutral'|'running'|'skipped'|'interrupted'|'unknown';
  callId?:string;toolName?:string;turnNumber?:number;phase?:'started'|'finished';truncated?:boolean;
  description?:string;input?:ToolPayload;output?:ToolPayload;durationMs?:number;
}
export interface ReasoningTimelineEntry {kind:'reasoning';id:string;sequence:number;turnNumber:number;text:string}
export type ChatTimelineEntry = ToolTimelineEntry | ReasoningTimelineEntry;

export interface ChatMessage {
  timeline?:ChatTimelineEntry[];
  report_context?:import('./api').ReportContext;
  signInPrompt?: boolean;
  status?: string;
  reasoning?: string | string[];
  id: string;
  sender: 'user' | 'assistant';
  timestamp: string;
  content: string;
  structuredPoints?: {
    label: string;
    value: string;
  }[];
  savedMemoryNotice?: {
    memoryId: string;
    summary: string;
  };
  citations?: MemoryCitation[];
  actions?: ChatAction[];
}

export type ConversationListItem = Pick<Conversation,'id'|'title'|'group'|'updatedAt'>;
export interface Conversation {
  id: string;
  title: string;
  group: string;
  updatedAt: string;
  messages: ChatMessage[];
  relatedMemoryIds: string[];
  relatedEventId?: string;
  relatedNodeId?: string;
}

export type MemoryCategory = 'Personal memory' | 'People & Clients' | 'Agreements & Decisions' | 'Preferences' | 'Dates & Commitments';

export interface MemoryItem {
  id: string;
  title: string;
  summary: string;
  details: string;
  category: MemoryCategory;
  dateSaved: string;
  source: string;
  entities: string[];
  relatedNodeId: string;
  relatedEventId?: string;
  confidenceNote?: string;
}

export type GoogleSyncState =
  | 'disconnected'
  | 'connecting'
  | 'initial_syncing'
  | 'connected_auto_off'
  | 'connected_auto_on'
  | 'syncing'
  | 'sync_error'
  | 'conflict'
  | 'reconnect_required';

export interface GoogleCalendarItem {
  id: string;
  name: string;
  primary?: boolean;
  selectedForImport: boolean;
  color?: string;
}

export interface GoogleSyncResult {
  importedCount: number;
  exportedCount: number;
  lastSynced: string;
  partialWarning?: string;
}

export interface CalendarEvent {
  memoryLinks?:import('./memoryLinks').MemoryLink[];
  api?:import('./calendarApi').CalendarEventDto; // Canonical metadata; occurrences keep a separate presentation id.
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  dayOfMonth: number;
  time: string;
  duration: string;
  category: 'meeting' | 'deadline' | 'reminder';
  person?: string;
  organization?: string;
  locationOrLink?: string;
  notes: string;
  linkedMemoryId?: string;
  recurrence?: RecurrenceRule;
  isReadOnly?: boolean; // For external/read-only calendars like Google Contacts / Birthdays
  calendarSource?: 'primary' | 'google_birthdays' | 'google_work' | 'local';
  sourceName?: string;
  syncStatus?: 'synced' | 'pending' | 'sync_error' | 'local_only' | 'read_only' | 'conflict';
  syncError?: string;
}

export type GraphNodeCategory = 'person' | 'agreement' | 'event' | 'organization' | 'preference';

export interface GraphNode {
  type?: 'entity'|'memory'; kind?: string; is_self?: boolean; degree?: number; memory_count?: number;
  subject?: string; statement_id?: string; predicate?: string; predicate_key?: string; polarity?: string;
  literal_type?: string; valid_from?: string|null; valid_to?: string|null; learned_at?: string|null;
  evidence_count?: number; resolution_state?: string|null;
  id: string;
  label: string;
  subtitle: string;
  category: GraphNodeCategory;
  x?: number;
  y?: number;
  connectionsCount: number;
  summary: string;
  dateRecorded: string;
  source: string;
  linkedMemoryId?: string;
}

export interface GraphEdge {
  type?: 'relation'|'memory'; statement_id?: string; predicate?: string; predicate_key?: string;
  polarity?: string; valid_from?: string|null; valid_to?: string|null; learned_at?: string|null; evidence_count?: number;
  id: string;
  source: string;
  target: string;
  relationship: string;
}

export interface ServiceConnection {
  id: string;
  name: string;
  category: string;
  description: string;
  connected: boolean;
  accountLabel?: string;
  lastSyncNote?: string;
  capabilities: string[];
}
