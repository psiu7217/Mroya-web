export type ProposalSourceType = 'Calendar' | 'Email' | 'Drive';

export type ProposalStatus =
  | 'new'
  | 'reanalyzing'
  | 'accepted'
  | 'declined'
  | 'applied'
  | 'outdated'
  | 'error';

export interface MemoryMatch {
  id: string;
  name: string;
  relation?: string;
  similarity?: string;
}

export interface InboxProposal {
  id: string;
  title: string;
  source: ProposalSourceType;
  sourceResourceTitle: string;
  sourceDate: string;
  actionProposed: string;
  explanation: string;
  memoryMatches: MemoryMatch[];
  status: ProposalStatus;
  comment?: string;
  errorMessage?: string;
  suggestedComment?: string;
  isConfirmed?: boolean;
}

// Presentation contract only, not a claim that an Inbox API exists.
export type InboxPreviewFilter = ProposalStatus | 'all' | 'empty' | 'loading';
export interface MemoryInboxPresentation {
  available: boolean;
  scopeKey: string; // Account/controller lifetime; changing it discards UI drafts.
  proposals: readonly InboxProposal[];
  loading: boolean;
  error: string | null;
  onAcceptProposal?: (id: string) => void | Promise<void>;
  onRejectProposal?: (id: string) => void | Promise<void>;
  onCommentProposal?: (id: string, comment: string) => void | Promise<void>;
  onRetryProposal?: (id?: string) => void | Promise<void>;
  preview?: {
    filter: InboxPreviewFilter;
    filters: {id: InboxPreviewFilter; label: string}[];
    onSelectFilter: (filter: InboxPreviewFilter) => void;
    onReset: () => void;
    commentPlaceholder: string;
  };
}
