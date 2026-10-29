import React,{useEffect,useState} from 'react';
import {Sparkles,X,Clock,Loader2,CheckCircle2,AlertCircle,HelpCircle,Ban} from 'lucide-react';
import type {AiTask,AiTaskStatus} from '../types/aiTasks';
import {tr} from '../i18n/index.ts';
import {currentLocale} from '../i18n/format';
import {taskGroup,reviewQuestions} from '../hooks/aiTaskPresentation';

export interface AiTasksDrawerProps {
 isOpen:boolean;onClose:()=>void;tasks:AiTask[];loading?:boolean;error?:string|null;hasMore?:boolean;
 onRefresh?:()=>void;onMore?:()=>void;onDetails?:(id:string)=>void;highlightTaskId?:string|null;
 executingTaskId?:string|null;onExecute?:(id:string)=>void;
 cancellingTaskId?:string|null;onCancel?:(id:string)=>void;
 decidingTaskId?:string|null;onDecision?:(id:string,action:'accept'|'reject'|'comment'|'retry',comment?:string)=>Promise<boolean>;
}
export type CompactTab='active'|'completed'|'issues';
const active=(task:AiTask)=>['awaiting_review','pending_confirmation','queued','running','needs_clarification'].includes(task.status);
const label=(key:string,options={})=>tr(key,{ns:'chat',...options});
function badge(status:AiTaskStatus){
 const key={awaiting_review:'taskReviewWaiting',pending_confirmation:'taskStatusPending',queued:'taskStatusQueued',running:'taskStatusRunning',completed:'taskStatusCompleted',failed:'taskStatusFailed',needs_clarification:'taskStatusClarification',cancelled:'taskStatusCancelled'}[status];
 const Icon=status==='running'?Loader2:status==='completed'?CheckCircle2:status==='failed'?AlertCircle:status==='cancelled'?Ban:status==='needs_clarification'?HelpCircle:Clock;
 return <span className={`inline-flex items-center gap-1 text-[11.5px] font-semibold ${status==='failed'?'text-rose-600':status==='completed'?'text-emerald-600':'text-[var(--mroya-primary)]'}`}><Icon className={`w-3.5 h-3.5 ${status==='running'?'animate-spin':''}`}/>{label(key)}</span>;
}
export function ReviewActions({task,busy,onDecision,editing,comment,onEdit,onComment}:{task:AiTask;busy:boolean;onDecision:NonNullable<AiTasksDrawerProps['onDecision']>;editing:boolean;comment:string;onEdit:(value:boolean)=>void;onComment:(value:string)=>void}){
 const act=async(action:'accept'|'reject'|'comment'|'retry')=>{
  try{
   const accepted=await onDecision(task.id,action,action==='comment'?comment.trim():undefined);
   if(accepted){onComment('');onEdit(false);}
  }catch{/* Preserve the draft until the server confirms the action. */}
 };
 return <div className="space-y-2 pt-2 border-t border-[var(--mroya-divider)]">
  <div className="flex flex-wrap gap-2">
   {!task.needsClarification&&task.reviewActions?.includes('accept')&&<button type="button" disabled={busy} onClick={()=>void act('accept')} className="px-3 py-1.5 rounded-lg bg-[var(--mroya-primary)] text-[var(--mroya-on-primary)] text-xs font-semibold disabled:opacity-40">{label(task.taskKind==='calendar_review'?'taskStudy':'taskSave')}</button>}
   {task.reviewActions?.includes('comment')&&<button type="button" disabled={busy} onClick={()=>onEdit(!editing)} aria-expanded={editing} className="px-3 py-1.5 rounded-lg border border-[var(--mroya-divider)] text-xs text-[var(--mroya-primary)] disabled:opacity-40">{label(task.taskKind==='calendar_review'?'taskExplain':task.needsClarification?'taskAnswer':'taskCorrect')}</button>}
   {task.reviewActions?.includes('reject')&&<button type="button" disabled={busy} onClick={()=>void act('reject')} className="px-3 py-1.5 rounded-lg border border-[var(--mroya-divider)] text-xs disabled:opacity-40">{label('taskSkip')}</button>}
   {task.status==='failed'&&task.reviewActions?.includes('retry')&&<button type="button" disabled={busy} onClick={()=>void act('retry')} className="px-3 py-1.5 rounded-lg bg-[var(--mroya-primary)] text-[var(--mroya-on-primary)] text-xs font-semibold disabled:opacity-40">{label('taskRetry')}</button>}
  </div>
  {editing&&<form onSubmit={event=>{event.preventDefault();void act('comment');}} className="space-y-2">
   <label className="block text-xs">{label(task.needsClarification?'taskAnswerLabel':'taskCommentLabel')}<textarea maxLength={2000} rows={3} disabled={busy} value={comment} onChange={event=>onComment(event.target.value)} className="mt-1 w-full p-2 rounded-lg border border-[var(--mroya-divider)] bg-[var(--mroya-surface)] text-[var(--mroya-text)]"/></label>
   <button type="submit" disabled={busy||!comment.trim()||!task.reviewActions?.includes('comment')} className="px-3 py-1.5 rounded-lg bg-[var(--mroya-primary)] text-[var(--mroya-on-primary)] text-xs disabled:opacity-40">{label(task.taskKind==='calendar_review'?'taskStudyWithComment':'taskSendAnswer')}</button>
  </form>}
 </div>;
}
export const AiTasksDrawer:React.FC<AiTasksDrawerProps>=({isOpen,onClose,tasks,loading,error,hasMore,onRefresh,onMore,highlightTaskId,executingTaskId,onExecute,cancellingTaskId,onCancel,decidingTaskId,onDecision})=>{
 const [tab,setTab]=useState<CompactTab>('active');
 const [drafts,setDrafts]=useState<Record<string,{editing:boolean;comment:string}>>({});
 const updateDraft=(id:string,patch:Partial<{editing:boolean;comment:string}>)=>setDrafts(old=>({...old,[id]:{...(old[id]??{editing:false,comment:''}),...patch}}));
 useEffect(()=>{if(!isOpen)return;const key=(event:KeyboardEvent)=>{if(event.key==='Escape')onClose();};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[isOpen,onClose]);
 useEffect(()=>{const task=tasks.find(t=>t.id===highlightTaskId);if(task)setTab(task.status==='completed'?'completed':['failed','cancelled'].includes(task.status)?'issues':'active');},[highlightTaskId,isOpen]);
 if(!isOpen)return null;
 const counts={active:tasks.filter(active).length,completed:tasks.filter(t=>t.status==='completed').length,issues:tasks.filter(t=>['failed','cancelled'].includes(t.status)).length};
 const rows=tasks.filter(t=>tab==='active'?active(t):tab==='completed'?t.status==='completed':['failed','cancelled'].includes(t.status));
 return <div role="dialog" aria-modal="true" aria-label={label('taskPanelTitle')} className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-[1px]">
  <div className="fixed inset-0" onClick={onClose} aria-hidden="true"/>
  <div className="relative z-10 w-full sm:max-w-[420px] h-full bg-[var(--mroya-surface)] border-l border-[var(--mroya-divider)] shadow-[var(--mroya-shadow-elevated)] flex flex-col min-h-0">
   <header className="px-4 py-3 border-b border-[var(--mroya-divider)] space-y-3 shrink-0">
    <div className="flex justify-between items-center"><h2 className="inline-flex items-center gap-2 text-[15px] font-semibold"><Sparkles className="w-4 h-4 text-[var(--mroya-brand-honey)]"/>{label('taskPanelTitle')}</h2><button type="button" onClick={onClose} aria-label={tr('close',{ns:'common'})} className="p-1.5"><X className="w-4 h-4"/></button></div>
    <div className="flex flex-wrap gap-1">{(['active','completed','issues'] as const).map(value=><button key={value} type="button" onClick={()=>setTab(value)} className={`px-3 py-1 rounded-full text-[11.5px] font-semibold ${tab===value?'bg-[var(--mroya-surface-active)]':'text-[var(--mroya-text-muted)]'}`}>{label(value==='active'?'taskTabActive':value==='completed'?'taskTabCompleted':'taskTabIssues')} ({counts[value]})</button>)}</div>
   </header>
   <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5 min-h-0">
    {error&&<p role="alert" className="text-xs text-rose-600">{label('taskPanelError')} <button type="button" onClick={onRefresh} className="underline">{tr('refresh',{ns:'common'})}</button></p>}
    {loading&&tasks.length===0&&<p role="status" className="text-xs">{tr('loading',{ns:'common'})}</p>}
    {!rows.length&&!loading&&<p className="py-12 text-center text-xs text-[var(--mroya-text-muted)]">{label('taskEmpty')}</p>}
    {(tab==='active'?(['answer','suggestions','working'] as const).map(group=>({group,items:rows.filter(task=>taskGroup(task)===group)})):[{group:null,items:rows}]).filter(section=>section.items.length).map(section=><section key={section.group??tab} className="space-y-2.5">
     {section.group&&<h3 className="pt-2 text-xs font-semibold text-[var(--mroya-text-muted)]">{label({answer:'taskGroupAnswer',suggestions:'taskGroupSuggestions',working:'taskGroupWorking'}[section.group])} ({section.items.length})</h3>}
    {section.items.map(task=>{
     const canCancel=['queued','needs_clarification'].includes(task.status)&&task.canCancel===true&&!!onCancel;
     const result=task.resultCode?label({no_new_information:'taskNoInformation',analysis_complete:'taskAnalysisComplete',memory_saved:'taskMemorySaved'}[task.resultCode]):task.resultSummary;
     return <article key={task.id} className={`p-3 rounded-xl border space-y-2 text-[13px] shadow-2xs ${['awaiting_review','needs_clarification'].includes(task.status)?'border-amber-500/40 bg-amber-500/5':'border-[var(--mroya-divider)] bg-[var(--mroya-surface)]'}`}>
      <div className="flex justify-between items-start gap-3">{badge(task.status)}{canCancel&&<button type="button" onClick={()=>onCancel?.(task.id)} disabled={!!cancellingTaskId||executingTaskId===task.id} className="shrink-0 min-h-9 px-3 py-1.5 rounded-lg border border-rose-500/40 bg-rose-500/5 text-rose-700 dark:text-rose-300 text-xs font-semibold disabled:opacity-40">{label(cancellingTaskId===task.id?'taskCancelling':'taskConfirmCancel')}</button>}</div>
      {task.taskKind&&task.taskKind!=='chat'&&<p className="text-[11.5px] text-[var(--mroya-text-muted)]">{label(task.taskKind==='calendar_review'?'taskStudyKind':'taskSaveKind')}</p>}
      <p className="font-semibold leading-snug break-words">{task.taskKind&&task.taskKind!=='chat'?task.eventTitle||label('taskCalendarEvent'):task.title==='Calendar'?label('taskCalendarEvent'):task.title}</p>
      {task.eventDate&&<p className="text-xs text-[var(--mroya-text-muted)]">{new Intl.DateTimeFormat(currentLocale(),{dateStyle:'long',timeZone:'UTC'}).format(new Date(task.eventDate+'T12:00:00Z'))}</p>}
      {task.taskKind==='calendar_review'&&task.status==='awaiting_review'&&<p className="text-xs text-[var(--mroya-text-muted)]">{label('taskStudyDescription')}</p>}
      {task.taskKind==='memory_proposal'&&task.status==='awaiting_review'&&<>
       <p className="text-xs text-[var(--mroya-text-muted)]">{label(task.needsClarification?'taskClarifyDescription':'taskFactsDescription')}</p>
       {task.needsClarification?<div className="p-3 rounded-lg bg-[var(--mroya-surface-active)] space-y-2">{reviewQuestions(task).map((question,index)=><p key={index} className="text-[13px] font-medium leading-relaxed break-words">{question}</p>)}</div>:null}
      </>}
      {task.facts?.length?<ul className="space-y-1.5 pl-4 list-disc">{task.facts.map((fact,index)=><li key={index} className="text-xs leading-relaxed break-words">{fact}</li>)}</ul>:null}
      {task.reviewPhase==='answer_processing'&&<p role="status" className="text-xs text-[var(--mroya-primary)]">{label('taskAnswerProcessing')}</p>}
      {task.status==='failed'?<p className="text-xs text-rose-600">{label('taskFriendlyFailure')}</p>:result?<p className="text-xs text-[var(--mroya-text-muted)] leading-snug">{result.replace(/\s*\[[^\]]+\]\s*$/,'')}</p>:task.status==='needs_clarification'?<p className="text-xs text-[var(--mroya-text-muted)]">{label('taskFriendlyClarification')}</p>:null}
      {(task.reviewActions?.length||drafts[task.id]?.editing)&&onDecision?<ReviewActions task={task} busy={!!decidingTaskId} onDecision={onDecision} editing={drafts[task.id]?.editing??false} comment={drafts[task.id]?.comment??''} onEdit={editing=>updateDraft(task.id,{editing})} onComment={comment=>updateDraft(task.id,{comment})}/>:null}
      {task.status==='queued'&&!task.confirmDeadlineAt&&(!task.taskKind||task.taskKind==='chat')&&onExecute&&<button type="button" onClick={()=>onExecute(task.id)} disabled={!!executingTaskId||!!cancellingTaskId||tasks.some(t=>t.status==='running')} className="px-3 py-1.5 rounded-lg bg-[var(--mroya-surface-active)] text-xs disabled:opacity-40">{label('taskExecuteLegacy')}</button>}
     </article>;
    })}</section>)}
    {hasMore&&<button type="button" disabled={loading} onClick={onMore} className="w-full py-2 text-xs text-[var(--mroya-primary)]">{label('taskMore')}</button>}
   </div>
  </div>
 </div>;
};
