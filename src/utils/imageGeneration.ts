import type {ChatMessage,ToolTimelineEntry} from '../types/mroya';

// OpenRouter returns a finished image in one response. Keep room for confirmation.
export function estimateImageGenerationProgress(elapsedMs: number): number {
  return Math.min(94, Math.floor(8 + 92 * (1 - Math.exp(-elapsedMs / 25000))));
}

export function latestImageGeneration(timeline:ChatMessage['timeline']):ToolTimelineEntry|undefined {
 return [...(timeline??[])].reverse().find((entry):entry is ToolTimelineEntry=>
  entry.kind==='tool'&&entry.toolName==='generate_image'&&entry.status!=='skipped');
}

export function imageGenerationPhase(status:ChatMessage['status'],activity?:ToolTimelineEntry):'generating'|'preview'|null {
 if(status==='streaming'&&activity?.status==='running')return 'generating';
 if((status==='streaming'||status==='completed')&&activity?.status==='success')return 'preview';
 return null;
}
