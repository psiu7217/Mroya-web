import React, { useState, useRef } from 'react';
import {
  Calendar as CalendarIcon,
  Plus,
  Clock,
  BookOpen,
  Link2,
  Check,
  X,
  Menu,
  PanelLeftOpen,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Grid2x2,
  CalendarDays,
  ZoomOut,
  ZoomIn,
} from 'lucide-react';
import { CalendarEvent, MemoryItem } from '../types/mroya';

interface CalendarViewProps {
  events: CalendarEvent[];
  memories: MemoryItem[];
  selectedEventId: string | null;
  onAddEvent: (event: Omit<CalendarEvent, 'id'>) => void;
  onOpenMemory: (memoryId: string) => void;
  onOpenConnections: () => void;
  googleCalendarConnected: boolean;
  isSidebarCollapsed: boolean;
  onExpandSidebar: () => void;
  onOpenMobileMenu: () => void;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const SHORT_MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const AVAILABLE_YEARS = [2024, 2025, 2026, 2027, 2028];

export const CalendarView: React.FC<CalendarViewProps> = ({
  events,
  memories,
  selectedEventId,
  onAddEvent,
  onOpenMemory,
  onOpenConnections,
  googleCalendarConnected,
  isSidebarCollapsed,
  onExpandSidebar,
  onOpenMobileMenu,
}) => {
  const [currentYear, setCurrentYear] = useState<number>(2026);
  const [currentMonthIndex, setCurrentMonthIndex] = useState<number>(9); // 0-based: 9 = October
  const [viewMode, setViewMode] = useState<'year' | 'month' | 'week'>('month');
  const [selectedDay, setSelectedDay] = useState<number>(12);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);

  // Touch swipe support for iOS-like native gesture navigation
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  // New event form state
  const [newTitle, setNewTitle] = useState('');
  const [newDay, setNewDay] = useState(12);
  const [newTime, setNewTime] = useState('14:00');
  const [newCategory, setNewCategory] = useState<'meeting' | 'deadline' | 'reminder'>('meeting');
  const [newPerson, setNewPerson] = useState('Sarah Chen');
  const [newNotes, setNewNotes] = useState('');

  // Computes calendar grid data for any month/year
  const getMonthCalendarData = (year: number, monthIndex: number) => {
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const firstDayOfWeekSun = new Date(year, monthIndex, 1).getDay();
    const firstDayOffset = (firstDayOfWeekSun + 6) % 7; // Monday = 0
    const prevMonthDays = new Date(year, monthIndex, 0).getDate();
    const leadingDays: number[] = [];
    for (let i = firstDayOffset - 1; i >= 0; i--) {
      leadingDays.push(prevMonthDays - i);
    }
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    return { daysInMonth, firstDayOffset, leadingDays, days };
  };

  const getDayOfWeekName = (year: number, monthIndex: number, day: number) => {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return dayNames[new Date(year, monthIndex, day).getDay()];
  };

  const getEventsForDay = (year: number, monthIndex: number, day: number) => {
    const monthStr = String(monthIndex + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const dateStr = `${year}-${monthStr}-${dayStr}`;
    return events.filter((e) => {
      if (e.date === dateStr) return true;
      if (year === 2026 && monthIndex === 9 && e.dayOfMonth === day) return true;
      return false;
    });
  };

  const getEventsForMonthCount = (year: number, monthIndex: number) => {
    const monthStr = String(monthIndex + 1).padStart(2, '0');
    const prefix = `${year}-${monthStr}`;
    return events.filter((e) => {
      if (e.date?.startsWith(prefix)) return true;
      if (year === 2026 && monthIndex === 9) return true;
      return false;
    }).length;
  };

  const handleCreateEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const paddedMonth = String(currentMonthIndex + 1).padStart(2, '0');
    const paddedDay = String(newDay).padStart(2, '0');
    onAddEvent({
      title: newTitle.trim(),
      date: `${currentYear}-${paddedMonth}-${paddedDay}`,
      dayOfMonth: newDay,
      time: newTime,
      duration: newCategory === 'deadline' ? 'Deadline' : '1h',
      category: newCategory,
      person: newPerson.trim() || undefined,
      notes: newNotes.trim() || 'Added via Mroya Calendar.',
    });
    setNewTitle('');
    setNewNotes('');
    setIsNewModalOpen(false);
    setSelectedDay(newDay);
  };

  const handlePrevMonth = () => {
    if (currentMonthIndex === 0) {
      setCurrentMonthIndex(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonthIndex((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonthIndex === 11) {
      setCurrentMonthIndex(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonthIndex((m) => m + 1);
    }
  };

  const handlePrevYear = () => {
    setCurrentYear((y) => y - 1);
  };

  const handleNextYear = () => {
    setCurrentYear((y) => y + 1);
  };

  const handleJumpToToday = () => {
    setCurrentYear(2026);
    setCurrentMonthIndex(9); // October
    setSelectedDay(12);
    setViewMode('month');
    setIsMonthPickerOpen(false);
  };

  const handleSelectMonthFromYearView = (mIdx: number, day?: number) => {
    setCurrentMonthIndex(mIdx);
    if (day) {
      setSelectedDay(day);
    }
    setViewMode('month');
  };

  const handleSelectMonthAndYear = (year: number, mIdx: number) => {
    setCurrentYear(year);
    setCurrentMonthIndex(mIdx);
    setIsMonthPickerOpen(false);
    setViewMode('month');
  };

  // Touch gestures: swipe left/right to change month/year
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartXRef.current = e.touches[0].clientX;
      touchStartYRef.current = e.touches[0].clientY;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const diffX = touchEndX - touchStartXRef.current;
    const diffY = touchEndY - touchStartYRef.current;

    // Only handle horizontal swipes if horizontal movement > vertical movement and > 50px
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
      if (diffX > 0) {
        // Swiped right -> go to previous
        if (viewMode === 'year') {
          handlePrevYear();
        } else {
          handlePrevMonth();
        }
      } else {
        // Swiped left -> go to next
        if (viewMode === 'year') {
          handleNextYear();
        } else {
          handleNextMonth();
        }
      }
    }
    touchStartXRef.current = null;
    touchStartYRef.current = null;
  };

  const currentMonthData = getMonthCalendarData(currentYear, currentMonthIndex);
  const dayEvents = getEventsForDay(currentYear, currentMonthIndex, selectedDay);
  const formattedDayTitle = `${getDayOfWeekName(currentYear, currentMonthIndex, selectedDay)}, ${MONTH_NAMES[currentMonthIndex]} ${selectedDay}`;

  const weekDays = [12, 13, 14, 15, 16, 17, 18];

  return (
    <div
      className="flex-1 flex flex-col h-full min-w-0 bg-[var(--mroya-bg)] text-[var(--mroya-text)] select-none relative"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* HEADER: iPhone iOS Calendar Inspired Navigation Bar */}
      <header className="h-[56px] px-3 sm:px-6 border-b border-[var(--mroya-divider)] flex items-center justify-between gap-2 shrink-0 bg-[var(--mroya-bg)]/95 backdrop-blur-xs sticky top-0 z-20">
        {/* Left Side: Mobile Menu or Desktop Sidebar toggle + iOS Back/Zoom Breadcrumb */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            aria-label="Open menu"
            className="lg:hidden inline-flex items-center justify-center w-8 h-8 rounded-lg text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)] cursor-pointer shrink-0"
          >
            <Menu className="w-5 h-5" />
          </button>

          {isSidebarCollapsed && (
            <button
              type="button"
              onClick={onExpandSidebar}
              aria-label="Expand sidebar"
              className="hidden lg:inline-flex items-center justify-center w-8 h-8 rounded-lg text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)] cursor-pointer"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          )}

          {/* When in Month view: Apple Calendar Back Button to zoom out to Year View */}
          {viewMode === 'month' || viewMode === 'week' ? (
            <button
              type="button"
              onClick={() => setViewMode('year')}
              title="Zoom out to Year calendar (iOS style)"
              className="inline-flex items-center gap-0.5 px-2 py-1 -ml-1 rounded-lg text-[var(--mroya-primary)] hover:bg-[var(--mroya-surface-muted)] transition-colors cursor-pointer group shrink-0"
            >
              <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
              <span className="text-[14px] sm:text-[15px] font-bold tracking-tight">
                {currentYear}
              </span>
              <span className="hidden md:inline-block text-[11px] font-medium text-[var(--mroya-text-muted)] ml-1">
                (Year)
              </span>
            </button>
          ) : (
            /* When in Year view: Navigation controls for switching years */
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={handlePrevYear}
                title="Previous year"
                aria-label="Previous year"
                className="w-7 h-7 rounded-lg inline-flex items-center justify-center text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)] cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsMonthPickerOpen(true)}
                className="text-[16px] sm:text-[18px] font-bold text-[var(--mroya-text)] hover:text-[var(--mroya-primary)] px-1 rounded transition-colors cursor-pointer flex items-center gap-1"
                title="Choose year"
              >
                <span>{currentYear}</span>
                <ChevronDown className="w-3.5 h-3.5 text-[var(--mroya-text-muted)]" />
              </button>
              <button
                type="button"
                onClick={handleNextYear}
                title="Next year"
                aria-label="Next year"
                className="w-7 h-7 rounded-lg inline-flex items-center justify-center text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)] cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Center: Month Navigator with Dropdown Picker & Chevrons (in Month/Week mode) */}
        {(viewMode === 'month' || viewMode === 'week') && (
          <div className="hidden sm:flex items-center gap-0.5 sm:gap-1 min-w-0">
            <button
              type="button"
              onClick={handlePrevMonth}
              title="Previous month"
              aria-label="Previous month"
              className="w-7 h-7 rounded-full inline-flex items-center justify-center text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)] cursor-pointer shrink-0 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Clickable Month title: opens iOS Month & Year Quick Picker sheet */}
            <button
              type="button"
              onClick={() => setIsMonthPickerOpen(true)}
              className="px-2 py-1 rounded-lg hover:bg-[var(--mroya-surface-muted)] flex items-center gap-1.5 transition-colors cursor-pointer group"
              title="Click to jump to another month or year"
            >
              <span className="text-[15px] sm:text-[17px] font-bold text-[var(--mroya-text)] group-hover:text-[var(--mroya-primary)] transition-colors truncate">
                {MONTH_NAMES[currentMonthIndex]}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-[var(--mroya-brand-honey)] shrink-0 transition-transform group-hover:translate-y-0.5" />
            </button>

            <button
              type="button"
              onClick={handleNextMonth}
              title="Next month"
              aria-label="Next month"
              className="w-7 h-7 rounded-full inline-flex items-center justify-center text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)] cursor-pointer shrink-0 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Year view subtitle when in year view */}
        {viewMode === 'year' && (
          <div className="hidden sm:flex items-center text-[12px] text-[var(--mroya-text-muted)]">
            Tap any month or day to zoom in
          </div>
        )}

        {/* Right Controls: iOS Segmented Controller (Year / Month) + Today + Add Event */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* iOS Style Segmented View Mode Toggle (Available on BOTH mobile and desktop) */}
          <div className="flex items-center p-0.5 rounded-[8px] bg-[var(--mroya-surface-muted)] border border-[var(--mroya-divider)]">
            <button
              type="button"
              onClick={() => setViewMode('year')}
              title="Zoom out to Year (12 months)"
              className={`px-2 sm:px-2.5 py-1 rounded-[6px] text-[11px] sm:text-[12px] font-medium transition-all cursor-pointer flex items-center gap-1 ${
                viewMode === 'year'
                  ? 'bg-[var(--mroya-surface)] text-[var(--mroya-text)] shadow-2xs font-semibold'
                  : 'text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)]'
              }`}
            >
              <Grid2x2 className="w-3.5 h-3.5" />
              <span className="hidden xs:inline sm:inline">Year</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('month')}
              title="Month calendar"
              className={`px-2 sm:px-2.5 py-1 rounded-[6px] text-[11px] sm:text-[12px] font-medium transition-all cursor-pointer flex items-center gap-1 ${
                viewMode === 'month'
                  ? 'bg-[var(--mroya-surface)] text-[var(--mroya-text)] shadow-2xs font-semibold'
                  : 'text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)]'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span className="hidden xs:inline sm:inline">Month</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('week')}
              title="Week schedule"
              className={`hidden md:inline-flex px-2 sm:px-2.5 py-1 rounded-[6px] text-[11px] sm:text-[12px] font-medium transition-all cursor-pointer ${
                viewMode === 'week'
                  ? 'bg-[var(--mroya-surface)] text-[var(--mroya-text)] shadow-2xs font-semibold'
                  : 'text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)]'
              }`}
            >
              Week
            </button>
          </div>

          {/* Today Button: Apple Calendar Style */}
          <button
            type="button"
            onClick={handleJumpToToday}
            title="Jump to today (Oct 12)"
            className="px-2 sm:px-2.5 py-1 rounded-full text-[11px] sm:text-[12px] font-semibold text-[var(--mroya-primary)] bg-[var(--mroya-surface-active)] hover:opacity-90 transition-opacity cursor-pointer shrink-0"
          >
            Today
          </button>

          {/* + Add Event Button */}
          <button
            type="button"
            onClick={() => setIsNewModalOpen(true)}
            aria-label="New commitment"
            className="w-7 h-7 sm:w-auto sm:px-3 sm:py-1 rounded-full bg-[var(--mroya-primary)] hover:bg-[var(--mroya-primary-hover)] text-[var(--mroya-on-primary)] text-[12px] font-semibold inline-flex items-center justify-center gap-1 transition-colors cursor-pointer shadow-xs shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[2.4]" />
            <span className="hidden sm:inline">Event</span>
          </button>
        </div>
      </header>

      {/* QUICK MONTH & YEAR PICKER POPOVER / SHEET (iOS Style) */}
      {isMonthPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-[2px]">
          <div className="w-full max-w-sm rounded-[20px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] shadow-[var(--mroya-shadow-elevated)] p-4 sm:p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-[var(--mroya-divider)]">
              <div>
                <h3 className="text-[15px] font-bold text-[var(--mroya-text)]">
                  Jump to Month & Year
                </h3>
                <p className="text-[11px] text-[var(--mroya-text-muted)]">
                  Switch instantly or scale to full year
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsMonthPickerOpen(false)}
                className="w-7 h-7 rounded-full inline-flex items-center justify-center text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Year Selector Row */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mroya-text-muted)]">
                Select Year
              </label>
              <div className="flex items-center justify-between gap-1 p-1 rounded-[10px] bg-[var(--mroya-surface-muted)] border border-[var(--mroya-divider)]">
                {AVAILABLE_YEARS.map((yr) => (
                  <button
                    key={yr}
                    type="button"
                    onClick={() => setCurrentYear(yr)}
                    className={`flex-1 py-1.5 rounded-[7px] text-[12px] font-semibold transition-all cursor-pointer ${
                      currentYear === yr
                        ? 'bg-[var(--mroya-primary)] text-white shadow-2xs'
                        : 'text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-active)]'
                    }`}
                  >
                    {yr}
                  </button>
                ))}
              </div>
            </div>

            {/* 12 Months Grid */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mroya-text-muted)]">
                Select Month ({currentYear})
              </label>
              <div className="grid grid-cols-3 gap-2">
                {MONTH_NAMES.map((name, idx) => {
                  const isCurrent = currentMonthIndex === idx;
                  const isTodayMonth = currentYear === 2026 && idx === 9;
                  const count = getEventsForMonthCount(currentYear, idx);

                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => handleSelectMonthAndYear(currentYear, idx)}
                      className={`p-2.5 rounded-[12px] border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 relative ${
                        isCurrent
                          ? 'bg-[var(--mroya-surface-active)] border-[var(--mroya-primary)] ring-1 ring-[var(--mroya-primary)] font-bold text-[var(--mroya-primary)]'
                          : isTodayMonth
                          ? 'bg-[var(--mroya-surface)] border-[var(--mroya-brand-honey)] text-[var(--mroya-text)] font-semibold'
                          : 'bg-[var(--mroya-surface)] border-[var(--mroya-divider)] hover:bg-[var(--mroya-surface-muted)] text-[var(--mroya-text)]'
                      }`}
                    >
                      <span className="text-[13px]">{SHORT_MONTH_NAMES[idx]}</span>
                      {count > 0 && (
                        <span className="text-[10px] text-[var(--mroya-brand-honey)] font-medium">
                          {count} ev.
                        </span>
                      )}
                      {isTodayMonth && !isCurrent && (
                        <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[var(--mroya-primary)]" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Footer: Quick Jump to Year View or Today */}
            <div className="flex items-center gap-2 pt-2 border-t border-[var(--mroya-divider)]">
              <button
                type="button"
                onClick={() => {
                  setViewMode('year');
                  setIsMonthPickerOpen(false);
                }}
                className="flex-1 py-2 rounded-[10px] bg-[var(--mroya-surface-muted)] hover:bg-[var(--mroya-surface-active)] text-[var(--mroya-text)] text-[12px] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Grid2x2 className="w-3.5 h-3.5 text-[var(--mroya-primary)]" />
                <span>Annual View ({currentYear})</span>
              </button>
              <button
                type="button"
                onClick={handleJumpToToday}
                className="py-2 px-3 rounded-[10px] bg-[var(--mroya-primary)] text-white text-[12px] font-semibold transition-colors cursor-pointer"
              >
                Jump to Today
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MAIN CALENDAR CONTENT */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-6">
        <div className="max-w-[1120px] mx-auto space-y-6">

          {/* ============================================================== */}
          {/* 1. YEAR VIEW: Apple Calendar 12-Month Annual Grid               */}
          {/* ============================================================== */}
          {viewMode === 'year' ? (
            <div className="space-y-4">
              {/* Year View Bar with Year Stepper and Instructions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 sm:p-4 rounded-[16px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] shadow-2xs">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[var(--mroya-surface-muted)] flex items-center justify-center text-[var(--mroya-primary)] shrink-0">
                    <Grid2x2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-[16px] sm:text-[18px] font-bold text-[var(--mroya-text)] flex items-center gap-2">
                      <span>Annual Calendar</span>
                      <span className="text-[var(--mroya-primary)]">· {currentYear}</span>
                    </h2>
                    <p className="text-[12px] text-[var(--mroya-text-muted)]">
                      Tap any month to zoom in, or tap a date to open its schedule.
                    </p>
                  </div>
                </div>

                {/* Quick Year Stepper buttons */}
                <div className="flex items-center gap-1 self-start sm:self-center">
                  <button
                    type="button"
                    onClick={handlePrevYear}
                    className="px-2.5 py-1.5 rounded-[8px] border border-[var(--mroya-divider)] bg-[var(--mroya-surface-muted)] hover:bg-[var(--mroya-surface-active)] text-[12px] font-semibold text-[var(--mroya-text)] flex items-center gap-1 cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>{currentYear - 1}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleNextYear}
                    className="px-2.5 py-1.5 rounded-[8px] border border-[var(--mroya-divider)] bg-[var(--mroya-surface-muted)] hover:bg-[var(--mroya-surface-active)] text-[12px] font-semibold text-[var(--mroya-text)] flex items-center gap-1 cursor-pointer"
                  >
                    <span>{currentYear + 1}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* 12-Month Responsive Grid: 1 col on mobile, 2 col on sm, 3 col on lg, 4 col on xl */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-4">
                {MONTH_NAMES.map((mName, mIdx) => {
                  const mData = getMonthCalendarData(currentYear, mIdx);
                  const evtCount = getEventsForMonthCount(currentYear, mIdx);
                  const isCurrentViewingMonth = currentMonthIndex === mIdx && currentYear === 2026;
                  const isRealTodayMonth = mIdx === 9 && currentYear === 2026;

                  return (
                    <div
                      key={mName}
                      className={`p-3.5 rounded-[16px] border transition-all hover:shadow-xs group ${
                        isCurrentViewingMonth
                          ? 'bg-[var(--mroya-surface)] border-[var(--mroya-primary)] ring-1.5 ring-[var(--mroya-primary)]/30'
                          : isRealTodayMonth
                          ? 'bg-[var(--mroya-surface)] border-[var(--mroya-brand-honey)]'
                          : 'bg-[var(--mroya-surface)] border-[var(--mroya-divider)] hover:border-[var(--mroya-brand-honey)]'
                      }`}
                    >
                      {/* Month Header in Year Card (click to zoom to this month) */}
                      <button
                        type="button"
                        onClick={() => handleSelectMonthFromYearView(mIdx)}
                        className="w-full flex items-center justify-between mb-2 pb-1.5 border-b border-[var(--mroya-divider)]/40 text-left cursor-pointer group-hover:text-[var(--mroya-primary)] transition-colors"
                        title={`Zoom into ${mName}`}
                      >
                        <span className={`text-[15px] font-bold ${isRealTodayMonth ? 'text-[var(--mroya-primary)]' : 'text-[var(--mroya-text)] group-hover:text-[var(--mroya-primary)]'}`}>
                          {mName}
                        </span>
                        <div className="flex items-center gap-1">
                          {evtCount > 0 && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[var(--mroya-surface-active)] text-[var(--mroya-primary)] tabular-nums">
                              {evtCount} ev.
                            </span>
                          )}
                          <ZoomIn className="w-3.5 h-3.5 text-[var(--mroya-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </button>

                      {/* Mini weekday initials */}
                      <div className="grid grid-cols-7 mb-1 text-center text-[9px] font-semibold text-[var(--mroya-text-muted)]">
                        <div>M</div>
                        <div>T</div>
                        <div>W</div>
                        <div>T</div>
                        <div>F</div>
                        <div>S</div>
                        <div>S</div>
                      </div>

                      {/* Mini dates grid */}
                      <div className="grid grid-cols-7 gap-y-1 text-center text-[10px] tabular-nums">
                        {mData.leadingDays.map((d) => (
                          <div key={`y-lead-${d}`} className="h-5 flex items-center justify-center text-[var(--mroya-text-muted)]/20 select-none">
                            {d}
                          </div>
                        ))}
                        {mData.days.map((day) => {
                          const isTodayDate = currentYear === 2026 && mIdx === 9 && day === 12;
                          const hasEvt = getEventsForDay(currentYear, mIdx, day).length > 0;
                          return (
                            <button
                              key={`y-day-${day}`}
                              type="button"
                              onClick={() => handleSelectMonthFromYearView(mIdx, day)}
                              title={`${mName} ${day} — click to view`}
                              className="h-5 flex flex-col items-center justify-center relative hover:scale-115 transition-transform cursor-pointer"
                            >
                              <span
                                className={`w-4 h-4 flex items-center justify-center rounded-full text-[10px] ${
                                  isTodayDate
                                    ? 'bg-[var(--mroya-primary)] text-white font-bold shadow-xs'
                                    : hasEvt
                                    ? 'font-bold text-[var(--mroya-text)] ring-1 ring-[var(--mroya-brand-honey)]/60'
                                    : 'text-[var(--mroya-text)]'
                                }`}
                              >
                                {day}
                              </span>
                              {hasEvt && !isTodayDate && (
                                <span className="w-1 h-1 rounded-full bg-[var(--mroya-brand-honey)] absolute -bottom-0.5" />
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* Zoom into month action link at bottom of card */}
                      <button
                        type="button"
                        onClick={() => handleSelectMonthFromYearView(mIdx)}
                        className="w-full mt-2.5 pt-1 text-[11px] font-semibold text-[var(--mroya-primary)] hover:underline flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <span>Open {SHORT_MONTH_NAMES[mIdx]}</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* ============================================================== */
            /* 2. MONTH & WEEK VIEWS: Mobile (iOS style) + Desktop            */
            /* ============================================================== */
            <>
              {/* MOBILE iOS iPHONE CALENDAR (lg:hidden) */}
              <div className="lg:hidden space-y-4">
                {/* iOS Calendar Card: Weekday header + Month date circles */}
                <div className="rounded-[18px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] p-3 shadow-2xs">
                  {/* Quick Month Bar inside card for fast switching */}
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-[var(--mroya-divider)]/40 px-1">
                    <button
                      type="button"
                      onClick={() => setIsMonthPickerOpen(true)}
                      className="text-[14px] font-bold text-[var(--mroya-text)] flex items-center gap-1 cursor-pointer"
                    >
                      <span>{MONTH_NAMES[currentMonthIndex]} {currentYear}</span>
                      <ChevronDown className="w-3.5 h-3.5 text-[var(--mroya-brand-honey)]" />
                    </button>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={handlePrevMonth}
                        aria-label="Previous month"
                        className="w-6 h-6 rounded-full inline-flex items-center justify-center text-[var(--mroya-text-muted)] hover:bg-[var(--mroya-surface-muted)] cursor-pointer"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={handleNextMonth}
                        aria-label="Next month"
                        className="w-6 h-6 rounded-full inline-flex items-center justify-center text-[var(--mroya-text-muted)] hover:bg-[var(--mroya-surface-muted)] cursor-pointer"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* iOS Days of week row */}
                  <div className="grid grid-cols-7 mb-2 text-center text-[11px] font-semibold tracking-wider text-[var(--mroya-text-muted)]">
                    <div>M</div>
                    <div>T</div>
                    <div>W</div>
                    <div>T</div>
                    <div>F</div>
                    <div>S</div>
                    <div>S</div>
                  </div>

                  {/* iOS Dates Grid */}
                  <div className="grid grid-cols-7 gap-y-1">
                    {currentMonthData.leadingDays.map((d) => (
                      <div
                        key={`m-sep-${d}`}
                        className="h-9 flex items-center justify-center text-[13px] text-[var(--mroya-text-muted)]/30 tabular-nums select-none"
                      >
                        {d}
                      </div>
                    ))}
                    {currentMonthData.days.map((day) => {
                      const dayEvts = getEventsForDay(currentYear, currentMonthIndex, day);
                      const hasEvt = dayEvts.length > 0;
                      const isToday = currentYear === 2026 && currentMonthIndex === 9 && day === 12;
                      const isSelected = day === selectedDay;
                      return (
                        <button
                          key={`m-day-${day}`}
                          type="button"
                          onClick={() => setSelectedDay(day)}
                          className="h-10 flex flex-col items-center justify-center relative cursor-pointer"
                        >
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-[13px] tabular-nums transition-all ${
                              isSelected
                                ? 'bg-[var(--mroya-primary)] text-[var(--mroya-on-primary)] font-bold shadow-xs scale-105'
                                : isToday
                                ? 'text-[var(--mroya-primary)] font-bold ring-1.5 ring-[var(--mroya-brand-honey)] bg-[var(--mroya-surface-muted)]'
                                : 'text-[var(--mroya-text)] font-medium hover:bg-[var(--mroya-surface-muted)]'
                            }`}
                          >
                            {day}
                          </div>
                          {/* iOS dot indicator underneath date if event exists */}
                          <div className="h-1 mt-0.5 flex items-center justify-center">
                            {hasEvt && (
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  isSelected
                                    ? 'bg-[var(--mroya-primary)]'
                                    : 'bg-[var(--mroya-brand-honey)]'
                                }`}
                              />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* iOS Selected Day Agenda Timeline */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <div>
                      <h2 className="text-[16px] font-bold text-[var(--mroya-text)]">
                        {formattedDayTitle}
                      </h2>
                      <div className="text-[12px] text-[var(--mroya-text-muted)]">
                        {dayEvents.length > 0
                          ? `${dayEvents.length} commitment${dayEvents.length > 1 ? 's' : ''}`
                          : 'No events scheduled'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setNewDay(selectedDay);
                        setIsNewModalOpen(true);
                      }}
                      className="text-[12px] font-semibold text-[var(--mroya-primary)] hover:underline cursor-pointer"
                    >
                      + Add event
                    </button>
                  </div>

                  {dayEvents.length > 0 ? (
                    <div className="space-y-2.5">
                      {dayEvents.map((ev) => {
                        const linkedMem = memories.find((m) => m.id === ev.linkedMemoryId);
                        const isDeadline = ev.category === 'deadline';
                        return (
                          <div
                            key={ev.id}
                            className="p-3.5 rounded-[14px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] shadow-2xs flex items-start gap-3"
                          >
                            {/* Left time column */}
                            <div className="w-14 shrink-0 pt-0.5 text-right font-mono-tabular">
                              <div className="text-[12px] font-bold text-[var(--mroya-text)]">
                                {ev.time}
                              </div>
                              <div className="text-[10px] text-[var(--mroya-text-muted)] uppercase">
                                {ev.duration}
                              </div>
                            </div>

                            {/* iOS Color vertical marker bar */}
                            <div
                              className={`w-1 self-stretch rounded-full shrink-0 ${
                                isDeadline
                                  ? 'bg-[var(--mroya-primary)]'
                                  : 'bg-[var(--mroya-brand-honey)]'
                              }`}
                            />

                            {/* Event content */}
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="text-[14px] font-semibold text-[var(--mroya-text)] leading-[19px]">
                                {ev.title}
                              </div>
                              {ev.person && (
                                <div className="text-[12px] text-[var(--mroya-text-muted)]">
                                  {ev.person}
                                  {ev.organization ? ` · ${ev.organization}` : ''}
                                </div>
                              )}
                              {ev.notes && (
                                <p className="text-[12px] text-[var(--mroya-text-muted)] leading-[17px] line-clamp-2">
                                  {ev.notes}
                                </p>
                              )}
                              {linkedMem && (
                                <button
                                  type="button"
                                  onClick={() => onOpenMemory(linkedMem.id)}
                                  className="pt-0.5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--mroya-primary)] hover:underline cursor-pointer"
                                >
                                  <BookOpen className="w-3 h-3" />
                                  <span className="truncate">Memory: {linkedMem.title}</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-6 rounded-[14px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] text-center space-y-1">
                      <div className="text-[14px] font-semibold text-[var(--mroya-text)]">
                        No Events
                      </div>
                      <div className="text-[12px] text-[var(--mroya-text-muted)]">
                        Protected deep work block · Tap + to schedule a commitment
                      </div>
                    </div>
                  )}
                </div>

                {/* iOS Style Google Calendar Settings Cell */}
                <div className="p-3.5 rounded-[14px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-[var(--mroya-surface-muted)] flex items-center justify-center shrink-0">
                      <CalendarIcon className="w-4 h-4 text-[var(--mroya-primary)]" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-[var(--mroya-text)] truncate">
                        Google Calendar
                      </div>
                      <div className="text-[11px] text-[var(--mroya-text-muted)] truncate">
                        {googleCalendarConnected ? 'Synced (alex@lindqvist.studio)' : 'Not connected'}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenConnections}
                    className="text-[12px] font-semibold text-[var(--mroya-primary)] hover:underline shrink-0 cursor-pointer"
                  >
                    Settings
                  </button>
                </div>
              </div>

              {/* DESKTOP CALENDAR VIEW (hidden on mobile, full workspace on desktop) */}
              <div className="hidden lg:block space-y-6">
                {/* Google Calendar Connection Entry Point Banner */}
                <div className="p-4 rounded-[12px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[var(--mroya-surface-muted)] border border-[var(--mroya-divider)] flex items-center justify-center shrink-0">
                      <CalendarIcon className="w-4 h-4 text-[var(--mroya-primary)]" />
                    </div>
                    <div>
                      <div className="text-[14px] font-semibold text-[var(--mroya-text)] flex items-center gap-2">
                        <span>Google Calendar integration</span>
                        <span className="text-[12px] font-normal text-[var(--mroya-text-muted)]">
                          · {googleCalendarConnected ? 'Connected (alex@lindqvist.studio)' : 'Not connected'}
                        </span>
                      </div>
                      <p className="text-[13px] text-[var(--mroya-text-muted)]">
                        Mroya cross-references your calendar with saved client commitments and protects mornings before 11:00 AM.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenConnections}
                    className="self-start sm:self-center inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-[var(--mroya-surface-muted)] hover:bg-[var(--mroya-surface-active)] text-[13px] font-medium text-[var(--mroya-text)] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Link2 className="w-3.5 h-3.5 text-[var(--mroya-primary)]" />
                    <span>Manage connection</span>
                  </button>
                </div>

                {/* Split Layout: Calendar Grid + Upcoming Commitments */}
                <div className="grid grid-cols-12 gap-6 items-start">
                  {/* Left 8 cols: Calendar Grid */}
                  <div className="col-span-8 rounded-[12px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] p-4 sm:p-5">
                    <div className="grid grid-cols-7 gap-1 mb-2 text-center text-[12px] font-medium text-[var(--mroya-text-muted)]">
                      <div>Mon</div>
                      <div>Tue</div>
                      <div>Wed</div>
                      <div>Thu</div>
                      <div>Fri</div>
                      <div>Sat</div>
                      <div>Sun</div>
                    </div>

                    {viewMode === 'month' ? (
                      <div className="grid grid-cols-7 gap-1.5">
                        {currentMonthData.leadingDays.map((d) => (
                          <div
                            key={`sep-${d}`}
                            className="min-h-[82px] p-2 rounded-[8px] bg-[var(--mroya-surface-muted)]/40 text-[12px] text-[var(--mroya-text-muted)]/50 tabular-nums select-none"
                          >
                            {d}
                          </div>
                        ))}
                        {currentMonthData.days.map((day) => {
                          const evts = getEventsForDay(currentYear, currentMonthIndex, day);
                          const isToday = currentYear === 2026 && currentMonthIndex === 9 && day === 12;
                          const isSelected = day === selectedDay;
                          return (
                            <button
                              key={day}
                              type="button"
                              onClick={() => setSelectedDay(day)}
                              className={`min-h-[82px] p-2 rounded-[8px] border text-left flex flex-col justify-between transition-colors cursor-pointer ${
                                isSelected
                                  ? 'bg-[var(--mroya-surface-active)] border-[var(--mroya-primary)] ring-1 ring-[var(--mroya-primary)]/20'
                                  : isToday
                                  ? 'bg-[var(--mroya-surface-muted)] border-[var(--mroya-brand-honey)]'
                                  : 'bg-[var(--mroya-surface)] border-[var(--mroya-divider)]/60 hover:bg-[var(--mroya-surface-muted)]'
                              }`}
                            >
                              <div className="flex items-center justify-between w-full">
                                <span
                                  className={`text-[12px] tabular-nums ${
                                    isToday || isSelected
                                      ? 'font-bold text-[var(--mroya-primary)]'
                                      : 'font-medium text-[var(--mroya-text)]'
                                  }`}
                                >
                                  {day}
                                </span>
                                {isToday && (
                                  <span className="text-[10px] font-medium text-[var(--mroya-primary)]">
                                    Today
                                  </span>
                                )}
                              </div>

                              <div className="space-y-1 w-full mt-1">
                                {evts.slice(0, 2).map((ev) => (
                                  <div
                                    key={ev.id}
                                    className="text-[11px] leading-[14px] px-1.5 py-0.5 rounded bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] text-[var(--mroya-text)] truncate"
                                  >
                                    {ev.title}
                                  </div>
                                ))}
                                {evts.length > 2 && (
                                  <div className="text-[10px] text-[var(--mroya-text-muted)]">
                                    +{evts.length - 2} more
                                  </div>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      /* Week View (Oct 12 - Oct 18) */
                      <div className="grid grid-cols-7 gap-2">
                        {weekDays.map((day) => {
                          const evts = getEventsForDay(currentYear, currentMonthIndex, day);
                          const isSelected = day === selectedDay;
                          return (
                            <div
                              key={day}
                              onClick={() => setSelectedDay(day)}
                              className={`min-h-[240px] p-2.5 rounded-[10px] border cursor-pointer flex flex-col gap-2 ${
                                isSelected
                                  ? 'bg-[var(--mroya-surface-active)] border-[var(--mroya-primary)]'
                                  : 'bg-[var(--mroya-surface)] border-[var(--mroya-divider)]'
                              }`}
                            >
                              <div className="text-[13px] font-semibold text-[var(--mroya-text)] tabular-nums border-b border-[var(--mroya-divider)] pb-1.5">
                                Oct {day} {day === 12 ? '· Today' : ''}
                              </div>
                              <div className="space-y-2">
                                {evts.map((ev) => (
                                  <div
                                    key={ev.id}
                                    className="p-2 rounded-[8px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] text-[12px] space-y-1"
                                  >
                                    <div className="font-mono-tabular text-[11px] text-[var(--mroya-primary)]">
                                      {ev.time}
                                    </div>
                                    <div className="font-medium text-[var(--mroya-text)] leading-[16px]">
                                      {ev.title}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Right 4 cols: Selected Day + All Upcoming Commitments */}
                  <div className="col-span-4 space-y-5">
                    {/* Selected Date Detail */}
                    <div className="p-4 rounded-[12px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] space-y-3">
                      <div className="flex items-center justify-between">
                        <h2 className="text-[14px] font-semibold text-[var(--mroya-text)] tabular-nums">
                          {MONTH_NAMES[currentMonthIndex]} {selectedDay}, {currentYear}
                        </h2>
                        <button
                          type="button"
                          onClick={() => {
                            setNewDay(selectedDay);
                            setIsNewModalOpen(true);
                          }}
                          className="text-[12px] font-semibold text-[var(--mroya-primary)] hover:underline cursor-pointer"
                        >
                          + Add event
                        </button>
                      </div>

                      {dayEvents.length > 0 ? (
                        <div className="space-y-2.5">
                          {dayEvents.map((ev) => {
                            const linkedMem = memories.find((m) => m.id === ev.linkedMemoryId);
                            return (
                              <div
                                key={ev.id}
                                className={`p-3 rounded-[10px] border space-y-1.5 ${
                                  selectedEventId === ev.id
                                    ? 'bg-[var(--mroya-surface-active)] border-[var(--mroya-primary)]'
                                    : 'bg-[var(--mroya-surface-muted)] border-[var(--mroya-divider)]'
                                }`}
                              >
                                <div className="flex items-center justify-between text-[12px] text-[var(--mroya-text-muted)] tabular-nums">
                                  <span className="font-medium text-[var(--mroya-primary)] capitalize">
                                    {ev.category} · {ev.time}
                                  </span>
                                  <span>{ev.duration}</span>
                                </div>
                                <div className="text-[14px] font-semibold text-[var(--mroya-text)]">
                                  {ev.title}
                                </div>
                                {ev.person && (
                                  <div className="text-[12px] text-[var(--mroya-text-muted)]">
                                    With {ev.person}
                                    {ev.organization ? ` · ${ev.organization}` : ''}
                                  </div>
                                )}
                                <p className="text-[12px] text-[var(--mroya-text-muted)] leading-[18px]">
                                  {ev.notes}
                                </p>
                                {linkedMem && (
                                  <button
                                    type="button"
                                    onClick={() => onOpenMemory(linkedMem.id)}
                                    className="pt-1 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--mroya-primary)] hover:underline cursor-pointer"
                                  >
                                    <BookOpen className="w-3.5 h-3.5" />
                                    <span>Linked memory: {linkedMem.title}</span>
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-[13px] text-[var(--mroya-text-muted)] py-3">
                          No commitments scheduled for {MONTH_NAMES[currentMonthIndex]} {selectedDay}. Mornings before 11:00 AM are protected for deep work.
                        </p>
                      )}
                    </div>

                    {/* All Upcoming Commitments List */}
                    <div className="p-4 rounded-[12px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] space-y-3">
                      <h3 className="text-[14px] font-semibold text-[var(--mroya-text)]">
                        Upcoming commitments
                      </h3>
                      <div className="divide-y divide-[var(--mroya-divider)]">
                        {events.map((ev) => (
                          <button
                            key={ev.id}
                            type="button"
                            onClick={() => {
                              setSelectedDay(ev.dayOfMonth);
                              setCurrentMonthIndex(9);
                              setCurrentYear(2026);
                              setViewMode('month');
                            }}
                            className="w-full py-2.5 first:pt-0 last:pb-0 text-left flex items-start justify-between gap-3 hover:opacity-85 transition-opacity cursor-pointer"
                          >
                            <div className="min-w-0">
                              <div className="text-[13px] font-semibold text-[var(--mroya-text)] truncate">
                                {ev.title}
                              </div>
                              <div className="text-[12px] text-[var(--mroya-text-muted)]">
                                {ev.person || 'Personal commitment'} · {ev.category}
                              </div>
                            </div>
                            <div className="text-right shrink-0 tabular-nums">
                              <div className="text-[12px] font-semibold text-[var(--mroya-primary)]">
                                Oct {ev.dayOfMonth}
                              </div>
                              <div className="text-[11px] text-[var(--mroya-text-muted)] flex items-center justify-end gap-1">
                                <Clock className="w-3 h-3" />
                                <span>{ev.time}</span>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* NEW EVENT MODAL */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[1px]">
          <div className="w-full max-w-md rounded-[16px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] shadow-[var(--mroya-shadow-elevated)] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[16px] font-semibold text-[var(--mroya-text)]">
                New calendar commitment
              </h2>
              <button
                type="button"
                onClick={() => setIsNewModalOpen(false)}
                aria-label="Close modal"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateEvent} className="space-y-4">
              <div>
                <label className="block text-[12px] font-medium text-[var(--mroya-text-muted)] mb-1">
                  Commitment title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Design token sprint with Sarah"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-[8px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] text-[14px] text-[var(--mroya-text)] focus:outline-none focus:border-[var(--mroya-primary)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-[var(--mroya-text-muted)] mb-1">
                    Day of month (1-31)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={newDay}
                    onChange={(e) => setNewDay(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-[8px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] text-[14px] text-[var(--mroya-text)] focus:outline-none focus:border-[var(--mroya-primary)]"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[var(--mroya-text-muted)] mb-1">
                    Time
                  </label>
                  <input
                    type="text"
                    placeholder="15:00"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-[8px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] text-[14px] text-[var(--mroya-text)] focus:outline-none focus:border-[var(--mroya-primary)]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-medium text-[var(--mroya-text-muted)] mb-1">
                  Category
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['meeting', 'deadline', 'reminder'] as const).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setNewCategory(cat)}
                      className={`py-1.5 rounded-[6px] text-[12px] capitalize font-medium border cursor-pointer ${
                        newCategory === cat
                          ? 'bg-[var(--mroya-surface-active)] border-[var(--mroya-primary)] text-[var(--mroya-primary)] font-semibold'
                          : 'bg-[var(--mroya-surface)] border-[var(--mroya-divider)] text-[var(--mroya-text)]'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-medium text-[var(--mroya-text-muted)] mb-1">
                  Person / Counterparty
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sarah Chen"
                  value={newPerson}
                  onChange={(e) => setNewPerson(e.target.value)}
                  className="w-full px-3 py-2 rounded-[8px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] text-[14px] text-[var(--mroya-text)] focus:outline-none focus:border-[var(--mroya-primary)]"
                />
              </div>

              <div>
                <label className="block text-[12px] font-medium text-[var(--mroya-text-muted)] mb-1">
                  Notes & Context
                </label>
                <textarea
                  rows={2}
                  placeholder="Agenda, prep requirements, or memory references"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-[8px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] text-[13px] text-[var(--mroya-text)] focus:outline-none focus:border-[var(--mroya-primary)]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-4 py-2 rounded-[8px] text-[13px] font-medium text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-[8px] bg-[var(--mroya-primary)] hover:bg-[var(--mroya-primary-hover)] text-[var(--mroya-on-primary)] text-[13px] font-semibold cursor-pointer shadow-xs"
                >
                  Save commitment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
