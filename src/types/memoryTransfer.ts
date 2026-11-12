export interface MemoryTransferPresentation {
  busy: boolean;
  error: string | null;
  success: boolean;
  restored: boolean;
  importAvailable: boolean;
  searchPending: boolean;
  retryAvailable: boolean;
  canRestore: boolean;
  exportMemory: () => void;
  validateFile: (file: File) => Promise<boolean>;
  importValidatedFile: () => void;
  retrySearch: () => void;
  restorePrevious: () => void;
}
