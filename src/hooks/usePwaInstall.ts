import {useEffect, useState} from 'react';
import {useLocale} from '../i18n';
import {createInstallController} from './pwaInstall';
import type {InstallPresentation} from '../types/install';

export function usePwaInstall(): InstallPresentation {
  const {language} = useLocale();
  const [controller] = useState(() => createInstallController(window));
  const [state, setState] = useState(controller.getSnapshot);
  useEffect(() => {
    setState(controller.getSnapshot());
    const unsubscribe = controller.subscribe(() => setState(controller.getSnapshot()));
    return () => { unsubscribe(); controller.dispose(); };
  }, [controller]);
  useEffect(() => {
    const manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (manifest) manifest.href = `/manifest-${language}.webmanifest`;
    document.querySelector('meta[name="apple-mobile-web-app-title"]')?.setAttribute('content', language === 'ru' ? 'Мроя' : 'Mroya');
  }, [language]);
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/sw.js', {updateViaCache: 'none'}).catch(() => { /* Installation remains available without offline fallback. */ });
    }
  }, []);
  return {...state, onInstall: () => { void controller.install(); }, onClose: controller.close};
}
