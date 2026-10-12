export type NavSection = 'chat' | 'calendar' | 'memory' | 'memory-map' | 'connections';

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

export interface ChatAction {
  id: string;
  label: string;
  type: 'add-calendar' | 'show-memories' | 'open-map' | 'view-memory';
  targetMemoryId?: string;
  targetNodeId?: string;
  calendarPayload?: {
    title: string;
    date: string;
    time: string;
    category: 'deadline' | 'meeting' | 'reminder';
    person?: string;
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
