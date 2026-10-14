import React, { useState } from 'react';
import {
  Bell,
  Plus,
  Calendar,
  Clock,
  CheckCircle2,
  Circle,
  Pause,
  Play,
  Trash2,
  Edit3,
  Link2,
  Unlink,
  Send,
  Search,
  Filter,
  Check,
  Sparkles,
  Menu,
  PanelLeftOpen,
  RefreshCw,
  ExternalLink,
  Repeat,
  Lock,
  RotateCw,
} from 'lucide-react';
import { ReminderItem, CalendarEvent } from '../types/mroya';
import {
  formatRecurrence,
  getEffectiveRecurrence,
  getNextOccurrenceDate,
} from '../utils/recurrenceUtils';

interface RemindersViewProps {
  reminders: ReminderItem[];
  events: CalendarEvent[];
  onAddReminder: (reminder: Omit<ReminderItem, 'id' | 'createdAt'>, existingId?: string) => void;
  onUpdateReminder: (reminder: ReminderItem) => void;
  onDeleteReminder: (id: string) => void;
  onToggleComplete: (id: string) => void;
  onCompleteOccurrence?: (id: string) => void;
  onTogglePause: (id: string) => void;
  onUnlinkReminder: (id: string) => void;
  onSimulateGoogleSync: (reminderId: string) => void;
  onOpenCalendarEvent: (eventId: string) => void;
  onOpenNewReminderModal: () => void;
  onOpenEditReminderModal: (reminder: ReminderItem) => void;
  isSidebarCollapsed: boolean;
  onExpandSidebar: () => void;
  onOpenMobileMenu: () => void;
}

export const RemindersView: React.FC<RemindersViewProps> = ({
  reminders,
  events,
  onAddReminder,
  onUpdateReminder,
  onDeleteReminder,
  onToggleComplete,
  onCompleteOccurrence,
  onTogglePause,
  onUnlinkReminder,
  onSimulateGoogleSync,
  onOpenCalendarEvent,
  onOpenNewReminderModal,
  onOpenEditReminderModal,
  isSidebarCollapsed,
  onExpandSidebar,
  onOpenMobileMenu,
}) => {
  const [filter, setFilter] = useState<'all' | 'standalone' | 'linked' | 'recurring' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [syncToast, setSyncToast] = useState<string | null>(null);

  const handleSimulateSync = (reminderId: string, customMessage?: string) => {
    onSimulateGoogleSync(reminderId);
    setSyncToast(
      customMessage ||
        'Updated from Google Calendar · Shared recurrence rule updated (no duplicate reminders)'
    );
    setTimeout(() => {
      setSyncToast(null);
    }, 4500);
  };

  const handleAdvanceOccurrence = (reminder: ReminderItem) => {
    if (onCompleteOccurrence) {
      onCompleteOccurrence(reminder.id);
    } else {
      onToggleComplete(reminder.id);
    }
    const eff = getEffectiveRecurrence(reminder, events);
    const next = getNextOccurrenceDate(reminder.date, reminder.time, eff.rule, '2026-10-12');
    setSyncToast(`Occurrence completed! Next alert scheduled for ${next.label}`);
    setTimeout(() => setSyncToast(null), 4000);
  };

  // Filter items
  const filteredReminders = reminders.filter((item) => {
    const eff = getEffectiveRecurrence(item, events);

    // Filter mode
    if (filter === 'standalone' && (item.type !== 'standalone' || item.status === 'completed')) return false;
    if (filter === 'linked' && (item.type !== 'calendar_linked' || item.status === 'completed')) return false;
    if (filter === 'recurring' && (!eff.isRecurring || item.status === 'completed')) return false;
    if (filter === 'completed' && item.status !== 'completed') return false;
    if (filter === 'all' && item.status === 'completed') return true; // show in completed section

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchNotes = item.notes?.toLowerCase().includes(q);
      const linkedEvt = events.find((e) => e.id === item.calendarEventId);
      const matchEvent = linkedEvt?.title.toLowerCase().includes(q);
      const matchRecurrence = eff.rule?.humanReadable?.toLowerCase().includes(q);
      if (!matchTitle && !matchNotes && !matchEvent && !matchRecurrence) return false;
    }

    return true;
  });

  // Calculate stats
  const totalScheduled = reminders.filter((r) => r.status === 'scheduled').length;
  const recurringCount = reminders.filter(
    (r) => getEffectiveRecurrence(r, events).isRecurring && r.status !== 'completed'
  ).length;
  const completedCount = reminders.filter((r) => r.status === 'completed').length;

  // Grouping
  const todayReminders = filteredReminders.filter(
    (r) => r.date === '2026-10-12' && r.status !== 'completed'
  );
  const tomorrowReminders = filteredReminders.filter(
    (r) => r.date === '2026-10-13' && r.status !== 'completed'
  );
  const upcomingReminders = filteredReminders.filter(
    (r) => r.date > '2026-10-13' && r.status !== 'completed'
  );
  const completedReminders = filteredReminders.filter((r) => r.status === 'completed');

  const formatOffset = (mins?: number) => {
    if (mins === undefined || mins === null) return '';
    if (mins === 0) return 'At event time';
    if (mins < 60) return `${mins} min before`;
    if (mins === 60) return '1 hour before';
    if (mins === 1440) return '1 day before';
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return rem > 0 ? `${hrs}h ${rem}m before` : `${hrs} hours before`;
  };

  return (
    <div className="flex-1 flex flex-col h-full min-w-0 bg-[var(--mroya-bg)] text-[var(--mroya-text)]">
      {/* Header */}
      <header className="h-[58px] px-3.5 sm:px-6 border-b border-[var(--mroya-divider)] flex items-center justify-between gap-3 shrink-0 bg-[var(--mroya-surface)] shadow-xs sticky top-0 z-20">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            aria-label="Open menu"
            className="lg:hidden inline-flex items-center justify-center w-8 h-8 rounded-lg text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)] cursor-pointer shrink-0 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div>
            <h1 className="text-[17px] sm:text-[18px] font-bold text-[var(--mroya-text)] flex items-center gap-2">
              <span>Reminders</span>
              <span className="text-[12px] font-semibold px-2 py-0.5 rounded-full bg-[var(--mroya-surface-active)] text-[var(--mroya-primary)]">
                {totalScheduled} scheduled
              </span>
              {recurringCount > 0 && (
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                  <Repeat className="w-3 h-3" />
                  <span>{recurringCount} recurring</span>
                </span>
              )}
            </h1>
            <p className="hidden sm:block text-[11px] text-[var(--mroya-text-muted)] truncate">
              Standalone & calendar-linked reminders with automatic recurrence inheritance.
            </p>
          </div>
        </div>

        {/* Right header actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenNewReminderModal}
            className="px-3.5 py-1.5 rounded-full bg-[var(--mroya-primary)] hover:bg-[var(--mroya-primary-hover)] text-white text-[13px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs hover:shadow-sm"
          >
            <Plus className="w-4 h-4 stroke-[2.4]" />
            <span>New reminder</span>
          </button>
        </div>
      </header>

      {/* Sync Notification Toast */}
      {syncToast && (
        <div className="px-4 py-2.5 bg-emerald-500/15 border-b border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-[12px] font-semibold flex items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-emerald-600 dark:text-emerald-400" />
            <span>{syncToast}</span>
          </div>
          <button
            type="button"
            onClick={() => setSyncToast(null)}
            className="text-[11px] font-bold underline hover:opacity-80 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-3.5 sm:p-6">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* Quick Simulation Banner for Google Calendar Sync */}
          <div className="p-3 sm:p-4 rounded-[16px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20">
                <RefreshCw className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[13px] font-bold text-[var(--mroya-text)]">
                  Shared Schedule with Google Calendar
                </span>
                <p className="text-[11px] text-[var(--mroya-text-muted)]">
                  Test external modifications: recurring series & one-off reminder rules update synchronously without duplicating objects.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <button
                type="button"
                onClick={() =>
                  handleSimulateSync(
                    'rem-weekly-meeting',
                    'Weekly meeting synced from Google Calendar · Offset changed across all recurrences (15m before)'
                  )
                }
                className="px-2.5 py-1 rounded-full bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 text-[11px] font-bold border border-purple-500/30 cursor-pointer transition-colors flex items-center gap-1"
              >
                <Repeat className="w-3 h-3" />
                <span>Simulate weekly series sync</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  handleSimulateSync(
                    'rem-doctor-appt',
                    'Doctor appointment synced from Google Calendar · Offset changed from 1 hour to 30 min before'
                  )
                }
                className="px-2.5 py-1 rounded-full bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 text-[11px] font-bold border border-blue-500/30 cursor-pointer transition-colors flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Simulate doctor sync</span>
              </button>
            </div>
          </div>

          {/* Filter Tabs & Search Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[var(--mroya-divider)]">
            {/* Filter Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`px-3 py-1.5 rounded-[8px] text-[12px] font-medium transition-all whitespace-nowrap cursor-pointer ${
                  filter === 'all'
                    ? 'bg-[var(--mroya-surface)] text-[var(--mroya-primary)] shadow-xs font-semibold'
                    : 'text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)]'
                }`}
              >
                All ({reminders.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter('standalone')}
                className={`px-3 py-1.5 rounded-[8px] text-[12px] font-medium transition-all whitespace-nowrap cursor-pointer ${
                  filter === 'standalone'
                    ? 'bg-[var(--mroya-surface)] text-[var(--mroya-primary)] shadow-xs font-semibold'
                    : 'text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)]'
                }`}
              >
                Standalone
              </button>
              <button
                type="button"
                onClick={() => setFilter('linked')}
                className={`px-3 py-1.5 rounded-[8px] text-[12px] font-medium transition-all whitespace-nowrap cursor-pointer ${
                  filter === 'linked'
                    ? 'bg-[var(--mroya-surface)] text-[var(--mroya-primary)] shadow-xs font-semibold'
                    : 'text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)]'
                }`}
              >
                Linked to Calendar
              </button>
              <button
                type="button"
                onClick={() => setFilter('recurring')}
                className={`px-3 py-1.5 rounded-[8px] text-[12px] font-medium transition-all whitespace-nowrap cursor-pointer flex items-center gap-1 ${
                  filter === 'recurring'
                    ? 'bg-[var(--mroya-surface)] text-purple-600 dark:text-purple-400 shadow-xs font-semibold'
                    : 'text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)]'
                }`}
              >
                <Repeat className="w-3 h-3" />
                <span>Recurring ({recurringCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setFilter('completed')}
                className={`px-3 py-1.5 rounded-[8px] text-[12px] font-medium transition-all whitespace-nowrap cursor-pointer ${
                  filter === 'completed'
                    ? 'bg-[var(--mroya-surface)] text-[var(--mroya-primary)] shadow-xs font-semibold'
                    : 'text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)]'
                }`}
              >
                Completed ({completedCount})
              </button>
            </div>

            {/* Quick Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--mroya-text-muted)]" />
              <input
                type="text"
                placeholder="Search reminders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-56 pl-8 pr-3 py-1.5 rounded-[10px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] text-[12px] text-[var(--mroya-text)] focus:outline-none focus:border-[var(--mroya-primary)] shadow-2xs"
              />
            </div>
          </div>

          {/* Reminder Groups List */}
          <div className="space-y-6">

            {/* 1. TODAY */}
            {todayReminders.length > 0 && filter !== 'completed' && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-[14px] font-bold text-[var(--mroya-text)] uppercase tracking-wider flex items-center gap-2">
                    <span>Today</span>
                    <span className="text-[12px] font-normal text-[var(--mroya-text-muted)]">
                      · Monday, October 12
                    </span>
                  </h2>
                  <span className="text-[11px] font-semibold text-[var(--mroya-primary)]">
                    {todayReminders.length} reminder{todayReminders.length > 1 ? 's' : ''}
                  </span>
                </div>

                <div className="space-y-2">
                  {todayReminders.map((r) => renderReminderCard(r))}
                </div>
              </div>
            )}

            {/* 2. TOMORROW */}
            {tomorrowReminders.length > 0 && filter !== 'completed' && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-[14px] font-bold text-[var(--mroya-text)] uppercase tracking-wider flex items-center gap-2">
                    <span>Tomorrow</span>
                    <span className="text-[12px] font-normal text-[var(--mroya-text-muted)]">
                      · Tuesday, October 13
                    </span>
                  </h2>
                  <span className="text-[11px] font-semibold text-[var(--mroya-primary)]">
                    {tomorrowReminders.length} reminder{tomorrowReminders.length > 1 ? 's' : ''}
                  </span>
                </div>

                <div className="space-y-2">
                  {tomorrowReminders.map((r) => renderReminderCard(r))}
                </div>
              </div>
            )}

            {/* 3. UPCOMING */}
            {upcomingReminders.length > 0 && filter !== 'completed' && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-[14px] font-bold text-[var(--mroya-text)] uppercase tracking-wider flex items-center gap-2">
                    <span>Upcoming</span>
                  </h2>
                  <span className="text-[11px] font-semibold text-[var(--mroya-text-muted)]">
                    {upcomingReminders.length} scheduled
                  </span>
                </div>

                <div className="space-y-2">
                  {upcomingReminders.map((r) => renderReminderCard(r))}
                </div>
              </div>
            )}

            {/* 4. COMPLETED */}
            {(filter === 'completed' || (filter === 'all' && completedReminders.length > 0)) && (
              <div className="space-y-2.5 pt-2">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-[14px] font-bold text-[var(--mroya-text-muted)] uppercase tracking-wider flex items-center gap-2">
                    <span>Completed</span>
                  </h2>
                  <span className="text-[11px] font-medium text-[var(--mroya-text-muted)]">
                    {completedReminders.length} item{completedReminders.length > 1 ? 's' : ''}
                  </span>
                </div>

                <div className="space-y-2 opacity-80 hover:opacity-100 transition-opacity">
                  {completedReminders.map((r) => renderReminderCard(r))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {filteredReminders.length === 0 && (
              <div className="p-10 rounded-[18px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-[var(--mroya-surface-muted)] text-[var(--mroya-text-muted)] flex items-center justify-center mx-auto">
                  <Bell className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-[var(--mroya-text)]">
                    No reminders found
                  </h3>
                  <p className="text-[13px] text-[var(--mroya-text-muted)] max-w-sm mx-auto mt-1">
                    {searchQuery
                      ? 'No reminders match your current search query.'
                      : 'You are all caught up! Create a standalone recurring reminder or link one to your calendar.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onOpenNewReminderModal}
                  className="px-4 py-2 rounded-full bg-[var(--mroya-primary)] text-white text-[13px] font-semibold hover:bg-[var(--mroya-primary-hover)] transition-colors cursor-pointer"
                >
                  Create a reminder
                </button>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );

  // Helper renderer for a single Reminder Item
  function renderReminderCard(reminder: ReminderItem) {
    const isCompleted = reminder.status === 'completed';
    const isPaused = reminder.status === 'paused';
    const linkedEvent = events.find((e) => e.id === reminder.calendarEventId);
    const eff = getEffectiveRecurrence(reminder, events);
    const nextInfo = getNextOccurrenceDate(reminder.date, reminder.time, eff.rule, '2026-10-12');

    return (
      <div
        key={reminder.id}
        className={`p-3.5 sm:p-4 rounded-[14px] bg-[var(--mroya-surface)] border transition-all ${
          isCompleted
            ? 'border-[var(--mroya-divider)]/60 bg-[var(--mroya-surface)]/60'
            : isPaused
            ? 'border-[var(--mroya-divider)] bg-[var(--mroya-surface-muted)]/40'
            : 'border-[var(--mroya-divider)] hover:border-[var(--mroya-brand-honey)] shadow-2xs'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          {/* Left: Complete toggle + Content */}
          <div className="flex items-start gap-3 min-w-0 flex-1">
            {/* Complete Checkbox */}
            <button
              type="button"
              onClick={() => onToggleComplete(reminder.id)}
              aria-label={isCompleted ? 'Mark incomplete' : 'Mark completed'}
              className="mt-0.5 text-[var(--mroya-text-muted)] hover:text-[var(--mroya-primary)] cursor-pointer transition-colors shrink-0"
            >
              {isCompleted ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Circle className="w-5 h-5 hover:scale-110 transition-transform" />
              )}
            </button>

            <div className="space-y-1 min-w-0 flex-1">
              {/* Title & Status Badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`text-[14px] sm:text-[15px] font-semibold leading-snug ${
                    isCompleted
                      ? 'line-through text-[var(--mroya-text-muted)]'
                      : 'text-[var(--mroya-text)]'
                  }`}
                >
                  {reminder.title}
                </span>

                {/* Recurrence Badge */}
                {eff.isRecurring && eff.rule && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 whitespace-nowrap flex items-center gap-1">
                    <Repeat className="w-2.5 h-2.5" />
                    <span>
                      {eff.isInherited
                        ? `Inherited: ${formatRecurrence(eff.rule)}`
                        : formatRecurrence(eff.rule)}
                    </span>
                  </span>
                )}

                {/* Relative Offset Pill if Linked */}
                {reminder.type === 'calendar_linked' && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--mroya-surface-active)] text-[var(--mroya-primary)] border border-[var(--mroya-primary)]/20 whitespace-nowrap">
                    🔔 {formatOffset(reminder.offsetMinutes)}
                  </span>
                )}

                {/* Google Synced Badge */}
                {reminder.syncedWithGoogle && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 whitespace-nowrap">
                    Google Synced
                  </span>
                )}

                {/* Paused Badge */}
                {isPaused && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400">
                    Paused
                  </span>
                )}
              </div>

              {/* Linked Calendar Event link */}
              {reminder.type === 'calendar_linked' && linkedEvent && (
                <div className="pt-0.5 flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => onOpenCalendarEvent(linkedEvent.id)}
                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--mroya-primary)] hover:underline cursor-pointer group"
                    title="Open event in Mroya Calendar"
                  >
                    <Calendar className="w-3.5 h-3.5 text-[var(--mroya-brand-honey)]" />
                    <span>Event: {linkedEvent.title} ({linkedEvent.date} · {linkedEvent.time})</span>
                    <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                  {linkedEvent.recurrence && (
                    <span className="text-[10px] text-[var(--mroya-text-muted)] flex items-center gap-0.5">
                      <Lock className="w-2.5 h-2.5" /> (controlled by event)
                    </span>
                  )}
                </div>
              )}

              {/* Standalone note or details */}
              {reminder.notes && (
                <p className="text-[12px] text-[var(--mroya-text-muted)] leading-relaxed line-clamp-2">
                  {reminder.notes}
                </p>
              )}

              {/* Metadata Row: Date, Notification Time, Delivery Channel, Next occurrence */}
              <div className="flex items-center gap-2.5 pt-1 text-[11px] text-[var(--mroya-text-muted)] flex-wrap">
                <span className="font-mono-tabular font-medium text-[var(--mroya-text)] flex items-center gap-1">
                  <Clock className="w-3 h-3 text-[var(--mroya-brand-honey)]" />
                  <span>Notifies: {reminder.date} at {reminder.time}</span>
                </span>
                <span className="text-[var(--mroya-divider)]">·</span>
                <span className="flex items-center gap-1 text-[#229ED9] font-medium">
                  <Send className="w-3 h-3" />
                  <span>Telegram</span>
                </span>
                {eff.isRecurring && !isCompleted && (
                  <>
                    <span className="text-[var(--mroya-divider)]">·</span>
                    <span className="text-purple-600 dark:text-purple-400 font-semibold flex items-center gap-1">
                      <RotateCw className="w-3 h-3" />
                      <span>Next occurrence: {nextInfo.label}</span>
                    </span>
                  </>
                )}
                {reminder.completedOccurrencesCount && reminder.completedOccurrencesCount > 0 && (
                  <>
                    <span className="text-[var(--mroya-divider)]">·</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                      ✓ {reminder.completedOccurrencesCount} completed
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right: Context Actions */}
          <div className="flex items-center gap-1 shrink-0 pt-0.5">
            {/* Quick Action: Complete this occurrence for recurring reminders */}
            {eff.isRecurring && !isCompleted && (
              <button
                type="button"
                onClick={() => handleAdvanceOccurrence(reminder)}
                title="Mark this occurrence completed & schedule next occurrence"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold border border-emerald-500/30 cursor-pointer transition-colors mr-1"
              >
                <Check className="w-3 h-3" />
                <span className="hidden sm:inline">Complete occurrence</span>
              </button>
            )}

            {/* Doctor Demo: Simulate Google Calendar Update Button */}
            {reminder.id === 'rem-doctor-appt' && (
              <button
                type="button"
                onClick={() =>
                  handleSimulateSync(
                    reminder.id,
                    'Doctor appointment synced from Google Calendar · Offset changed from 1 hour to 30 min before'
                  )
                }
                title="Simulate external Google Calendar change (1h -> 30m before)"
                className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 text-[11px] font-bold border border-blue-500/30 cursor-pointer transition-colors mr-1"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Simulate Google update</span>
              </button>
            )}

            {/* Pause / Resume */}
            <button
              type="button"
              onClick={() => onTogglePause(reminder.id)}
              title={isPaused ? 'Resume reminder' : 'Pause reminder'}
              aria-label={isPaused ? 'Resume' : 'Pause'}
              className="w-7 h-7 rounded-lg inline-flex items-center justify-center text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)] cursor-pointer transition-colors"
            >
              {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            </button>

            {/* Edit */}
            <button
              type="button"
              onClick={() => onOpenEditReminderModal(reminder)}
              title="Edit reminder"
              aria-label="Edit"
              className="w-7 h-7 rounded-lg inline-flex items-center justify-center text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)] cursor-pointer transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>

            {/* Unlink from calendar if linked */}
            {reminder.type === 'calendar_linked' && (
              <button
                type="button"
                onClick={() => onUnlinkReminder(reminder.id)}
                title="Unlink from calendar event (keep reminder as standalone)"
                aria-label="Unlink"
                className="w-7 h-7 rounded-lg inline-flex items-center justify-center text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)] cursor-pointer transition-colors"
              >
                <Unlink className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Delete */}
            <button
              type="button"
              onClick={() => onDeleteReminder(reminder.id)}
              title="Delete reminder"
              aria-label="Delete"
              className="w-7 h-7 rounded-lg inline-flex items-center justify-center text-[var(--mroya-text-muted)] hover:text-red-600 hover:bg-red-500/10 cursor-pointer transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }
};
