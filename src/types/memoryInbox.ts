export type ProposalSourceType = 'Calendar' | 'Email' | 'Drive';

export type ProposalStatus =
  | 'new'
  | 'reanalyzing'
  | 'accepted'
  | 'declined'
  | 'applied'
  | 'outdated'
  | 'error'
  | import('./intelligenceApi').IntelligenceStatus;

export interface MemoryMatch {
  id: string;
  name: string;
  relation?: string;
  similarity?: string;
}

export interface InboxProposal {
  id: string;
  version?: number;
  statusLabel?:string;
  statusMessage?:string;
  resultMessage?:string;
  sourceLabel?:string;
  sourceAvailable?:boolean;
  processingEnabled?:boolean;
  actions?:{accept:boolean;reject:boolean;comment:boolean;reconsider:boolean;retry:boolean};
  busy?:boolean;
  uncertain?:boolean;
  history?:{loading:boolean;error:string|null;entries:{version:number;kind:string;comment:string;createdAt:string;summary:string}[];hasMore:boolean};
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
  focusedId?:string;focusToken?:number;
  available: boolean;
  scopeKey: string; // Account/controller lifetime; changing it discards UI drafts.
  proposals: readonly InboxProposal[];
  loading: boolean;
  error: string | null;
  notice?:string;
  emptyMessage?:string;
  hasMore?:boolean;
  loadingMore?:boolean;
  onMore?:()=>void;
  onRefresh?:()=>void;
  onOpenProposal?:(id:string)=>void;
  onMoreHistory?:(id:string)=>void;
  onReconsiderProposal?:(id:string)=>void | Promise<boolean>;
  onAcceptProposal?: (id: string) => boolean | void | Promise<boolean | void>;
  onRejectProposal?: (id: string) => boolean | void | Promise<boolean | void>;
  onCommentProposal?: (id: string, comment: string) => boolean | void | Promise<boolean | void>;
  onRetryProposal?: (id?: string) => boolean | void | Promise<boolean | void>;
  preview?: {
    filter: InboxPreviewFilter;
    filters: {id: InboxPreviewFilter; label: string}[];
    onSelectFilter: (filter: InboxPreviewFilter) => void;
    onReset: () => void;
    commentPlaceholder: string;
  };
}
