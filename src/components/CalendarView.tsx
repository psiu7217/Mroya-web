import type {CalendarPresentation} from '../types/workspace';
import React, { useState, useRef, useEffect } from 'react';
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
  Bell,
  RefreshCw,
  Send,
  Repeat,
  Pencil,
  Trash2,
  Eye,
  AlertTriangle,
  AlertCircle,
  Lock,
  ShieldCheck,
  Sparkles,
  Brain,
  ExternalLink,
  User,
  Building2,
  MapPin,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';
import { GoogleSyncState, CalendarEvent, MemoryItem, ReminderItem, RecurrenceRule } from '../types/mroya';
import {calendarDate,calendarWeek,sameCalendarDay,calendarKey,calendarYears} from '../utils/calendarDates';
import { RecurrenceEditor } from './RecurrenceEditor';
import { doesEventOccurOnDate, formatRecurrence } from '../utils/recurrenceUtils';

interface CalendarViewProps {
  readOnly?:boolean;
  live?:boolean;
  calendar?:CalendarPresentation;
  googleCalendarAvailable?:boolean;
  googleCalendarNotice?:string;
  samples?:{person:string;titlePlaceholder:string;personPlaceholder:string;accountLabel:string};
  events: CalendarEvent[];
  memories: MemoryItem[];
  reminders: ReminderItem[];
  selectedEventId: string | null;
  onAddEvent: (event: Omit<CalendarEvent, 'id'>, initialReminderOffset?: number) => void|boolean|Promise<boolean>;
  onEditEvent?: (event: CalendarEvent) => void|boolean|Promise<boolean>;
  onDeleteEvent?: (id: string, version?:number) => void|boolean|Promise<boolean>;
  onOpenMemory: (memoryId: string) => void;
  onOpenConnections: () => void;
  onAddReminder: (reminder: Omit<ReminderItem, 'id' | 'createdAt'>) => void;
  onDeleteReminder: (id: string) => void;
  onSimulateGoogleSync: (reminderId: string) => void;
  onNavigateToReminders?: () => void;
  googleCalendarConnected: boolean;
  gcalSyncState?: GoogleSyncState;
  googleCalendarEmail?: string;
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


export const CalendarView: React.FC<CalendarViewProps> = ({
  readOnly=false,live=false,calendar,googleCalendarAvailable=false,googleCalendarNotice,
  samples,
  events,
  memories,
  reminders,
  selectedEventId = null,
  onAddEvent,
  onEditEvent,
  onDeleteEvent,
  onOpenMemory,
  onOpenConnections,
  onAddReminder,
  onDeleteReminder,
  onSimulateGoogleSync,
  onNavigateToReminders,
  gcalSyncState='disconnected',googleCalendarEmail='',
  isSidebarCollapsed,
  onExpandSidebar,
  onOpenMobileMenu,
}) => {
  const googleStatus=(readOnly||live&&!googleCalendarAvailable)?'Coming soon':{
    disconnected:'Disconnected',connecting:'Connecting',initial_syncing:'Initial syncing',
    connected_auto_off:'Connected · Automatic sync OFF',connected_auto_on:'Connected · Automatic sync ON',
    syncing:'Syncing',sync_error:'Sync error',conflict:'Conflict · Sync paused',reconnect_required:'Reconnect required',
  }[gcalSyncState];
  const googleStatusLabel=googleStatus+(!readOnly&&googleCalendarEmail&&!['disconnected','connecting'].includes(gcalSyncState)?` (${googleCalendarEmail})`:'');
  const today=live||readOnly?new Date():new Date(2026,9,12);
  const [currentYear, setCurrentYear] = useState<number>(today.getFullYear());
  const [currentMonthIndex, setCurrentMonthIndex] = useState<number>(today.getMonth());
  const [viewMode, setViewMode] = useState<'year' | 'month' | 'week'>('month');
  const [selectedDay, setSelectedDay] = useState<number>(today.getDate());
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [syncToast, setSyncToast] = useState<string | null>(null);

  // Viewing, Editing, and Deleting event state
  const [viewingEvent, setViewingEvent] = useState<CalendarEvent | null>(null);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [deletingEvent, setDeletingEvent] = useState<CalendarEvent | null>(null);
  const [confirmedAiProposals, setConfirmedAiProposals] = useState<Record<string, boolean>>({});

  // Edit event form state
  const [editTitle, setEditTitle] = useState('');
  const [editDate, setEditDate] = useState('2026-10-12');
  const [editTime, setEditTime] = useState('14:00');
  const [editDuration, setEditDuration] = useState('1h');
  const [editCategory, setEditCategory] = useState<'meeting' | 'deadline' | 'reminder'>('meeting');
  const [editPerson, setEditPerson] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editRecurrence, setEditRecurrence] = useState<RecurrenceRule | undefined>(undefined);

  // New event form state
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState(calendarKey(today));
  const [newTime, setNewTime] = useState('14:00');
  const [newCategory, setNewCategory] = useState<'meeting' | 'deadline' | 'reminder'>('meeting');
  const [newPerson, setNewPerson] = useState(samples?.person??'');
  const [newNotes, setNewNotes] = useState('');
  const [newEventRecurrence, setNewEventRecurrence] = useState<RecurrenceRule | undefined>(undefined);
  const [newReminderEnabled, setNewReminderEnabled] = useState(false);
  const [newReminderOffset, setNewReminderOffset] = useState<number>(30);
  const [addingReminderForEventId, setAddingReminderForEventId] = useState<string | null>(null);
  const [quickOffset, setQuickOffset] = useState<number>(30);

  const draftSignatures=useRef({create:'',edit:'',delete:''});
  draftSignatures.current={create:JSON.stringify([newTitle,newDate,newTime,newNotes,newCategory,newPerson,newEventRecurrence]),edit:JSON.stringify([editingEvent?.id,editTitle,editDate,editTime,editNotes,editCategory,editPerson,editDuration,editRecurrence]),delete:deletingEvent?.id??''};
  const pendingForm=useRef<{kind:'create'|'edit'|'delete';signature:string}|null>(null);
  const finishForm=(pending:NonNullable<typeof pendingForm.current>)=>{
    if(!mounted.current||pending.signature!==draftSignatures.current[pending.kind])return;
    if(pending.kind==='create'){setNewTitle('');setNewNotes('');setNewEventRecurrence(undefined);setNewReminderEnabled(false);setIsNewModalOpen(false);}
    else if(pending.kind==='edit')setEditingEvent(null);else setDeletingEvent(null);
  };
  const retryCalendar=async()=>{
    if(!calendar||mutationRef.current)return;
    mutationRef.current=true;const pending=pendingForm.current;
    try{if(await calendar.onRetry()){if(pending)finishForm(pending);pendingForm.current=null;}}
    finally{mutationRef.current=false;}
  };
  const mutationRef=useRef(false),editEpoch=useRef(0),mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;editEpoch.current++;};},[]);
  useEffect(()=>{
    if(!calendar?.onRangeChange)return;
    const start=viewMode==='year'?calendarDate(currentYear,0,1):calendarWeek(calendarDate(currentYear,currentMonthIndex,1))[0];
    const end=viewMode==='year'?calendarDate(currentYear,11,31):calendarWeek(new Date(currentYear,currentMonthIndex+1,0,12))[6];
    calendar.onRangeChange(calendarKey(start),calendarKey(end));
  },[calendar?.onRangeChange,currentYear,currentMonthIndex,viewMode]);
  const validDate=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
  const occurs=(event:CalendarEvent,date:string)=>{
    if(!live)return doesEventOccurOnDate(event,date);
    // Backend already expands recurrences. Never expand those instances a second time.
    if(date<event.date)return false;
    const end=event.api?.end_date??event.date;
    return event.api?.time_kind==='all_day'&&event.api.end_date?date<end:date<=end;
  };
  // Touch swipe support for iOS-like native gesture navigation
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

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

  const handleSimulateSync = (reminderId: string) => {
    if(live||readOnly||!['connected_auto_off','connected_auto_on'].includes(gcalSyncState))return;
    onSimulateGoogleSync(reminderId);
    setSyncToast('Demo schedule update applied locally');
    setTimeout(() => setSyncToast(null), 4000);
  };

  const handleQuickAddReminder = (event: CalendarEvent) => {
    if(readOnly||live)return;
    const pad = (n: number) => String(n).padStart(2, '0');
    let calcTime = event.time;
    let calcDate = event.date;
    try {
      const [h, m] = event.time.split(':').map(Number);
      const [y, mo, d] = event.date.split('-').map(Number);
      const targetDate = new Date(y, mo - 1, d, h, m);
      const notifDate = new Date(targetDate.getTime() - quickOffset * 60 * 1000);
      calcDate = `${notifDate.getFullYear()}-${pad(notifDate.getMonth() + 1)}-${pad(notifDate.getDate())}`;
      calcTime = `${pad(notifDate.getHours())}:${pad(notifDate.getMinutes())}`;
    } catch {}

    onAddReminder({
      title: event.title,
      type: 'calendar_linked',
      date: calcDate,
      time: calcTime,
      calendarEventId: event.id,
      offsetMinutes: quickOffset,
      channel: 'telegram',
      status: 'scheduled',
      notes: `${event.title} starts at ${event.time}`,
      syncedWithGoogle: event.id === 'evt-oct13-doctor' || event.id === 'evt-weekly-meeting',
      lastSyncedNote: 'Synced with Google Calendar',
    });
    setAddingReminderForEventId(null);
  };

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
    return events.filter((e) => occurs(e, dateStr));
  };

  const getEventsForMonthCount = (year: number, monthIndex: number) => {
    const monthStr = String(monthIndex + 1).padStart(2, '0');
    const prefix = `${year}-${monthStr}`;
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    let count = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const dStr = `${prefix}-${String(d).padStart(2, '0')}`;
      if (events.some((e) => occurs(e, dStr))) {
        count++;
      }
    }
    return count;
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if(readOnly||calendar?.busy||calendar?.mutationPending||mutationRef.current||!newTitle.trim()||!validDate(newDate))return;
    mutationRef.current=true;
    try {
    pendingForm.current={kind:'create',signature:draftSignatures.current.create};
    const accepted=await onAddEvent(
      {
        title: newTitle.trim(),
        date: newDate,
        dayOfMonth: Number(newDate.slice(8)),
        time: newTime,
        duration: newCategory === 'deadline' ? 'Deadline' : '1h',
        category: newCategory,
        person: newPerson.trim() || undefined,
        notes: newNotes.trim(),
        recurrence: newEventRecurrence,
        sourceName: 'Mroya',
        calendarSource: 'local',
        syncStatus: 'local_only',
      },
      newReminderEnabled ? newReminderOffset : undefined
    );

    if(accepted===false||!mounted.current)return;
    const submitted=pendingForm.current;pendingForm.current=null;
    if(submitted&&submitted.signature===draftSignatures.current.create){finishForm(submitted);const [year,month,day]=newDate.split('-').map(Number);selectDate(year,month-1,day);}
    }catch(error){if(mounted.current)setSyncToast(error instanceof Error?error.message:'Event was not saved.');}
    finally{mutationRef.current=false;}
  };

  const handleOpenEdit = async (event: CalendarEvent) => {
    if (readOnly || event.isReadOnly || mutationRef.current) return;
    const epoch=++editEpoch.current;
    if(calendar){const canonical=await calendar.onLoadEventForEdit(event);if(!canonical||!mounted.current||epoch!==editEpoch.current)return;event=canonical;}
    if(event.isReadOnly)return;
    setEditingEvent(event);
    setViewingEvent(null);
    setEditTitle(event.title);
    setEditDate(event.date);
    setEditTime(event.api?(event.api.start_time??'All day'):event.time);
    setEditDuration(event.duration || '1h');
    setEditCategory(event.category);
    setEditPerson(event.person || '');
    setEditNotes(event.notes || '');
    setEditRecurrence(event.recurrence);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly || calendar?.busy || calendar?.mutationPending || mutationRef.current || !editingEvent || editingEvent.isReadOnly || !editTitle.trim() || !validDate(editDate)) return;
    const updatedDate=editDate;
    const updated: CalendarEvent = {
      ...editingEvent,
      title: editTitle.trim(),
      date: updatedDate,
      dayOfMonth: Number(editDate.slice(8)),
      time: editTime,
      duration: editCategory === 'deadline' ? 'Deadline' : editDuration,
      category: editCategory,
      person: editPerson.trim() || undefined,
      notes: editNotes.trim(),
      recurrence: editRecurrence,
      syncStatus: 'local_only',
    };

    mutationRef.current=true;
    pendingForm.current={kind:'edit',signature:draftSignatures.current.edit};
    try{const accepted=await onEditEvent?.(updated);if(accepted===false||!mounted.current)return;
      const submitted=pendingForm.current;pendingForm.current=null;if(submitted)finishForm(submitted);setSyncToast(live?'Commitment saved in Mroya. Google sync is confirmed separately.':'Commitment updated locally · Not yet synchronized');
      setTimeout(() => setSyncToast(null),3500);
    }catch(error){if(mounted.current)setSyncToast(error instanceof Error?error.message:'Event was not saved.');}
    finally{mutationRef.current=false;}
  };

  const handleOpenDelete = (event: CalendarEvent) => {
    if (readOnly || event.isReadOnly) return;
    setDeletingEvent(event);
    setViewingEvent(null);
  };

  const handleConfirmDelete = async () => {
    if (readOnly || calendar?.busy || calendar?.mutationPending || mutationRef.current || !deletingEvent || deletingEvent.isReadOnly) return;
    mutationRef.current=true;
    pendingForm.current={kind:'delete',signature:draftSignatures.current.delete};
    try{const accepted=await onDeleteEvent?.(deletingEvent.id,deletingEvent.api?.version);if(accepted===false||!mounted.current)return;
      const submitted=pendingForm.current;pendingForm.current=null;if(submitted)finishForm(submitted);setSyncToast('Commitment permanently deleted from calendar');setTimeout(()=>setSyncToast(null),3500);
    }catch(error){if(mounted.current)setSyncToast(error instanceof Error?error.message:'Event was not deleted.');}
    finally{mutationRef.current=false;}
  };

  const renderSourceBadge = (ev: CalendarEvent) => {
    const isGoogle = ev.calendarSource === 'google_work' || ev.calendarSource === 'primary' || (ev.sourceName && ev.sourceName.includes('Google'));
    const isGoogleContacts = ev.calendarSource === 'google_birthdays' || (ev.sourceName && ev.sourceName.includes('Contacts'));
    const sourceLabel = ev.sourceName || (isGoogleContacts ? 'Google Contacts' : isGoogle ? 'Google Calendar' : 'Mroya');

    if (isGoogleContacts || ev.isReadOnly) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-pink-700 dark:text-pink-300 bg-pink-500/10 px-2 py-0.5 rounded-full border border-pink-500/20 shrink-0">
          <Lock className="w-3 h-3" />
          <span>{sourceLabel} · Read-only</span>
        </span>
      );
    }
    if (isGoogle) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 dark:text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20 shrink-0">
          <CalendarIcon className="w-3 h-3 text-blue-600 dark:text-blue-400" />
          <span>{sourceLabel}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--mroya-primary)] bg-[var(--mroya-surface-active)] px-2 py-0.5 rounded-full border border-[var(--mroya-divider)] shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--mroya-primary)]" />
        <span>Mroya (Local)</span>
      </span>
    );
  };

  const renderSyncStatusBadge = (ev: CalendarEvent) => {
    if (ev.isReadOnly) {
      return (
        <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-[var(--mroya-text-muted)] bg-[var(--mroya-surface-muted)] px-1.5 py-0.5 rounded-[5px] border border-[var(--mroya-divider)] shrink-0">
          <Lock className="w-2.5 h-2.5" />
          <span>External</span>
        </span>
      );
    }
    if(live&&!ev.syncStatus)return null;
    if (ev.syncStatus === 'synced') {
      return (
        <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-[5px] border border-emerald-500/20 shrink-0">
          <Check className="w-3 h-3 stroke-[2.5]" />
          <span>Synced</span>
        </span>
      );
    }
    if (ev.syncStatus === 'pending') {
      return (
        <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-blue-700 dark:text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded-[5px] border border-blue-500/20 shrink-0">
          <RefreshCw className="w-2.5 h-2.5 animate-spin" />
          <span>Pending sync</span>
        </span>
      );
    }
    if (ev.syncStatus === 'sync_error') {
      return (
        <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-[5px] border border-amber-500/20 shrink-0">
          <AlertTriangle className="w-2.5 h-2.5" />
          <span>Sync error</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-[var(--mroya-text-muted)] bg-[var(--mroya-surface-muted)] px-1.5 py-0.5 rounded-[5px] border border-[var(--mroya-divider)] shrink-0">
        <span>Local only</span>
      </span>
    );
  };

  const selectDate = (year:number,month:number,day=selectedDay) => {
    const date=calendarDate(year,month,day);
    setCurrentYear(date.getFullYear());setCurrentMonthIndex(date.getMonth());setSelectedDay(date.getDate());
  };
  const handlePrevMonth = () => selectDate(currentYear,currentMonthIndex-1);
  const handleNextMonth = () => selectDate(currentYear,currentMonthIndex+1);
  const handlePrevYear = () => selectDate(currentYear-1,currentMonthIndex);
  const handleNextYear = () => selectDate(currentYear+1,currentMonthIndex);

  const handleJumpToToday = () => {
    setCurrentYear(today.getFullYear());
    setCurrentMonthIndex(today.getMonth());
    setSelectedDay(today.getDate());
    setViewMode('month');
    setIsMonthPickerOpen(false);
  };

  const handleSelectMonthFromYearView = (mIdx: number, day?: number) => {
    selectDate(currentYear,mIdx,day??selectedDay);
    setViewMode('month');
  };

  const handleSelectMonthAndYear = (year: number, mIdx: number) => {
    selectDate(year,mIdx);
    setIsMonthPickerOpen(false);
    if(!(live||readOnly)||viewMode!=='week')setViewMode('month');
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

  const selectedDate=calendarDate(currentYear,currentMonthIndex,selectedDay);
  const weekDays=calendarWeek(selectedDate);
  const availableYears=calendarYears(currentYear);

  const calendarStatus=calendar&&(calendar.error||calendar.busy)&&<div role={calendar.error?'alert':'status'} className="px-4 py-2 text-sm bg-[var(--mroya-surface-muted)] border-b border-[var(--mroya-divider)] shrink-0">
        {calendar.error??'Saving calendar change…'}
        {calendar.error&&<button type="button" disabled={calendar.busy||calendar.loading} onClick={()=>void retryCalendar()} className="ml-3 underline">Retry / check calendar</button>}
      </div>;

  return (
    <div
      className="flex-1 flex flex-col h-full min-w-0 bg-[var(--mroya-bg)] text-[var(--mroya-text)] select-none relative"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* HEADER: iPhone iOS Calendar Inspired Navigation Bar */}
      <header className="h-[58px] px-3.5 sm:px-6 border-b border-[var(--mroya-divider)] flex items-center justify-between gap-2.5 shrink-0 bg-[var(--mroya-surface)] shadow-xs sticky top-0 z-20">
        {/* Left Side: Mobile Menu or Desktop Sidebar toggle + iOS Back/Zoom Breadcrumb */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            aria-label="Open menu"
            className="lg:hidden inline-flex items-center justify-center w-8 h-8 rounded-lg text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)] cursor-pointer shrink-0 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Shared year breadcrumb: vibrant pill button */}
          <button
            type="button"
            onClick={() => setViewMode(viewMode === 'year' ? 'month' : 'year')}
            title={viewMode === 'year' ? 'Back to month calendar' : 'Zoom out to year calendar'}
            aria-label={viewMode === 'year' ? 'Back to month calendar' : 'Show year calendar'}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--mroya-surface-muted)] hover:bg-[var(--mroya-surface-active)] text-[var(--mroya-primary)] border border-[var(--mroya-divider)]/80 shadow-2xs transition-all cursor-pointer group shrink-0"
          >
            <ChevronLeft className="w-4 h-4 stroke-[2.5] text-[var(--mroya-brand-honey)] group-hover:-translate-x-0.5 transition-transform" />
            <span className="text-[14px] sm:text-[15px] font-bold tracking-tight">
              {currentYear}
            </span>
          </button>
        </div>

        {/* Center: Month Navigator with Dropdown Picker & Chevrons (in Month/Week mode) */}
        {(viewMode === 'month' || viewMode === 'week') && (
          <div className="hidden sm:flex items-center gap-1 min-w-0 px-2 py-0.5 rounded-full bg-[var(--mroya-surface-muted)] border border-[var(--mroya-divider)]/80 shadow-2xs">
            <button
              type="button"
              onClick={handlePrevMonth}
              title="Previous month"
              aria-label="Previous month"
              className="w-7 h-7 rounded-full inline-flex items-center justify-center text-[var(--mroya-text)] hover:text-[var(--mroya-primary)] hover:bg-[var(--mroya-surface)] cursor-pointer shrink-0 transition-all shadow-2xs"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Clickable Month title: opens iOS Month & Year Quick Picker sheet */}
            <button
              type="button"
              onClick={() => setIsMonthPickerOpen(true)}
              className="px-2.5 py-1 rounded-full hover:bg-[var(--mroya-surface)] flex items-center gap-1.5 transition-all cursor-pointer group"
              title="Click to jump to another month or year"
            >
              <span className="text-[15px] sm:text-[16px] font-bold text-[var(--mroya-text)] group-hover:text-[var(--mroya-primary)] transition-colors truncate">
                {MONTH_NAMES[currentMonthIndex]}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-[var(--mroya-brand-honey)] shrink-0 transition-transform group-hover:translate-y-0.5" />
            </button>

            <button
              type="button"
              onClick={handleNextMonth}
              title="Next month"
              aria-label="Next month"
              className="w-7 h-7 rounded-full inline-flex items-center justify-center text-[var(--mroya-text)] hover:text-[var(--mroya-primary)] hover:bg-[var(--mroya-surface)] cursor-pointer shrink-0 transition-all shadow-2xs"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Year view subtitle when in year view */}
        {viewMode === 'year' && (
          <div className="hidden sm:flex items-center text-[12px] font-medium text-[var(--mroya-text-muted)] bg-[var(--mroya-surface-muted)] px-3 py-1 rounded-full border border-[var(--mroya-divider)]/60">
            Tap any month or day to zoom in
          </div>
        )}

        {/* Right Controls: iOS Segmented Controller (Year / Month) + Today + Add Event */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* iOS Style Segmented View Mode Toggle */}
          <div className="flex items-center p-0.5 rounded-[10px] bg-[var(--mroya-surface-muted)] border border-[var(--mroya-divider)] shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode('year')}
              title="Zoom out to Year (12 months)"
              className={`px-2 sm:px-2.5 py-1 rounded-[8px] text-[11px] sm:text-[12px] font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                viewMode === 'year'
                  ? 'bg-[var(--mroya-surface)] text-[var(--mroya-primary)] shadow-xs'
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
              className={`px-2 sm:px-2.5 py-1 rounded-[8px] text-[11px] sm:text-[12px] font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                viewMode === 'month'
                  ? 'bg-[var(--mroya-surface)] text-[var(--mroya-primary)] shadow-xs'
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
              className={`hidden md:inline-flex px-2 sm:px-2.5 py-1 rounded-[8px] text-[11px] sm:text-[12px] font-semibold transition-all cursor-pointer ${
                viewMode === 'week'
                  ? 'bg-[var(--mroya-surface)] text-[var(--mroya-primary)] shadow-xs'
                  : 'text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)]'
              }`}
            >
              Week
            </button>
          </div>

          {/* Today Button: Brighter warm accent pill */}
          <button
            type="button"
            onClick={handleJumpToToday}
            title={live||readOnly?'Jump to today':'Jump to today (Oct 12)'}
            className="px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-[12px] font-bold text-[var(--mroya-primary)] bg-[var(--mroya-surface-active)] hover:bg-[var(--mroya-brand-honey)]/25 border border-[var(--mroya-brand-honey)]/40 shadow-2xs transition-all cursor-pointer shrink-0"
          >
            Today
          </button>

          {/* + Add Event Button: Radiant Primary Action */}
          <button
            type="button"
            disabled={readOnly}
            onClick={() => setIsNewModalOpen(true)}
            aria-label="New commitment"
            className="w-8 h-8 sm:w-auto sm:px-3.5 sm:py-1 rounded-full bg-[var(--mroya-primary)] hover:bg-[var(--mroya-primary-hover)] text-white text-[12px] font-bold inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs hover:shadow-sm shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[2.4]" />
            <span className="hidden sm:inline">Event</span>
          </button>
        </div>
      </header>

      {/* Google Calendar Sync Simulation Banner */}
      {syncToast && (
        <div className="px-4 py-2.5 bg-emerald-500/15 border-b border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-[12px] font-semibold flex items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600 dark:text-emerald-400" />
            <span>{syncToast}</span>
          </div>
          <button
            type="button"
            onClick={() => setSyncToast(null)}
            className="text-[11px] underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

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
                {availableYears.map((yr) => (
                  <button
                    key={yr}
                    type="button"
                    onClick={() => selectDate(yr,currentMonthIndex)}
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
                  const isTodayMonth = currentYear === today.getFullYear() && idx === today.getMonth();
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
                  const isCurrentViewingMonth = currentMonthIndex === mIdx;
                  const isRealTodayMonth = mIdx === today.getMonth() && currentYear === today.getFullYear();

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
                          const isTodayDate = currentYear === today.getFullYear() && mIdx === today.getMonth() && day === today.getDate();
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
                      const isToday = currentYear === today.getFullYear() && currentMonthIndex === today.getMonth() && day === today.getDate();
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
                      disabled={readOnly}
                      onClick={() => {
                        setNewDate(calendarKey(calendarDate(currentYear,currentMonthIndex,selectedDay)));
                        if(!readOnly)setIsNewModalOpen(true);
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
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[14px] font-semibold text-[var(--mroya-text)] leading-[19px]">
                                  {ev.title}
                                </span>
                                {renderSourceBadge(ev)}
                                {renderSyncStatusBadge(ev)}
                                {ev.recurrence && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-purple-600 dark:text-purple-400 bg-purple-500/10 px-1.5 py-0.2 rounded-full border border-purple-500/20">
                                    <Repeat className="w-2.5 h-2.5" />
                                    <span>Recurring · {formatRecurrence(ev.recurrence)}</span>
                                  </span>
                                )}
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
                              <div className="pt-1.5 flex items-center justify-between border-t border-[var(--mroya-divider)]/40">
                                <button
                                  type="button"
                                  onClick={() => setViewingEvent(ev)}
                                  className="text-[11px] font-semibold text-[var(--mroya-primary)] hover:underline cursor-pointer flex items-center gap-1"
                                >
                                  <Eye className="w-3 h-3" />
                                  <span>Details</span>
                                </button>
                                {!readOnly && !ev.isReadOnly && (
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEdit(ev)}
                                      className="text-[11px] text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] p-0.5 cursor-pointer"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenDelete(ev)}
                                      className="text-[11px] text-red-500 hover:underline p-0.5 cursor-pointer"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* Reminders section for event (Mobile) */}
                              {(() => {
                                const eventReminders = reminders.filter((r) => r.calendarEventId === ev.id);
                                const isDoctor = ev.id === 'evt-oct13-doctor';
                                return (
                                  <div className="pt-2 border-t border-[var(--mroya-divider)]/50 space-y-2 mt-1.5">
                                    <div className="flex items-center justify-between text-[11px]">
                                      <span className="font-semibold text-[var(--mroya-text)] flex items-center gap-1">
                                        <Bell className="w-3 h-3 text-[var(--mroya-primary)]" />
                                        <span>Reminders ({eventReminders.length})</span>
                                      </span>
                                      <button
                                        type="button"
                                        disabled={live}
                                        onClick={() =>
                                          setAddingReminderForEventId(
                                            addingReminderForEventId === ev.id ? null : ev.id
                                          )
                                        }
                                        className="font-semibold text-[var(--mroya-primary)] hover:underline cursor-pointer"
                                      >
                                        {addingReminderForEventId === ev.id ? 'Cancel' : '+ Add'}
                                      </button>
                                    </div>

                                    {eventReminders.length > 0 ? (
                                      <div className="space-y-1">
                                        {eventReminders.map((r) => (
                                          <div
                                            key={r.id}
                                            className="p-1.5 px-2 rounded-[6px] bg-[var(--mroya-surface-muted)] border border-[var(--mroya-divider)]/60 flex items-center justify-between text-[11px]"
                                          >
                                            <div className="flex items-center gap-1.5 min-w-0">
                                              <span className="font-medium text-[var(--mroya-text)] truncate">
                                                🔔 {formatOffset(r.offsetMinutes)}
                                              </span>
                                              <span className="text-[var(--mroya-text-muted)] text-[10px]">
                                                ({r.time})
                                              </span>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                              {r.syncedWithGoogle && (
                                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                                  GCal
                                                </span>
                                              )}
                                              <button
                                                type="button"
                                                onClick={() => onDeleteReminder(r.id)}
                                                className="w-4 h-4 inline-flex items-center justify-center text-[var(--mroya-text-muted)] hover:text-red-500 cursor-pointer"
                                              >
                                                <X className="w-3 h-3" />
                                              </button>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="text-[10px] text-[var(--mroya-text-muted)] italic">
                                        No reminders set for this event
                                      </div>
                                    )}

                                    {isDoctor && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const docR = reminders.find((r) => r.calendarEventId === ev.id);
                                          if (docR) handleSimulateSync(docR.id);
                                        }}
                                        className="w-full py-1 px-2 rounded-md bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 text-[10px] font-bold border border-blue-500/30 flex items-center justify-center gap-1 cursor-pointer"
                                      >
                                        <RefreshCw className="w-2.5 h-2.5" />
                                        <span>Simulate Google update (1h → 30m)</span>
                                      </button>
                                    )}

                                    {addingReminderForEventId === ev.id && (
                                      <div className="p-2 rounded-[8px] bg-[var(--mroya-surface-active)]/60 border border-[var(--mroya-divider)] space-y-1.5">
                                        <div className="text-[10px] font-semibold text-[var(--mroya-text)]">
                                          Notification offset:
                                        </div>
                                        <div className="grid grid-cols-4 gap-1">
                                          {[
                                            { label: 'At time', val: 0 },
                                            { label: '15m', val: 15 },
                                            { label: '30m', val: 30 },
                                            { label: '1h', val: 60 },
                                          ].map((p) => (
                                            <button
                                              key={p.val}
                                              type="button"
                                              onClick={() => setQuickOffset(p.val)}
                                              className={`py-0.5 text-[10px] rounded border cursor-pointer ${
                                                quickOffset === p.val
                                                  ? 'bg-[var(--mroya-primary)] text-white font-semibold'
                                                  : 'bg-[var(--mroya-surface)] text-[var(--mroya-text)] border-[var(--mroya-divider)]'
                                              }`}
                                            >
                                              {p.label}
                                            </button>
                                          ))}
                                        </div>
                                        <div className="flex items-center justify-end gap-1.5 pt-0.5">
                                          <button
                                            type="button"
                                            onClick={() => setAddingReminderForEventId(null)}
                                            className="text-[10px] text-[var(--mroya-text-muted)] hover:underline cursor-pointer"
                                          >
                                            Cancel
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleQuickAddReminder(ev)}
                                            className="px-2 py-0.5 rounded bg-[var(--mroya-primary)] text-white text-[10px] font-semibold cursor-pointer"
                                          >
                                            Save
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
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
                        {readOnly ? 'Calendar API is not available yet.' : live?'Tap + to schedule a commitment':'Protected deep work block · Tap + to schedule a commitment'}
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
                        {googleStatusLabel}
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
                          · {googleStatusLabel}
                        </span>
                      </div>
                      <p className="text-[13px] text-[var(--mroya-text-muted)]">
                        {readOnly ? 'Calendar integration is not available yet.' : live?'Mroya calendar · Google synchronization is managed by the backend.':'Mroya cross-references your calendar with saved client commitments and protects mornings before 11:00 AM.'}
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
                          const isToday = currentYear === today.getFullYear() && currentMonthIndex === today.getMonth() && day === today.getDate();
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
                      /* Monday–Sunday week containing the selected civil date. */
                      <div className="grid grid-cols-7 gap-2">
                        {weekDays.map((date) => {
                          const year=date.getFullYear(),month=date.getMonth(),day=date.getDate();
                          const evts = getEventsForDay(year,month,day);
                          const isSelected = sameCalendarDay(date,selectedDate);
                          const isToday = sameCalendarDay(date,today);
                          return (
                            <div
                              key={calendarKey(date)}
                              data-calendar-date={live||readOnly?calendarKey(date):undefined}
                              onClick={() => selectDate(year,month,day)}
                              className={`min-h-[240px] p-2.5 rounded-[10px] border cursor-pointer flex flex-col gap-2 ${
                                isSelected
                                  ? 'bg-[var(--mroya-surface-active)] border-[var(--mroya-primary)]'
                                  : 'bg-[var(--mroya-surface)] border-[var(--mroya-divider)]'
                              }`}
                            >
                              <div className="text-[13px] font-semibold text-[var(--mroya-text)] tabular-nums border-b border-[var(--mroya-divider)] pb-1.5">
                                {SHORT_MONTH_NAMES[month]} {day}{live||readOnly ? ', '+year : ''} {isToday ? '· Today' : ''}
                              </div>
                              <div className="space-y-2">
                                {evts.map((ev) => (
                                  <div
                                    key={ev.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setViewingEvent(ev);
                                    }}
                                    className="p-2 rounded-[8px] bg-[var(--mroya-surface)] hover:bg-[var(--mroya-surface-active)] border border-[var(--mroya-divider)] text-[12px] space-y-1 cursor-pointer transition-colors"
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="font-mono-tabular text-[11px] text-[var(--mroya-primary)]">
                                        {ev.time}
                                      </span>
                                      <div className="flex items-center gap-1">
                                        {ev.recurrence && <Repeat className="w-2.5 h-2.5 text-purple-600 dark:text-purple-400" />}
                                        {ev.isReadOnly && <Lock className="w-2.5 h-2.5 text-[var(--mroya-text-muted)]" />}
                                      </div>
                                    </div>
                                    <div className="font-medium text-[var(--mroya-text)] leading-[16px] truncate">
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
                          disabled={readOnly}
                          onClick={() => {
                            setNewDate(calendarKey(calendarDate(currentYear,currentMonthIndex,selectedDay)));
                            if(!readOnly)setIsNewModalOpen(true);
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
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-[14px] font-semibold text-[var(--mroya-text)]">
                                    {ev.title}
                                  </span>
                                  {renderSourceBadge(ev)}
                                  {renderSyncStatusBadge(ev)}
                                  {ev.recurrence && (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">
                                      <Repeat className="w-3 h-3" />
                                      <span>Recurring · {formatRecurrence(ev.recurrence)}</span>
                                    </span>
                                  )}
                                  {(ev.id === 'evt-oct14-alex' || ev.person?.includes('Александр')) && (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-full border border-amber-500/30">
                                      <Sparkles className="w-3 h-3 text-[var(--mroya-brand-honey)]" />
                                      <span>Проанализировано AI</span>
                                    </span>
                                  )}
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

                                <div className="pt-2 flex items-center justify-between border-t border-[var(--mroya-divider)]/40">
                                  <button
                                    type="button"
                                    onClick={() => setViewingEvent(ev)}
                                    className="inline-flex items-center gap-1 text-[11.5px] font-medium text-[var(--mroya-primary)] hover:underline cursor-pointer"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>View details</span>
                                  </button>
                                  <div className="flex items-center gap-2">
                                    {!readOnly && !ev.isReadOnly && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => handleOpenEdit(ev)}
                                          title="Edit commitment"
                                          className="p-1 rounded-[5px] text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-active)] transition-colors cursor-pointer"
                                        >
                                          <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleOpenDelete(ev)}
                                          title="Delete commitment"
                                          className="p-1 rounded-[5px] text-[var(--mroya-text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </>
                                    )}
                                    {ev.isReadOnly && (
                                      <span className="text-[11px] text-[var(--mroya-text-muted)] flex items-center gap-1">
                                        <Lock className="w-3 h-3" />
                                        <span>Read-only</span>
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Reminders section for event (Desktop) */}
                                {(() => {
                                  const eventReminders = reminders.filter((r) => r.calendarEventId === ev.id);
                                  const isDoctor = ev.id === 'evt-oct13-doctor';
                                  return (
                                    <div className="pt-2.5 border-t border-[var(--mroya-divider)]/60 space-y-2 mt-2">
                                      <div className="flex items-center justify-between text-[12px]">
                                        <div className="font-semibold text-[var(--mroya-text)] flex items-center gap-1.5">
                                          <Bell className="w-3.5 h-3.5 text-[var(--mroya-primary)]" />
                                          <span>Reminders</span>
                                          {eventReminders.length > 0 && (
                                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-[var(--mroya-surface-active)] text-[var(--mroya-primary)]">
                                              {eventReminders.length}
                                            </span>
                                          )}
                                        </div>
                                        <button
                                          type="button"
                                          disabled={live}
                                          onClick={() =>
                                            setAddingReminderForEventId(
                                              addingReminderForEventId === ev.id ? null : ev.id
                                            )
                                          }
                                          className="text-[11px] font-semibold text-[var(--mroya-primary)] hover:underline cursor-pointer"
                                        >
                                          {addingReminderForEventId === ev.id ? 'Cancel' : '+ Add reminder'}
                                        </button>
                                      </div>

                                      {/* Reminders List */}
                                      {eventReminders.length > 0 ? (
                                        <div className="space-y-1.5">
                                          {eventReminders.map((r) => (
                                            <div
                                              key={r.id}
                                              className="p-2 rounded-[8px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] flex items-center justify-between text-[11px] gap-2"
                                            >
                                              <div className="flex items-center gap-2 min-w-0">
                                                <Bell className="w-3.5 h-3.5 text-[var(--mroya-brand-honey)] shrink-0" />
                                                <span className="font-semibold text-[var(--mroya-text)] truncate">
                                                  {formatOffset(r.offsetMinutes)}
                                                </span>
                                                <span className="text-[var(--mroya-text-muted)] font-mono-tabular shrink-0">
                                                  ({r.time})
                                                </span>
                                                {r.syncedWithGoogle && (
                                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shrink-0">
                                                    Google Synced
                                                  </span>
                                                )}
                                              </div>

                                              <div className="flex items-center gap-1 shrink-0">
                                                {isDoctor && (
                                                  <button
                                                    type="button"
                                                    onClick={() => handleSimulateSync(r.id)}
                                                    title="Simulate Google Calendar external update"
                                                    className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/30 cursor-pointer flex items-center gap-1 transition-colors"
                                                  >
                                                    <RefreshCw className="w-2.5 h-2.5" />
                                                    <span>Sync update</span>
                                                  </button>
                                                )}
                                                <button
                                                  type="button"
                                                  onClick={() => onDeleteReminder(r.id)}
                                                  title="Remove reminder"
                                                  className="w-5 h-5 rounded flex items-center justify-center text-[var(--mroya-text-muted)] hover:text-red-500 cursor-pointer"
                                                >
                                                  <X className="w-3.5 h-3.5" />
                                                </button>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <div className="text-[11px] text-[var(--mroya-text-muted)] italic">
                                          No reminders configured. Default calendar events have no alerts.
                                        </div>
                                      )}

                                      {/* Doctor Appointment Demo Simulation Callout */}
                                      {isDoctor && (
                                        <div className="p-2.5 rounded-[10px] bg-blue-500/10 border border-blue-500/20 text-[12px] text-blue-900 dark:text-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                          <div>
                                            <span className="font-semibold">Doctor appointment (Google Synced)</span>
                                            <p className="text-[11px] text-blue-800/80 dark:text-blue-300/80">
                                              Simulate external Google Calendar change from 1 hour to 30 min before
                                            </p>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const docR = reminders.find((r) => r.calendarEventId === ev.id);
                                              if (docR) handleSimulateSync(docR.id);
                                            }}
                                            className="px-2.5 py-1 rounded-[6px] bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap shadow-xs shrink-0"
                                          >
                                            Simulate Google Calendar update
                                          </button>
                                        </div>
                                      )}

                                      {/* Weekly Team Meeting Simulation Callout */}
                                      {ev.id === 'evt-weekly-meeting' && (
                                        <div className="p-2.5 rounded-[10px] bg-purple-500/10 border border-purple-500/20 text-[12px] text-purple-900 dark:text-purple-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                          <div>
                                            <span className="font-semibold flex items-center gap-1.5">
                                              <Repeat className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                                              <span>Weekly team meeting · Recurring Series</span>
                                            </span>
                                            <p className="text-[11px] text-purple-800/80 dark:text-purple-300/80">
                                              Parent event is source of truth. Simulates Google Calendar updating recurring alert across all Mondays.
                                            </p>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const meetingR = reminders.find((r) => r.calendarEventId === ev.id);
                                              if (meetingR) handleSimulateSync(meetingR.id);
                                            }}
                                            className="px-2.5 py-1 rounded-[6px] bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap shadow-xs shrink-0"
                                          >
                                            Simulate recurrence sync
                                          </button>
                                        </div>
                                      )}

                                      {/* Anna's Birthday Simulation Callout */}
                                      {ev.id === 'evt-annas-birthday' && (
                                        <div className="p-2.5 rounded-[10px] bg-pink-500/10 border border-pink-500/20 text-[12px] text-pink-900 dark:text-pink-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                          <div>
                                            <span className="font-semibold">Anna's birthday (Google Contacts · Annual)</span>
                                            <p className="text-[11px] text-pink-800/80 dark:text-pink-300/80">
                                              Annual reminder inherited from contact calendar. Alerts on April 16 at 09:00 via Telegram.
                                            </p>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const bdayR = reminders.find((r) => r.calendarEventId === ev.id);
                                              if (bdayR) handleSimulateSync(bdayR.id);
                                            }}
                                            className="px-2.5 py-1 rounded-[6px] bg-pink-600 hover:bg-pink-700 text-white text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap shadow-xs shrink-0"
                                          >
                                            Test sync
                                          </button>
                                        </div>
                                      )}

                                      {/* Quick Add Reminder inline picker */}
                                      {addingReminderForEventId === ev.id && (
                                        <div className="p-2.5 rounded-[10px] bg-[var(--mroya-surface-active)]/50 border border-[var(--mroya-divider)] space-y-2 animate-in fade-in duration-150">
                                          <div className="text-[11px] font-semibold text-[var(--mroya-text)]">
                                            Select notification offset before start:
                                          </div>
                                          <div className="grid grid-cols-4 gap-1.5">
                                            {[
                                              { label: 'At time', val: 0 },
                                              { label: '15m before', val: 15 },
                                              { label: '30m before', val: 30 },
                                              { label: '1h before', val: 60 },
                                            ].map((p) => (
                                              <button
                                                key={p.val}
                                                type="button"
                                                onClick={() => setQuickOffset(p.val)}
                                                className={`py-1 text-[11px] rounded border cursor-pointer ${
                                                  quickOffset === p.val
                                                    ? 'bg-[var(--mroya-primary)] text-white border-[var(--mroya-primary)] font-semibold'
                                                    : 'bg-[var(--mroya-surface)] text-[var(--mroya-text)] border-[var(--mroya-divider)]'
                                                }`}
                                              >
                                                {p.label}
                                              </button>
                                            ))}
                                          </div>
                                          <div className="flex items-center justify-end gap-2 pt-1">
                                            <button
                                              type="button"
                                              onClick={() => setAddingReminderForEventId(null)}
                                              className="text-[11px] text-[var(--mroya-text-muted)] hover:underline cursor-pointer"
                                            >
                                              Cancel
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleQuickAddReminder(ev)}
                                              className="px-3 py-1 rounded bg-[var(--mroya-primary)] text-white text-[11px] font-semibold cursor-pointer shadow-xs"
                                            >
                                              Save reminder
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-[13px] text-[var(--mroya-text-muted)] py-3">
                          {readOnly ? 'Calendar API is not available yet.' : <>No commitments scheduled for {MONTH_NAMES[currentMonthIndex]} {selectedDay}. {!live&&'Mornings before 11:00 AM are protected for deep work.'}</>}
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
                              const [year,month,day]=ev.date.split('-').map(Number);
                              // Demo fixtures store recurring occurrence dayOfMonth separately from their series start date.
                              selectDate(live||readOnly?year:today.getFullYear(),live||readOnly?month-1:today.getMonth(),live||readOnly?day:ev.dayOfMonth);
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
                                {SHORT_MONTH_NAMES[live||readOnly?Number(ev.date.slice(5,7))-1:today.getMonth()]} {live||readOnly?Number(ev.date.slice(8,10)):ev.dayOfMonth}{live||readOnly?', '+ev.date.slice(0,4):''}
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

      {!isNewModalOpen&&!editingEvent&&!deletingEvent&&calendarStatus}
      {googleCalendarNotice&&<p role="status" className="px-4 py-2 text-sm text-[var(--mroya-text-muted)]">{googleCalendarNotice}</p>}
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
              {calendarStatus}
              <div>
                <label className="block text-[12px] font-medium text-[var(--mroya-text-muted)] mb-1">
                  Commitment title *
                </label>
                <input
                  type="text"
                  required
                  placeholder={samples?.titlePlaceholder??'Event title'}
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-[8px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] text-[14px] text-[var(--mroya-text)] focus:outline-none focus:border-[var(--mroya-primary)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-[var(--mroya-text-muted)] mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
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
                  placeholder={samples?.personPlaceholder??'Person or organization'}
                  value={newPerson}
                  disabled={live}
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

              {/* Recurrence Rule for Event */}
              <div className="p-3 rounded-[10px] bg-[var(--mroya-surface-muted)]/60 border border-[var(--mroya-divider)]">
                <RecurrenceEditor
                  value={newEventRecurrence}
                  onChange={(rule) => setNewEventRecurrence(rule)}
                  baseTime={newTime}
                  baseDate={newDate}
                />
              </div>

              {/* Optional Reminder Setup */}
              <div className="p-3 rounded-[10px] bg-[var(--mroya-surface-muted)]/60 border border-[var(--mroya-divider)] space-y-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={newReminderEnabled}
                    disabled={live}
                    onChange={(e) => setNewReminderEnabled(e.target.checked)}
                    className="w-4 h-4 rounded text-[var(--mroya-primary)] accent-[var(--mroya-primary)] cursor-pointer"
                  />
                  <span className="text-[12px] font-semibold text-[var(--mroya-text)] flex items-center gap-1.5">
                    <Bell className="w-3.5 h-3.5 text-[var(--mroya-primary)]" />
                    <span>{live?'Reminders · Coming soon':'Set a reminder for this commitment'}</span>
                  </span>
                </label>
                {newReminderEnabled && (
                  <div className="pt-1 space-y-1.5 animate-in fade-in duration-150">
                    <div className="text-[11px] text-[var(--mroya-text-muted)]">
                      Notify before event start:
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { label: '15m before', val: 15 },
                        { label: '30m before', val: 30 },
                        { label: '1h before', val: 60 },
                        { label: '1d before', val: 1440 },
                      ].map((chip) => (
                        <button
                          key={chip.val}
                          type="button"
                          onClick={() => setNewReminderOffset(chip.val)}
                          className={`py-1 px-1 rounded-[6px] text-[11px] font-medium border text-center transition-all cursor-pointer ${
                            newReminderOffset === chip.val
                              ? 'bg-[var(--mroya-primary)] text-white border-[var(--mroya-primary)] font-semibold shadow-2xs'
                              : 'bg-[var(--mroya-surface)] text-[var(--mroya-text)] border-[var(--mroya-divider)]'
                          }`}
                        >
                          {chip.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-[var(--mroya-text-muted)] flex items-center gap-1">
                      <Send className="w-3 h-3 text-[#229ED9]" />
                      <span>Alert will be sent via Telegram (@MroyaBot)</span>
                    </p>
                  </div>
                )}
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
                  disabled={calendar?.busy||calendar?.mutationPending}
                  className="px-4 py-2 rounded-[8px] bg-[var(--mroya-primary)] hover:bg-[var(--mroya-primary-hover)] text-[var(--mroya-on-primary)] text-[13px] font-semibold cursor-pointer shadow-xs"
                >
                  Save commitment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW EVENT DETAILS MODAL */}
      {viewingEvent && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="view-event-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-[2px] animate-in fade-in duration-150"
          onClick={() => setViewingEvent(null)}
        >
          <div
            className="w-full max-w-lg rounded-[16px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] shadow-[var(--mroya-shadow-elevated)] p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto text-[var(--mroya-text)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mroya-primary)] bg-[var(--mroya-surface-active)] px-2 py-0.5 rounded-[5px]">
                    {viewingEvent.category}
                  </span>
                  {renderSourceBadge(viewingEvent)}
                  {renderSyncStatusBadge(viewingEvent)}
                </div>
                <h2 id="view-event-title" className="text-[17px] font-bold text-[var(--mroya-text)] pt-1">
                  {viewingEvent.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setViewingEvent(null)}
                aria-label="Close details"
                className="p-1 rounded-lg text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 divide-y divide-[var(--mroya-divider)]/60 text-[13px]">
              {/* Date and Time */}
              <div className="pt-2 flex items-center justify-between">
                <div className="flex items-center gap-2 text-[var(--mroya-text)] font-medium">
                  <Clock className="w-4 h-4 text-[var(--mroya-primary)] shrink-0" />
                  <span>
                    {viewingEvent.date} · {viewingEvent.time}
                  </span>
                </div>
                <span className="text-[var(--mroya-text-muted)] text-[12px]">
                  Duration: {viewingEvent.duration}
                </span>
              </div>

              {/* Counterparty / Organization */}
              {viewingEvent.person && (
                <div className="pt-3 flex items-start gap-2">
                  <div className="text-[var(--mroya-text-muted)] w-28 shrink-0">With:</div>
                  <div className="font-medium text-[var(--mroya-text)]">
                    {viewingEvent.person}
                    {viewingEvent.organization ? ` · ${viewingEvent.organization}` : ''}
                  </div>
                </div>
              )}

              {/* Location or Link */}
              {viewingEvent.locationOrLink && (
                <div className="pt-3 flex items-start gap-2">
                  <div className="text-[var(--mroya-text-muted)] w-28 shrink-0">Location:</div>
                  <div className="font-medium text-[var(--mroya-text)]">
                    {viewingEvent.locationOrLink}
                  </div>
                </div>
              )}

              {/* Recurrence Series */}
              <div className="pt-3 space-y-1">
                <div className="text-[var(--mroya-text-muted)] text-[12px] font-medium">
                  Recurrence:
                </div>
                {(viewingEvent.recurrence||viewingEvent.api?.edit_scope==='series') ? (
                  <div className="p-2.5 rounded-[10px] bg-purple-500/10 border border-purple-500/20 text-purple-900 dark:text-purple-200 text-[12px] space-y-1">
                    <div className="flex items-center gap-1.5 font-semibold">
                      <Repeat className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      <span>Part of a recurring series ({viewingEvent.recurrence?formatRecurrence(viewingEvent.recurrence):'Google provider rule'}). Changes apply to the whole series.</span>
                    </div>
                    <p className="text-[11px] text-purple-800/80 dark:text-purple-300/80">
                      Modifications apply to the entire recurring series. Individual instance exceptions are not supported by Backend yet.
                    </p>
                  </div>
                ) : (
                  <div className="text-[12px] text-[var(--mroya-text-muted)]">
                    Single commitment (does not repeat)
                  </div>
                )}
              </div>

              {/* Notes */}
              {viewingEvent.notes && (
                <div className="pt-3 space-y-1">
                  <div className="text-[var(--mroya-text-muted)] text-[12px] font-medium">
                    Notes & Context:
                  </div>
                  <p className="p-2.5 rounded-[8px] bg-[var(--mroya-surface-muted)] text-[12.5px] leading-[19px] text-[var(--mroya-text)] whitespace-pre-wrap">
                    {viewingEvent.notes}
                  </p>
                </div>
              )}

              {/* Read-only notification */}
              {viewingEvent.isReadOnly && (
                <div className="pt-3">
                  <div className="p-3 rounded-[10px] bg-pink-500/10 border border-pink-500/20 text-pink-900 dark:text-pink-200 text-[12px] flex items-start gap-2">
                    <Lock className="w-4 h-4 text-pink-600 dark:text-pink-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold">Read-only external event</span>
                      <p className="text-[11px] text-pink-800/80 dark:text-pink-300/80">
                        This commitment is imported from an external read-only calendar ({viewingEvent.sourceName || 'Google Contacts'}). Editing and deleting must be done in the source application.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Memory Intelligence Event Analysis Section */}
              <div className="pt-3 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="text-[12.5px] font-semibold text-[var(--mroya-text)] flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-[var(--mroya-brand-honey)]" />
                    <span>Memory Intelligence · Анализ события</span>
                  </div>

                  {/* Analysis Status Badge */}
                  <div>
                    {confirmedAiProposals[viewingEvent.id] ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                        <Check className="w-3 h-3" />
                        <span>Предложение принято</span>
                      </span>
                    ) : viewingEvent.id === 'evt-annas-birthday' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[var(--mroya-surface-muted)] text-[var(--mroya-text-muted)] border border-[var(--mroya-divider)]">
                        <Clock className="w-3 h-3" />
                        <span>Анализ недоступен</span>
                      </span>
                    ) : viewingEvent.id === 'evt-oct19-daniel' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                        <Clock className="w-3 h-3" />
                        <span>В очереди на анализ</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30">
                        <Sparkles className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                        <span>Проанализировано AI</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Extracted Entities */}
                <div className="p-3 rounded-[10px] bg-[var(--mroya-surface-muted)]/70 border border-[var(--mroya-divider)] space-y-2">
                  <div className="text-[11px] uppercase tracking-wider text-[var(--mroya-text-muted)] font-semibold">
                    Извлечённые сущности:
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[12px]">
                    <div className="flex items-center gap-2 p-1.5 rounded bg-[var(--mroya-surface)] border border-[var(--mroya-divider)]/60">
                      <User className="w-3.5 h-3.5 text-[var(--mroya-primary)] shrink-0" />
                      <div className="truncate">
                        <span className="text-[var(--mroya-text-muted)]">Участник: </span>
                        <span className="font-medium text-[var(--mroya-text)]">{viewingEvent.person || 'Александр Белов (Сашка)'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-1.5 rounded bg-[var(--mroya-surface)] border border-[var(--mroya-divider)]/60">
                      <Building2 className="w-3.5 h-3.5 text-[var(--mroya-primary)] shrink-0" />
                      <div className="truncate">
                        <span className="text-[var(--mroya-text-muted)]">Компания: </span>
                        <span className="font-medium text-[var(--mroya-text)]">{viewingEvent.organization || 'Архитектурное бюро'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-1.5 rounded bg-[var(--mroya-surface)] border border-[var(--mroya-divider)]/60">
                      <MapPin className="w-3.5 h-3.5 text-[var(--mroya-primary)] shrink-0" />
                      <div className="truncate">
                        <span className="text-[var(--mroya-text-muted)]">Локация: </span>
                        <span className="font-medium text-[var(--mroya-text)]">{viewingEvent.locationOrLink || 'Кофейня на Немиге / Google Meet'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-1.5 rounded bg-[var(--mroya-surface)] border border-[var(--mroya-divider)]/60">
                      <Brain className="w-3.5 h-3.5 text-[var(--mroya-brand-honey)] shrink-0" />
                      <div className="truncate">
                        <span className="text-[var(--mroya-text-muted)]">Договоренность: </span>
                        <span className="font-medium text-[var(--mroya-text)]">Согласование эскизов фасада</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Proposed for Memory Card */}
                <div className="p-3.5 rounded-[10px] bg-[var(--mroya-bg)] border border-[var(--mroya-primary)]/40 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="text-[11.5px] uppercase tracking-wider font-semibold text-[var(--mroya-primary)] flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Предложено для памяти:</span>
                      </div>
                      <p className="text-[13px] font-semibold text-[var(--mroya-text)]">
                        {viewingEvent.id === 'evt-oct14-alex'
                          ? 'Связать встречу с контактом «Александр Белов» и зафиксировать срок эскизов'
                          : `Связать событие «${viewingEvent.title}» с карточкой контакта в долговременной памяти`}
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/25 shrink-0">
                      Кандидат
                    </span>
                  </div>

                  <p className="text-[12px] text-[var(--mroya-text-muted)] leading-[18px]">
                    Модель обнаружила соответствие с существующим контактом (сходство 94%). Информация не считается свершившимся фактом до вашего одобрения.
                  </p>

                  <div className="flex items-center justify-between pt-1 gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => onOpenMemory('mem-schedule-pref')}
                      className="text-[12px] font-semibold text-[var(--mroya-primary)] hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>Перейти к предложению в Inbox</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                    {!confirmedAiProposals[viewingEvent.id] ? (
                      <button
                        type="button"
                        onClick={() => setConfirmedAiProposals((prev) => ({ ...prev, [viewingEvent.id]: true }))}
                        className="px-3 py-1 rounded-[6px] bg-[var(--mroya-primary)] hover:bg-[var(--mroya-primary-hover)] text-[var(--mroya-on-primary)] text-[11.5px] font-semibold transition-colors cursor-pointer shadow-xs inline-flex items-center gap-1"
                      >
                        <Check className="w-3 h-3" />
                        <span>Подтвердить факт</span>
                      </button>
                    ) : (
                      <span className="text-[11.5px] font-semibold text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Подтверждено</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* AI Uncertainty Indicator */}
                <div className="p-2.5 rounded-[8px] bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-200 text-[12px] flex items-start gap-2">
                  <HelpCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Индикатор неуверенности AI: </span>
                    <span>Модель не уверена на 100%, относится ли встреча к личной консультации или проекту Harbor Labs. Требуется подтверждение человека.</span>
                  </div>
                </div>

                {/* Conflict Warning */}
                {viewingEvent.id === 'evt-oct14-alex' && (
                  <div className="p-2.5 rounded-[8px] bg-red-500/10 border border-red-500/25 text-red-800 dark:text-red-300 text-[12px] flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold">Предупреждение о конфликте: </span>
                      <span>В существующей памяти указано, что Александр находится в отпуске до 18 октября. Проверьте актуальность даты встречи перед подтверждением.</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer buttons */}
            <div className="flex items-center justify-between pt-3 border-t border-[var(--mroya-divider)]">
              <div>
                {!viewingEvent.isReadOnly && !readOnly && (
                  <button
                    type="button"
                    onClick={() => handleOpenDelete(viewingEvent)}
                    className="px-3 py-1.5 rounded-[8px] border border-red-500/30 hover:bg-red-500/10 text-red-600 dark:text-red-400 text-[12px] font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setViewingEvent(null)}
                  className="px-3.5 py-1.5 rounded-[8px] border border-[var(--mroya-divider)] text-[12.5px] font-medium text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] cursor-pointer"
                >
                  Close
                </button>
                {!viewingEvent.isReadOnly && !readOnly && (
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(viewingEvent)}
                    className="px-3.5 py-1.5 rounded-[8px] bg-[var(--mroya-primary)] hover:bg-[var(--mroya-primary-hover)] text-[var(--mroya-on-primary)] text-[12.5px] font-semibold cursor-pointer shadow-xs flex items-center gap-1.5"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>{viewingEvent.api?.edit_scope==='series'?'Edit entire series':'Edit commitment'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT EVENT MODAL */}
      {editingEvent && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-event-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-[2px] animate-in fade-in duration-150"
          onClick={() => setEditingEvent(null)}
        >
          <div
            className="w-full max-w-md rounded-[16px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] shadow-[var(--mroya-shadow-elevated)] p-5 space-y-4 max-h-[90vh] overflow-y-auto text-[var(--mroya-text)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 id="edit-event-title" className="text-[16px] font-semibold text-[var(--mroya-text)]">
                  Edit commitment
                </h2>
                <p className="text-[11px] text-[var(--mroya-text-muted)]">
                  {editingEvent.sourceName || 'Mroya Calendar'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingEvent(null)}
                aria-label="Close edit modal"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              {calendarStatus}
              <div>
                <label className="block text-[12px] font-medium text-[var(--mroya-text-muted)] mb-1">
                  Commitment title *
                </label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-[8px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] text-[14px] text-[var(--mroya-text)] focus:outline-none focus:border-[var(--mroya-primary)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-[var(--mroya-text-muted)] mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-[8px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] text-[14px] text-[var(--mroya-text)] focus:outline-none focus:border-[var(--mroya-primary)]"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[var(--mroya-text-muted)] mb-1">
                    Time
                  </label>
                  <input
                    type="text"
                    value={editTime}
                    onChange={(e) => setEditTime(e.target.value)}
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
                      onClick={() => setEditCategory(cat)}
                      className={`py-1.5 rounded-[6px] text-[12px] capitalize font-medium border cursor-pointer ${
                        editCategory === cat
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
                  value={editPerson}
                  disabled={live}
                  onChange={(e) => setEditPerson(e.target.value)}
                  placeholder="Person or organization"
                  className="w-full px-3 py-2 rounded-[8px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] text-[14px] text-[var(--mroya-text)] focus:outline-none focus:border-[var(--mroya-primary)]"
                />
              </div>

              <div>
                <label className="block text-[12px] font-medium text-[var(--mroya-text-muted)] mb-1">
                  Notes & Context
                </label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-[8px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] text-[13px] text-[var(--mroya-text)] focus:outline-none focus:border-[var(--mroya-primary)]"
                />
              </div>

              {/* Recurrence Rule in Edit Modal */}
              <div className="p-3 rounded-[10px] bg-[var(--mroya-surface-muted)]/60 border border-[var(--mroya-divider)] space-y-2">
                {(editingEvent.recurrence||editingEvent.api?.edit_scope==='series') && (
                  <div className="text-[11px] font-semibold text-purple-700 dark:text-purple-300 flex items-center gap-1 mb-1">
                    <Repeat className="w-3.5 h-3.5" />
                    <span>Part of a recurring series (Applies to all occurrences)</span>
                  </div>
                )}
                <RecurrenceEditor
                  value={editRecurrence}
                  onChange={(rule) => setEditRecurrence(rule)}
                  baseTime={editTime}
                  baseDate={editDate}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingEvent(null)}
                  className="px-4 py-2 rounded-[8px] text-[13px] font-medium text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={calendar?.busy||calendar?.mutationPending}
                  className="px-4 py-2 rounded-[8px] bg-[var(--mroya-primary)] hover:bg-[var(--mroya-primary-hover)] text-[var(--mroya-on-primary)] text-[13px] font-semibold cursor-pointer shadow-xs"
                >
                  Save changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingEvent && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-event-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setDeletingEvent(null)}
        >
          <div
            className="w-full max-w-[420px] rounded-[14px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] p-5 sm:p-6 shadow-[var(--mroya-shadow-elevated)] space-y-4 animate-in zoom-in-95 duration-150 text-[var(--mroya-text)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <h3
                  id="delete-event-dialog-title"
                  className="text-[16px] font-semibold text-[var(--mroya-text)] tracking-[-0.01em]"
                >
                  {(deletingEvent.recurrence||deletingEvent.api?.edit_scope==='series') ? 'Delete recurring series?' : 'Delete commitment?'}
                </h3>
                <p className="text-[12px] text-[var(--mroya-text-muted)] truncate max-w-[300px]">
                  {deletingEvent.title}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDeletingEvent(null)}
                aria-label="Close dialog"
                className="p-1 rounded-[6px] text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[13.5px] leading-[20px] text-[var(--mroya-text-muted)]">
              {(deletingEvent.recurrence||deletingEvent.api?.edit_scope==='series')
                ? 'Permanently delete this recurring series and all its scheduled occurrences? This cannot be undone.'
                : 'Permanently delete this commitment from your calendar? This cannot be undone.'}
            </p>

            {calendarStatus}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeletingEvent(null)}
                className="px-3.5 py-2 rounded-[8px] border border-[var(--mroya-divider)] bg-[var(--mroya-surface)] hover:bg-[var(--mroya-surface-muted)] text-[13px] font-medium text-[var(--mroya-text)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={calendar?.busy||calendar?.mutationPending}
                className="px-3.5 py-2 rounded-[8px] bg-[var(--mroya-error)] hover:opacity-90 active:scale-[0.98] text-white text-[13px] font-semibold transition-all cursor-pointer shadow-2xs"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
