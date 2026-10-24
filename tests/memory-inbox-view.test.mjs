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

test('WorkspaceView renders MemoryInboxView when activeSection is "memory-inbox"', () => {
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

  assert.ok(html.includes('Memory Inbox'), 'Contains Memory Inbox title');
  assert.ok(html.includes('Прогресс обработки событий'), 'Contains pipeline progress header');
  assert.ok(html.includes('Ожидают проверки'), 'Contains Pending Check stat card');
  assert.ok(html.includes('Отобрано AI'), 'Contains Fast Approved stat card');
  assert.ok(html.includes('Отклонено AI'), 'Contains Fast Rejected stat card');
  assert.ok(html.includes('В очереди анализа'), 'Contains Deep Queue stat card');
  assert.ok(html.includes('На подтверждении'), 'Contains Awaiting Confirmation stat card');
  assert.ok(html.includes('В памяти'), 'Contains Committed stat card');
});

test('MemoryInboxView renders 5 pipeline stages and fast filter decision principles', () => {
  const html = renderToStaticMarkup(React.createElement(MemoryInboxView, {}));

  // 5 stages
  assert.ok(html.includes('1. Обнаружение'), 'Stage 1: Discovery');
  assert.ok(html.includes('2. Быстрый фильтр (APPROVE / REJECT)'), 'Stage 2: Fast filter');
  assert.ok(html.includes('3. Глубокий анализ'), 'Stage 3: Deep analysis');
  assert.ok(html.includes('4. Подтверждение'), 'Stage 4: Confirmation');
  assert.ok(html.includes('5. Сохранение'), 'Stage 5: Committed memory');

  // Fast filter principle banner
  assert.ok(
    html.includes('Правило фильтра 1: сомнительное всегда одобряется (APPROVE)'),
    'Fast filter rule banner present'
  );
});

test('MemoryInboxView renders realistic demo events in all states with action buttons', () => {
  const html = renderToStaticMarkup(React.createElement(MemoryInboxView, {}));

  // Check event presence
  assert.ok(html.includes('День рождения Марка'), 'Mark birthday proposal present');
  assert.ok(html.includes('Семейный отпуск: 1–15 августа'), 'Vacation proposal present');
  assert.ok(html.includes('Еженедельный общий стендап'), 'Rejected standup event present');
  assert.ok(html.includes('Созвон с бухгалтером'), 'Pending check event present');

  // Check action buttons exist
  assert.ok(html.includes('Подтвердить и сохранить в память'), 'Confirm button present');
  assert.ok(html.includes('Отклонить'), 'Decline button present');
  assert.ok(html.includes('Сброс демо'), 'Reset demo button present');

  // Check AI details inspection sections
  assert.ok(html.includes('Исходное событие из календаря'), 'Source calendar event card');
  assert.ok(html.includes('Решение первого AI-фильтра'), 'Fast filter decision card');
  assert.ok(html.includes('Предлагаемая информация для памяти'), 'Deep analysis card');
  assert.ok(html.includes('История обработки (Audit Log)'), 'Audit log timeline');
});
