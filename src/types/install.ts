export interface InstallPresentation {
  installed: boolean;
  showMobile: boolean;
  instruction: 'ios' | 'android' | 'desktop' | null;
  onInstall: () => void;
  onClose: () => void;
}
