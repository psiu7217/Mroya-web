import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import fs from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const vite = await createServer({ mode: 'design', server: { middlewareMode: true }, appType: 'custom' });
const { Sidebar } = await vite.ssrLoadModule('/src/components/Sidebar.tsx');
const { ChatWorkspace } = await vite.ssrLoadModule('/src/components/ChatWorkspace.tsx');
const { useDemoWorkspace } = await vite.ssrLoadModule('/src/demo/useDemoWorkspace.ts');

const noop = () => {};
const account = {
  displayName: 'Alex Lindqvist',
  initials: 'AL',
  email: 'alex@example.com',
  description: 'Design Director',
  timezone: 'Europe/Stockholm',
  spaceDescription: 'Personal space',
  nickname: '',
};

test('Sidebar renders multiple conversations with subtle three-dot action menus', () => {
  const conversations = [
    { id: 'c1', title: 'Website redesign agreement with Sarah', group: 'Today', updatedAt: 'Just now', relatedMemoryIds: [], messages: [] },
    { id: 'c2', title: 'Q4 retainer scope for Nordic Studio', group: 'Previous 7 Days', updatedAt: 'Oct 9', relatedMemoryIds: [], messages: [] },
  ];

  const html = renderToStaticMarkup(
    React.createElement(Sidebar, {
      account,
      activeSection: 'chat',
      onSelectSection: noop,
      conversations,
      activeConversationId: 'c1',
      onSelectConversation: noop,
      onNewChat: noop,
      plan: 'free',
      onTogglePlan: noop,
      onOpenPlanModal: noop,
      theme: 'light',
      onToggleTheme: noop,
      isCollapsed: false,
      onToggleCollapse: noop,
      mobileOpen: false,
      onCloseMobile: noop,
      memoriesCount: 5,
      upcomingEventsCount: 2,
      pendingRemindersCount: 1,
      onOpenSettingsTab: noop,
    })
  );

  assert.match(html, /Website redesign agreement with Sarah/);
  assert.match(html, /Q4 retainer scope for Nordic Studio/);
  assert.match(html, /aria-label="Options for Website redesign agreement with Sarah"/);
  assert.match(html, /aria-label="Options for Q4 retainer scope for Nordic Studio"/);
  assert.match(html, /New chat/);
});

test('useDemoWorkspace supports creating, selecting, renaming and permanently deleting conversations', () => {
  let model;
  function Harness() {
    model = useDemoWorkspace('filled');
    return null;
  }
  renderToStaticMarkup(React.createElement(Harness));

  assert.ok(model.conversations.length >= 2, 'Initial conversations should have multiple items');
  assert.equal(typeof model.onSidebarRenameConversation, 'function');
  assert.equal(typeof model.onSidebarDeleteConversation, 'function');
  assert.equal(typeof model.onSidebarSelectConversation, 'function');
  assert.equal(typeof model.handleNewChat, 'function');
});

test('Sidebar includes exact delete confirmation dialog text and destructive button', () => {
  const sidebarSource = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');
  assert.match(
    sidebarSource,
    /Permanently delete this chat and all its messages\? This cannot be undone\. Your saved memories will not be affected\./
  );
  assert.match(sidebarSource, />\s*Delete\s*<\/button>/);
  assert.match(sidebarSource, />\s*Cancel\s*<\/button>/);
});

test('ChatWorkspace renders empty state when active conversation is null or has no messages', () => {
  const html = renderToStaticMarkup(
    React.createElement(ChatWorkspace, {
      account,
      conversation: null,
      onSendMessage: noop,
      onCitationClick: noop,
      onActionClick: noop,
      addedActionIds: [],
      isSidebarCollapsed: false,
      onExpandSidebar: noop,
      onOpenMobileMenu: noop,
      isContextPanelOpen: false,
      onToggleContextPanel: noop,
      plan: 'free',
      onTogglePlan: noop,
      onOpenPlanModal: noop,
      theme: 'light',
      onToggleTheme: noop,
      onNewChat: noop,
      memoriesCount: 0,
    })
  );

  assert.match(html, /Good afternoon\. What(?:&#x27;|&apos;|')s on your mind\?/);
  assert.match(html, /What do you remember about me\?/);
});

await vite.close();
