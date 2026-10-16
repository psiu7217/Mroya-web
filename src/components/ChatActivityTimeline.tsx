import React from 'react';
import type {ChatTimelineEntry} from '../types/mroya';
import {ModelReasoningBlock} from './ModelReasoningBlock';
import {ToolActivityBlock} from './ToolActivityBlock';

export function ChatActivityTimeline({entries,isStreaming=false}:{entries:ChatTimelineEntry[];isStreaming?:boolean}){
 return <div className="w-full min-w-0 space-y-2">
  {entries.map((entry,index)=>entry.kind==='tool'
   ?<ToolActivityBlock key={entry.id} activity={entry}/>
   :<ModelReasoningBlock key={entry.id} reasoning={entry.text} isStreaming={isStreaming&&index===entries.length-1} defaultExpanded/>)}
 </div>;
}
