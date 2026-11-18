export interface MemoryTransferPresentation {
  busy: boolean;
  operation: 'export' | 'import' | 'retry' | 'restore' | null;
  error: string | null;
  success: boolean;
  restored: boolean;
  importAvailable: boolean;
  importUnavailable: boolean;
  canImportFile: boolean;
  searchPending: boolean;
  retryAvailable: boolean;
  canRestore: boolean;
  exportMemory: () => void;
  validateFile: (file: File) => Promise<boolean>;
  importValidatedFile: () => void;
  retrySearch: () => void;
  restorePrevious: () => void;
}
