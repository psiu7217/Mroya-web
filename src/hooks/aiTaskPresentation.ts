import type {AiTask} from '../types/aiTasks';
export type TaskGroup='answer'|'suggestions'|'working'|'review';
const technicalErrors=new Set(['execution_outcome_unknown','mutation_receipt_missing','mutation_receipt_invalid','execution_incomplete','final_disposition_invalid','partial_execution','task_finalization_failed','execution_interrupted','domain_operation_rejected','completion_unconfirmed']);
export const needsTaskReview=(task:AiTask)=>task.status==='needs_clarification'&&task.taskKind==='chat'&&technicalErrors.has(task.errorMessage??'');
export function taskGroup(task:AiTask):TaskGroup {
 if(needsTaskReview(task))return 'review';
 if(task.status==='needs_clarification'||task.status==='awaiting_review'&&task.needsClarification)return 'answer';
 return task.status==='awaiting_review'?'suggestions':'working';
}
export function reviewQuestions(task:AiTask):string[]{
 if(!task.needsClarification)return [];
 return [...new Set(task.questions??[])];
}
