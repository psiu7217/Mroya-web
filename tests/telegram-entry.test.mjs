import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isTelegramEntry, restoreTelegramGoogleReturn, setTelegramGoogleReturn, telegramSettingsPath } from '../src/utils/telegramEntry.ts';

test('only the public Telegram settings path is an entry point', () => {
  assert.ok(isTelegramEntry(telegramSettingsPath));
  assert.ok(isTelegramEntry(telegramSettingsPath + '/'));
  for (const path of ['/', '/settings', telegramSettingsPath + '/other', '//other.example/']) assert.equal(isTelegramEntry(path), false);
});

test('Google sign-in restores the fixed path once and leaves other callbacks alone', (t) => {
  const values = new Map();
  const location = new URL('https://app.example/?auth_error=cancelled#top');
  const sessionStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  t.after(() => { delete globalThis.window; });
  globalThis.window = { location, sessionStorage, history: { state: {}, replaceState: (_state, _title, url) => { location.href = url; } } };
  setTelegramGoogleReturn(true);
  assert.equal(restoreTelegramGoogleReturn(), true);
  assert.equal(location.href, 'https://app.example/settings/connections/telegram?auth_error=cancelled#top');
  assert.equal(restoreTelegramGoogleReturn(), false);

  for (const path of ['/?calendar_google=ok', '/unrelated']) {
    location.href = new URL(path, location);
    setTelegramGoogleReturn(true);
    assert.equal(restoreTelegramGoogleReturn(), false);
    assert.equal(location.pathname + location.search, path);
    assert.equal(values.size, 0);
  }
  location.href = new URL('/', location);
  setTelegramGoogleReturn(true);
  setTelegramGoogleReturn(false);
  assert.equal(restoreTelegramGoogleReturn(), false);
  Object.defineProperty(globalThis.window, 'sessionStorage', { get() { throw new Error('Storage unavailable'); } });
  assert.doesNotThrow(() => setTelegramGoogleReturn(true));
  assert.equal(restoreTelegramGoogleReturn(), false);
});
