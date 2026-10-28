import {ApiError} from './errors.ts';
import {isTurnUuid} from './reportContext.ts';
import type {AiTask, AiTasksPage} from '../types/aiTasks';
export function readAiTask(value: unknown, expectedId?: string): AiTask {
  const v = value as Record<string, unknown> | null;
  if (!v || typeof v !== 'object' || !isTurnUuid(v.id) || (expectedId && v.id !== expectedId)
    || !['memory','calendar','notes'].includes(v.type as string)
    || !['awaiting_review','pending_confirmation','queued','running','completed','failed','needs_clarification','cancelled'].includes(v.status as string)
    || typeof v.description !== 'string' || !v.description
    || !['created_at','updated_at'].every(k => typeof v[k] === 'string' && Number.isFinite(Date.parse(v[k] as string)))
    || !['started_at','finished_at'].every(k => v[k] == null || typeof v[k] === 'string' && Number.isFinite(Date.parse(v[k] as string)))
    || !(v.confirm_deadline_at === undefined || v.confirm_deadline_at === null
      || typeof v.confirm_deadline_at === 'string' && Number.isFinite(Date.parse(v.confirm_deadline_at as string)))
    || !(v.server_time === undefined || typeof v.server_time === 'string' && Number.isFinite(Date.parse(v.server_time)))
    || !(v.can_cancel === undefined || typeof v.can_cancel === 'boolean')
    || !(v.duration_ms == null || Number.isSafeInteger(v.duration_ms) && (v.duration_ms as number) >= 0)
    || !(v.result === null || typeof v.result === 'string') || !(v.error_code === null || typeof v.error_code === 'string'))
    throw new ApiError(502,'invalid_response','Invalid AI task');
  const kind=v.task_kind??'chat';
  if(!['chat','calendar_review','memory_proposal'].includes(kind as string)
    ||kind==='chat'&&v.status==='awaiting_review'
    ||kind!=='chat'&&(!Number.isSafeInteger(v.version)||(v.version as number)<1
      ||!Array.isArray(v.actions)||v.actions.some(a=>!['accept','reject','comment'].includes(a))
      ||!Array.isArray(v.facts)||v.facts.some(f=>typeof f!=='string')
      ||!(v.event_date===null||typeof v.event_date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v.event_date)&&Number.isFinite(Date.parse(v.event_date)))
      ||!(v.result_code===null||['no_new_information','analysis_complete','memory_saved'].includes(v.result_code as string))))
    throw new ApiError(502,'invalid_response','Invalid task review');
  const product=kind!=='chat'&&v.event_title!==undefined;
  if(product&&(!(v.event_title===null||typeof v.event_title==='string')
    ||!Array.isArray(v.questions)||v.questions.some(q=>typeof q!=='string')
    ||typeof v.needs_clarification!=='boolean'||!(v.review_phase===null||v.review_phase==='answer_processing')))
    throw new ApiError(502,'invalid_response','Invalid task presentation');
  const title=kind==='chat'?v.description as string:product&&v.event_title?v.event_title as string:'Calendar';
  return {id:v.id as string, title, userPrompt:title,
    eventTitle:product?v.event_title as string||undefined:undefined,
    questions:product?v.questions as string[]:[],needsClarification:product?v.needs_clarification as boolean:false,
    reviewPhase:product?v.review_phase as AiTask['reviewPhase']||undefined:undefined,
    taskKind:kind as AiTask['taskKind'],reviewVersion:v.version as number|undefined,
    reviewActions:v.actions as AiTask['reviewActions'],eventDate:v.event_date as string||undefined,
    facts:product?v.facts as AiTask['facts']:[],resultCode:v.result_code as AiTask['resultCode'],
    target:v.type as AiTask['target'], status:v.status as AiTask['status'],
    canCancel:v.can_cancel === true,
    createdAt:v.created_at as string, updatedAt:v.updated_at as string,
    serverClockOffsetMs:typeof v.server_time === 'string' ? Date.parse(v.server_time)-Date.now() : undefined,
    confirmDeadlineAt:typeof v.confirm_deadline_at === 'string' ? v.confirm_deadline_at : undefined,
    startedAt:v.started_at as string || undefined, finishedAt:v.finished_at as string || undefined,
    durationMs:typeof v.duration_ms === 'number' ? v.duration_ms : undefined,
    resultSummary:v.result as string || undefined, errorMessage:v.error_code as string || undefined};
}
/** Chat receipts: the `tasks` array of one source turn, present only when non-empty. */
export function readTasksPayload(value: unknown): AiTask[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 9)
    throw new ApiError(502,'invalid_response','Invalid chat task receipts');
  const tasks=value.map(t => readAiTask(t));
  if(new Set(tasks.map(t=>t.id)).size!==tasks.length)throw new ApiError(502,'invalid_response','Duplicate task receipts');
  return tasks;
}
export function readAiTasksPage(value: unknown, offset: number): AiTasksPage {
  const v = value as Record<string, unknown> | null;
  if (!v || !Array.isArray(v.tasks) || v.tasks.length > 50 || !(v.next_offset === null
    || (Number.isSafeInteger(v.next_offset) && (v.next_offset as number) === offset + 50 && (v.next_offset as number) <= 10000)))
    throw new ApiError(502,'invalid_response','Invalid AI tasks page');
  return {tasks:v.tasks.map(t => readAiTask(t)), nextOffset:v.next_offset as number | null};
}

/** State advances monotonically, including virtual deadline approval with unchanged updated_at. */
export function newerTask(current:AiTask|undefined,incoming:AiTask):AiTask {
  if(!current)return incoming;
  const previous=Date.parse(current.updatedAt),next=Date.parse(incoming.updatedAt);
  if(incoming.taskKind&&incoming.taskKind!=='chat')
    return previous>next||(current.reviewVersion??0)>(incoming.reviewVersion??0)?current:incoming;
  const rank=(s:AiTask['status'])=>['awaiting_review','pending_confirmation'].includes(s)?0:s==='queued'?1:s==='running'?2:3;
  return previous>next||previous===next&&(rank(current.status)>rank(incoming.status)
    ||current.confirmDeadlineAt!==undefined&&incoming.confirmDeadlineAt===undefined)?current:incoming;
}

export function taskTimeRemaining(task:AiTask,now=Date.now()):number|null {
  return task.confirmDeadlineAt?Math.max(0,Date.parse(task.confirmDeadlineAt)-now-(task.serverClockOffsetMs??0)):null;
}
