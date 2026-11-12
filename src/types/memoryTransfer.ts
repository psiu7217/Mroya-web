export interface MemoryTransferPresentation {
  busy: boolean;
  error: string | null;
  success: boolean;
  exportMemory: () => void;
  validateFile: (file: File) => Promise<boolean>;
  importValidatedFile: () => void;
}
