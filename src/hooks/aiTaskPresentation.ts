import type {AiTask} from '../types/aiTasks';
import {tr} from '../i18n/index.ts';
import {currentLocale} from '../i18n/format';
const text=(key:string,options={})=>tr(key,{ns:'chat',...options});
export type TaskGroup='answer'|'suggestions'|'working';
export function taskGroup(task:AiTask):TaskGroup {
 if(task.status==='needs_clarification'||task.status==='awaiting_review'&&task.needsClarification)return 'answer';
 return task.status==='awaiting_review'?'suggestions':'working';
}
export function reviewQuestions(task:AiTask):string[]{
 if(!task.needsClarification)return [];
 const questions=[...new Set(task.questions?.map(q=>q.trim()).filter(Boolean)??[])];
 const technical=/__self__|[{}]|\b(?:entity|matching|confidence|memory|rationale|uuid|tool|search)\b|сущност|сопостав|поиск|фамили|полное имя|[0-9a-f]{8}-[0-9a-f-]{27,}/i;
 const safe=questions.length>0&&questions.every(q=>q.length<=200&&!technical.test(q)
   &&(currentLocale()==='ru'?/[А-Яа-яЁё]/.test(q):!/[А-Яа-яЁё]/.test(q)));
 return safe?questions:[text('taskClarifyEvent',{event:task.eventTitle||text('taskCalendarEvent')})];
}
