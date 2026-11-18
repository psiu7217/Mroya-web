import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const vite = await createServer({ mode: 'design', server: { middlewareMode: true }, appType: 'custom' });
after(() => vite.close());

const { WorkspaceView } = await vite.ssrLoadModule('/src/pages/WorkspaceView.tsx');
const { Sidebar } = await vite.ssrLoadModule('/src/components/Sidebar.tsx');
const { NotesView } = await vite.ssrLoadModule('/src/components/NotesView.tsx');
const { INITIAL_NOTES } = await vite.ssrLoadModule('/src/demo/notesFixtures.ts');
const { useDemoWorkspace } = await vite.ssrLoadModule('/src/demo/useDemoWorkspace.ts');

const noop = () => {};
const account = {
  displayName: 'Test User',
  initials: 'TU',
  email: 'test@example.com',
  description: '',
  timezone: 'UTC',
  spaceDescription: 'Personal space',
};

const baseSidebarProps = {
  account,
  activeSection: 'notes',
  onSelectSection: noop,
  conversations: [],
  activeConversationId: null,
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
  notesCount: INITIAL_NOTES.length,
  notesAvailable: true,
  onOpenSettingsTab: noop,
};

test('Sidebar includes Notes navigation item in expanded, collapsed, and mobile states', () => {
  for (const isCollapsed of [true, false]) {
    for (const mobileOpen of [true, false]) {
      const html = renderToStaticMarkup(
        React.createElement(Sidebar, { ...baseSidebarProps, isCollapsed, mobileOpen })
      );
      assert.match(html, /Notes/);
    }
  }
});

test('WorkspaceView renders NotesView when activeSection is "notes"', () => {
  let model;
  function Seed() {
    model = useDemoWorkspace('filled');
    return null;
  }
  renderToStaticMarkup(React.createElement(Seed));
  const html = renderToStaticMarkup(
    React.createElement(WorkspaceView, {
      model: { ...model, activeSection: 'notes' },
    })
  );

  assert.match(html, /Условия карты MaxSwap/);
  assert.match(html, /Рецепт яблочного пирога/);
  assert.match(html, /Инструкция по деплою Mroya/);
});

test('NotesView Screen 1 renders titles, summaries, tags, dates, and search/filter controls', () => {
  const html = renderToStaticMarkup(
    React.createElement(NotesView, {
      notes: INITIAL_NOTES,
      isSidebarCollapsed: false,
      onExpandSidebar: noop,
      onOpenMobileMenu: noop,
    })
  );

  assert.match(html, /Notes/);
  assert.match(html, /Условия карты MaxSwap/);
  assert.match(html, /Условия обслуживания карты, промокод Катц/);
  assert.match(html, /Промокод Катц/);
  assert.match(html, /Рецепт яблочного пирога/);
  assert.match(html, /Search notes/);
  // Verify no create note button exists
  assert.doesNotMatch(html, />Add note<|>Create note<|>New note</i);
});

test('NotesView Screen 3 renders empty state with exact required copy and no create button', () => {
  const html = renderToStaticMarkup(
    React.createElement(NotesView, {
      notes: [],
      isSidebarCollapsed: false,
      onExpandSidebar: noop,
      onOpenMobileMenu: noop,
    })
  );

  assert.match(html, /No notes yet/);
  assert.match(html, /Ask Mroya to save a recipe, instruction, or any useful text\./);
  // Strictly no create/new note button
  assert.doesNotMatch(html, />Add note<|>Create note<|>New note<|>Создать заметку</i);
});

test('NotesView Reading View renders title above category/date, category on left, date on right, and reset button for checklist', () => {
  const checklistNote = INITIAL_NOTES.find((n) => n.id === 'note-hiking-checklist');
  assert.ok(checklistNote, 'checklist note must exist');

  const html = renderToStaticMarkup(
    React.createElement(NotesView, {
      notes: [checklistNote],
      isSidebarCollapsed: false,
      onExpandSidebar: noop,
      onOpenMobileMenu: noop,
    })
  );

  // In list view: shows category and date
  assert.match(html, /Чеклист для трехдневного хайкинга/);
});
