import type {IntelligenceProposal,IntelligenceCapabilities,IntelligenceRuntime,IntelligenceAction,IntelligenceStatus,JsonValue} from '../types/intelligenceApi.ts';
import type {InboxProposal} from '../types/memoryInbox.ts';
import {tr} from '../i18n/index.ts';
import {formatDate} from '../i18n/format.ts';

const statusKeys:Record<IntelligenceStatus,string>={
 pending:'statusPending',reanalyzing:'statusReanalyzing',rejected:'statusRejected',pending_apply:'statusPendingApply',applying:'statusApplying',
 applied:'statusApplied',search_pending:'statusSearchPending',apply_conflict:'statusConflict',apply_retry:'statusApplyRetry',apply_error:'statusApplyError',
 stale:'statusStale',error:'statusError',no_proposal:'statusNoProposal',
};
export function inboxStatusLabel(status:IntelligenceStatus| string,awaitingSearchUpdate=false):string{
 return tr(awaitingSearchUpdate?'statusAwaitingSearchUpdate':statusKeys[status as IntelligenceStatus]??'statusError',{ns:'memory'});
}

export function inboxActions(p:IntelligenceProposal,c:IntelligenceCapabilities,r:IntelligenceRuntime|null){
 const frozen=['pending_apply','applying','apply_retry','search_pending','applied','apply_error'].includes(p.status)||p.canonical_saved;
 const source=p.source_preview.available,deep=!!r?.worker_enabled&&r.deep_enabled&&c.deep_analysis,apply=!!r?.worker_enabled&&r.apply_enabled&&c.memory_apply;
 return {accept:!frozen&&p.status==='pending'&&source&&apply&&!p.plan.actions.some(a=>a.type==='clarify'||a.type==='skip'),
  reject:!frozen,comment:!frozen&&p.status!=='rejected'&&source&&deep,
  reconsider:!frozen&&p.status==='rejected'&&source&&deep,
  retry:['apply_retry','apply_error','search_pending'].includes(p.status)&&apply};
}

export function runtimeNotice(c:IntelligenceCapabilities,r:IntelligenceRuntime|null){
 if(!r)return tr('runtimeUnconfirmed',{ns:'memory'});
 const messages:string[]=[];
 if(!r.worker_enabled)messages.push(tr('runtimeWorkerDisabled',{ns:'memory'}));
 else {if(!r.deep_enabled||!c.deep_analysis)messages.push(tr('runtimeDeepAnalysisDisabled',{ns:'memory'}));if(!r.apply_enabled||!c.memory_apply)messages.push(tr('runtimeApplyDisabled',{ns:'memory'}));}
 if(!c.auto_link)messages.push(tr('runtimeAutoLinkUnavailable',{ns:'memory'}));
 if(!c.auto_write)messages.push(tr('runtimeAutoWriteUnavailable',{ns:'memory'}));
 return messages.join(' ');
}
function show(value:JsonValue|undefined):string{
 if(value===undefined)return '';
 if(value&&typeof value==='object'&&!Array.isArray(value)){
  if(value.reference==='self')return tr('profileSelf',{ns:'memory'});
  if(value.reference==='existing')return String(value.object_uuid);
  if(value.reference==='new')return String(value.ref);
  if(value.type==='literal')return typeof value.literal_value==='string'?value.literal_value:JSON.stringify(value.literal_value);
 }
 return typeof value==='string'?value:JSON.stringify(value);
}
function actionText(a:IntelligenceAction,p:IntelligenceProposal):string{
 const name=(id:string)=>p.plan.matches.flatMap(m=>m.objects).find(o=>o.object_uuid===id)?.label??id;
 const reason=a.reason??'';
 if(a.type==='link')return tr('actionLinkMemory',{ns:'memory',name:name(a.target!.object_uuid),reason:reason?' — '+reason:''});
 if(a.type==='create_object')return tr('actionCreateObject',{ns:'memory',label:a.entity!.label,kind:a.entity!.kind,reason});
 if(a.type==='clarify')return tr('actionClarify',{ns:'memory',question:a.question});
 if(a.type==='skip')return tr('actionNoChanges',{ns:'memory',reason});
 const s=a.statement!,predicate=s.predicate as {[key:string]:JsonValue};
 const endpoint=(value:JsonValue)=>{const obj=value as {[key:string]:JsonValue};return obj?.reference==='existing'?name(String(obj.object_uuid)):show(value);};
 const prefix=tr(a.type==='revise_fact'?'actionReviseFact':a.type==='add_relation'?'actionAddRelation':'actionAddFact',{ns:'memory'});
 return prefix+endpoint(s.subject)+' — '+show(predicate.label??predicate.key)+' — '+endpoint(s.value)+' — '+reason;
}
export function receiptMessage(p:IntelligenceProposal):string|undefined{
 const links=p.apply?.result.links_saved===true;
 if(p.canonical_saved)return tr(p.search_ready?'receiptSavedSearchReady':'receiptSavedSearchUpdating',{ns:'memory'});
 if(links)return tr('receiptLinkedOnly',{ns:'memory'});
 if(p.status==='applied')return tr('receiptUnconfirmed',{ns:'memory'});
 return undefined;
}
export function proposalPresentation(p:IntelligenceProposal,c:IntelligenceCapabilities,r:IntelligenceRuntime|null):InboxProposal{
 const preview=p.source_preview;
 const recurrence=preview.recurrence?JSON.stringify(preview.recurrence):'';
 const sourceDate=preview.available?[
  preview.date?formatDate(preview.date,{year:'numeric',month:'short',day:'numeric'},'UTC'):undefined,
  preview.time_kind==='all_day'?tr('allDay',{ns:'memory'}):preview.time_kind==='exact'?tr('exactTime',{ns:'memory'}):preview.time_kind,
  recurrence,
 ].filter(Boolean).join(' · '):'';
 return {id:p.id,version:p.version,title:preview.available?preview.title!:tr('sourceUnavailableLabel',{ns:'memory'}),source:'Calendar',sourceLabel:tr('sourceMroyaCalendar',{ns:'memory'}),sourceAvailable:preview.available,
  sourceResourceTitle:preview.available?[preview.calendar_name,preview.title].filter(Boolean).join(' · '):tr('sourceUnavailableLabel',{ns:'memory'}),sourceDate,
  actionProposed:p.plan.actions.map(a=>actionText(a,p)).join('\n'),explanation:p.plan.rationale,
  memoryMatches:p.plan.matches.flatMap(m=>m.objects.map(o=>({id:o.object_uuid,name:o.label??o.object_uuid,relation:[m.mention,o.kind].filter(Boolean).join(' · ')}))),
  status:p.status,statusLabel:inboxStatusLabel(p.status,p.status==='search_pending'&&!p.canonical_saved),resultMessage:receiptMessage(p),statusMessage:p.apply?.code?tr('requestFailed',{ns:'common'}):undefined,
  actions:inboxActions(p,c,r),isConfirmed:p.canonical_saved||p.apply?.result.links_saved===true,
  processingEnabled:!!r?.worker_enabled&&(p.status==='reanalyzing'?r.deep_enabled:r.apply_enabled),
  errorMessage:p.apply?.code?tr('requestFailed',{ns:'common'}):(p.status==='error'?tr('proposalAnalysisIncomplete',{ns:'memory'}):undefined)};
}
