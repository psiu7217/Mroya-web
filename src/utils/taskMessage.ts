import type {AiTask} from '../types/aiTasks';

/** Copy the visible proposal, rather than the legacy technical chat fallback. */
export function taskMessageText(tasks:AiTask[]):string {
  return tasks.map(task=>[task.title,...task.review??[],
    ...((task.status==='failed'||task.status==='needs_clarification'||task.target!=='memory')&&task.resultSummary
      ?[task.resultSummary]:[])].join('\n')).join('\n\n');
}
