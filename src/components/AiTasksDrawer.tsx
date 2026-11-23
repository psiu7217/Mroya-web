import React,{useEffect,useRef,useState} from 'react';
import {ArrowLeft, ChevronRight, RefreshCw, Sparkles,X,Clock,Loader2,CheckCircle2,AlertCircle,HelpCircle,Ban} from 'lucide-react';
import type {AiTask,AiTaskStatus} from '../types/aiTasks';
import {tr} from '../i18n/index.ts';
import {currentLocale} from '../i18n/format';
import {taskGroup,reviewQuestions,needsTaskReview} from '../hooks/aiTaskPresentation';
import {DialogFocus} from './DialogFocus';

export interface AiTasksDrawerProps {
 onReport?:(id:string)=>Promise<void>;
 mobileDetails?:boolean;
 isOpen:boolean;onClose:()=>void;tasks:AiTask[];loading?:boolean;error?:string|null;hasMore?:boolean;
 onRefresh?:()=>void;onMore?:()=>void;onDetails?:(id:string)=>void;highlightTaskId?:string|null;
 executingTaskId?:string|null;onExecute?:(id:string)=>void;
 cancellingTaskId?:string|null;onCancel?:(id:string)=>void;
 decidingTaskId?:string|null;onDecision?:(id:string,action:'accept'|'reject'|'comment'|'retry',comment?:string)=>Promise<boolean>;
}
export type CompactTab='active'|'completed'|'issues';
const active=(task:AiTask)=>!needsTaskReview(task)&&['awaiting_review','pending_confirmation','queued','running','needs_clarification'].includes(task.status);
const issue=(task:AiTask)=>needsTaskReview(task)||['failed','cancelled'].includes(task.status);
const label=(key:string,options={})=>tr(key,{ns:'chat',...options});
export function taskFailureLabel(task:AiTask){
 const key:Record<string,string>={new_entity_candidate_found:'taskDuplicatePerson',confirmed_memory_conflict:'taskFactConflict',memory_context_changed:'taskMemoryChanged',source_unavailable:'taskSourceUnavailable',analysis_unavailable:'taskAnalysisFailed',memory_apply_unavailable:'taskSaveFailed'};
 return label(key[task.errorMessage??'']??'taskFriendlyFailure');
}
function badge(status:AiTaskStatus,task:AiTask){
 const key={awaiting_review:'taskReviewWaiting',pending_confirmation:'taskStatusPending',queued:'taskStatusQueued',running:'taskStatusRunning',completed:'taskStatusCompleted',failed:'taskStatusFailed',needs_clarification:'taskStatusClarification',cancelled:'taskStatusCancelled'}[status];
 const Icon=status==='running'?Loader2:status==='completed'?CheckCircle2:status==='failed'?AlertCircle:status==='cancelled'?Ban:status==='needs_clarification'?HelpCircle:Clock;
 return <span className={`inline-flex items-center gap-1 text-[11.5px] font-semibold ${status==='failed'?'text-[var(--mroya-error)]':status==='completed'?'text-emerald-600':'text-[var(--mroya-primary)]'}`}><Icon className={`w-3.5 h-3.5 ${status==='running'?'animate-spin':''}`}/>{label(needsTaskReview(task)?'taskStatusReview':key)}</span>;
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
   {['failed','cancelled'].includes(task.status)&&task.reviewActions?.includes('retry')&&<button type="button" disabled={busy} onClick={()=>void act('retry')} className="px-3 py-1.5 rounded-lg bg-[var(--mroya-primary)] text-[var(--mroya-on-primary)] text-xs font-semibold disabled:opacity-40">{label('taskRetry')}</button>}
  </div>
  {editing&&<form onSubmit={event=>{event.preventDefault();void act('comment');}} className="space-y-2">
   <label className="block text-xs">{label(task.needsClarification?'taskAnswerLabel':'taskCommentLabel')}<textarea maxLength={2000} rows={3} disabled={busy} value={comment} onChange={event=>onComment(event.target.value)} className="mt-1 w-full p-2 rounded-lg border border-[var(--mroya-divider)] bg-[var(--mroya-surface)] text-[var(--mroya-text)]"/></label>
   <button type="submit" disabled={busy||!comment.trim()||!task.reviewActions?.includes('comment')} className="px-3 py-1.5 rounded-lg bg-[var(--mroya-primary)] text-[var(--mroya-on-primary)] text-xs disabled:opacity-40">{label(task.taskKind==='calendar_review'?'taskStudyWithComment':'taskSendAnswer')}</button>
  </form>}
 </div>;
}
function taskTitle(task:AiTask) {
 return task.taskKind&&task.taskKind!=='chat' ? task.eventTitle||label('taskCalendarEvent')
   : task.title==='Calendar' ? label('taskCalendarEvent') : task.title;
}

export const AiTasksDrawer:React.FC<AiTasksDrawerProps>=({isOpen,onClose,tasks,loading,error,hasMore,onRefresh,onMore,onDetails,highlightTaskId,executingTaskId,onExecute,cancellingTaskId,onCancel,decidingTaskId,onDecision,onReport,mobileDetails=false})=>{
 const [reports,setReports]=useState<Record<string,'sending'|'sent'|'error'>>({});
 const report=async(id:string)=>{if(!onReport||reports[id]==='sending')return;setReports(old=>({...old,[id]:'sending'}));try{await onReport(id);setReports(old=>({...old,[id]:'sent'}));}catch{setReports(old=>({...old,[id]:'error'}));}};
 const [tab,setTab]=useState<CompactTab>('active');
 const [drafts,setDrafts]=useState<Record<string,{editing:boolean;comment:string}>>({});
 const updateDraft=(id:string,patch:Partial<{editing:boolean;comment:string}>)=>setDrafts(old=>({...old,[id]:{...(old[id]??{editing:false,comment:''}),...patch}}));
 const [narrow,setNarrow]=useState(false);
 const compact=mobileDetails&&narrow;
 const [detailId,setDetailId]=useState<string|null>(null);
 const backButton=useRef<HTMLButtonElement>(null);
 const closeButton=useRef<HTMLButtonElement>(null);
 const taskButtons=useRef(new Map<string,HTMLButtonElement>());
 const highlighted=tasks.find(task=>task.id===highlightTaskId);
 const detail=compact?tasks.find(task=>task.id===detailId):undefined;

 useEffect(()=>{
  if(!mobileDetails)return;
  const media=window.matchMedia('(max-width:1023px)');
  const update=()=>setNarrow(media.matches);
  update();
  media.addEventListener('change',update);
  return ()=>media.removeEventListener('change',update);
 },[mobileDetails]);
 useEffect(()=>{
  if(!isOpen){setDetailId(null);return;}
  if(!highlighted)return;
  setTab(highlighted.status==='completed'?'completed':issue(highlighted)?'issues':'active');
  if(compact)setDetailId(highlighted.id);
 },[highlighted?.id,isOpen,compact]);
 useEffect(()=>{
  if(detail)backButton.current?.focus();
 },[detail?.id]);

 if(!isOpen)return null;
 const showDetails=(task:AiTask)=>{setDetailId(task.id);onDetails?.(task.id);};
 const closeDetails=()=>{
  const id=detail?.id;
  setDetailId(null);
  requestAnimationFrame(()=>{(id?taskButtons.current.get(id)??closeButton.current:closeButton.current)?.focus();});
 };
 const counts={active:tasks.filter(active).length,completed:tasks.filter(t=>t.status==='completed').length,issues:tasks.filter(issue).length};
 const rows=tasks.filter(t=>tab==='active'?active(t):tab==='completed'?t.status==='completed':issue(t));
 const sections=detail
  ? [{group:null,items:[detail]}]
  : tab==='active'
   ? (['review','answer','suggestions','working'] as const).map(group=>({group,items:rows.filter(task=>taskGroup(task)===group)}))
   : [{group:null,items:rows}];
 const close=detail?closeDetails:onClose;
 const toolbarButton="grid size-10 shrink-0 place-items-center rounded-full hover:bg-[var(--mroya-surface-muted)] disabled:opacity-45";
 return <DialogFocus role="dialog" aria-modal="true" aria-label={label(detail?'taskDetailTitle':'taskPanelTitle')} onClose={close}
  tabIndex={-1} className="fixed inset-0 z-50 flex justify-end bg-black/45" onClick={event=>{if(event.target===event.currentTarget)onClose();}}>
  <div className={`relative flex h-full min-h-0 w-full flex-col shadow-[var(--mroya-shadow-elevated)] ${compact?'bg-[var(--mroya-bg)]':'border-l border-[var(--mroya-divider)] bg-[var(--mroya-surface)] sm:max-w-[420px]'}`}>
   <header className="shrink-0 border-b border-[var(--mroya-divider)] bg-[var(--mroya-surface)] px-3 sm:px-4">
    <div className="flex min-h-14 items-center gap-2">
     {detail&&<button ref={backButton} type="button" onClick={closeDetails} aria-label={label('taskBackToList')} className={toolbarButton}><ArrowLeft className="size-5" aria-hidden="true"/></button>}
     {!compact&&<Sparkles className="size-4 text-[var(--mroya-brand-honey)]" aria-hidden="true"/>}
     <h2 className="min-w-0 flex-1 truncate text-lg font-semibold">{label(detail?'taskDetailTitle':'taskPanelTitle')}</h2>
     {onRefresh&&<button type="button" onClick={onRefresh} disabled={loading} aria-label={tr('refresh',{ns:'common'})} className={toolbarButton}><RefreshCw className={`size-4 ${loading?'motion-safe:animate-spin':''}`} aria-hidden="true"/></button>}
     {!detail&&<button ref={closeButton} type="button" onClick={onClose} aria-label={tr('close',{ns:'common'})} className={toolbarButton}><X className="size-5" aria-hidden="true"/></button>}
    </div>
    {!detail&&<div className="flex flex-wrap gap-1.5 pb-3">
     {(['active','completed','issues'] as const).map(value=><button key={value} type="button" aria-pressed={tab===value} onClick={()=>setTab(value)}
       className={`min-h-8 rounded-lg border px-2.5 py-1 text-xs font-medium ${tab===value?'border-transparent bg-[var(--mroya-surface-active)]':'border-[var(--mroya-divider)] text-[var(--mroya-text-muted)] hover:bg-[var(--mroya-surface-muted)]'}`}>
       {label(value==='active'?'taskTabActive':value==='completed'?'taskTabCompleted':'taskTabIssues')} ({counts[value]})
     </button>)}
    </div>}
   </header>
   <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-4">
    {error&&<p role="alert" className="text-xs text-[var(--mroya-error)]">{label('taskPanelError')} <button type="button" onClick={onRefresh} className="underline">{tr('refresh',{ns:'common'})}</button></p>}
    {loading&&tasks.length===0&&<p role="status" className="text-xs">{tr('loading',{ns:'common'})}</p>}
    {!detail&&!rows.length&&!loading&&<p className="py-12 text-center text-xs text-[var(--mroya-text-muted)]">{label('taskEmpty')}</p>}
    {sections.filter(section=>section.items.length).map(section=><section key={section.group??tab} className="space-y-2.5">
     {section.group&&<h3 className="pt-2 text-xs font-semibold text-[var(--mroya-text-muted)]">{label({review:'taskGroupReview',answer:'taskGroupAnswer',suggestions:'taskGroupSuggestions',working:'taskGroupWorking'}[section.group])} ({section.items.length})</h3>}
    {section.items.map(task=>{
     const title=taskTitle(task);
     if(compact&&!detail)return <button key={task.id} type="button" onClick={()=>showDetails(task)}
       ref={button=>{if(button)taskButtons.current.set(task.id,button);else taskButtons.current.delete(task.id);}}
       className="flex min-h-16 w-full items-center gap-3 rounded-xl border border-[var(--mroya-divider)] bg-[var(--mroya-surface)] p-3 text-left hover:bg-[var(--mroya-surface-muted)]">
       <span className="min-w-0 flex-1"><span className="block break-words text-sm font-medium">{title}</span>{badge(task.status,task)}</span>
       <ChevronRight className="size-4 shrink-0 text-[var(--mroya-text-muted)]" aria-hidden="true"/>
     </button>;
     const canCancel=['queued','needs_clarification'].includes(task.status)&&task.canCancel===true&&!!onCancel;
     const result=task.resultCode?label({no_new_information:'taskNoInformation',analysis_complete:'taskAnalysisComplete',memory_saved:'taskMemorySaved'}[task.resultCode]):task.resultSummary;
     return <article key={task.id} className={`space-y-2 text-[13px] ${detail?'':'rounded-xl border border-[var(--mroya-divider)] bg-[var(--mroya-surface)] p-3'}`}>
      <div className="flex justify-between items-start gap-3">{badge(task.status,task)}{canCancel&&<button type="button" onClick={()=>onCancel?.(task.id)} disabled={!!cancellingTaskId||executingTaskId===task.id} className="shrink-0 min-h-9 px-3 py-1.5 rounded-lg border border-rose-500/40 bg-rose-500/5 text-rose-700 dark:text-rose-300 text-xs font-semibold disabled:opacity-40">{label(cancellingTaskId===task.id?'taskCancelling':'taskConfirmCancel')}</button>}</div>
      {task.taskKind&&task.taskKind!=='chat'&&<p className="text-[11.5px] text-[var(--mroya-text-muted)]">{label(task.taskKind==='calendar_review'?'taskStudyKind':'taskSaveKind')}</p>}
      <h3 className={`break-words font-semibold leading-snug ${detail?'text-xl':''}`}>{title}</h3>
      {detail&&<p className="text-xs text-[var(--mroya-text-muted)]">{tr({memory:'navMemory',calendar:'navCalendar',notes:'navNotes'}[task.target],{ns:'sidebar'})}</p>}
      {task.eventDate&&<p className="text-xs text-[var(--mroya-text-muted)]">{new Intl.DateTimeFormat(currentLocale(),{dateStyle:'long',timeZone:'UTC'}).format(new Date(task.eventDate+'T12:00:00Z'))}</p>}
      {task.taskKind==='calendar_review'&&task.status==='awaiting_review'&&<p className="text-xs text-[var(--mroya-text-muted)]">{label('taskStudyDescription')}</p>}
      {task.taskKind==='memory_proposal'&&task.status==='awaiting_review'&&<>
       <p className="text-xs text-[var(--mroya-text-muted)]">{label(task.needsClarification?'taskClarifyDescription':'taskFactsDescription')}</p>
       {task.needsClarification?<div className="p-3 rounded-lg bg-[var(--mroya-surface-active)] space-y-2">{reviewQuestions(task).map((question,index)=><p key={index} className="text-[13px] font-medium leading-relaxed break-words">{question}</p>)}</div>:null}
      </>}
      {task.facts?.length?<ul className="space-y-1.5 pl-4 list-disc">{task.facts.map((fact,index)=><li key={index} className="text-xs leading-relaxed break-words">{fact}</li>)}</ul>:null}
      {task.reviewPhase==='answer_processing'&&<p role="status" className="text-xs text-[var(--mroya-primary)]">{label('taskAnswerProcessing')}</p>}
      {task.status==='failed'?<p className="text-xs text-[var(--mroya-error)]">{taskFailureLabel(task)}</p>:result?<p className="text-xs text-[var(--mroya-text-muted)] leading-snug">{result.replace(/\s*\[[^\]]+\]\s*$/,'')}</p>:task.status==='needs_clarification'?<p className="text-xs text-[var(--mroya-text-muted)]">{label('taskFriendlyClarification')}</p>:null}
      {task.status==='needs_clarification'&&(!task.taskKind||task.taskKind==='chat')&&!needsTaskReview(task)&&<p className="text-xs text-[var(--mroya-text-muted)]">{label('taskClarificationUnavailable')}</p>}
      {task.status==='failed'&&task.reviewActions?.includes('retry')&&['new_entity_candidate_found','confirmed_memory_conflict'].includes(task.errorMessage??'')&&<p className="text-xs text-[var(--mroya-text-muted)]">{label('taskRetryReviewHint')}</p>}
      {(task.reviewActions?.length||drafts[task.id]?.editing)&&onDecision?<ReviewActions task={task} busy={!!decidingTaskId} onDecision={onDecision} editing={drafts[task.id]?.editing??false} comment={drafts[task.id]?.comment??''} onEdit={editing=>updateDraft(task.id,{editing})} onComment={comment=>updateDraft(task.id,{comment})}/>:null}
      {onReport&&(!task.taskKind||task.taskKind==='chat')&&['failed','needs_clarification'].includes(task.status)&&<div>{reports[task.id]==='sent'?<p role="status" className="text-xs">{label('taskReportSent')}</p>:<><button type="button" disabled={reports[task.id]==='sending'} onClick={()=>void report(task.id)} className="px-3 py-1.5 rounded-lg border border-[var(--mroya-divider)] text-xs disabled:opacity-40">{label('taskReportProblem')}</button>{reports[task.id]==='error'&&<p role="alert" className="text-xs text-rose-600">{label('taskReportError')}</p>}</>}</div>}
      {task.status==='queued'&&!task.confirmDeadlineAt&&(!task.taskKind||task.taskKind==='chat')&&onExecute&&<button type="button" onClick={()=>onExecute(task.id)} disabled={!!executingTaskId||!!cancellingTaskId||tasks.some(t=>t.status==='running')} className="px-3 py-1.5 rounded-lg bg-[var(--mroya-surface-active)] text-xs disabled:opacity-40">{label('taskExecuteLegacy')}</button>}
     </article>;
    })}</section>)}
    {!detail&&hasMore&&<button type="button" disabled={loading} onClick={onMore} className="w-full py-2 text-xs text-[var(--mroya-primary)]">{label('taskMore')}</button>}
   </div>
  </div>
 </DialogFocus>;
};
