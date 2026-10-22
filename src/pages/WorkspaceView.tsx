import React from 'react';
import {WorkspaceSurface} from '../components/WorkspaceSurface';
import { Sparkles, Check, X } from 'lucide-react';
import type { WorkspaceModel } from '../types/workspace';
import { Sidebar } from '../components/Sidebar';
import { ChatWorkspace } from '../components/ChatWorkspace';
import { MemoryContextPanel } from '../components/MemoryContextPanel';
import { CalendarView } from '../components/CalendarView';
import { RemindersView } from '../components/RemindersView';
import { ReminderEditorModal } from '../components/ReminderEditorModal';
import { MemoryView } from '../components/MemoryView';
import { MemoryMapView } from '../components/MemoryMapView';
import { AccessNotice } from '../components/AccessNotice';
import { ConnectionsSettingsView } from '../components/ConnectionsSettingsView';
import { NotesView } from '../components/NotesView';
export function WorkspaceView({model}: {model:WorkspaceModel}) {
 const runtime=model.runtime;
 const feedback=model.feedback??runtime;
 const {account, activeSection:requestedSection, isSidebarCollapsed, mobileMenuOpen, theme, plan, planModalOpen, conversations, activeConversationId, memories, events, nodes, connections, reminders, reminderModalOpen, editingReminder, reminderPreselectedEventId, handleAddOrUpdateReminder, handleDeleteReminder, handleToggleCompleteReminder, handleTogglePauseReminder, handleUnlinkReminder, handleSimulateGoogleSync, isContextPanelOpen, selectedMemoryViewId, selectedGraphNodeId, selectedCalendarEventId, settingsTab, addedActionIds, activeConversation, focusedMemory, relatedMemoriesForActiveChat, upcomingRelatedEvent, handleNewChat, handleSendMessage, handleCitationClick, handleChatActionClick, googleCalendarConnected, edges, onSidebarSelectSection, onSidebarSelectConversation, onSidebarTogglePlan, onSidebarOpenPlanModal, onSidebarToggleTheme, onSidebarToggleCollapse, onSidebarCloseMobile, onSidebarOpenSettingsTab, onChatWorkspaceExpandSidebar, onChatWorkspaceOpenMobileMenu, onChatWorkspaceToggleContextPanel, onChatWorkspaceTogglePlan, onChatWorkspaceOpenPlanModal, onChatWorkspaceToggleTheme, onChatWorkspaceOpenSettingsTab, onMemoryContextPanelClose, onMemoryContextPanelSelectMemory, onMemoryContextPanelOpenInMemoryView, onMemoryContextPanelOpenInMemoryMap, onMemoryContextPanelOpenInCalendar, onCalendarViewAddEvent, onCalendarViewOpenMemory, onCalendarViewOpenConnections, onCalendarViewAddReminder, onCalendarViewNavigateToReminders, onCalendarViewExpandSidebar, onCalendarViewOpenMobileMenu, onRemindersViewUpdateReminder, onRemindersViewOpenCalendarEvent, onRemindersViewOpenNewReminderModal, onRemindersViewOpenEditReminderModal, onRemindersViewExpandSidebar, onRemindersViewOpenMobileMenu, onMemoryViewSelectMemory, onMemoryViewUpdateMemory, onMemoryViewForgetMemory, onMemoryViewAddMemory, onMemoryViewExploreInMap, onMemoryViewAskMroyaAbout, onMemoryViewExpandSidebar, onMemoryViewOpenMobileMenu, onMemoryMapViewSelectNode, onMemoryMapViewOpenMemory, onMemoryMapViewAskAboutNode, onMemoryMapViewExpandSidebar, onMemoryMapViewOpenMobileMenu, onConnectionsSettingsViewToggleConnection, onConnectionsSettingsViewSelectPlan, onConnectionsSettingsViewSelectTheme, onConnectionsSettingsViewChangeTab, onConnectionsSettingsViewExpandSidebar, onConnectionsSettingsViewOpenMobileMenu, onClosePlanPreview, onPreviewFreePlan, onPreviewPremiumPlan, onReminderEditorModalClose}=model;
 const notesAvailable=model.notesAvailable===true;
 const activeSection=requestedSection==='notes'&&!notesAvailable?'chat':requestedSection;
 return (
    <WorkspaceSurface mobileOpen={mobileMenuOpen} onOpenMobile={onChatWorkspaceOpenMobileMenu} onCloseMobile={onSidebarCloseMobile}>
      {/* Left Navigation Sidebar */}
      <Sidebar
        account={account}
        conversationLocked={runtime?.conversationLocked}
        live={!!runtime}
        onLogout={runtime?.onLogout}
        activeSection={activeSection}
        onSelectSection={onSidebarSelectSection}
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={onSidebarSelectConversation}
        onNewChat={handleNewChat}
        onRenameConversation={model.onSidebarRenameConversation}
        onDeleteConversation={model.onSidebarDeleteConversation}
        plan={plan}
        onTogglePlan={onSidebarTogglePlan}
        onOpenPlanModal={onSidebarOpenPlanModal}
        theme={model.appearance??theme}
        onToggleTheme={onSidebarToggleTheme}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={onSidebarToggleCollapse}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={onSidebarCloseMobile}
        memoriesCount={runtime?.memoriesTotal??memories.length}
        upcomingEventsCount={events.length}
        pendingRemindersCount={reminders.filter((r) => r.status === 'scheduled').length}
        notesAvailable={notesAvailable}
        notesCount={notesAvailable?(model.notes ?? []).length:0}
        onOpenSettingsTab={onSidebarOpenSettingsTab}
      />

      {/* Center Primary Workspace + Optional Contextual Memory Details */}
      <main className="flex-1 flex flex-col min-w-0 h-full relative overflow-hidden">
        {feedback && (feedback.error || feedback.loading) && <div role={feedback.error?'alert':'status'} className="px-4 py-2 text-sm bg-[var(--mroya-surface-muted)] border-b border-[var(--mroya-divider)] shrink-0">
          {feedback.error ?? 'Loading your workspace…'}
          {feedback.error && <button disabled={feedback.busy||feedback.loading} onClick={feedback.onRetry} className="ml-3 underline">Check server status</button>}
        </div>}
        {runtime?.timezoneSettings?.status==='error'&&<div role="alert" className="px-4 py-2 text-sm bg-[var(--mroya-surface-muted)] border-b border-[var(--mroya-divider)] shrink-0">
          {runtime.timezoneSettings.error}
          <button type="button" onClick={()=>onSidebarOpenSettingsTab('profile')} className="ml-3 underline">Choose timezone in Profile</button>
        </div>}
        {runtime && !runtime.loading && !runtime.error && ((activeSection==='calendar'&&!runtime.calendarAvailable)||(activeSection==='reminders'&&!runtime.remindersAvailable)||(activeSection==='chat'&&!runtime.chatAvailable)||((activeSection==='memory'||activeSection==='memory-map')&&!runtime.memoryAvailable)) && <p role="status" className="px-4 py-2 text-sm bg-[var(--mroya-surface-muted)] border-b border-[var(--mroya-divider)] shrink-0">Not available yet. No changes have been saved.</p>}
        {runtime?.hasOlder && activeSection==='chat' && <button disabled={runtime.loading||runtime.busy} onClick={runtime.onOlder} className="py-2 text-xs underline shrink-0">Load earlier messages</button>}
        {runtime && activeSection==='memory' && <div className="px-4 py-2 text-xs shrink-0">Read-only list. Ask Mroya in chat to update your memory.{runtime.hasMoreMemories&&<button disabled={runtime.loading||runtime.busy} onClick={runtime.onMoreMemories} className="ml-3 underline">Load more memories</button>}</div>}
        {runtime?.truncated && activeSection==='memory-map' && <p role="status" className="p-2 text-xs shrink-0">This map is limited by the server; some connections are not shown.</p>}
        <div className="flex flex-1 min-w-0 min-h-0">
        {activeSection === 'chat' && (
          <>
            <ChatWorkspace
              diagnostics={runtime?.diagnostics??model.diagnostics}
              live={!!runtime}
              pending={runtime?.pending??feedback?.loading}
              isThinking={runtime?.busy ?? feedback?.busy}
              onUnavailable={runtime?.onUnavailable}
              samples={model.composerSamples}
              account={account}
              memoriesCount={runtime?.memoriesTotal??memories.length}
              conversation={activeConversation}
              onSendMessage={handleSendMessage}
              onCitationClick={handleCitationClick}
              onActionClick={handleChatActionClick}
              addedActionIds={addedActionIds}
              isSidebarCollapsed={isSidebarCollapsed}
              onExpandSidebar={onChatWorkspaceExpandSidebar}
              onOpenMobileMenu={onChatWorkspaceOpenMobileMenu}
              isContextPanelOpen={isContextPanelOpen}
              onToggleContextPanel={onChatWorkspaceToggleContextPanel}
              plan={plan}
              onTogglePlan={onChatWorkspaceTogglePlan}
              onOpenPlanModal={onChatWorkspaceOpenPlanModal}
              theme={model.appearance??theme}
              onToggleTheme={onChatWorkspaceToggleTheme}
              onNewChat={handleNewChat}
              onOpenSettingsTab={onChatWorkspaceOpenSettingsTab}
            />

            <MemoryContextPanel
              isOpen={isContextPanelOpen}
              onClose={onMemoryContextPanelClose}
              focusedMemory={focusedMemory}
              relatedMemories={relatedMemoriesForActiveChat}
              upcomingEvent={upcomingRelatedEvent}
              onSelectMemory={onMemoryContextPanelSelectMemory}
              onOpenInMemoryView={onMemoryContextPanelOpenInMemoryView}
              onOpenInMemoryMap={onMemoryContextPanelOpenInMemoryMap}
              onOpenInCalendar={onMemoryContextPanelOpenInCalendar}
            />
          </>
        )}

        {activeSection === 'calendar' && (
          <CalendarView
            designEventAnalysis={runtime?undefined:model.designIntelligence?.EventAnalysis}
            samples={model.calendarSamples}
            readOnly={!!runtime&&!runtime.calendarAvailable}
            live={!!runtime}
            calendar={model.calendar}
            googleCalendarAvailable={model.googleCalendarAvailable}
            googleCalendarNotice={model.googleCalendarNotice}
            events={events}
            memories={memories}
            reminders={reminders}
            selectedEventId={selectedCalendarEventId}
            onAddEvent={onCalendarViewAddEvent}
            onEditEvent={model.onCalendarViewEditEvent}
            onDeleteEvent={model.onCalendarViewDeleteEvent}
            onOpenMemory={onCalendarViewOpenMemory}
            onOpenConnections={onCalendarViewOpenConnections}
            onAddReminder={onCalendarViewAddReminder}
            onDeleteReminder={handleDeleteReminder}
            onSimulateGoogleSync={handleSimulateGoogleSync}
            onNavigateToReminders={onCalendarViewNavigateToReminders}
            googleCalendarConnected={runtime&&!model.googleCalendarAvailable?false:googleCalendarConnected}
            autoSync={model.autoSync}
            gcalSyncState={runtime&&!model.googleCalendarAvailable?undefined:model.gcalSyncState}
            googleCalendarEmail={runtime&&!model.googleCalendarAvailable?undefined:model.googleCalendarEmail}
            isSidebarCollapsed={isSidebarCollapsed}
            onExpandSidebar={onCalendarViewExpandSidebar}
            onOpenMobileMenu={onCalendarViewOpenMobileMenu}
          />
        )}

        {activeSection === 'reminders' && (
          <RemindersView
            readOnly={!!runtime}
            reminders={reminders}
            events={events}
            onAddReminder={handleAddOrUpdateReminder}
            onUpdateReminder={onRemindersViewUpdateReminder}
            onDeleteReminder={handleDeleteReminder}
            onToggleComplete={handleToggleCompleteReminder}
            onTogglePause={handleTogglePauseReminder}
            onUnlinkReminder={handleUnlinkReminder}
            onSimulateGoogleSync={handleSimulateGoogleSync}
            onOpenCalendarEvent={onRemindersViewOpenCalendarEvent}
            onOpenNewReminderModal={onRemindersViewOpenNewReminderModal}
            onOpenEditReminderModal={onRemindersViewOpenEditReminderModal}
            isSidebarCollapsed={isSidebarCollapsed}
            onExpandSidebar={onRemindersViewExpandSidebar}
            onOpenMobileMenu={onRemindersViewOpenMobileMenu}
          />
        )}

        {activeSection==='memory'&&runtime&&!runtime.memoryInboxAvailable&&model.memoryInbox?.error&&<p role="alert" className="px-4 py-2 text-sm border-b border-[var(--mroya-divider)]">{model.memoryInbox.error}<button type="button" className="ml-3 underline" onClick={model.memoryInbox.onRefresh}>Retry Inbox</button></p>}
        {activeSection === 'memory' && (
          <MemoryView
            key={model.memoryInbox?.scopeKey??'saved-memory'}
            inbox={!runtime||runtime.memoryInboxAvailable===true?model.memoryInbox:undefined}
            readOnly={!!runtime}
            memories={memories}
            selectedMemoryId={selectedMemoryViewId}
            onSelectMemory={onMemoryViewSelectMemory}
            onUpdateMemory={onMemoryViewUpdateMemory}
            onForgetMemory={onMemoryViewForgetMemory}
            onAddMemory={onMemoryViewAddMemory}
            onExploreInMap={onMemoryViewExploreInMap}
            onAskMroyaAbout={onMemoryViewAskMroyaAbout}
            isSidebarCollapsed={isSidebarCollapsed}
            onExpandSidebar={onMemoryViewExpandSidebar}
            onOpenMobileMenu={onMemoryViewOpenMobileMenu}
          />
        )}

        {activeSection === 'memory-map' && (
          <MemoryMapView
            theme={model.appearance ?? (theme === 'dark' ? 'dark' : 'light')}
            displayName={account.displayName}
            loading={feedback?.loading}
            error={feedback?.error}
            nodes={nodes}
            edges={edges}
            selectedNodeId={selectedGraphNodeId}
            onSelectNode={onMemoryMapViewSelectNode}
            onOpenMemory={onMemoryMapViewOpenMemory}
            onAskAboutNode={onMemoryMapViewAskAboutNode}
            isSidebarCollapsed={isSidebarCollapsed}
            onExpandSidebar={onMemoryMapViewExpandSidebar}
            onOpenMobileMenu={onMemoryMapViewOpenMobileMenu}
          />
        )}

        {activeSection === 'connections' && (
          <ConnectionsSettingsView
            notifications={model.notifications}
            notificationPreview={runtime?undefined:model.notificationPreview}
            designIntelligence={runtime?undefined:model.designIntelligence}
            timezoneSettings={runtime?.timezoneSettings}
            onChangeTimezone={runtime?.timezoneSettings?.onChange??model.onChangeTimezone}
            connectionSamples={runtime?undefined:model.connectionSamples}
            googleCalendarAvailable={model.googleCalendarAvailable}
            googleCalendarBusy={model.googleCalendarBusy}
            googleCalendarNotice={model.googleCalendarNotice}
            googleCalendarError={model.googleCalendarError}
            googleConnections={model.googleConnections}
            selectedGoogleConnectionId={model.selectedGoogleConnectionId}
            onSelectGoogleConnection={model.onSelectGoogleConnection}
            onRefreshGoogleCalendar={model.onRefreshGoogleCalendar}
            onConnectAnotherGoogleCalendar={model.onConnectAnotherGoogleCalendar}
            gcalSyncState={runtime&&!model.googleCalendarAvailable?undefined:model.gcalSyncState}
            autoSync={runtime&&!model.googleCalendarAvailable?undefined:model.autoSync}
            lastSyncedTime={runtime&&!model.googleCalendarAvailable?undefined:model.lastSyncedTime}
            syncSummary={runtime&&!model.googleCalendarAvailable?undefined:model.syncSummary}
            googleCalendarEmail={runtime&&!model.googleCalendarAvailable?undefined:model.googleCalendarEmail}
            importedCalendars={runtime&&!model.googleCalendarAvailable?undefined:model.importedCalendars}
            exportCalendar={runtime&&!model.googleCalendarAvailable?undefined:model.exportCalendar}
            onChangeImportedCalendars={runtime&&!model.googleCalendarAvailable?undefined:model.onChangeImportedCalendars}
            onChangeExportCalendar={runtime&&!model.googleCalendarAvailable?undefined:model.onChangeExportCalendar}
            onConnectGoogleCalendar={runtime&&!model.googleCalendarAvailable?undefined:model.onConnectGoogleCalendar}
            onDisconnectGoogleCalendar={runtime&&!model.googleCalendarAvailable?undefined:model.onDisconnectGoogleCalendar}
            onSyncNowGoogleCalendar={runtime&&!model.googleCalendarAvailable?undefined:model.onSyncNowGoogleCalendar}
            onToggleAutoSyncGoogleCalendar={runtime&&!model.googleCalendarAvailable?undefined:model.onToggleAutoSyncGoogleCalendar}
            onSetGcalSyncState={runtime?undefined:model.onSetGcalSyncState}
            live={!!runtime}
            telegram={runtime?.telegram}
            preferenceSave={runtime?.preferenceSave}
            showModelReasoning={runtime?.showModelReasoning}
            onToggleShowModelReasoning={runtime?.onToggleShowModelReasoning}
            onSaveNickname={runtime?.onSaveNickname ?? model.onSaveNickname}
            onClearNickname={runtime?.onClearNickname ?? model.onClearNickname}
        account={account}
            connections={connections}
            onToggleConnection={onConnectionsSettingsViewToggleConnection}
            plan={plan}
            onSelectPlan={onConnectionsSettingsViewSelectPlan}
            theme={theme}
            onSelectTheme={onConnectionsSettingsViewSelectTheme}
            activeTab={settingsTab}
            onChangeTab={onConnectionsSettingsViewChangeTab}
            isSidebarCollapsed={isSidebarCollapsed}
            onExpandSidebar={onConnectionsSettingsViewExpandSidebar}
            onOpenMobileMenu={onConnectionsSettingsViewOpenMobileMenu}
          />
        )}

        {activeSection === 'notes' && notesAvailable && (
          <NotesView
            notes={model.notes ?? []}
            designPreview={!runtime}
            isSidebarCollapsed={isSidebarCollapsed}
            onExpandSidebar={onConnectionsSettingsViewExpandSidebar}
            onOpenMobileMenu={onConnectionsSettingsViewOpenMobileMenu}
          />
        )}
        </div>
        {runtime?.notice && <div className="absolute top-16 left-3 right-3 z-40 max-w-md mx-auto"><AccessNotice message={runtime.notice} onClose={runtime.onCloseNotice}/></div>}
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
                onClick={onClosePlanPreview}
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
                  onClick={onPreviewFreePlan}
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
                  onClick={onPreviewPremiumPlan}
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
        onClose={onReminderEditorModalClose}
        onSave={handleAddOrUpdateReminder}
        editingReminder={editingReminder}
        events={events}
        preselectedEventId={reminderPreselectedEventId}
      />
    </WorkspaceSurface>);
}
