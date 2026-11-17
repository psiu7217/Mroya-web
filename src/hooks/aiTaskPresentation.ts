import type {AiTask} from '../types/aiTasks';
export type TaskGroup='answer'|'suggestions'|'working'|'review';
export const needsTaskReview=(task:AiTask)=>task.status==='needs_clarification'&&(!task.taskKind||task.taskKind==='chat')&&!!task.errorMessage&&task.errorMessage!=='clarification_required';
/** Count ongoing work and supported user decisions; reporting an issue is not a decision. */
export function countsTowardTaskBadge(task:AiTask):boolean {
 if(['pending_confirmation','queued','running'].includes(task.status))return true;
 if(['failed','cancelled'].includes(task.status))return task.reviewActions?.includes('retry')===true;
 if(!['awaiting_review','needs_clarification'].includes(task.status))return false;
 return task.status==='needs_clarification'&&task.canCancel===true
  ||task.reviewActions?.some(action=>action==='comment'||action==='reject'||action==='accept'&&!task.needsClarification)===true;
}
export function taskGroup(task:AiTask):TaskGroup {
 if(needsTaskReview(task))return 'review';
 if(task.status==='needs_clarification'||task.status==='awaiting_review'&&task.needsClarification)return 'answer';
 return task.status==='awaiting_review'?'suggestions':'working';
}
export function reviewQuestions(task:AiTask):string[]{
 if(!task.needsClarification)return [];
 return [...new Set(task.questions??[])];
}
