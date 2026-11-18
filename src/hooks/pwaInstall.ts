import type {InstallPresentation} from '../types/install';
export const INSTALL_KEY = 'mroya.pwa.installed';
export interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{outcome: 'accepted' | 'dismissed'}>;
}

// Kept separate from React so browser lifecycle behavior can be exercised directly.
export function createInstallController(browser: Window) {
  const media = browser.matchMedia('(display-mode: standalone)');
  const ios = /iPad|iPhone|iPod/.test(browser.navigator.userAgent) ||
    (/Macintosh/.test(browser.navigator.userAgent) && browser.navigator.maxTouchPoints > 1);
  const mobile = ios || /Android|Mobile/.test(browser.navigator.userAgent);
  const standalone = () => media.matches || (browser.navigator as Navigator & {standalone?: boolean}).standalone === true;
  let remembered = false;
  try { remembered = browser.localStorage.getItem(INSTALL_KEY) === '1'; } catch { /* Optional browser hint. */ }
  let installed = standalone() || remembered;
  let prompt: InstallPromptEvent | null = null;
  let pending = false;
  let instruction: 'ios' | 'android' | 'desktop' | null = null;
  const listeners = new Set<() => void>();
  let snapshot: Pick<InstallPresentation, 'installed' | 'showMobile' | 'instruction'> = {installed, showMobile: mobile && !installed, instruction};
  const emit = () => {
    snapshot = {installed, showMobile: mobile && !installed, instruction};
    listeners.forEach(listener => listener());
  };
  const markInstalled = () => {
    installed = true; prompt = null; instruction = null;
    try { browser.localStorage.setItem(INSTALL_KEY, '1'); } catch { /* Storage can be blocked. */ }
    emit();
  };
  const beforeInstall = (event: Event) => {
    event.preventDefault();
    prompt = event as InstallPromptEvent;
    // A fresh browser offer is authoritative, e.g. after an uninstall.
    installed = standalone();
    if (!installed) { try { browser.localStorage.removeItem(INSTALL_KEY); } catch { /* Optional hint. */ } }
    emit();
  };
  const onDisplay = () => { if (standalone()) markInstalled(); };
  const onPageShow = () => { if (standalone()) markInstalled(); };
  browser.addEventListener('beforeinstallprompt', beforeInstall);
  browser.addEventListener('appinstalled', markInstalled);
  browser.addEventListener('pageshow', onPageShow);
  media.addEventListener('change', onDisplay);
  if (standalone()) markInstalled();
  return {
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    getSnapshot: () => snapshot,
    async install() {
      if (installed || pending) return;
      if (!prompt || ios) { instruction = ios ? 'ios' : mobile ? 'android' : 'desktop'; emit(); return; }
      const offer = prompt;
      prompt = null; pending = true; instruction = null; emit();
      try {
        // Must run in the original click stack, before any await.
        await offer.prompt();
        const choice = await offer.userChoice;
        // Only appinstalled / standalone confirms a completed installation.
        if (choice.outcome === 'dismissed') emit();
      } catch { instruction = mobile ? 'android' : 'desktop'; emit(); }
      finally { pending = false; }
    },
    close() { instruction = null; emit(); },
    dispose() {
      browser.removeEventListener('beforeinstallprompt', beforeInstall);
      browser.removeEventListener('appinstalled', markInstalled);
      browser.removeEventListener('pageshow', onPageShow);
      media.removeEventListener('change', onDisplay);
      listeners.clear();
    },
  };
}
