import {ApiError} from './errors.ts';
import {isTurnUuid} from './reportContext.ts';
import type {AiTask, AiTasksPage} from '../types/aiTasks';
export function readAiTask(value: unknown, expectedId?: string): AiTask {
  const v = value as Record<string, unknown> | null;
  if (!v || typeof v !== 'object' || !isTurnUuid(v.id) || (expectedId && v.id !== expectedId)
    || !['memory','calendar','notes'].includes(v.type as string)
    || !['queued','running','completed','failed','needs_clarification','cancelled'].includes(v.status as string)
    || typeof v.description !== 'string' || !v.description
    || !['created_at','updated_at'].every(k => typeof v[k] === 'string' && Number.isFinite(Date.parse(v[k] as string)))
    || !(v.result === null || typeof v.result === 'string') || !(v.error_code === null || typeof v.error_code === 'string'))
    throw new ApiError(502,'invalid_response','Invalid AI task');
  return {id:v.id as string, title:v.description as string, userPrompt:v.description as string,
    target:v.type as AiTask['target'], status:v.status as AiTask['status'],
    createdAt:v.created_at as string, updatedAt:v.updated_at as string,
    resultSummary:v.result as string || undefined, errorMessage:v.error_code as string || undefined};
}
export function readAiTasksPage(value: unknown, offset: number): AiTasksPage {
  const v = value as Record<string, unknown> | null;
  if (!v || !Array.isArray(v.tasks) || v.tasks.length > 50 || !(v.next_offset === null
    || (Number.isSafeInteger(v.next_offset) && (v.next_offset as number) === offset + 50 && (v.next_offset as number) <= 10000)))
    throw new ApiError(502,'invalid_response','Invalid AI tasks page');
  return {tasks:v.tasks.map(t => readAiTask(t)), nextOffset:v.next_offset as number | null};
}
