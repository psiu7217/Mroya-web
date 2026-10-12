import React, { useState, useEffect } from 'react';
import { Sparkles, Check, X } from 'lucide-react';
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
} from './types/mroya';
import {
  INITIAL_CONVERSATIONS,
  INITIAL_MEMORIES,
  INITIAL_EVENTS,
  INITIAL_GRAPH_NODES,
  INITIAL_GRAPH_EDGES,
  INITIAL_CONNECTIONS,
  INITIAL_REMINDERS,
} from './data/mockData';
import { Sidebar } from './components/Sidebar';
import { ChatWorkspace } from './components/ChatWorkspace';
import { MemoryContextPanel } from './components/MemoryContextPanel';
import { CalendarView } from './components/CalendarView';
import { RemindersView } from './components/RemindersView';
import { ReminderEditorModal } from './components/ReminderEditorModal';
import { MemoryView } from './components/MemoryView';
import { MemoryMapView } from './components/MemoryMapView';
import { ConnectionsSettingsView } from './components/ConnectionsSettingsView';

export default function App() {
  // Navigation & layout state (Desktop opens directly in Chat)
  const [activeSection, setActiveSection] = useState<NavSection>('chat');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Theme & Subscription state (Free by default per prompt)
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [plan, setPlan] = useState<SubscriptionPlan>('free');
  const [planModalOpen, setPlanModalOpen] = useState(false);

  // Domain data states
  const [conversations, setConversations] = useState<Conversation[]>(INITIAL_CONVERSATIONS);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    'conv-sarah-redesign'
  );
  const [memories, setMemories] = useState<MemoryItem[]>(INITIAL_MEMORIES);
  const [events, setEvents] = useState<CalendarEvent[]>(INITIAL_EVENTS);
  const [nodes, setNodes] = useState<GraphNode[]>(INITIAL_GRAPH_NODES);
  const [connections, setConnections] = useState(INITIAL_CONNECTIONS);

  // Reminders state
  const [reminders, setReminders] = useState<ReminderItem[]>(INITIAL_REMINDERS);
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
  const [focusedMemoryId, setFocusedMemoryId] = useState<string | null>('mem-sarah-redesign');
  const [selectedMemoryViewId, setSelectedMemoryViewId] = useState<string | null>(
    'mem-sarah-redesign'
  );
  const [selectedGraphNodeId, setSelectedGraphNodeId] = useState<string | null>(
    'node-redesign'
  );
  const [selectedCalendarEventId, setSelectedCalendarEventId] = useState<string | null>(
    'evt-oct16-proposal'
  );
  const [settingsTab, setSettingsTab] = useState<
    'connections' | 'profile' | 'plan' | 'appearance' | 'settings'
  >('connections');
  const [addedActionIds, setAddedActionIds] = useState<string[]>([]);

  // Sync data-theme attribute on document root
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [theme]);

  const activeConversation =
    conversations.find((c) => c.id === activeConversationId) || null;

  const focusedMemory =
    memories.find((m) => m.id === focusedMemoryId) || memories[0] || null;

  const relatedMemoriesForActiveChat = activeConversation
    ? memories.filter((m) => activeConversation.relatedMemoryIds.includes(m.id))
    : memories.slice(0, 3);

  const upcomingRelatedEvent =
    events.find(
      (e) =>
        e.id === focusedMemory?.relatedEventId ||
        e.id === activeConversation?.relatedEventId
    ) || events.find((e) => e.id === 'evt-oct16-proposal') || null;

  const handleNewChat = () => {
    setActiveConversationId(null);
    setActiveSection('chat');
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

    if (activeConversationId) {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConversationId
            ? {
                ...c,
                updatedAt: 'Just now',
                messages: [...c.messages, userMsg, assistantReply],
              }
            : c
        )
      );
    } else {
      const newConvId = `conv-${Date.now()}`;
      const newConv: Conversation = {
        id: newConvId,
        title: content.length > 42 ? `${content.slice(0, 42)}...` : content,
        group: 'Today',
        updatedAt: 'Just now',
        relatedMemoryIds: ['mem-sarah-redesign', 'mem-schedule-pref', 'mem-oct16-commitment'],
        relatedEventId: 'evt-oct16-proposal',
        relatedNodeId: 'node-redesign',
        messages: [userMsg, assistantReply],
      };
      setConversations((prev) => [newConv, ...prev]);
      setActiveConversationId(newConvId);
    }
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

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--mroya-bg)] text-[var(--mroya-text)]">
      {/* Left Navigation Sidebar */}
      <Sidebar
        activeSection={activeSection}
        onSelectSection={(sec) => setActiveSection(sec)}
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={(id) => setActiveConversationId(id)}
        onNewChat={handleNewChat}
        plan={plan}
        onTogglePlan={() => setPlan((p) => (p === 'free' ? 'premium' : 'free'))}
        onOpenPlanModal={() => setPlanModalOpen(true)}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((c) => !c)}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        memoriesCount={memories.length}
        upcomingEventsCount={events.length}
        pendingRemindersCount={reminders.filter((r) => r.status === 'scheduled').length}
        onOpenSettingsTab={(tab) => {
          setSettingsTab(tab);
          setActiveSection('connections');
        }}
      />

      {/* Center Primary Workspace + Optional Contextual Memory Details */}
      <main className="flex-1 flex min-w-0 h-full relative overflow-hidden">
        {activeSection === 'chat' && (
          <>
            <ChatWorkspace
              conversation={activeConversation}
              onSendMessage={handleSendMessage}
              onCitationClick={handleCitationClick}
              onActionClick={handleChatActionClick}
              addedActionIds={addedActionIds}
              isSidebarCollapsed={isSidebarCollapsed}
              onExpandSidebar={() => setIsSidebarCollapsed(false)}
              onOpenMobileMenu={() => setMobileMenuOpen(true)}
              isContextPanelOpen={isContextPanelOpen}
              onToggleContextPanel={() => setIsContextPanelOpen((v) => !v)}
              plan={plan}
              onTogglePlan={() => setPlan((p) => (p === 'free' ? 'premium' : 'free'))}
              onOpenPlanModal={() => setPlanModalOpen(true)}
              theme={theme}
              onToggleTheme={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
              onNewChat={handleNewChat}
              onOpenSettingsTab={(tab) => {
                setSettingsTab(tab);
                setActiveSection('connections');
              }}
            />

            <MemoryContextPanel
              isOpen={isContextPanelOpen}
              onClose={() => setIsContextPanelOpen(false)}
              focusedMemory={focusedMemory}
              relatedMemories={relatedMemoriesForActiveChat}
              upcomingEvent={upcomingRelatedEvent}
              onSelectMemory={(id) => setFocusedMemoryId(id)}
              onOpenInMemoryView={(memoryId) => {
                setSelectedMemoryViewId(memoryId);
                setActiveSection('memory');
              }}
              onOpenInMemoryMap={(nodeId) => {
                setSelectedGraphNodeId(nodeId);
                setActiveSection('memory-map');
              }}
              onOpenInCalendar={(eventId) => {
                setSelectedCalendarEventId(eventId);
                setActiveSection('calendar');
              }}
            />
          </>
        )}

        {activeSection === 'calendar' && (
          <CalendarView
            events={events}
            memories={memories}
            reminders={reminders}
            selectedEventId={selectedCalendarEventId}
            onAddEvent={(newEvt) =>
              setEvents((prev) => [...prev, { ...newEvt, id: `evt-${Date.now()}` }])
            }
            onOpenMemory={(memId) => {
              setSelectedMemoryViewId(memId);
              setActiveSection('memory');
            }}
            onOpenConnections={() => {
              setSettingsTab('connections');
              setActiveSection('connections');
            }}
            onAddReminder={(rem) => handleAddOrUpdateReminder(rem)}
            onDeleteReminder={handleDeleteReminder}
            onSimulateGoogleSync={handleSimulateGoogleSync}
            onNavigateToReminders={() => setActiveSection('reminders')}
            googleCalendarConnected={googleCalendarConnected}
            isSidebarCollapsed={isSidebarCollapsed}
            onExpandSidebar={() => setIsSidebarCollapsed(false)}
            onOpenMobileMenu={() => setMobileMenuOpen(true)}
          />
        )}

        {activeSection === 'reminders' && (
          <RemindersView
            reminders={reminders}
            events={events}
            onAddReminder={handleAddOrUpdateReminder}
            onUpdateReminder={(rem) => handleAddOrUpdateReminder(rem, rem.id)}
            onDeleteReminder={handleDeleteReminder}
            onToggleComplete={handleToggleCompleteReminder}
            onTogglePause={handleTogglePauseReminder}
            onUnlinkReminder={handleUnlinkReminder}
            onSimulateGoogleSync={handleSimulateGoogleSync}
            onOpenCalendarEvent={(eventId) => {
              setSelectedCalendarEventId(eventId);
              setActiveSection('calendar');
            }}
            onOpenNewReminderModal={() => {
              setEditingReminder(null);
              setReminderPreselectedEventId(undefined);
              setReminderModalOpen(true);
            }}
            onOpenEditReminderModal={(rem) => {
              setEditingReminder(rem);
              setReminderModalOpen(true);
            }}
            isSidebarCollapsed={isSidebarCollapsed}
            onExpandSidebar={() => setIsSidebarCollapsed(false)}
            onOpenMobileMenu={() => setMobileMenuOpen(true)}
          />
        )}

        {activeSection === 'memory' && (
          <MemoryView
            memories={memories}
            selectedMemoryId={selectedMemoryViewId}
            onSelectMemory={(id) => setSelectedMemoryViewId(id)}
            onUpdateMemory={(updated) =>
              setMemories((prev) =>
                prev.map((m) => (m.id === updated.id ? updated : m))
              )
            }
            onForgetMemory={(id) => {
              setMemories((prev) => prev.filter((m) => m.id !== id));
              if (selectedMemoryViewId === id) {
                setSelectedMemoryViewId(null);
              }
            }}
            onAddMemory={(item) => {
              const created: MemoryItem = { ...item, id: `mem-${Date.now()}` };
              setMemories((prev) => [created, ...prev]);
              setSelectedMemoryViewId(created.id);
            }}
            onExploreInMap={(nodeId) => {
              setSelectedGraphNodeId(nodeId);
              setActiveSection('memory-map');
            }}
            onAskMroyaAbout={(mem) => {
              setActiveSection('chat');
              handleSendMessage(`What else should I keep in mind regarding "${mem.title}"?`);
            }}
            isSidebarCollapsed={isSidebarCollapsed}
            onExpandSidebar={() => setIsSidebarCollapsed(false)}
            onOpenMobileMenu={() => setMobileMenuOpen(true)}
          />
        )}

        {activeSection === 'memory-map' && (
          <MemoryMapView
            nodes={nodes}
            edges={INITIAL_GRAPH_EDGES}
            selectedNodeId={selectedGraphNodeId}
            onSelectNode={(id) => setSelectedGraphNodeId(id)}
            onOpenMemory={(memId) => {
              setSelectedMemoryViewId(memId);
              setActiveSection('memory');
            }}
            onAskAboutNode={(node) => {
              setActiveSection('chat');
              handleSendMessage(`Summarize what you remember about ${node.label}.`);
            }}
            isSidebarCollapsed={isSidebarCollapsed}
            onExpandSidebar={() => setIsSidebarCollapsed(false)}
            onOpenMobileMenu={() => setMobileMenuOpen(true)}
          />
        )}

        {activeSection === 'connections' && (
          <ConnectionsSettingsView
            connections={connections}
            onToggleConnection={(id) =>
              setConnections((prev) =>
                prev.map((c) =>
                  c.id === id ? { ...c, connected: !c.connected } : c
                )
              )
            }
            plan={plan}
            onSelectPlan={(p) => setPlan(p)}
            theme={theme}
            onSelectTheme={(t) => setTheme(t)}
            activeTab={settingsTab}
            onChangeTab={(tab) => setSettingsTab(tab)}
            isSidebarCollapsed={isSidebarCollapsed}
            onExpandSidebar={() => setIsSidebarCollapsed(false)}
            onOpenMobileMenu={() => setMobileMenuOpen(true)}
          />
        )}
      </main>

      {/* Subscription Plan Preview Modal (Free vs Mroya Premium) */}
      {planModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[1px]">
          <div className="w-full max-w-lg rounded-[14px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] shadow-[var(--mroya-shadow-elevated)] p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[var(--mroya-brand-honey)]" />
                <h2 className="text-[17px] font-semibold text-[var(--mroya-text)]">
                  Mroya Subscription Preview
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setPlanModalOpen(false)}
                aria-label="Close plan modal"
                className="w-7 h-7 rounded-lg inline-flex items-center justify-center text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[13px] text-[var(--mroya-text-muted)] leading-[20px]">
              Preview how Mroya presents subscription states in the sidebar and workspace header.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div
                className={`p-4 rounded-[12px] border flex flex-col justify-between space-y-4 ${
                  plan === 'free'
                    ? 'bg-[var(--mroya-surface-active)] border-[var(--mroya-primary)]'
                    : 'bg-[var(--mroya-surface)] border-[var(--mroya-divider)]'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="text-[15px] font-semibold text-[var(--mroya-text)]">
                    Free Plan
                  </div>
                  <p className="text-[12px] text-[var(--mroya-text-muted)] leading-[18px]">
                    Clean default state with a quiet Upgrade link and no intrusive banners.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPlan('free');
                    setPlanModalOpen(false);
                  }}
                  className="w-full py-2 px-3 rounded-full bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] text-[12px] font-semibold text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)] cursor-pointer"
                >
                  {plan === 'free' ? 'Active (Free)' : 'Switch to Free'}
                </button>
              </div>

              <div
                className={`p-4 rounded-[12px] border flex flex-col justify-between space-y-4 ${
                  plan === 'premium'
                    ? 'bg-[var(--mroya-surface-active)] border-[var(--mroya-brand-honey)]'
                    : 'bg-[var(--mroya-surface)] border-[var(--mroya-divider)]'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="text-[15px] font-semibold text-[var(--mroya-text)] flex items-center gap-1.5">
                    <span>Mroya Premium</span>
                    <Sparkles className="w-3.5 h-3.5 text-[var(--mroya-brand-honey)]" />
                  </div>
                  <p className="text-[12px] text-[var(--mroya-text-muted)] leading-[18px]">
                    Restrained warm-gold accent with upgrade prompts removed.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPlan('premium');
                    setPlanModalOpen(false);
                  }}
                  className="w-full py-2 px-3 rounded-full bg-[var(--mroya-primary)] hover:bg-[var(--mroya-primary-hover)] text-[var(--mroya-on-primary)] text-[12px] font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{plan === 'premium' ? 'Active (Premium)' : 'Preview Mroya Premium'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reminders Creation / Edit Modal */}
      <ReminderEditorModal
        isOpen={reminderModalOpen}
        onClose={() => {
          setReminderModalOpen(false);
          setEditingReminder(null);
          setReminderPreselectedEventId(undefined);
        }}
        onSave={handleAddOrUpdateReminder}
        editingReminder={editingReminder}
        events={events}
        preselectedEventId={reminderPreselectedEventId}
      />
    </div>
  );
}
