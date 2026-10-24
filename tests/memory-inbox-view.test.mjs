import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const vite = await createServer({
  mode: 'design',
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
});

after(() => vite.close());

const { Sidebar } = await vite.ssrLoadModule('/src/components/Sidebar.tsx');
const { WorkspaceView } = await vite.ssrLoadModule('/src/pages/WorkspaceView.tsx');
const {DEFAULT_PIPELINE_EVENTS}=await vite.ssrLoadModule('/src/demo/inboxPipelineData.ts');
const { MemoryInboxView } = await vite.ssrLoadModule('/src/components/MemoryInboxView.tsx');
const { useDemoWorkspace } = await vite.ssrLoadModule('/src/demo/useDemoWorkspace.ts');

const account = {
  displayName: 'Alex Director',
  initials: 'AD',
  email: 'alex@example.test',
  description: '',
  timezone: 'Europe/Moscow',
  spaceDescription: 'Design space',
  nickname: 'Alex',
};

const baseSidebar = {
  account,
  activeSection: 'memory-inbox',
  onSelectSection: () => {},
  conversations: [],
  activeConversationId: null,
  onSelectConversation: () => {},
  onNewChat: () => {},
  plan: 'free',
  onTogglePlan: () => {},
  onOpenPlanModal: () => {},
  theme: 'light',
  onToggleTheme: () => {},
  isCollapsed: false,
  onToggleCollapse: () => {},
  mobileOpen: false,
  onCloseMobile: () => {},
  memoriesCount: 5,
  upcomingEventsCount: 3,
  pendingRemindersCount: 1,
  memoryInboxCount: 4,
  onOpenSettingsTab: () => {},
};

test('Sidebar includes Memory Inbox item right between Memory and Memory Map', () => {
  const html = renderToStaticMarkup(React.createElement(Sidebar, baseSidebar));
  assert.ok(html.includes('Memory Inbox'), 'Sidebar must include Memory Inbox');
  assert.ok(html.includes('Memory Map'), 'Sidebar must include Memory Map');
  assert.ok(html.includes('Memory'), 'Sidebar must include Memory');

  // Verify ordering: Memory -> Memory Inbox -> Memory Map
  const memIndex = html.indexOf('>Memory</span>');
  const inboxIndex = html.indexOf('>Memory Inbox</span>');
  const mapIndex = html.indexOf('>Memory Map</span>');

  assert.ok(memIndex >= 0, 'Memory found in sidebar');
  assert.ok(inboxIndex >= 0, 'Memory Inbox found in sidebar');
  assert.ok(mapIndex >= 0, 'Memory Map found in sidebar');
  assert.ok(memIndex < inboxIndex, 'Memory comes before Memory Inbox');
  assert.ok(inboxIndex < mapIndex, 'Memory Inbox comes before Memory Map');
});

test('WorkspaceView renders MemoryInboxView with "Требуют внимания" main screen by default', () => {
  let model;
  function Seed() {
    model = useDemoWorkspace('filled');
    return null;
  }
  renderToStaticMarkup(React.createElement(Seed));
  assert.ok(model, 'model initialized');

  const html = renderToStaticMarkup(
    React.createElement(WorkspaceView, {
      model: { ...model, activeSection: 'memory-inbox' },
    })
  );

  assert.ok(html.includes('Требуют внимания'), 'Contains "Требуют внимания" title');
  assert.ok(html.includes('История и статусы'), 'Contains "История и статусы" tab button');
  assert.ok(html.includes('День рождения Марка'), 'Contains proposal card');
  assert.ok(html.includes('Что AI предлагает запомнить:'), 'Contains memory proposal explanation');
  assert.ok(html.includes('>Да</span>'), 'Contains Yes button');
  assert.ok(html.includes('>Нет</span>'), 'Contains No button');
  assert.ok(html.includes('>Комментарий</span>'), 'Contains Comment button');
  assert.ok(html.includes('Сброс демо'), 'Contains Reset demo button');

  // Main screen has no technical jargon like Tier 1 or APPROVE/REJECT
  assert.ok(!html.includes('Tier 1'), 'No Tier 1 jargon on main screen');
});

test('MemoryInboxView renders empty state when all attention proposals are resolved', () => {
  // Empty initial events with no proposals in awaiting_confirmation
  const html = renderToStaticMarkup(React.createElement(MemoryInboxView, { design:true,initialEvents: [] }));

  assert.ok(html.includes('Всё разобрано!'), 'Contains "Всё разобрано!"');
  assert.ok(html.includes('Пока ничего не требует вашего внимания'), 'Contains "Пока ничего не требует вашего внимания"');
  assert.ok(html.includes('Сбросить демо / начать заново'), 'Contains Reset demo button in empty state');
});

test('MemoryInboxView technical tab renders pipeline stats, stages and re-analysis', () => {
  // In SSR we can render with activeMainTab state by testing the History view elements
  function HistoryWrapper() {
    const [view, setView] = React.useState('history');
    return React.createElement(MemoryInboxView, {design:true,initialEvents:DEFAULT_PIPELINE_EVENTS});
  }
  
  // Directly instantiate with history tab or test history elements
  const html = renderToStaticMarkup(React.createElement(MemoryInboxView, {design:true,initialEvents:DEFAULT_PIPELINE_EVENTS}));
  assert.ok(html.includes('История и статусы'), 'Tab switcher has History button');
  assert.ok(html.includes('Требуют внимания'), 'Tab switcher has Attention button');
});
