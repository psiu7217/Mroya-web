import {useDemoDiagnostics} from './useDemoDiagnostics';
import React, { useState, useEffect } from 'react';

import {
  NavSection,
  SubscriptionPlan,
  ThemeMode,
  Conversation,
  MemoryItem,
  CalendarEvent,
  GraphNode,
  ChatAction,
  ChatMessage,
  ReminderItem,
} from '../types/mroya';
import {
  INITIAL_CONVERSATIONS,
  INITIAL_MEMORIES,
  INITIAL_EVENTS,
  INITIAL_GRAPH_NODES,
  INITIAL_GRAPH_EDGES,
  INITIAL_CONNECTIONS,
  INITIAL_REMINDERS,
} from './fixtures';
import type { Sidebar } from '../components/Sidebar';
import type { ChatWorkspace } from '../components/ChatWorkspace';
import type { MemoryContextPanel } from '../components/MemoryContextPanel';
import type { CalendarView } from '../components/CalendarView';
import type { RemindersView } from '../components/RemindersView';
import type { ReminderEditorModal } from '../components/ReminderEditorModal';
import type { MemoryView } from '../components/MemoryView';
import type { MemoryMapView } from '../components/MemoryMapView';
import type { ConnectionsSettingsView } from '../components/ConnectionsSettingsView';


import type { WorkspaceModel } from '../types/workspace';
import { DEMO_ACCOUNT, DEMO_PROFILE } from './source';
import {accountPresentation} from '../hooks/liveAdapters';
export function useDemoWorkspace(seed: 'filled' | 'empty' = 'filled'): WorkspaceModel {
  const diagnostics=useDemoDiagnostics();
  const [nickname,setNickname]=useState(DEMO_PROFILE.nickname);
  const {displayName,initials}=accountPresentation({...DEMO_PROFILE,nickname});
  const account={...DEMO_ACCOUNT,displayName,initials,nickname};

  // Navigation & layout state (Desktop opens directly in Chat)
  const [activeSection, setActiveSection] = useState<NavSection>('chat');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Theme & Subscription state (Free by default per prompt)
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [appearance,setAppearance]=useState<'light'|'dark'>('light');
  const [plan, setPlan] = useState<SubscriptionPlan>('free');
  const [planModalOpen, setPlanModalOpen] = useState(false);

  // Domain data states
  const [conversations, setConversations] = useState<Conversation[]>(seed === 'empty' ? [] : INITIAL_CONVERSATIONS);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    seed === 'empty' ? null : 'conv-sarah-redesign'
  );
  const [memories, setMemories] = useState<MemoryItem[]>(seed === 'empty' ? [] : INITIAL_MEMORIES);
  const [events, setEvents] = useState<CalendarEvent[]>(seed === 'empty' ? [] : INITIAL_EVENTS);
  const [nodes, setNodes] = useState<GraphNode[]>(seed === 'empty' ? [] : INITIAL_GRAPH_NODES);
  const [connections, setConnections] = useState(INITIAL_CONNECTIONS);

  // Reminders state
  const [reminders, setReminders] = useState<ReminderItem[]>(seed === 'empty' ? [] : INITIAL_REMINDERS);
  const [reminderModalOpen, setReminderModalOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<ReminderItem | null>(null);
  const [reminderPreselectedEventId, setReminderPreselectedEventId] = useState<string | undefined>(undefined);

  const handleAddOrUpdateReminder = (
    reminderData: Omit<ReminderItem, 'id' | 'createdAt'>,
    existingId?: string
  ) => {
    if (existingId) {
      setReminders((prev) =>
        prev.map((r) =>
          r.id === existingId
            ? {
                ...r,
                ...reminderData,
              }
            : r
        )
      );
    } else {
      const newReminder: ReminderItem = {
        ...reminderData,
        id: `rem-${Date.now()}`,
        createdAt: new Date().toISOString(),
      };
      setReminders((prev) => [newReminder, ...prev]);
    }
    setReminderModalOpen(false);
    setEditingReminder(null);
    setReminderPreselectedEventId(undefined);
  };

  const handleDeleteReminder = (id: string) => {
    setReminders((prev) => prev.filter((r) => r.id !== id));
  };

  const handleToggleCompleteReminder = (id: string) => {
    setReminders((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, status: r.status === 'completed' ? 'scheduled' : 'completed' }
          : r
      )
    );
  };

  const handleTogglePauseReminder = (id: string) => {
    setReminders((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, status: r.status === 'paused' ? 'scheduled' : 'paused' }
          : r
      )
    );
  };

  const handleUnlinkReminder = (id: string) => {
    setReminders((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              type: 'standalone',
              calendarEventId: undefined,
              offsetMinutes: undefined,
            }
          : r
      )
    );
  };

  // Google Calendar shared schedule synchronization simulation
  const handleSimulateGoogleSync = (reminderId: string) => {
    setReminders((prev) =>
      prev.map((r) => {
        if (
          r.id === reminderId ||
          (reminderId === 'rem-doctor-appt' && r.calendarEventId === 'evt-oct13-doctor')
        ) {
          const isCurrently30 = r.offsetMinutes === 30;
          const newOffset = isCurrently30 ? 60 : 30;
          const newTime = isCurrently30 ? '11:30' : '12:00';
          return {
            ...r,
            offsetMinutes: newOffset,
            time: newTime,
            notes: `Starts in ${newOffset} minutes — 12:30 PM at City Health Clinic`,
            syncedWithGoogle: true,
            lastSyncedNote: `Synced with Google Calendar (${newOffset} min before appointment)`,
          };
        }
        return r;
      })
    );
  };

  // Contextual Memory Panel state (Optional third panel)
  const [isContextPanelOpen, setIsContextPanelOpen] = useState(false);
  const [focusedMemoryId, setFocusedMemoryId] = useState<string | null>(seed === 'empty' ? null : 'mem-sarah-redesign');
  const [selectedMemoryViewId, setSelectedMemoryViewId] = useState<string | null>(
    seed === 'empty' ? null : 'mem-sarah-redesign'
  );
  const [selectedGraphNodeId, setSelectedGraphNodeId] = useState<string | null>(
    seed === 'empty' ? null : 'node-redesign'
  );
  const [selectedCalendarEventId, setSelectedCalendarEventId] = useState<string | null>(
    seed === 'empty' ? null : 'evt-oct16-proposal'
  );
  const [settingsTab, setSettingsTab] = useState<
    'connections' | 'profile' | 'plan' | 'appearance' | 'settings'
  >('connections');
  const [addedActionIds, setAddedActionIds] = useState<string[]>([]);

  // Sync data-theme attribute on document root
  useEffect(() => {
    const media=window.matchMedia?.('(prefers-color-scheme: dark)');
    const apply=()=>{const value=theme==='system'?(media?.matches?'dark':'light'):theme;setAppearance(value);document.documentElement.setAttribute('data-theme',value);};
    apply();media?.addEventListener?.('change',apply);
    return()=>{media?.removeEventListener?.('change',apply);document.documentElement.removeAttribute('data-theme');};
  }, [theme]);

  const activeConversation: Conversation | null =
    conversations.find((c) => c.id === activeConversationId) || null;

  const focusedMemory: MemoryItem | null =
    memories.find((m) => m.id === focusedMemoryId) || memories[0] || null;

  const relatedMemoriesForActiveChat = activeConversation
    ? memories.filter((m) => activeConversation.relatedMemoryIds.includes(m.id))
    : memories.slice(0, 3);

  const upcomingRelatedEvent: CalendarEvent | null =
    events.find(
      (e) =>
        e.id === focusedMemory?.relatedEventId ||
        e.id === activeConversation?.relatedEventId
    ) || events.find((e) => e.id === 'evt-oct16-proposal') || null;

  const handleNewChat = () => {
    setActiveConversationId(null);
    setActiveSection('chat');
  };

  const handleRenameConversation = (id: string, newTitle: string) => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title: trimmed } : c))
    );
  };

  const handleDeleteConversation = (id: string) => {
    setConversations((prev) => {
      const remaining = prev.filter((c) => c.id !== id);
      if (activeConversationId === id) {
        setActiveConversationId(remaining.length > 0 ? remaining[0].id : null);
      }
      return remaining;
    });
  };

  // Simulated intelligent Mroya response generator grounded in saved memories
  const handleSendMessage = (content: string, attachmentName?: string) => {
    const nowTime = '2:24 PM';
    const userMsg: ChatMessage = {
      id: `msg-u-${Date.now()}`,
      sender: 'user',
      timestamp: nowTime,
      content: attachmentName ? `${content} [Attached: ${attachmentName}]` : content,
    };

    const lower = content.toLowerCase();
    let assistantReply: ChatMessage;

    if (
      lower.includes('oven') ||
      (lower.includes('turn off') && lower.includes('remind'))
    ) {
      const newRemId = `rem-oven-${Date.now()}`;
      const newRem: ReminderItem = {
        id: newRemId,
        title: 'Turn off the oven',
        type: 'standalone',
        date: '2026-10-12',
        time: '14:44',
        channel: 'telegram',
        status: 'scheduled',
        notes: 'Roast vegetables timer (20 minutes). Created via conversational assistant.',
        createdAt: new Date().toISOString(),
      };
      setReminders((prev) => [newRem, ...prev]);

      assistantReply = {
        id: `msg-a-${Date.now() + 1}`,
        sender: 'assistant',
        timestamp: nowTime,
        content:
          "I've set a standalone reminder for you: **Turn off the oven** in 20 minutes (at 2:44 PM).\n\nSince this is an immediate, self-contained task, no calendar event was created. You'll receive a notification on Telegram right on time.",
        structuredPoints: [
          { label: 'Reminder type', value: 'Standalone (no calendar event)' },
          { label: 'Notification time', value: 'Today · 2:44 PM (in 20 minutes)' },
          { label: 'Delivery channel', value: 'Telegram bot (@MroyaBot)' },
        ],
        actions: [
          {
            id: `act-rem-${newRemId}`,
            label: 'View in Reminders',
            type: 'view-reminder',
            targetReminderId: newRemId,
          },
        ],
      };
    } else if (
      lower.includes('doctor') &&
      (lower.includes('remind') || lower.includes('schedule') || lower.includes('appointment'))
    ) {
      const existingEvt = events.find((e) => e.id === 'evt-oct13-doctor');
      if (!existingEvt) {
        const newEvt: CalendarEvent = {
          id: 'evt-oct13-doctor',
          title: 'Doctor appointment',
          date: '2026-10-13',
          dayOfMonth: 13,
          time: '12:30',
          duration: '45m',
          category: 'meeting',
          person: 'Dr. Emily Watson',
          organization: 'City Health Clinic',
          locationOrLink: '742 Evergreen Terrace, Suite 300',
          notes: 'Annual routine health checkup. Google Calendar synced.',
        };
        setEvents((prev) => [...prev, newEvt]);
      }

      const existingReminder = reminders.find((r) => r.calendarEventId === 'evt-oct13-doctor');
      let remId = existingReminder?.id;
      if (!existingReminder) {
        remId = `rem-doctor-${Date.now()}`;
        const newRem: ReminderItem = {
          id: remId,
          title: 'Doctor appointment',
          type: 'calendar_linked',
          date: '2026-10-13',
          time: '11:30',
          calendarEventId: 'evt-oct13-doctor',
          offsetMinutes: 60,
          channel: 'telegram',
          status: 'scheduled',
          syncedWithGoogle: true,
          lastSyncedNote: 'Synced with Google Calendar (60m before)',
          notes: 'Starts in 1 hour — 12:30 PM at City Health Clinic',
          createdAt: new Date().toISOString(),
        };
        setReminders((prev) => [newRem, ...prev]);
      }

      assistantReply = {
        id: `msg-a-${Date.now() + 1}`,
        sender: 'assistant',
        timestamp: nowTime,
        content:
          "I've scheduled your **Doctor appointment** for tomorrow, October 13, at 12:30 PM and set a linked reminder for **1 hour before (11:30 AM)** via Telegram.\n\nBoth Mroya and your connected Google Calendar share this exact schedule. Modifying the alert time in Google Calendar will automatically synchronize here.",
        structuredPoints: [
          { label: 'Calendar Event', value: 'Doctor appointment · Tue, Oct 13 at 12:30 PM' },
          { label: 'Linked Reminder', value: '60 minutes before (11:30 AM)' },
          { label: 'Sync Status', value: 'Shared schedule with Google Calendar' },
          { label: 'Notification', value: 'Telegram bot (@MroyaBot)' },
        ],
        actions: [
          {
            id: 'act-rem-doc',
            label: 'View reminder',
            type: 'view-reminder',
            targetReminderId: remId,
          },
          {
            id: 'act-cal-doc',
            label: 'Open in Calendar',
            type: 'open-calendar-event',
            targetEventId: 'evt-oct13-doctor',
          },
        ],
      };
    } else if (
      lower.includes('what reminders') ||
      lower.includes('show reminders') ||
      lower.includes('my reminders') ||
      lower === 'reminders'
    ) {
      const scheduledReminders = reminders.filter((r) => r.status === 'scheduled');
      assistantReply = {
        id: `msg-a-${Date.now() + 1}`,
        sender: 'assistant',
        timestamp: nowTime,
        content: `You currently have ${scheduledReminders.length} scheduled reminders. Standalone items alert you directly without cluttering your calendar, while calendar-linked reminders stay synchronized with Google Calendar:`,
        structuredPoints: scheduledReminders.slice(0, 4).map((r) => ({
          label: `${r.date} · ${r.time}`,
          value: `${r.title} (${r.type === 'calendar_linked' ? 'Linked to calendar · GCal synced' : 'Standalone'})`,
        })),
        actions: [
          {
            id: 'act-open-reminders-view',
            label: 'Open Reminders screen',
            type: 'view-reminder',
          },
        ],
      };
    } else if (
      lower.includes('remember that') ||
      lower.includes('save') ||
      lower.includes('note that') ||
      lower.includes('prefers')
    ) {
      // Create a new saved memory dynamically
      const newMemId = `mem-custom-${Date.now()}`;
      const newMem: MemoryItem = {
        id: newMemId,
        title: content.length > 56 ? `${content.slice(0, 56)}...` : content,
        summary: content,
        details: `Recorded directly from your conversation with Mroya on October 12, 2026: "${content}"`,
        category: 'Preferences',
        dateSaved: 'Oct 12, 2026',
        source: 'Chat with Mroya · Today',
        entities: ['Personal Space', 'Sarah Chen'],
        relatedNodeId: 'node-sarah',
      };
      setMemories((prev) => [newMem, ...prev]);
      setFocusedMemoryId(newMemId);

      assistantReply = {
        id: `msg-a-${Date.now() + 1}`,
        sender: 'assistant',
        timestamp: nowTime,
        savedMemoryNotice: {
          memoryId: newMemId,
          summary: 'Saved to memory · Updated personal & client context',
        },
        content:
          "I've saved that to your long-term memory. I'll keep it in mind for future preparations and upcoming reviews.",
        citations: [
          {
            memoryId: newMemId,
            label: 'Saved memory · Just now',
            date: 'Oct 12, 2026',
            sourceType: 'Conversation',
          },
        ],
        actions: [
          {
            id: `act-view-${newMemId}`,
            label: 'View memory',
            type: 'view-memory',
            targetMemoryId: newMemId,
          },
          {
            id: `act-rel-${newMemId}`,
            label: 'Show related memories',
            type: 'show-memories',
            targetMemoryId: newMemId,
          },
        ],
      };
    } else if (lower.includes('remember about me') || lower.includes('know about me')) {
      assistantReply = {
        id: `msg-a-${Date.now() + 1}`,
        sender: 'assistant',
        timestamp: nowTime,
        content:
          'You are an independent design director advising Harbor Labs (Sarah Chen) on their $14,500 website redesign and Nordic Studio (Lukas Lindholm) on a €4,200/month Q4 design systems retainer. You protect mornings before 11:00 AM for deep work and keep Fridays light for deliverables.',
        structuredPoints: [
          { label: 'Active client agreements', value: 'Harbor Labs ($14,500 · 40/30/30) & Nordic Studio (€4,200/mo)' },
          { label: 'Scheduling preference', value: 'Deep work before 11:00 AM · Client calls Tue–Thu afternoons' },
        ],
        citations: [
          {
            memoryId: 'mem-schedule-pref',
            label: 'Saved memory · Sep 14',
            date: 'Sep 14, 2026',
            sourceType: 'Direct Note',
          },
          {
            memoryId: 'mem-sarah-redesign',
            label: 'Saved memory · Oct 8',
            date: 'Oct 8, 2026',
            sourceType: 'Call Notes',
          },
        ],
        actions: [
          {
            id: `act-map-${Date.now()}`,
            label: 'Explore in Memory Map',
            type: 'open-map',
            targetNodeId: 'node-alex',
          },
        ],
      };
    } else if (lower.includes('week') || lower.includes('coming up') || lower.includes('schedule')) {
      assistantReply = {
        id: `msg-a-${Date.now() + 1}`,
        sender: 'assistant',
        timestamp: nowTime,
        content:
          'Here is what you have coming up this week in October: tomorrow (Oct 13) you have a morning block to draft Sarah’s 1-page brief, Thursday (Oct 15) is your bi-weekly token critique with Lukas at Nordic Studio, and Friday (Oct 16) is the deadline to send Sarah Chen the revised $14,500 website proposal.',
        structuredPoints: [
          { label: 'Tue, Oct 13 · 10:00 AM', value: 'Draft Harbor Labs 1-page executive brief' },
          { label: 'Thu, Oct 15 · 2:00 PM', value: 'Bi-weekly Design Token Critique — Nordic Studio' },
          { label: 'Fri, Oct 16 · 4:00 PM', value: 'Deadline: Send revised website proposal to Sarah Chen' },
        ],
        citations: [
          {
            memoryId: 'mem-oct16-commitment',
            label: 'Related calendar event · Oct 16',
            date: 'Oct 16, 2026',
            sourceType: 'Calendar Event',
          },
          {
            memoryId: 'mem-nordic-retainer',
            label: 'Saved memory · Oct 2',
            date: 'Oct 2, 2026',
            sourceType: 'Call Notes',
          },
        ],
        actions: [
          {
            id: `act-show-mem-${Date.now()}`,
            label: 'Show related memories',
            type: 'show-memories',
            targetMemoryId: 'mem-oct16-commitment',
          },
        ],
      };
    } else {
      assistantReply = {
        id: `msg-a-${Date.now() + 1}`,
        sender: 'assistant',
        timestamp: nowTime,
        content:
          'Based on your saved memories with Sarah Chen (Harbor Labs), the revised $14,500 website redesign proposal is due this Friday, October 16, with payments structured as 40% kick-off, 30% design sign-off, and 30% staging handoff (referencing PO #HL-2026-09 for Elena Vance).',
        citations: [
          {
            memoryId: 'mem-sarah-redesign',
            label: 'Saved memory · Oct 8',
            date: 'Oct 8, 2026',
            sourceType: 'Call Notes',
          },
          {
            memoryId: 'mem-harbor-billing',
            label: 'Saved memory · Oct 12',
            date: 'Oct 12, 2026',
            sourceType: 'Conversation',
          },
        ],
        actions: [
          {
            id: `act-view-def-${Date.now()}`,
            label: 'View memory',
            type: 'view-memory',
            targetMemoryId: 'mem-sarah-redesign',
          },
          {
            id: `act-rel-def-${Date.now()}`,
            label: 'Show related memories',
            type: 'show-memories',
            targetMemoryId: 'mem-sarah-redesign',
          },
        ],
      };
    }

    const targetConvId = activeConversationId ?? `conv-${Date.now()}`;
    if (activeConversationId) {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConversationId
            ? {
                ...c,
                updatedAt: 'Just now',
                messages: [...c.messages, userMsg],
              }
            : c
        )
      );
    } else {
      const newConv: Conversation = {
        id: targetConvId,
        title: content.length > 42 ? `${content.slice(0, 42)}...` : content,
        group: 'Today',
        updatedAt: 'Just now',
        relatedMemoryIds: ['mem-sarah-redesign', 'mem-schedule-pref', 'mem-oct16-commitment'],
        relatedEventId: 'evt-oct16-proposal',
        relatedNodeId: 'node-redesign',
        messages: [userMsg],
      };
      setConversations((prev) => [newConv, ...prev]);
      setActiveConversationId(targetConvId);
    }

    setTimeout(() => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === targetConvId
            ? {
                ...c,
                updatedAt: 'Just now',
                messages: [...c.messages, assistantReply],
              }
            : c
        )
      );
    }, 1000);
  };

  const handleCitationClick = (memoryId: string) => {
    setFocusedMemoryId(memoryId);
    setIsContextPanelOpen(true);
  };

  const handleChatActionClick = (action: ChatAction) => {
    if (action.type === 'view-memory' || action.type === 'show-memories') {
      if (action.targetMemoryId) {
        setFocusedMemoryId(action.targetMemoryId);
      }
      setIsContextPanelOpen(true);
    } else if (action.type === 'open-map') {
      if (action.targetNodeId) {
        setSelectedGraphNodeId(action.targetNodeId);
      }
      setActiveSection('memory-map');
    } else if (action.type === 'view-reminder') {
      if (action.targetReminderId) {
        const target = reminders.find((r) => r.id === action.targetReminderId);
        if (target) {
          setEditingReminder(target);
          setReminderModalOpen(true);
        }
      }
      setActiveSection('reminders');
    } else if (action.type === 'open-calendar-event') {
      if (action.targetEventId) {
        setSelectedCalendarEventId(action.targetEventId);
      }
      setActiveSection('calendar');
    } else if (action.type === 'add-calendar' && action.calendarPayload) {
      if (!addedActionIds.includes(action.id)) {
        const newEvt: CalendarEvent = {
          id: `evt-chat-${Date.now()}`,
          title: action.calendarPayload.title,
          date: action.calendarPayload.date,
          dayOfMonth: 16,
          time: action.calendarPayload.time,
          duration: '1h',
          category: action.calendarPayload.category,
          person: action.calendarPayload.person,
          organization: 'Harbor Labs',
          notes: 'Created directly from Mroya chat memory follow-up.',
          linkedMemoryId: 'mem-sarah-redesign',
        };
        setEvents((prev) => [...prev, newEvt]);
        setAddedActionIds((prev) => [...prev, action.id]);
      } else {
        setActiveSection('calendar');
      }
    }
  };

  const googleCalendarConnected =
    connections.find((c) => c.id === 'conn-gcal')?.connected ?? true;

  const edges = seed === 'empty' ? [] : INITIAL_GRAPH_EDGES;

  const onSidebarSelectSection: React.ComponentProps<typeof Sidebar>['onSelectSection'] = (sec) => setActiveSection(sec);
  const onSidebarSelectConversation: React.ComponentProps<typeof Sidebar>['onSelectConversation'] = (id) => setActiveConversationId(id);
  const onSidebarTogglePlan: React.ComponentProps<typeof Sidebar>['onTogglePlan'] = () => setPlan((p) => (p === 'free' ? 'premium' : 'free'));
  const onSidebarOpenPlanModal: React.ComponentProps<typeof Sidebar>['onOpenPlanModal'] = () => setPlanModalOpen(true);
  const onSidebarToggleTheme: React.ComponentProps<typeof Sidebar>['onToggleTheme'] = () => setTheme(appearance === 'light' ? 'dark' : 'light');
  const onSidebarToggleCollapse: React.ComponentProps<typeof Sidebar>['onToggleCollapse'] = () => setIsSidebarCollapsed((c) => !c);
  const onSidebarCloseMobile: React.ComponentProps<typeof Sidebar>['onCloseMobile'] = () => setMobileMenuOpen(false);
  const onSidebarOpenSettingsTab: React.ComponentProps<typeof Sidebar>['onOpenSettingsTab'] = (tab) => {
          setSettingsTab(tab);
          setActiveSection('connections');
        };
  const onChatWorkspaceExpandSidebar: React.ComponentProps<typeof ChatWorkspace>['onExpandSidebar'] = () => setIsSidebarCollapsed(false);
  const onChatWorkspaceOpenMobileMenu: React.ComponentProps<typeof ChatWorkspace>['onOpenMobileMenu'] = () => setMobileMenuOpen(true);
  const onChatWorkspaceToggleContextPanel: React.ComponentProps<typeof ChatWorkspace>['onToggleContextPanel'] = () => setIsContextPanelOpen((v) => !v);
  const onChatWorkspaceTogglePlan: React.ComponentProps<typeof ChatWorkspace>['onTogglePlan'] = () => setPlan((p) => (p === 'free' ? 'premium' : 'free'));
  const onChatWorkspaceOpenPlanModal: React.ComponentProps<typeof ChatWorkspace>['onOpenPlanModal'] = () => setPlanModalOpen(true);
  const onChatWorkspaceToggleTheme: React.ComponentProps<typeof ChatWorkspace>['onToggleTheme'] = () => setTheme(appearance === 'light' ? 'dark' : 'light');
  const onChatWorkspaceOpenSettingsTab: React.ComponentProps<typeof ChatWorkspace>['onOpenSettingsTab'] = (tab) => {
                setSettingsTab(tab);
                setActiveSection('connections');
              };
  const onMemoryContextPanelClose: React.ComponentProps<typeof MemoryContextPanel>['onClose'] = () => setIsContextPanelOpen(false);
  const onMemoryContextPanelSelectMemory: React.ComponentProps<typeof MemoryContextPanel>['onSelectMemory'] = (id) => setFocusedMemoryId(id);
  const onMemoryContextPanelOpenInMemoryView: React.ComponentProps<typeof MemoryContextPanel>['onOpenInMemoryView'] = (memoryId) => {
                setSelectedMemoryViewId(memoryId);
                setActiveSection('memory');
              };
  const onMemoryContextPanelOpenInMemoryMap: React.ComponentProps<typeof MemoryContextPanel>['onOpenInMemoryMap'] = (nodeId) => {
                setSelectedGraphNodeId(nodeId);
                setActiveSection('memory-map');
              };
  const onMemoryContextPanelOpenInCalendar: React.ComponentProps<typeof MemoryContextPanel>['onOpenInCalendar'] = (eventId) => {
                setSelectedCalendarEventId(eventId);
                setActiveSection('calendar');
              };
  const onCalendarViewAddEvent: React.ComponentProps<typeof CalendarView>['onAddEvent'] = (newEvt) =>
              setEvents((prev) => [...prev, { ...newEvt, id: `evt-${Date.now()}` }])
            ;
  const onCalendarViewOpenMemory: React.ComponentProps<typeof CalendarView>['onOpenMemory'] = (memId) => {
              setSelectedMemoryViewId(memId);
              setActiveSection('memory');
            };
  const onCalendarViewOpenConnections: React.ComponentProps<typeof CalendarView>['onOpenConnections'] = () => {
              setSettingsTab('connections');
              setActiveSection('connections');
            };
  const onCalendarViewAddReminder: React.ComponentProps<typeof CalendarView>['onAddReminder'] = (rem) => handleAddOrUpdateReminder(rem);
  const onCalendarViewNavigateToReminders: React.ComponentProps<typeof CalendarView>['onNavigateToReminders'] = () => setActiveSection('reminders');
  const onCalendarViewExpandSidebar: React.ComponentProps<typeof CalendarView>['onExpandSidebar'] = () => setIsSidebarCollapsed(false);
  const onCalendarViewOpenMobileMenu: React.ComponentProps<typeof CalendarView>['onOpenMobileMenu'] = () => setMobileMenuOpen(true);
  const onRemindersViewUpdateReminder: React.ComponentProps<typeof RemindersView>['onUpdateReminder'] = (rem) => handleAddOrUpdateReminder(rem, rem.id);
  const onRemindersViewOpenCalendarEvent: React.ComponentProps<typeof RemindersView>['onOpenCalendarEvent'] = (eventId) => {
              setSelectedCalendarEventId(eventId);
              setActiveSection('calendar');
            };
  const onRemindersViewOpenNewReminderModal: React.ComponentProps<typeof RemindersView>['onOpenNewReminderModal'] = () => {
              setEditingReminder(null);
              setReminderPreselectedEventId(undefined);
              setReminderModalOpen(true);
            };
  const onRemindersViewOpenEditReminderModal: React.ComponentProps<typeof RemindersView>['onOpenEditReminderModal'] = (rem) => {
              setEditingReminder(rem);
              setReminderModalOpen(true);
            };
  const onRemindersViewExpandSidebar: React.ComponentProps<typeof RemindersView>['onExpandSidebar'] = () => setIsSidebarCollapsed(false);
  const onRemindersViewOpenMobileMenu: React.ComponentProps<typeof RemindersView>['onOpenMobileMenu'] = () => setMobileMenuOpen(true);
  const onMemoryViewSelectMemory: React.ComponentProps<typeof MemoryView>['onSelectMemory'] = (id) => setSelectedMemoryViewId(id);
  const onMemoryViewUpdateMemory: React.ComponentProps<typeof MemoryView>['onUpdateMemory'] = (updated) =>
              setMemories((prev) =>
                prev.map((m) => (m.id === updated.id ? updated : m))
              )
            ;
  const onMemoryViewForgetMemory: React.ComponentProps<typeof MemoryView>['onForgetMemory'] = (id) => {
              setMemories((prev) => prev.filter((m) => m.id !== id));
              if (selectedMemoryViewId === id) {
                setSelectedMemoryViewId(null);
              }
            };
  const onMemoryViewAddMemory: React.ComponentProps<typeof MemoryView>['onAddMemory'] = (item) => {
              const created: MemoryItem = { ...item, id: `mem-${Date.now()}` };
              setMemories((prev) => [created, ...prev]);
              setSelectedMemoryViewId(created.id);
            };
  const onMemoryViewExploreInMap: React.ComponentProps<typeof MemoryView>['onExploreInMap'] = (nodeId) => {
              setSelectedGraphNodeId(nodeId);
              setActiveSection('memory-map');
            };
  const onMemoryViewAskMroyaAbout: React.ComponentProps<typeof MemoryView>['onAskMroyaAbout'] = (mem) => {
              setActiveSection('chat');
              handleSendMessage(`What else should I keep in mind regarding "${mem.title}"?`);
            };
  const onMemoryViewExpandSidebar: React.ComponentProps<typeof MemoryView>['onExpandSidebar'] = () => setIsSidebarCollapsed(false);
  const onMemoryViewOpenMobileMenu: React.ComponentProps<typeof MemoryView>['onOpenMobileMenu'] = () => setMobileMenuOpen(true);
  const onMemoryMapViewSelectNode: React.ComponentProps<typeof MemoryMapView>['onSelectNode'] = (id) => setSelectedGraphNodeId(id);
  const onMemoryMapViewOpenMemory: React.ComponentProps<typeof MemoryMapView>['onOpenMemory'] = (memId) => {
              setSelectedMemoryViewId(memId);
              setActiveSection('memory');
            };
  const onMemoryMapViewAskAboutNode: React.ComponentProps<typeof MemoryMapView>['onAskAboutNode'] = (node) => {
              setActiveSection('chat');
              handleSendMessage(`Summarize what you remember about ${node.label}.`);
            };
  const onMemoryMapViewExpandSidebar: React.ComponentProps<typeof MemoryMapView>['onExpandSidebar'] = () => setIsSidebarCollapsed(false);
  const onMemoryMapViewOpenMobileMenu: React.ComponentProps<typeof MemoryMapView>['onOpenMobileMenu'] = () => setMobileMenuOpen(true);
  const onConnectionsSettingsViewToggleConnection: React.ComponentProps<typeof ConnectionsSettingsView>['onToggleConnection'] = (id) =>
              setConnections((prev) =>
                prev.map((c) =>
                  c.id === id ? { ...c, connected: !c.connected } : c
                )
              )
            ;
  const onConnectionsSettingsViewSelectPlan: React.ComponentProps<typeof ConnectionsSettingsView>['onSelectPlan'] = (p) => setPlan(p);
  const onConnectionsSettingsViewSelectTheme: React.ComponentProps<typeof ConnectionsSettingsView>['onSelectTheme'] = (t) => setTheme(t);
  const onConnectionsSettingsViewChangeTab: React.ComponentProps<typeof ConnectionsSettingsView>['onChangeTab'] = (tab) => setSettingsTab(tab);
  const onConnectionsSettingsViewExpandSidebar: React.ComponentProps<typeof ConnectionsSettingsView>['onExpandSidebar'] = () => setIsSidebarCollapsed(false);
  const onConnectionsSettingsViewOpenMobileMenu: React.ComponentProps<typeof ConnectionsSettingsView>['onOpenMobileMenu'] = () => setMobileMenuOpen(true);
  const onClosePlanPreview: React.ComponentProps<'button'>['onClick'] = () => setPlanModalOpen(false);
  const onPreviewFreePlan: React.ComponentProps<'button'>['onClick'] = () => {
                    setPlan('free');
                    setPlanModalOpen(false);
                  };
  const onPreviewPremiumPlan: React.ComponentProps<'button'>['onClick'] = () => {
                    setPlan('premium');
                    setPlanModalOpen(false);
                  };
  const onReminderEditorModalClose: React.ComponentProps<typeof ReminderEditorModal>['onClose'] = () => {
          setReminderModalOpen(false);
          setEditingReminder(null);
          setReminderPreselectedEventId(undefined);
        };
  return {diagnostics,calendarSamples:{person:'Sarah Chen',titlePlaceholder:'e.g. Design token sprint with Sarah',personPlaceholder:'e.g. Sarah Chen',accountLabel:DEMO_ACCOUNT.email},composerSamples:{memoryPrompt:'Remember that Sarah prefers receiving a 1-page written summary 24 hours before any design review call.',attachmentName:'Harbor_Labs_Scope_Oct2026.pdf',voicePhrases:['Remember that Sarah confirmed we will review the design system tokens on Thursday at 2 PM.','Add a reminder to send the revised website proposal to Sarah Chen by Friday October 16.','Daniel mentioned he needs the updated typography scale and CSS custom properties by next Monday.','Elena Vance noted that all milestone invoices must include purchase order number HL-2026-09.','Remember that my protected deep work window is every morning before 11:00 AM.']},onSaveNickname:setNickname,onClearNickname:()=>setNickname(''),account,activeSection, isSidebarCollapsed, mobileMenuOpen, theme, appearance, plan, planModalOpen, conversations, activeConversationId, memories, events, nodes, connections, reminders, reminderModalOpen, editingReminder, reminderPreselectedEventId, handleAddOrUpdateReminder, handleDeleteReminder, handleToggleCompleteReminder, handleTogglePauseReminder, handleUnlinkReminder, handleSimulateGoogleSync, isContextPanelOpen, selectedMemoryViewId, selectedGraphNodeId, selectedCalendarEventId, settingsTab, addedActionIds, activeConversation: activeConversation as Conversation | null, focusedMemory: focusedMemory as MemoryItem | null, relatedMemoriesForActiveChat, upcomingRelatedEvent: upcomingRelatedEvent as CalendarEvent | null, handleNewChat, handleSendMessage, handleCitationClick, handleChatActionClick, googleCalendarConnected, edges, onSidebarSelectSection, onSidebarSelectConversation, onSidebarRenameConversation: handleRenameConversation, onSidebarDeleteConversation: handleDeleteConversation, onSidebarTogglePlan, onSidebarOpenPlanModal, onSidebarToggleTheme, onSidebarToggleCollapse, onSidebarCloseMobile, onSidebarOpenSettingsTab, onChatWorkspaceExpandSidebar, onChatWorkspaceOpenMobileMenu, onChatWorkspaceToggleContextPanel, onChatWorkspaceTogglePlan, onChatWorkspaceOpenPlanModal, onChatWorkspaceToggleTheme, onChatWorkspaceOpenSettingsTab, onMemoryContextPanelClose, onMemoryContextPanelSelectMemory, onMemoryContextPanelOpenInMemoryView, onMemoryContextPanelOpenInMemoryMap, onMemoryContextPanelOpenInCalendar, onCalendarViewAddEvent, onCalendarViewOpenMemory, onCalendarViewOpenConnections, onCalendarViewAddReminder, onCalendarViewNavigateToReminders, onCalendarViewExpandSidebar, onCalendarViewOpenMobileMenu, onRemindersViewUpdateReminder, onRemindersViewOpenCalendarEvent, onRemindersViewOpenNewReminderModal, onRemindersViewOpenEditReminderModal, onRemindersViewExpandSidebar, onRemindersViewOpenMobileMenu, onMemoryViewSelectMemory, onMemoryViewUpdateMemory, onMemoryViewForgetMemory, onMemoryViewAddMemory, onMemoryViewExploreInMap, onMemoryViewAskMroyaAbout, onMemoryViewExpandSidebar, onMemoryViewOpenMobileMenu, onMemoryMapViewSelectNode, onMemoryMapViewOpenMemory, onMemoryMapViewAskAboutNode, onMemoryMapViewExpandSidebar, onMemoryMapViewOpenMobileMenu, onConnectionsSettingsViewToggleConnection, onConnectionsSettingsViewSelectPlan, onConnectionsSettingsViewSelectTheme, onConnectionsSettingsViewChangeTab, onConnectionsSettingsViewExpandSidebar, onConnectionsSettingsViewOpenMobileMenu, onClosePlanPreview, onPreviewFreePlan, onPreviewPremiumPlan, onReminderEditorModalClose};
}
