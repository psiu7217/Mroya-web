export type NavSection = 'chat' | 'calendar' | 'reminders' | 'memory' | 'memory-map' | 'connections';

export type SubscriptionPlan = 'free' | 'premium';

export type ThemeMode = 'light' | 'dark';

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

export interface ReminderItem {
  id: string;
  title: string;
  type: 'standalone' | 'calendar_linked';
  date: string; // YYYY-MM-DD
  time: string; // HH:mm (calculated notification time)
  calendarEventId?: string;
  offsetMinutes?: number; // 0, 5, 15, 30, 60, 1440, etc.
  channel: 'telegram';
  status: 'scheduled' | 'completed' | 'paused' | 'cancelled';
  notes?: string;
  syncedWithGoogle?: boolean;
  lastSyncedNote?: string;
  createdAt: string;
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

export interface ChatMessage {
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

export interface Conversation {
  id: string;
  title: string;
  group: 'Today' | 'Previous 7 Days' | 'Earlier in October';
  updatedAt: string;
  messages: ChatMessage[];
  relatedMemoryIds: string[];
  relatedEventId?: string;
  relatedNodeId?: string;
}

export type MemoryCategory = 'People & Clients' | 'Agreements & Decisions' | 'Preferences' | 'Dates & Commitments';

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

export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD in Oct 2026
  dayOfMonth: number;
  time: string;
  duration: string;
  category: 'meeting' | 'deadline' | 'reminder';
  person?: string;
  organization?: string;
  locationOrLink?: string;
  notes: string;
  linkedMemoryId?: string;
}

export type GraphNodeCategory = 'person' | 'agreement' | 'event' | 'organization' | 'preference';

export interface GraphNode {
  id: string;
  label: string;
  subtitle: string;
  category: GraphNodeCategory;
  x: number;
  y: number;
  connectionsCount: number;
  summary: string;
  dateRecorded: string;
  source: string;
  linkedMemoryId?: string;
}

export interface GraphEdge {
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
