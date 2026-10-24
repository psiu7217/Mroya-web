import React, { useState, useEffect } from 'react';
import {
  X,
  Bell,
  Calendar,
  Clock,
  Send,
  Link2,
  Check,
  AlertCircle,
  Sparkles,
  Repeat,
  Lock,
  ExternalLink,
} from 'lucide-react';
import { ReminderItem, CalendarEvent, RecurrenceRule } from '../types/mroya';
import {tr} from '../i18n';
import {formatDate,formatTime} from '../i18n/format';
import { RecurrenceEditor } from './RecurrenceEditor';
import {
  localizedRecurrence,
  getEffectiveRecurrence,
  getNextOccurrenceDate,
} from '../utils/recurrenceUtils';

interface ReminderEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (reminder: Omit<ReminderItem, 'id' | 'createdAt'>, existingId?: string) => void;
  editingReminder?: ReminderItem | null;
  events: CalendarEvent[];
  preselectedEventId?: string;
  onNavigateToCalendar?: (eventId: string) => void;
}

const PRESET_OFFSETS = [
  { minutes: 0 },{ minutes: 5 },{ minutes: 15 },{ minutes: 30 },{ minutes: 60 },{ minutes: 1440 },
];

export const ReminderEditorModal: React.FC<ReminderEditorModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingReminder,
  events,
  preselectedEventId,
  onNavigateToCalendar,
}) => {
  const [type, setType] = useState<'standalone' | 'calendar_linked'>(
    editingReminder?.type || (preselectedEventId ? 'calendar_linked' : 'standalone')
  );
  const [title, setTitle] = useState(editingReminder?.title || '');
  const [date, setDate] = useState(editingReminder?.date || '2026-10-12');
  const [time, setTime] = useState(editingReminder?.time || '14:30');
  const [selectedEventId, setSelectedEventId] = useState<string>(
    editingReminder?.calendarEventId || preselectedEventId || (events[0]?.id || '')
  );
  const [offsetMinutes, setOffsetMinutes] = useState<number>(
    editingReminder?.offsetMinutes ?? 30
  );
  const [customOffsetInput, setCustomOffsetInput] = useState<string>('45');
  const [isCustomOffset, setIsCustomOffset] = useState<boolean>(false);
  const [notes, setNotes] = useState(editingReminder?.notes || '');
  const [errors, setErrors] = useState<string | null>(null);

  // Recurrence for standalone reminders
  const [standaloneRecurrence, setStandaloneRecurrence] = useState<
    RecurrenceRule | undefined
  >(editingReminder?.recurrence);
  const formatCivilDate=(value:string)=>{const [y,m,d]=value.split('-').map(Number);return Number.isInteger(y)&&Number.isInteger(m)&&Number.isInteger(d)?formatDate(new Date(Date.UTC(y,m-1,d,12)),{year:'numeric',month:'short',day:'numeric'},'UTC'):value;};
  const formatCivilTime=(value:string)=>{const [h,m]=value.split(':').map(Number);return Number.isInteger(h)&&Number.isInteger(m)?formatTime(new Date(Date.UTC(2000,0,1,h,m)),{},'UTC'):value;};

  // Sync state when editingReminder or preselectedEventId changes
  useEffect(() => {
    if (editingReminder) {
      setType(editingReminder.type);
      setTitle(editingReminder.title);
      setDate(editingReminder.date);
      setTime(editingReminder.time);
      if (editingReminder.calendarEventId) {
        setSelectedEventId(editingReminder.calendarEventId);
      }
      if (editingReminder.offsetMinutes !== undefined) {
        const isStandard = PRESET_OFFSETS.some(
          (o) => o.minutes === editingReminder.offsetMinutes
        );
        if (isStandard) {
          setOffsetMinutes(editingReminder.offsetMinutes);
          setIsCustomOffset(false);
        } else {
          setIsCustomOffset(true);
          setCustomOffsetInput(String(editingReminder.offsetMinutes));
          setOffsetMinutes(editingReminder.offsetMinutes);
        }
      }
      setStandaloneRecurrence(editingReminder.recurrence);
      setNotes(editingReminder.notes || '');
    } else {
      setType(preselectedEventId ? 'calendar_linked' : 'standalone');
      if (preselectedEventId) {
        setSelectedEventId(preselectedEventId);
        const ev = events.find((e) => e.id === preselectedEventId);
        if (ev) {
          setTitle(ev.title);
        }
      } else {
        setTitle('');
      }
      setDate('2026-10-12');
      setTime('14:30');
      setOffsetMinutes(30);
      setIsCustomOffset(false);
      setStandaloneRecurrence(undefined);
      setNotes('');
    }
    setErrors(null);
  }, [editingReminder, preselectedEventId, isOpen, events]);

  if (!isOpen) return null;

  const selectedEvent = events.find((e) => e.id === selectedEventId);

  // Calculate notification time for calendar-linked reminders
  const calculateNotificationTime = (
    eventDate: string,
    eventTime: string,
    offsetMins: number
  ) => {
    try {
      const [hours, minutes] = eventTime.split(':').map(Number);
      const [year, month, day] = eventDate.split('-').map(Number);
      const evDate = new Date(year, month - 1, day, hours, minutes);
      const notifDate = new Date(evDate.getTime() - offsetMins * 60 * 1000);
      const pad = (n: number) => String(n).padStart(2, '0');
      const calcDate = `${notifDate.getFullYear()}-${pad(notifDate.getMonth() + 1)}-${pad(notifDate.getDate())}`;
      const calcTime = `${pad(notifDate.getHours())}:${pad(notifDate.getMinutes())}`;
      return { calcDate, calcTime };
    } catch {
      return { calcDate: eventDate, calcTime: eventTime };
    }
  };

  const getEffectiveOffset = () => {
    if (isCustomOffset) {
      const parsed = parseInt(customOffsetInput, 10);
      return isNaN(parsed) || parsed < 0 ? 0 : parsed;
    }
    return offsetMinutes;
  };

  const effectiveOffset = getEffectiveOffset();

  const computedNotification =
    type === 'calendar_linked' && selectedEvent
      ? calculateNotificationTime(selectedEvent.date, selectedEvent.time, effectiveOffset)
      : { calcDate: date, calcTime: time };

  // Recurrence resolution
  const effectiveRecurrenceRule =
    type === 'calendar_linked'
      ? selectedEvent?.recurrence
      : standaloneRecurrence;

  const nextOccurrenceInfo = getNextOccurrenceDate(
    computedNotification.calcDate,
    computedNotification.calcTime,
    effectiveRecurrenceRule,
    '2026-10-12'
  );

  const formatOffsetLabel = (mins: number) => {
    if (mins === 0) return tr('atEventTime',{ns:'reminders'});
    if (mins < 60) return tr('minutesBefore',{ns:'calendar',count:mins});
    if (mins === 60) return tr('hoursBefore',{ns:'calendar',count:1});
    if (mins === 1440) return tr('daysBefore',{ns:'calendar',count:1});
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return remMins > 0 ? tr('hoursMinutesBefore',{ns:'reminders',hours:hrs,minutes:remMins}) : tr('hoursBefore',{ns:'calendar',count:hrs});
  };

  const handleSelectEvent = (eventId: string) => {
    setSelectedEventId(eventId);
    const ev = events.find((e) => e.id === eventId);
    if (ev && !title.trim()) {
      setTitle(ev.title);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setErrors(tr('titleRequiredError',{ns:'reminders'}));
      return;
    }

    if (type === 'calendar_linked' && !selectedEvent) {
      setErrors(tr('selectEventError',{ns:'reminders'}));
      return;
    }

    const finalDate =
      type === 'calendar_linked' && selectedEvent
        ? computedNotification.calcDate
        : date;

    const finalTime =
      type === 'calendar_linked' && selectedEvent
        ? computedNotification.calcTime
        : time;

    const payload: Omit<ReminderItem, 'id' | 'createdAt'> = {
      title: cleanTitle,
      type,
      date: finalDate,
      time: finalTime,
      calendarEventId: type === 'calendar_linked' ? selectedEventId : undefined,
      offsetMinutes: type === 'calendar_linked' ? effectiveOffset : undefined,
      channel: 'telegram',
      status: editingReminder?.status || 'scheduled',
      notes: notes.trim() || undefined,
      recurrence: type === 'standalone' ? standaloneRecurrence : undefined,
      syncedWithGoogle:
        type === 'calendar_linked' &&
        (selectedEvent?.id === 'evt-oct13-doctor' ||
          selectedEvent?.id === 'evt-weekly-meeting' ||
          selectedEvent?.id === 'evt-annas-birthday' ||
          editingReminder?.syncedWithGoogle),
      lastSyncedNote:
        type === 'calendar_linked' &&
        (selectedEvent?.id === 'evt-oct13-doctor' ||
          selectedEvent?.id === 'evt-weekly-meeting' ||
          selectedEvent?.id === 'evt-annas-birthday')
          ? tr('googleSynced',{ns:'reminders'})
          : undefined,
    };

    onSave(payload, editingReminder?.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-[20px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] shadow-[var(--mroya-shadow-elevated)] p-5 sm:p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[var(--mroya-divider)]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[var(--mroya-surface-muted)] text-[var(--mroya-primary)] flex items-center justify-center border border-[var(--mroya-divider)]">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-[17px] font-bold text-[var(--mroya-text)]">
                {editingReminder ? tr('editReminderTitle',{ns:'reminders'}) : tr('newReminderTitle',{ns:'reminders'})}
              </h2>
              <p className="text-[12px] text-[var(--mroya-text-muted)]">
                {tr('telegramDeliveryHelp',{ns:'reminders'})}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={tr('close',{ns:'common'})}
            className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)] cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {errors && (
          <div className="p-3 rounded-[10px] bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-[12px] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errors}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Reminder Type Segmented Selector */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--mroya-text-muted)] mb-1.5">
              {tr('reminderType',{ns:'reminders'})}
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 rounded-[12px] bg-[var(--mroya-surface-muted)] border border-[var(--mroya-divider)]">
              <button
                type="button"
                onClick={() => setType('standalone')}
                className={`py-2 px-3 rounded-[9px] text-[13px] font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  type === 'standalone'
                    ? 'bg-[var(--mroya-surface)] text-[var(--mroya-primary)] shadow-xs'
                    : 'text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)]'
                }`}
              >
                <Clock className="w-4 h-4" />
                <span>{tr('standalone',{ns:'reminders'})}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setType('calendar_linked');
                  if (events.length > 0 && !title.trim()) {
                    setTitle(events[0].title);
                  }
                }}
                className={`py-2 px-3 rounded-[9px] text-[13px] font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  type === 'calendar_linked'
                    ? 'bg-[var(--mroya-surface)] text-[var(--mroya-primary)] shadow-xs'
                    : 'text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)]'
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span>{tr('linkedEvent',{ns:'reminders'})}</span>
              </button>
            </div>
            <p className="text-[11px] text-[var(--mroya-text-muted)] mt-1.5 px-0.5">
              {type === 'standalone'
                ? tr('standaloneHelp',{ns:'reminders'})
                : tr('linkedHelp',{ns:'reminders'})}
            </p>
          </div>

          {/* Title */}
          <div>
            <label className="block text-[12px] font-bold text-[var(--mroya-text)] mb-1">
              {tr('title',{ns:'reminders'})}
            </label>
            <input
              type="text"
              required
              placeholder={
                type === 'standalone'
                  ? tr('standaloneTitlePlaceholder',{ns:'reminders'})
                  : tr('linkedTitlePlaceholder',{ns:'reminders'})
              }
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-[10px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] text-[14px] text-[var(--mroya-text)] focus:outline-none focus:border-[var(--mroya-primary)] focus:ring-1 focus:ring-[var(--mroya-primary)]/20 shadow-2xs"
            />
          </div>

          {/* TYPE A: STANDALONE FIELDS + RECURRENCE */}
          {type === 'standalone' && (
            <div className="space-y-3.5 p-3.5 rounded-[14px] bg-[var(--mroya-surface-muted)]/50 border border-[var(--mroya-divider)]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-[var(--mroya-text)] mb-1">
                    {tr('notificationDate',{ns:'reminders'})}
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-[8px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] text-[13px] text-[var(--mroya-text)] focus:outline-none focus:border-[var(--mroya-primary)] shadow-2xs"
                  />
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <button
                      type="button"
                      onClick={() => setDate('2026-10-12')}
                      className="text-[11px] font-medium text-[var(--mroya-primary)] hover:underline cursor-pointer"
                    >
                      {tr('today',{ns:'reminders'})}
                    </button>
                    <span className="text-[var(--mroya-divider)]">·</span>
                    <button
                      type="button"
                      onClick={() => setDate('2026-10-13')}
                      className="text-[11px] font-medium text-[var(--mroya-primary)] hover:underline cursor-pointer"
                    >
                      {tr('tomorrow',{ns:'reminders'})}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[12px] font-semibold text-[var(--mroya-text)] mb-1">
                    {tr('notificationTime',{ns:'reminders'})}
                  </label>
                  <input
                    type="time"
                    required
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-[8px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] text-[13px] text-[var(--mroya-text)] focus:outline-none focus:border-[var(--mroya-primary)] shadow-2xs"
                  />
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setTime('09:00')}
                      className="text-[11px] font-medium text-[var(--mroya-primary)] hover:underline cursor-pointer"
                    >
                      {tr('morning',{ns:'reminders'})}
                    </button>
                    <span className="text-[var(--mroya-divider)]">·</span>
                    <button
                      type="button"
                      onClick={() => setTime('14:00')}
                      className="text-[11px] font-medium text-[var(--mroya-primary)] hover:underline cursor-pointer"
                    >
                      {tr('afternoon',{ns:'reminders'})}
                    </button>
                    <span className="text-[var(--mroya-divider)]">·</span>
                    <button
                      type="button"
                      onClick={() => setTime('18:00')}
                      className="text-[11px] font-medium text-[var(--mroya-primary)] hover:underline cursor-pointer"
                    >
                      {tr('evening',{ns:'reminders'})}
                    </button>
                  </div>
                </div>
              </div>

              {/* RECURRENCE EDITOR FOR STANDALONE REMINDER */}
              <div className="pt-2 border-t border-[var(--mroya-divider)]/70">
                <RecurrenceEditor
                  value={standaloneRecurrence}
                  onChange={(rule) => setStandaloneRecurrence(rule)}
                  baseTime={time}
                  baseDate={date}
                />
              </div>
            </div>
          )}

          {/* TYPE B: LINKED TO CALENDAR EVENT */}
          {type === 'calendar_linked' && (
            <div className="space-y-3.5 p-3.5 rounded-[14px] bg-[var(--mroya-surface-muted)]/50 border border-[var(--mroya-divider)]">
              {/* Event Selector */}
              <div>
                <label className="block text-[12px] font-semibold text-[var(--mroya-text)] mb-1">
                  {tr('selectEvent',{ns:'reminders'})}
                </label>
                <select
                  value={selectedEventId}
                  onChange={(e) => handleSelectEvent(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-[10px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] text-[13px] text-[var(--mroya-text)] focus:outline-none focus:border-[var(--mroya-primary)] shadow-2xs cursor-pointer"
                >
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.title} ({formatCivilDate(ev.date)} · {formatCivilTime(ev.time)})
                      {ev.recurrence ? ` [🔁 ${localizedRecurrence(ev.recurrence)}]` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {selectedEvent && (
                <div className="p-2.5 rounded-[10px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)]/80 flex items-center justify-between text-[12px]">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[var(--mroya-primary)] shrink-0" />
                    <div>
                      <span className="font-semibold text-[var(--mroya-text)]">
                        {selectedEvent.title}
                      </span>
                      <div className="text-[11px] text-[var(--mroya-text-muted)]">
                        {formatCivilDate(selectedEvent.date)} · {formatCivilTime(selectedEvent.time)}
                        {selectedEvent.person ? ` · ${selectedEvent.person}` : ''}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {selectedEvent.recurrence && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center gap-1">
                        <Repeat className="w-2.5 h-2.5" />
                        <span>{tr('recurring',{ns:'reminders'})}</span>
                      </span>
                    )}
                    {(selectedEvent.id === 'evt-oct13-doctor' ||
                      selectedEvent.id === 'evt-weekly-meeting' ||
                      selectedEvent.id === 'evt-annas-birthday') && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                        {tr('googleSynced',{ns:'reminders'})}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* INHERITED RECURRENCE DISPLAY (LOCKED FOR LINKED REMINDERS) */}
              <div className="p-3 rounded-[12px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] space-y-1.5">
                <div className="flex items-center justify-between text-[12px]">
                  <div className="flex items-center gap-1.5 font-semibold text-[var(--mroya-text)]">
                    <Repeat className="w-3.5 h-3.5 text-[var(--mroya-primary)]" />
                    <span>{tr('recurrence',{ns:'reminders'})}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-[var(--mroya-surface-active)] text-[var(--mroya-text-muted)] flex items-center gap-0.5 font-medium">
                      <Lock className="w-2.5 h-2.5" />
                      <span>{tr('inherited',{ns:'reminders'})}</span>
                    </span>
                  </div>
                  {selectedEvent && onNavigateToCalendar && (
                    <button
                      type="button"
                      onClick={() => onNavigateToCalendar(selectedEvent.id)}
                      className="text-[11px] text-[var(--mroya-primary)] hover:underline flex items-center gap-1 cursor-pointer font-medium"
                    >
                      <span>{tr('editEventCalendar',{ns:'reminders'})}</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {selectedEvent?.recurrence ? (
                  <div className="text-[12px]">
                    <span className="font-semibold text-purple-600 dark:text-purple-400">
                      {tr('repeats',{ns:'reminders',rule:localizedRecurrence(selectedEvent.recurrence)})}
                    </span>
                    <p className="text-[11px] text-[var(--mroya-text-muted)] mt-0.5">
                      {tr('recurrenceControlledHelp',{ns:'reminders',offset:formatOffsetLabel(effectiveOffset)})}
                    </p>
                  </div>
                ) : (
                  <p className="text-[11px] text-[var(--mroya-text-muted)]">
                    {tr('noRecurrenceHelp',{ns:'reminders'})}
                  </p>
                )}
              </div>

              {/* Relative Timing Offset */}
              <div>
                <label className="block text-[12px] font-semibold text-[var(--mroya-text)] mb-1.5">
                  {tr('notifyRelativeLabel',{ns:'reminders'})}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {PRESET_OFFSETS.map((preset) => (
                    <button
                      key={preset.minutes}
                      type="button"
                      onClick={() => {
                        setOffsetMinutes(preset.minutes);
                        setIsCustomOffset(false);
                      }}
                      className={`py-1.5 px-2 rounded-[8px] text-[12px] font-medium border text-center transition-all cursor-pointer ${
                        !isCustomOffset && offsetMinutes === preset.minutes
                          ? 'bg-[var(--mroya-primary)] text-white border-[var(--mroya-primary)] shadow-2xs font-semibold'
                          : 'bg-[var(--mroya-surface)] text-[var(--mroya-text)] border-[var(--mroya-divider)] hover:bg-[var(--mroya-surface-muted)]'
                      }`}
                    >
                      {formatOffsetLabel(preset.minutes)}
                    </button>
                  ))}
                </div>

                {/* Custom offset toggle */}
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCustomOffset((v) => !v)}
                    className={`text-[11px] font-semibold transition-colors cursor-pointer ${
                      isCustomOffset
                        ? 'text-[var(--mroya-primary)] underline'
                        : 'text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)]'
                    }`}
                  >
                    {isCustomOffset ? tr('usingCustomOffset',{ns:'reminders'}) : tr('customOffset',{ns:'reminders'})}
                  </button>
                  {isCustomOffset && (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="0"
                        max="10080"
                        value={customOffsetInput}
                        onChange={(e) => setCustomOffsetInput(e.target.value)}
                        className="w-16 px-2 py-1 rounded bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] text-[12px] text-center font-bold"
                      />
                      <span className="text-[11px] text-[var(--mroya-text-muted)]">
                        {tr('minutesBeforeUnit',{ns:'reminders'})}
                      </span>
                    </div>
                  )}
                </div>

                {/* Calculated notification feedback */}
                {selectedEvent && (
                  <div className="mt-2.5 p-2 rounded-[8px] bg-[var(--mroya-surface-active)]/60 border border-[var(--mroya-divider)]/80 text-[11px] text-[var(--mroya-text)] flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-[var(--mroya-primary)] shrink-0" />
                    <span>
                      {tr('alertScheduledFor',{ns:'reminders'})}{' '}
                      <strong className="text-[var(--mroya-primary)]">
                        {formatCivilDate(computedNotification.calcDate)} · {formatCivilTime(computedNotification.calcTime)}
                      </strong>{' '}
                      ({formatOffsetLabel(effectiveOffset)})
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Delivery Channel Pill */}
          <div className="p-3 rounded-[12px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#229ED9]/15 text-[#229ED9] flex items-center justify-center shrink-0">
                <Send className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="text-[13px] font-semibold text-[var(--mroya-text)]">
                  {tr('deliveryTelegram',{ns:'reminders'})}
                </span>
                <p className="text-[11px] text-[var(--mroya-text-muted)]">
                  {tr('telegramDeliveryDevice',{ns:'reminders'})}
                </p>
              </div>
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
              {tr('active',{ns:'reminders'})}
            </span>
          </div>

          {/* Optional Notes */}
          <div>
            <label className="block text-[12px] font-medium text-[var(--mroya-text-muted)] mb-1">
              {tr('contextNotes',{ns:'reminders'})}
            </label>
            <input
              type="text"
              placeholder={tr('descriptionPlaceholder',{ns:'reminders'})}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-[8px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] text-[13px] text-[var(--mroya-text)] focus:outline-none focus:border-[var(--mroya-primary)] shadow-2xs"
            />
          </div>

          {/* Live Notification Preview Card */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--mroya-text-muted)] flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-[var(--mroya-brand-honey)]" />
                <span>{tr('telegramPreview',{ns:'reminders'})}</span>
              </label>
              {effectiveRecurrenceRule && (
                <span className="text-[10px] font-medium text-purple-500 flex items-center gap-1">
                  <Repeat className="w-3 h-3" />
                  <span>{localizedRecurrence(effectiveRecurrenceRule)}</span>
                </span>
              )}
            </div>
            <div className="p-3.5 rounded-[14px] bg-[#1E232A] text-white space-y-1.5 shadow-sm border border-black/10">
              <div className="flex items-center justify-between text-[11px] text-white/60">
                <span className="font-semibold text-[#64B5F6] flex items-center gap-1">
                  <Send className="w-3 h-3" /> @MroyaBot
                </span>
                <span className="tabular-nums">
                  {type === 'calendar_linked'
                    ? computedNotification.calcTime
                    : time || '14:35'}
                </span>
              </div>
              <div className="text-[13px] font-bold text-white leading-snug">
                🔔 {title || tr('reminderTitle',{ns:'reminders'})}
              </div>
              <p className="text-[12px] text-white/80 leading-relaxed">
                {type === 'calendar_linked' && selectedEvent
                  ? tr('eventStartsIn',{ns:'reminders',title:selectedEvent.title,offset:formatOffsetLabel(effectiveOffset),time:formatCivilTime(selectedEvent.time),location:selectedEvent.locationOrLink?` (${selectedEvent.locationOrLink})`:''})
                  : notes || tr('scheduledReminder',{ns:'reminders'})}
              </p>
              {effectiveRecurrenceRule && (
                <div className="pt-1.5 border-t border-white/10 text-[11px] text-white/60 flex items-center justify-between">
                  <span>🔁 {tr('repeats',{ns:'reminders',rule:localizedRecurrence(effectiveRecurrenceRule)})}</span>
                  <span>{tr('next',{ns:'reminders',date:nextOccurrenceInfo.label})}</span>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--mroya-divider)]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-[10px] text-[13px] font-medium text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)] cursor-pointer transition-colors"
            >
              {tr('cancel',{ns:'common'})}
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-[10px] bg-[var(--mroya-primary)] hover:bg-[var(--mroya-primary-hover)] text-white text-[13px] font-semibold cursor-pointer shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>{editingReminder ? tr('save',{ns:'common'}) : tr('createReminder',{ns:'reminders'})}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
