import {ApiError} from './errors.ts';
import {calendarUuid} from './calendar.ts';
import {reminderRepeats, type ReminderRecord, type RemindersPage} from '../types/reminders.ts';

const PAGE_SIZE = 30;
const YYYY_MM_DD = /^\d{4}-\d{2}-\d{2}$/;
const HH_MM = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function invalid(): never {
  throw new ApiError(502, 'invalid_response', 'Invalid reminder response.');
}

function object(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || !value || Array.isArray(value)) invalid();
  return value as Record<string, unknown>;
}

function isTimezone(value: unknown): value is string {
  if (typeof value !== 'string' || !value || value.length > 128) return false;
  try {
    new Intl.DateTimeFormat('en', {timeZone: value});
    return true;
  } catch {
    return false;
  }
}

export function readReminder(value: unknown, expectedId?: string): ReminderRecord {
  const row = object(value);
  if (!calendarUuid(row.id) || (expectedId && row.id !== expectedId)
      || typeof row.text !== 'string' || !row.text.trim() || Array.from(row.text).length > 500
      || typeof row.date !== 'string' || !YYYY_MM_DD.test(row.date)
      || typeof row.time !== 'string' || !HH_MM.test(row.time)
      || !isTimezone(row.timezone) || !reminderRepeats.some(repeat => repeat === row.repeat)
      || !['scheduled', 'finished', 'cancelled'].some(status => status === row.status)
      || ![null, 'queued', 'skipped'].includes(row.last_outcome as string | null)
      || typeof row.version !== 'number' || !Number.isSafeInteger(row.version) || row.version < 1) invalid();

  if (row.status === 'scheduled') {
    if (typeof row.next_run_at !== 'string' || !Number.isFinite(Date.parse(row.next_run_at))
        || !/(?:Z|\+00:00)$/.test(row.next_run_at)) invalid();
  } else if (row.next_run_at !== null) invalid();

  const {id, text, date, time, timezone, repeat, status, next_run_at, last_outcome, version} = row;
  return {id, text, date, time, timezone, repeat, status, next_run_at, last_outcome, version} as ReminderRecord;
}

export function readRemindersPage(value: unknown, offset: number): RemindersPage {
  const page = object(value);
  if (!Array.isArray(page.reminders) || page.reminders.length > PAGE_SIZE || (
    page.next_offset !== null && (page.next_offset !== offset + PAGE_SIZE || page.reminders.length !== PAGE_SIZE)
  )) invalid();
  const reminders = page.reminders.map(item => readReminder(item));
  if (reminders.some(reminder => reminder.status === 'cancelled')
    || new Set(reminders.map(reminder => reminder.id)).size !== reminders.length) invalid();
  return {reminders, next_offset: page.next_offset as number | null};
}
