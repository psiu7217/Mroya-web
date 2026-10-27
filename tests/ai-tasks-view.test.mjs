import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const vite = await createServer({ mode: 'design', server: { middlewareMode: true }, appType: 'custom' });
after(() => vite.close());

const { INITIAL_AI_TASKS } = await vite.ssrLoadModule('/src/demo/aiTasksData.ts');
const { AiTasksDrawer } = await vite.ssrLoadModule('/src/components/AiTasksDrawer.tsx');
const { AiTaskCompletionToast } = await vite.ssrLoadModule('/src/components/AiTaskCompletionToast.tsx');

test('INITIAL_AI_TASKS covers all 6 required background task statuses', () => {
  const statuses = new Set(INITIAL_AI_TASKS.map((t) => t.status));
  assert.ok(statuses.has('queued'), 'Should have queued task');
  assert.ok(statuses.has('running'), 'Should have running task');
  assert.ok(statuses.has('completed'), 'Should have completed task');
  assert.ok(statuses.has('failed'), 'Should have error task');
  assert.ok(statuses.has('needs_clarification'), 'Should have needs_clarification task');
  assert.ok(statuses.has('cancelled'), 'Should have cancelled task');
  assert.equal(statuses.size, 6);
});

test('INITIAL_AI_TASKS covers all 3 target domains (calendar, memory, notes)', () => {
  const targets = new Set(INITIAL_AI_TASKS.map((t) => t.target));
  assert.ok(targets.has('calendar'), 'Should have calendar task');
  assert.ok(targets.has('memory'), 'Should have memory task');
  assert.ok(targets.has('notes'), 'Should have notes task');
});

test('AiTasksDrawer renders compact UI without "Все" tab and pins clarification at top', () => {
  const html = renderToStaticMarkup(
    React.createElement(AiTasksDrawer, {
      isOpen: true,
      onClose: () => {},
      tasks: INITIAL_AI_TASKS,
    })
  );

  // Tab check: No "Все" tab
  assert.doesNotMatch(html, />Все</);
  assert.match(html, /Активные/);
  assert.match(html, /Завершенные/);
  assert.match(html, /Ошибки/);

  // Highlighted clarification item pinned at top
  assert.match(html, /Требует уточнения/);
  assert.doesNotMatch(html, /Тест|Повторить|Продолжение обработки|\d+%/);

  // Active running/queued tasks
  assert.match(html, /Выполняется/);
  assert.match(html, /В очереди/);
});

test('AiTasksDrawer returns null when closed', () => {
  const html = renderToStaticMarkup(
    React.createElement(AiTasksDrawer, {
      isOpen: false,
      onClose: () => {},
      tasks: INITIAL_AI_TASKS,
    })
  );
  assert.equal(html, '');
});

test('AiTaskCompletionToast renders notification banner with action button', () => {
  const completedTask = INITIAL_AI_TASKS.find((t) => t.status === 'completed');
  assert.ok(completedTask);

  const html = renderToStaticMarkup(
    React.createElement(AiTaskCompletionToast, {
      task: completedTask,
      onOpenDetails: () => {},
      onDismiss: () => {},
    })
  );

  assert.match(html, /AI выполнил задачу/);
  assert.match(html, /Посмотреть результат/);
  assert.match(html, new RegExp(completedTask.title));
});
