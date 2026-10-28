import type {AiTask} from '../types/aiTasks';
export type TaskGroup='answer'|'suggestions'|'working';
export function taskGroup(task:AiTask):TaskGroup {
 if(task.status==='needs_clarification'||task.status==='awaiting_review'&&task.needsClarification)return 'answer';
 return task.status==='awaiting_review'?'suggestions':'working';
}
export function reviewQuestions(task:AiTask):string[]{
 if(!task.needsClarification)return [];
 return [...new Set(task.questions??[])];
}
