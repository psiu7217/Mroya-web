import type {EventAnalysisStatus} from '../types/intelligenceApi.ts';
import type {CalendarEvent} from '../types/mroya.ts';
import {tr} from '../i18n/index.ts';
export function canonicalEventId(event:CalendarEvent|null):string|null{return event?.api?(event.api.series_id??event.api.id):null;}
export function eventAnalysisMessages(data:EventAnalysisStatus):string[]{
 const messages:string[]=[];
 if(!data.source.enabled)messages.push(tr('analysisDisabled',{ns:'connections'})+'.');
 if(!data.runtime.worker_enabled)messages.push(tr('workerDisabled',{ns:'connections'}));
 if(!data.runtime.deep_enabled)messages.push(tr('deepAnalysisDisabled',{ns:'connections'}));
 if(!data.runtime.apply_enabled)messages.push(tr('applyDisabled',{ns:'connections'}));
 const p=data.proposal;
 if(p){
  const labels:Record<string,string>={pending:'ruleStatusPending',reanalyzing:'ruleStatusReanalyzing',rejected:'ruleStatusRejected',pending_apply:'ruleStatusPendingApply',applying:'ruleStatusApplying',applied:'ruleStatusApplied',search_pending:'ruleStatusSearchPending',apply_conflict:'ruleStatusConflict',apply_retry:'ruleStatusApplyRetry',apply_error:'ruleStatusApplyError',stale:'ruleStatusStale',error:'ruleStatusError',no_proposal:'ruleStatusNoProposal'};
  messages.push(tr(labels[p.status],{ns:'connections'}));
  const confirmed=!['pending','pending_apply','applying','reanalyzing'].includes(p.status);
  if(confirmed&&p.links_saved)messages.push(tr('memoryLinkSaved',{ns:'connections'}));
  if(confirmed&&p.canonical_saved)messages.push(tr('newFactSaved',{ns:'connections'}));
  if(confirmed&&(p.links_saved||p.canonical_saved)&&!p.search_ready&&p.status!=='search_pending')messages.push(tr('ruleStatusSearchPending',{ns:'connections'}));
 }else if(data.job){
  const labels:Record<string,string>={queued:'ruleStatusQueued',triaging:'ruleStatusTriaging',awaiting_analysis:'ruleStatusAwaitingAnalysis',analyzing:'ruleStatusAnalyzing',analyzed:'ruleStatusAnalyzed',irrelevant:'ruleStatusIrrelevant',skipped:'ruleStatusSkipped',suppressed:'ruleStatusSuppressed',stale:'ruleStatusStale',error:'ruleStatusJobError',analysis_error:'ruleStatusAnalysisError'};messages.push(tr(labels[data.job.status],{ns:'connections'}));
 }else messages.push(tr('noEventProcessingData',{ns:'connections'}));
 return messages;
}
