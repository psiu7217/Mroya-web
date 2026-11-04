import {test} from 'node:test';
import assert from 'node:assert/strict';
import {startVersionChecks} from '../src/hooks/frontendVersion.ts';

test('checks real build IDs on start and foreground without reloading', async () => {
  let listener, interval, notices = 0, requests = 0;
  let value = 'current';
  globalThis.document = {visibilityState: 'visible', addEventListener: (_, fn) => { listener = fn; }, removeEventListener: () => { listener = null; }};
  globalThis.window = {setInterval: fn => { interval = fn; return 1; }, clearInterval: () => { interval = null; }, location: {reload: () => { throw Error('unexpected reload'); }}};
  globalThis.fetch = async (url, options) => {
    requests++;
    assert.equal(url, '/version.json');
    assert.equal(options.cache, 'no-store');
    assert.equal(options.credentials, 'omit');
    if (value === 'offline') throw Error('offline');
    return {ok: true, json: async () => ({buildId: value})};
  };
  const flush = () => new Promise(resolve => setImmediate(resolve));
  const stop = startVersionChecks('current', () => { notices++; });
  await flush();
  assert.equal(notices, 0);
  value = 'offline'; listener(); await flush();
  assert.equal(notices, 0);
  value = 'new'; document.visibilityState = 'hidden'; listener(); interval(); await flush();
  assert.equal(requests, 2);
  document.visibilityState = 'visible'; listener(); await flush();
  assert.equal(notices, 1);
  stop();
  assert.equal(listener, null);
  assert.equal(interval, null);
});
