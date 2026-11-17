import type {ChatMessage,ToolTimelineEntry} from '../types/mroya';

export function imageGenerationPhase(message:Pick<ChatMessage,'status'|'timeline'|'content'>):'generating'|'finishing'|null {
 if(message.status!=='streaming')return null;
 const activity=[...(message.timeline??[])].reverse().find((entry):entry is ToolTimelineEntry=>entry.kind==='tool'&&entry.toolName==='generate_image');
 if(activity?.status==='running')return 'generating';
 if(activity?.status==='success'&&!/\/api\/v1\/documents\/[0-9a-f-]{36}\/original\//i.test(message.content))return 'finishing';
 return null;
}
