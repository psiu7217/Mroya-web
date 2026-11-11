import React from 'react';
import type {ChatTimelineEntry} from '../types/mroya';
import {ModelReasoningBlock} from './ModelReasoningBlock';
import {ToolActivityBlock} from './ToolActivityBlock';

function publicFacts(text:string):string[]{
 try{
  const data=JSON.parse(text) as {facts?:unknown;entities?:unknown};
  const facts=(rows:unknown):string[]=>Array.isArray(rows)?rows.slice(0,4).flatMap(row=>{
   if(!row||typeof row!=='object')return [];
   const r=row as Record<string,unknown>;
   const parts=[r.subject,r.predicate,r.value].filter((v):v is string=>typeof v==='string'&&v.length>0);
   return parts.length? [parts.join(' · ')]:[];
  }):[];
  return [...facts(data?.facts),...(Array.isArray(data?.entities)?data.entities.slice(0,4).flatMap((e:unknown)=>
   e&&typeof e==='object'?facts((e as Record<string,unknown>).facts):[]):[])];
 }catch{return [];}
}

export function ChatActivityTimeline({entries,isStreaming=false,technical=true}:{entries:ChatTimelineEntry[];isStreaming?:boolean;technical?:boolean}){
 if(!technical)return <div className="space-y-1" role="status">{entries.filter(entry=>entry.kind==='tool').map(entry=>
  <div key={entry.id} className="text-xs text-[var(--mroya-text-muted)]"><p>{entry.title}</p>
   {entry.output?.format==='json'&&publicFacts(entry.output.text).map((fact,index)=><p key={index}>{fact}</p>)}
  </div>)}</div>;
 return <div className="w-full min-w-0 space-y-2">
  {entries.map((entry,index)=>entry.kind==='tool'
   ?<ToolActivityBlock key={entry.id} activity={entry}/>
   :<ModelReasoningBlock key={entry.id} reasoning={entry.text} isStreaming={isStreaming&&index===entries.length-1} defaultExpanded/>)}
 </div>;
}
