import { RecurrenceRule, CalendarEvent, ReminderItem } from '../types/mroya';

export const WEEKDAYS = [
  { value: 1, short: 'Mon', full: 'Monday' },
  { value: 2, short: 'Tue', full: 'Tuesday' },
  { value: 3, short: 'Wed', full: 'Wednesday' },
  { value: 4, short: 'Thu', full: 'Thursday' },
  { value: 5, short: 'Fri', full: 'Friday' },
  { value: 6, short: 'Sat', full: 'Saturday' },
  { value: 0, short: 'Sun', full: 'Sunday' },
];

/**
 * Returns a concise, human-readable label for a recurrence rule
 */
export function formatRecurrence(rule?: RecurrenceRule | null): string {
  if (!rule) return 'Does not repeat';

  const interval = rule.interval || 1;
  let text = '';

  switch (rule.frequency) {
    case 'daily':
      text = interval === 1 ? 'Every day' : `Every ${interval} days`;
      break;

    case 'weekly': {
      const weekdaysText =
        rule.weekdays && rule.weekdays.length > 0
          ? ' on ' +
            rule.weekdays
              .slice()
              .sort((a, b) => ((a === 0 ? 7 : a) - (b === 0 ? 7 : b)))
              .map((w) => WEEKDAYS.find((d) => d.value === w)?.short || '')
              .filter(Boolean)
              .join(', ')
          : '';

      text =
        interval === 1
          ? `Every week${weekdaysText}`
          : `Every ${interval} weeks${weekdaysText}`;
      break;
    }

    case 'monthly':
      text = interval === 1 ? 'Every month' : `Every ${interval} months`;
      break;

    case 'yearly':
      text = interval === 1 ? 'Every year' : `Every ${interval} years`;
      break;

    default:
      text = 'Recurring';
  }

  if (rule.endCondition === 'on_date' && rule.endDate) {
    text += ` until ${rule.endDate}`;
  } else if (rule.endCondition === 'after_count' && rule.endCount) {
    text += ` (${rule.endCount} times)`;
  }

  return text;
}

/**
 * Resolves the effective recurrence rule for a reminder.
 * Linked reminders inherit recurrence from the parent calendar event.
 */
export function getEffectiveRecurrence(
  reminder: ReminderItem,
  events: CalendarEvent[]
): {
  isRecurring: boolean;
  rule?: RecurrenceRule;
  isInherited: boolean;
  parentEvent?: CalendarEvent;
} {
  if (reminder.type === 'calendar_linked' && reminder.calendarEventId) {
    const parentEvent = events.find((e) => e.id === reminder.calendarEventId);
    if (parentEvent?.recurrence) {
      return {
        isRecurring: true,
        rule: parentEvent.recurrence,
        isInherited: true,
        parentEvent,
      };
    }
    return { isRecurring: false, isInherited: false, parentEvent };
  }

  if (reminder.recurrence) {
    return {
      isRecurring: true,
      rule: reminder.recurrence,
      isInherited: false,
    };
  }

  return { isRecurring: false, isInherited: false };
}

/**
 * Calculates the next occurrence date after a given date (defaults to mock current date '2026-10-12')
 */
export function getNextOccurrenceDate(
  baseDate: string,
  baseTime: string,
  rule?: RecurrenceRule | null,
  currentReferenceDate: string = '2026-10-12'
): { nextDate: string; nextTime: string; label: string } {
  if (!rule) {
    return {
      nextDate: baseDate,
      nextTime: baseTime,
      label: formatRelativeDateLabel(baseDate, baseTime, currentReferenceDate),
    };
  }

  try {
    const pad = (n: number) => String(n).padStart(2, '0');
    const [refY, refM, refD] = currentReferenceDate.split('-').map(Number);
    const refDateTime = new Date(refY, refM - 1, refD, 0, 0, 0);

    const [baseY, baseM, baseD] = baseDate.split('-').map(Number);
    const baseDateTime = new Date(baseY, baseM - 1, baseD, 0, 0, 0);

    let candidate = new Date(Math.max(baseDateTime.getTime(), refDateTime.getTime()));
    const interval = Math.max(1, rule.interval || 1);

    if (rule.frequency === 'daily') {
      if (candidate.getTime() <= refDateTime.getTime()) {
        candidate.setDate(candidate.getDate() + (interval === 1 ? 1 : interval));
      }
    } else if (rule.frequency === 'weekly') {
      const weekdays = rule.weekdays?.length ? rule.weekdays : [baseDateTime.getDay()];
      let found = false;
      for (let i = 0; i <= 365; i++) {
        const check = new Date(refDateTime);
        check.setDate(check.getDate() + i);
        if (check.getTime() < baseDateTime.getTime()) continue;
        if (weekdays.includes(check.getDay())) {
          candidate = check;
          found = true;
          break;
        }
      }
      if (!found) candidate.setDate(candidate.getDate() + 7);
    } else if (rule.frequency === 'monthly') {
      const targetDay = baseD;
      let check = new Date(candidate);
      if (check.getDate() > targetDay) {
        check.setMonth(check.getMonth() + interval);
      }
      check.setDate(targetDay);
      candidate = check;
    } else if (rule.frequency === 'yearly') {
      let check = new Date(refY, baseM - 1, baseD);
      if (check.getTime() < refDateTime.getTime()) {
        check.setFullYear(check.getFullYear() + interval);
      }
      candidate = check;
    }

    const nextDate = `${candidate.getFullYear()}-${pad(candidate.getMonth() + 1)}-${pad(candidate.getDate())}`;
    return {
      nextDate,
      nextTime: baseTime,
      label: formatRelativeDateLabel(nextDate, baseTime, currentReferenceDate),
    };
  } catch {
    return {
      nextDate: baseDate,
      nextTime: baseTime,
      label: `${baseDate} at ${baseTime}`,
    };
  }
}

/**
 * Pretty human-friendly relative date label
 */
export function formatRelativeDateLabel(
  dateStr: string,
  timeStr: string,
  todayStr: string = '2026-10-12'
): string {
  if (dateStr === todayStr) {
    return `Today at ${timeStr}`;
  }

  const [tY, tM, tD] = todayStr.split('-').map(Number);
  const tomorrow = new Date(tY, tM - 1, tD + 1);
  const pad = (n: number) => String(n).padStart(2, '0');
  const tomorrowStr = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`;

  if (dateStr === tomorrowStr) {
    return `Tomorrow at ${timeStr}`;
  }

  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayName = dayNames[dateObj.getDay()];
    const monthName = monthNames[m - 1];

    if (y === 2026) {
      return `${dayName}, ${monthName} ${d} at ${timeStr}`;
    }
    return `${monthName} ${d}, ${y} at ${timeStr}`;
  } catch {
    return `${dateStr} at ${timeStr}`;
  }
}

/**
 * Checks if a calendar event occurs on a specific target date string (YYYY-MM-DD)
 */
export function doesEventOccurOnDate(event: CalendarEvent, dateStr: string): boolean {
  if (event.date === dateStr) return true;
  if (!event.recurrence) return false;

  const rule = event.recurrence;

  // Cannot occur before event start date
  if (dateStr < event.date) return false;

  // Check end conditions
  if (rule.endCondition === 'on_date' && rule.endDate && dateStr > rule.endDate) {
    return false;
  }

  try {
    const [startYear, startMonth, startDay] = event.date.split('-').map(Number);
    const [targetYear, targetMonth, targetDay] = dateStr.split('-').map(Number);

    const startDate = new Date(startYear, startMonth - 1, startDay, 0, 0, 0);
    const targetDate = new Date(targetYear, targetMonth - 1, targetDay, 0, 0, 0);

    const interval = Math.max(1, rule.interval || 1);

    if (rule.frequency === 'daily') {
      const diffDays = Math.round((targetDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays % interval === 0;
    }

    if (rule.frequency === 'weekly') {
      const targetDayOfWeek = targetDate.getDay();
      const allowedWeekdays = rule.weekdays?.length
        ? rule.weekdays
        : [startDate.getDay()];

      if (!allowedWeekdays.includes(targetDayOfWeek)) return false;

      // Check week intervals if interval > 1
      if (interval > 1) {
        const diffWeeks = Math.floor(
          (targetDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 7)
        );
        return diffWeeks >= 0 && diffWeeks % interval === 0;
      }
      return true;
    }

    if (rule.frequency === 'monthly') {
      if (targetDay !== startDay) return false;
      const monthDiff =
        (targetYear - startYear) * 12 + (targetMonth - startMonth);
      return monthDiff >= 0 && monthDiff % interval === 0;
    }

    if (rule.frequency === 'yearly') {
      if (targetMonth !== startMonth || targetDay !== startDay) return false;
      const yearDiff = targetYear - startYear;
      return yearDiff >= 0 && yearDiff % interval === 0;
    }
  } catch {
    return false;
  }

  return false;
}
