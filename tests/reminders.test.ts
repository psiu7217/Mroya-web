import test from 'node:test';
import assert from 'node:assert/strict';
import {MroyaApi} from '../src/api/client.ts';
import {readReminder, readRemindersPage} from '../src/api/reminders.ts';
import type {ReminderInput} from '../src/types/reminders.ts';

const id = '7a80d664-d168-48b3-8b15-708c9edfe373';
const submissionId = '25bbdc48-2686-4aa3-a5e2-69fe5a357dce';
const input: ReminderInput = {
  text: 'Pay the internet bill', date: '2030-01-31', time: '09:00', repeat: 'monthly', timezone: 'Europe/Minsk',
};
const row = {...input, id, version: 1, status: 'scheduled', next_run_at: '2030-01-31T06:00:00Z', last_outcome: null};
const response = (body: unknown) => new Response(JSON.stringify(body), {headers: {'Content-Type': 'application/json'}});

test('reminder reads and versioned mutations use the existing session and CSRF client', async () => {
  const requests: Array<{path: string; method: string | undefined; body: unknown}> = [];
  const api = new MroyaApi(async (path, init) => {
    assert.equal(init?.credentials, 'same-origin');
    const method = init?.method;
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    requests.push({path: String(path), method, body});
    if (String(path).endsWith('auth/csrf/')) return response({csrf_token: 'fixture'});
    if (String(path).endsWith('reminders/?offset=0')) return response({reminders: [row], next_offset: null});
    assert.equal(new Headers(init?.headers).get('X-CSRFToken'), 'fixture');
    return response({reminder: method === 'DELETE'
      ? {...row, status: 'cancelled', next_run_at: null, version: 3}
      : method === 'PATCH' ? {...row, text: 'Updated', version: 2} : row});
  });

  assert.deepEqual((await api.reminders()).reminders, [row]);
  assert.equal((await api.changeReminder({kind: 'create', submissionId, input})).id, id);
  assert.equal((await api.changeReminder({kind: 'edit', id, version: 1, input: {...input, text: 'Updated'}})).version, 2);
  assert.equal((await api.changeReminder({kind: 'cancel', id, version: 2})).status, 'cancelled');
  assert.deepEqual(requests.map(({path, method, body}) => [path, method, body]), [
    ['/api/v1/reminders/?offset=0', 'GET', null], ['/api/v1/auth/csrf/', 'GET', null],
    ['/api/v1/reminders/', 'POST', {submission_id: submissionId, reminder: input}],
    ['/api/v1/reminders/' + id + '/', 'PATCH', {version: 1, reminder: {...input, text: 'Updated'}}],
    ['/api/v1/reminders/' + id + '/', 'DELETE', {version: 2}],
  ]);
});

test('invalid recurrence, time, status and pagination cannot render as confirmed reminders', () => {
  for (const update of [
    {repeat: 'hourly'}, {time: '24:15'}, {timezone: 'Mars/Olympus'},
    {next_run_at: null}, {status: 'finished'}, {version: 0},
  ]) assert.throws(() => readReminder({...row, ...update}), {code: 'invalid_response'});
  assert.throws(() => readRemindersPage({reminders: [row, row], next_offset: null}, 0), {code: 'invalid_response'});
  assert.throws(() => readRemindersPage({reminders: [row], next_offset: 30}, 0), {code: 'invalid_response'});
  const skipped = readReminder({...row, status: 'finished', next_run_at: null, last_outcome: 'skipped'});
  assert.equal(skipped.last_outcome, 'skipped');
});
