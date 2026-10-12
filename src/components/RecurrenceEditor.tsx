import React, { useState, useEffect } from 'react';
import { Repeat, ChevronDown, Check, Calendar, Hash } from 'lucide-react';
import { RecurrenceRule, RecurrenceFrequency } from '../types/mroya';
import { formatRecurrence, WEEKDAYS } from '../utils/recurrenceUtils';

interface RecurrenceEditorProps {
  value?: RecurrenceRule | null;
  onChange: (rule?: RecurrenceRule) => void;
  baseTime?: string;
  baseDate?: string;
  compact?: boolean;
}

export const RecurrenceEditor: React.FC<RecurrenceEditorProps> = ({
  value,
  onChange,
  baseTime = '09:00',
  baseDate = '2026-10-12',
  compact = false,
}) => {
  // Mode: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'
  const determineInitialMode = (): string => {
    if (!value) return 'none';
    if (value.interval && value.interval > 1) return 'custom';
    if (value.endCondition && value.endCondition !== 'never') return 'custom';
    if (value.weekdays && value.weekdays.length > 1) return 'custom';
    return value.frequency;
  };

  const [mode, setMode] = useState<string>(determineInitialMode());
  const [interval, setInterval] = useState<number>(value?.interval || 1);
  const [frequency, setFrequency] = useState<RecurrenceFrequency>(
    value?.frequency || 'weekly'
  );
  const [weekdays, setWeekdays] = useState<number[]>(
    value?.weekdays || [1] // default Monday
  );
  const [endCondition, setEndCondition] = useState<'never' | 'on_date' | 'after_count'>(
    value?.endCondition || 'never'
  );
  const [endDate, setEndDate] = useState<string>(value?.endDate || '2026-12-31');
  const [endCount, setEndCount] = useState<number>(value?.endCount || 10);

  // Sync internal state when external value changes
  useEffect(() => {
    if (!value) {
      setMode('none');
    } else {
      setMode(determineInitialMode());
      setInterval(value.interval || 1);
      setFrequency(value.frequency);
      if (value.weekdays) setWeekdays(value.weekdays);
      if (value.endCondition) setEndCondition(value.endCondition);
      if (value.endDate) setEndDate(value.endDate);
      if (value.endCount) setEndCount(value.endCount);
    }
  }, [value]);

  const handleModeChange = (newMode: string) => {
    setMode(newMode);
    if (newMode === 'none') {
      onChange(undefined);
      return;
    }

    if (newMode === 'daily') {
      const rule: RecurrenceRule = { frequency: 'daily', interval: 1, endCondition: 'never' };
      rule.humanReadable = formatRecurrence(rule);
      onChange(rule);
      return;
    }

    if (newMode === 'weekly') {
      // Use current day of week from baseDate if possible
      let dayVal = 1;
      try {
        const [y, m, d] = baseDate.split('-').map(Number);
        dayVal = new Date(y, m - 1, d).getDay();
      } catch {}
      const rule: RecurrenceRule = {
        frequency: 'weekly',
        interval: 1,
        weekdays: [dayVal],
        endCondition: 'never',
      };
      rule.humanReadable = formatRecurrence(rule);
      onChange(rule);
      return;
    }

    if (newMode === 'monthly') {
      const rule: RecurrenceRule = { frequency: 'monthly', interval: 1, endCondition: 'never' };
      rule.humanReadable = formatRecurrence(rule);
      onChange(rule);
      return;
    }

    if (newMode === 'yearly') {
      const rule: RecurrenceRule = { frequency: 'yearly', interval: 1, endCondition: 'never' };
      rule.humanReadable = formatRecurrence(rule);
      onChange(rule);
      return;
    }

    if (newMode === 'custom') {
      emitCustomRule(interval, frequency, weekdays, endCondition, endDate, endCount);
    }
  };

  const emitCustomRule = (
    cInterval: number,
    cFreq: RecurrenceFrequency,
    cWeekdays: number[],
    cEnd: 'never' | 'on_date' | 'after_count',
    cEndDate: string,
    cEndCount: number
  ) => {
    const rule: RecurrenceRule = {
      frequency: cFreq,
      interval: Math.max(1, cInterval),
      weekdays: cFreq === 'weekly' ? cWeekdays : undefined,
      endCondition: cEnd,
      endDate: cEnd === 'on_date' ? cEndDate : undefined,
      endCount: cEnd === 'after_count' ? Math.max(1, cEndCount) : undefined,
    };
    rule.humanReadable = formatRecurrence(rule);
    onChange(rule);
  };

  const toggleWeekday = (dayValue: number) => {
    let nextWeekdays: number[];
    if (weekdays.includes(dayValue)) {
      if (weekdays.length > 1) {
        nextWeekdays = weekdays.filter((d) => d !== dayValue);
      } else {
        nextWeekdays = weekdays; // keep at least one
      }
    } else {
      nextWeekdays = [...weekdays, dayValue];
    }
    setWeekdays(nextWeekdays);
    emitCustomRule(interval, frequency, nextWeekdays, endCondition, endDate, endCount);
  };

  const isCustom = mode === 'custom';

  return (
    <div className="space-y-3">
      {/* Main Repeat dropdown */}
      <div>
        <label className="block text-[12px] font-semibold text-[var(--mroya-text)] mb-1 flex items-center gap-1.5">
          <Repeat className="w-3.5 h-3.5 text-[var(--mroya-primary)]" />
          <span>Repeat</span>
        </label>
        <div className="relative">
          <select
            value={mode}
            onChange={(e) => handleModeChange(e.target.value)}
            className="w-full px-3 py-2 rounded-[10px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] text-[13px] text-[var(--mroya-text)] focus:outline-none focus:border-[var(--mroya-primary)] shadow-2xs cursor-pointer appearance-none pr-8 font-medium"
          >
            <option value="none">Does not repeat</option>
            <option value="daily">Every day</option>
            <option value="weekly">Every week</option>
            <option value="monthly">Every month</option>
            <option value="yearly">Every year</option>
            <option value="custom">Custom...</option>
          </select>
          <ChevronDown className="w-4 h-4 text-[var(--mroya-text-muted)] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Custom Recurrence Editor Drawer */}
      {isCustom && (
        <div className="p-3.5 rounded-[12px] bg-[var(--mroya-surface-muted)]/70 border border-[var(--mroya-divider)] space-y-3.5 text-[12px] animate-in fade-in duration-150">
          {/* Interval and Frequency */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <span className="text-[var(--mroya-text)] font-medium shrink-0">Repeat every</span>
            <input
              type="number"
              min="1"
              max="99"
              value={interval}
              onChange={(e) => {
                const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                setInterval(val);
                emitCustomRule(val, frequency, weekdays, endCondition, endDate, endCount);
              }}
              className="w-16 px-2.5 py-1.5 rounded-[8px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] text-center text-[13px] font-bold text-[var(--mroya-text)] focus:outline-none focus:border-[var(--mroya-primary)]"
            />
            <select
              value={frequency}
              onChange={(e) => {
                const f = e.target.value as RecurrenceFrequency;
                setFrequency(f);
                emitCustomRule(interval, f, weekdays, endCondition, endDate, endCount);
              }}
              className="px-3 py-1.5 rounded-[8px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] text-[13px] font-medium text-[var(--mroya-text)] focus:outline-none focus:border-[var(--mroya-primary)] cursor-pointer"
            >
              <option value="daily">{interval === 1 ? 'day' : 'days'}</option>
              <option value="weekly">{interval === 1 ? 'week' : 'weeks'}</option>
              <option value="monthly">{interval === 1 ? 'month' : 'months'}</option>
              <option value="yearly">{interval === 1 ? 'year' : 'years'}</option>
            </select>
          </div>

          {/* Weekday selection for weekly recurrence */}
          {frequency === 'weekly' && (
            <div>
              <label className="block text-[11px] font-semibold text-[var(--mroya-text-muted)] uppercase tracking-wider mb-1.5">
                On days
              </label>
              <div className="grid grid-cols-7 gap-1">
                {WEEKDAYS.map((d) => {
                  const selected = weekdays.includes(d.value);
                  return (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => toggleWeekday(d.value)}
                      title={d.full}
                      className={`h-8 rounded-[8px] text-[12px] font-semibold transition-all cursor-pointer flex items-center justify-center border ${
                        selected
                          ? 'bg-[var(--mroya-primary)] text-white border-[var(--mroya-primary)] shadow-2xs'
                          : 'bg-[var(--mroya-surface)] text-[var(--mroya-text)] border-[var(--mroya-divider)] hover:bg-[var(--mroya-surface-muted)]'
                      }`}
                    >
                      {d.short.slice(0, 1)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Ends option */}
          <div className="pt-2 border-t border-[var(--mroya-divider)]/70">
            <label className="block text-[11px] font-semibold text-[var(--mroya-text-muted)] uppercase tracking-wider mb-2">
              Ends
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="recurrence_end"
                  checked={endCondition === 'never'}
                  onChange={() => {
                    setEndCondition('never');
                    emitCustomRule(interval, frequency, weekdays, 'never', endDate, endCount);
                  }}
                  className="accent-[var(--mroya-primary)]"
                />
                <span className="text-[var(--mroya-text)] font-medium">Never</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="recurrence_end"
                  checked={endCondition === 'on_date'}
                  onChange={() => {
                    setEndCondition('on_date');
                    emitCustomRule(interval, frequency, weekdays, 'on_date', endDate, endCount);
                  }}
                  className="accent-[var(--mroya-primary)]"
                />
                <span className="text-[var(--mroya-text)] font-medium">On date</span>
                {endCondition === 'on_date' && (
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      emitCustomRule(interval, frequency, weekdays, 'on_date', e.target.value, endCount);
                    }}
                    className="ml-2 px-2.5 py-1 rounded-[6px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] text-[12px] text-[var(--mroya-text)]"
                  />
                )}
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="recurrence_end"
                  checked={endCondition === 'after_count'}
                  onChange={() => {
                    setEndCondition('after_count');
                    emitCustomRule(interval, frequency, weekdays, 'after_count', endDate, endCount);
                  }}
                  className="accent-[var(--mroya-primary)]"
                />
                <span className="text-[var(--mroya-text)] font-medium">After</span>
                {endCondition === 'after_count' && (
                  <div className="flex items-center gap-1.5 ml-2">
                    <input
                      type="number"
                      min="1"
                      max="999"
                      value={endCount}
                      onChange={(e) => {
                        const count = Math.max(1, parseInt(e.target.value, 10) || 1);
                        setEndCount(count);
                        emitCustomRule(interval, frequency, weekdays, 'after_count', endDate, count);
                      }}
                      className="w-14 px-2 py-1 rounded-[6px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] text-[12px] text-center font-bold text-[var(--mroya-text)]"
                    />
                    <span className="text-[var(--mroya-text-muted)]">occurrences</span>
                  </div>
                )}
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Human-readable preview */}
      {mode !== 'none' && (
        <div className="p-2.5 rounded-[10px] bg-[var(--mroya-surface-active)]/50 border border-[var(--mroya-divider)] text-[11px] text-[var(--mroya-text)] flex items-start gap-2">
          <Repeat className="w-3.5 h-3.5 text-[var(--mroya-primary)] shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-semibold text-[var(--mroya-primary)]">
              {formatRecurrence(value)} at {baseTime}
            </span>
            <p className="text-[var(--mroya-text-muted)]">
              Telegram notification will repeat according to this schedule.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
