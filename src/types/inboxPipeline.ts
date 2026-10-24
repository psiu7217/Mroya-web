export type PipelineFilterStage =
  | 'all'
  | 'pending_check'
  | 'fast_approved'
  | 'fast_rejected'
  | 'in_queue'
  | 'awaiting_confirmation'
  | 'committed'
  | 'declined';

export type FastFilterDecision = 'APPROVE' | 'REJECT' | 'PENDING';

export interface PipelineHistoryEntry {
  id: string;
  timestamp: string;
  stageName: string;
  actor: 'scanner' | 'ai_fast_filter' | 'ai_deep_analyzer' | 'user';
  actorLabel: string;
  description: string;
  detail?: string;
}

export interface PipelineEventItem {
  id: string;
  title: string;
  source: 'Calendar' | 'Email' | 'Telegram';
  sourceAccount: string;
  sourceCalendarName?: string;
  sourceDate: string; // e.g. 'Oct 14, 2026, 14:00'
  sourceLocation?: string;
  sourceAttendees?: string[];
  rawEventSnippet: string;
  status: PipelineFilterStage;
  shortDescription: string;
  
  // Fast AI Filter (Step 2)
  fastFilter: {
    decision: FastFilterDecision;
    confidence: number; // 0 - 100
    evaluatedAt: string;
    rationale: string;
    ruleMatched: string;
    isDoubtfulDefaultApprove?: boolean;
  };

  // Deep AI Analysis (Step 3) - available if fast approved
  deepAnalysis?: {
    analyzedAt: string;
    confidence: number;
    proposedCategory: 'Agreements & Decisions' | 'People & Clients' | 'Dates & Commitments' | 'Preferences';
    proposedTitle: string;
    proposedSummary: string;
    factsToExtract: string[];
    connectedEntities: string[];
    impactLevel: 'high' | 'medium' | 'low';
  };

  // History timeline log (Step 4)
  history: PipelineHistoryEntry[];

  // Committed memory link
  committedMemoryId?: string;
}

export interface PipelineStats {
  totalDetected: number;
  pendingCheck: number;
  fastApproved: number;
  fastRejected: number;
  inDeepQueue: number;
  awaitingConfirmation: number;
  committed: number;
  userDeclined: number;
}
