export const telegramSettingsPath = '/settings/connections/telegram';
const returnKey = 'mroya.telegram.google-return';

export function isTelegramEntry(pathname: string) {
  return pathname === telegramSettingsPath || pathname === telegramSettingsPath + '/';
}

export function setTelegramGoogleReturn(pending: boolean) {
  try {
    if (pending) window.sessionStorage.setItem(returnKey, '1');
    else window.sessionStorage.removeItem(returnKey);
  } catch { /* Sign-in still works when storage is unavailable. */ }
}

// Google sign-in returns to the app root. Keep only this fixed destination
// in the originating tab, and consume it on the first return.
export function restoreTelegramGoogleReturn() {
  try {
    if (window.sessionStorage.getItem(returnKey) !== '1') return false;
    window.sessionStorage.removeItem(returnKey);
  } catch { return false; }
  const url = new URL(window.location.href);
  if (url.pathname !== '/' || url.searchParams.has('calendar_google')) return false;
  url.pathname = telegramSettingsPath;
  window.history.replaceState(window.history.state, '', url);
  return true;
}
