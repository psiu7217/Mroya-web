import React,{useEffect,useRef,useState} from 'react';
import {Send,Pencil,X,Loader2,CheckCircle2,Clock,AlertCircle,Ban,HelpCircle} from 'lucide-react';
import {tr} from '../i18n/index.ts';
import {ApiError} from '../api/errors.ts';
import {taskTimeRemaining} from '../api/aiTasks.ts';
import type {AiTask,AiTaskStatus} from '../types/aiTasks';

export interface AiTaskConfirmationCardProps {
  /** Task receipts bound to this assistant answer; the first pending status wins. */
  tasks:AiTask[];
  beginReview?:(id:string)=>Promise<AiTask>;
  approveTask?:(id:string)=>Promise<AiTask>;
  revokeTask?:(id:string)=>Promise<AiTask>;
  refreshTask?:(id:string)=>Promise<AiTask>;
  /** Submits the canonical revision message produced from the original description. */
  onEditSubmit:(description:string,comment:string)=>Promise<boolean>|boolean|void;
}

const targetLabels:{[k:string]:string}={memory:'taskTypeMemory',calendar:'taskTypeCalendar',notes:'taskTypeNotes'};

function statusKeys(status:AiTaskStatus):{label:string;tone:string;icon:React.ReactNode}{
  switch(status){
    case 'pending_confirmation':return{label:'taskStatusPending',tone:'text-amber-700 dark:text-amber-400',icon:<Clock className="w-3.5 h-3.5" />};
    case 'queued':return{label:'taskStatusQueued',tone:'text-amber-700 dark:text-amber-400',icon:<Clock className="w-3.5 h-3.5" />};
    case 'running':return{label:'taskStatusRunning',tone:'text-blue-600 dark:text-blue-400',icon:<Loader2 className="w-3.5 h-3.5 animate-spin" />};
    case 'completed':return{label:'taskStatusCompleted',tone:'text-emerald-600 dark:text-emerald-400',icon:<CheckCircle2 className="w-3.5 h-3.5" />};
    case 'failed':return{label:'taskStatusFailed',tone:'text-rose-600 dark:text-rose-400',icon:<AlertCircle className="w-3.5 h-3.5" />};
    case 'needs_clarification':return{label:'taskStatusClarification',tone:'text-amber-800 dark:text-amber-300',icon:<HelpCircle className="w-3.5 h-3.5" />};
    default:return{label:'taskStatusCancelled',tone:'text-[var(--mroya-text-muted)]',icon:<Ban className="w-3.5 h-3.5" />};
  }
}

/** One per-task row inside the answer card; owns countdown + canonical reconciliation. */
function TaskConfirmationRow({task,beginReview,approveTask,revokeTask,refreshTask,onEditSubmit}:{
  task: AiTask;
} & Pick<AiTaskConfirmationCardProps,'beginReview'|'approveTask'|'revokeTask'|'refreshTask'|'onEditSubmit'>){
  const [remaining,setRemaining]=useState<number|null>(()=>taskTimeRemaining(task));
  const [frozen,setFrozen]=useState(false);
  const [busy,setBusy]=useState<'approve'|'revoke'|null>(null);
  const [editing,setEditing]=useState(false);
  const [comment,setComment]=useState('');
  const [sending,setSending]=useState(false);
  const [notice,setNotice]=useState<string|null>(null);
  const taskRef=useRef(task);taskRef.current=task;

  // Rendering is the delivery acknowledgement. Neither polling nor enqueue arms it.
  // Retry a lost ACK idempotently; never consume a window before the answer arrives.
  useEffect(()=>{
    let active=true,timer:ReturnType<typeof setTimeout>|undefined;
    const sync=async()=>{
      const current=taskRef.current;
      try{
        if(current.status==='pending_confirmation'&&!current.confirmDeadlineAt&&beginReview)
          await beginReview(current.id);
        else if(['pending_confirmation','queued','running'].includes(current.status))
          await refreshTask?.(current.id);
      }catch{if(active)setNotice('taskConfirmError');}
      if(active&&taskRef.current.status==='pending_confirmation'&&!taskRef.current.confirmDeadlineAt)
        timer=setTimeout(()=>{void sync();},2000);
    };
    void sync();
    return()=>{active=false;if(timer)clearTimeout(timer);};
  },[task.id,beginReview,refreshTask]);

  useEffect(()=>{
    if(task.status!=='pending_confirmation'||!task.confirmDeadlineAt||frozen)return;
    let active=true,inFlight=false,lastRead=0;
    const tick=()=>{
      const left=taskTimeRemaining(task);
      setRemaining(left);
      if(left===0&&refreshTask&&!inFlight&&Date.now()-lastRead>=1000){
        lastRead=Date.now();inFlight=true;
        refreshTask(task.id).catch(()=>{if(active)setNotice('taskConfirmError');}).finally(()=>{inFlight=false;});
      }
    };
    tick();const timer=setInterval(tick,100);
    return()=>{active=false;clearInterval(timer);};
  },[task.id,task.status,task.confirmDeadlineAt,task.serverClockOffsetMs,frozen,refreshTask]);

  const reconcile=()=>refreshTask?.(task.id).catch(()=>{setNotice('taskConfirmError');});
  const apply=async(action:'approve'|'revoke')=>{
    if(busy||frozen||task.status!=='pending_confirmation'||!task.confirmDeadlineAt)return;
    setBusy(action);setNotice(null);
    try{
      if(action==='approve')await approveTask?.(task.id);else await revokeTask?.(task.id);
      await reconcile();
    }catch(error){
      setNotice(error instanceof ApiError&&error.code==='confirm_window_closed'?'taskWindowClosed':'taskConfirmUnavailable');
      await reconcile();
    }finally{setBusy(null);}
  };

  const startEdit=async()=>{
    if(busy||task.status!=='pending_confirmation'||frozen||!task.confirmDeadlineAt||!revokeTask)return;
    setFrozen(true);setBusy('revoke');setNotice(null);
    try{
      const next=await revokeTask(task.id);
      if(next.status!=='cancelled')throw new ApiError(409,'cancel_not_allowed','Original task was not revoked');
      setEditing(true); // Remains visible while the canonical original is cancelled.
    }catch(error){
      setNotice(error instanceof ApiError&&error.code==='confirm_window_closed'?'taskWindowClosed':'taskConfirmUnavailable');
      const current=await reconcile();
      if(current?.status==='cancelled'){setEditing(true);setNotice(null);}
      else setFrozen(false);
    }finally{setBusy(null);}
  };

  const submitEdit=async()=>{
    const text=comment.trim();
    if(!text||sending)return;
    setSending(true);setNotice(null);
    try{
      const accepted=await onEditSubmit(task.title,text);
      if(accepted!==false){setComment('');setEditing(false);}
    }catch{setNotice('taskConfirmError');}
    finally{setSending(false);}
  };

  return <TaskConfirmationView task={task} remaining={remaining} frozen={frozen} busy={busy}
    editing={editing} comment={comment} sending={sending} notice={notice}
    canApprove={!!approveTask} canRevoke={!!revokeTask} onComment={setComment}
    onSubmit={()=>void submitEdit()} onEdit={()=>void startEdit()}
    onApprove={()=>void apply('approve')} onRevoke={()=>void apply('revoke')}
    onDiscard={()=>{setEditing(false);setComment('');}} />;
}

/** Pure view keeps the editor visible after the original canonical task is cancelled. */
export function TaskConfirmationView({task,remaining=null,frozen=false,busy=null,editing=false,
  comment='',sending=false,notice=null,canApprove=false,canRevoke=false,
  onComment,onSubmit,onEdit,onApprove,onRevoke,onDiscard}:{
  task:AiTask;remaining?:number|null;frozen?:boolean;busy?:'approve'|'revoke'|null;
  editing?:boolean;comment?:string;sending?:boolean;notice?:string|null;
  canApprove?:boolean;canRevoke?:boolean;onComment?:(value:string)=>void;
  onSubmit?:()=>void;onEdit?:()=>void;onApprove?:()=>void;onRevoke?:()=>void;onDiscard?:()=>void;
}){
  const frozenTimer=frozen&&remaining!==null;
  if(task.status!=='pending_confirmation'&&!editing){
    const{label,tone,icon}=statusKeys(task.status);
    return (
      <div className="p-2.5 rounded-[10px] border border-[var(--mroya-divider)] bg-[var(--mroya-surface-muted)]/50 space-y-1">
        <div className="flex items-center gap-1.5 text-[11.5px] font-semibold">
          <span className={`inline-flex items-center gap-1 ${tone}`}>{icon}{tr(label,{ns:'chat'})}</span>
        </div>
        <p className="text-[12.5px] leading-snug text-[var(--mroya-text)]">{task.title}</p>
        {task.status==='completed'&&task.resultSummary&&(
          <p className="text-[12px] leading-snug text-[var(--mroya-text-muted)]">{task.resultSummary}</p>
        )}
        {(task.status==='failed'||task.status==='needs_clarification')&&(task.resultSummary||task.errorMessage)&&(
          <p className="text-[11.5px] leading-snug text-rose-700 dark:text-rose-400">{task.resultSummary||task.errorMessage}</p>
        )}
        {notice&&<p className="text-[11.5px] text-[var(--mroya-text-muted)]">{tr(notice,{ns:'chat'})}</p>}
      </div>
    );
  }
  const seconds=remaining===null?null:Math.ceil(remaining/1000);
  return (
    <div className="p-3 rounded-[10px] border border-amber-500/40 bg-amber-500/5 dark:bg-amber-900/10 space-y-2.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="inline-flex items-center gap-1 text-[12px] font-bold text-amber-700 dark:text-amber-400">
          <Clock className="w-3.5 h-3.5" />
          {tr('taskConfirmTitle',{ns:'chat'})}
        </span>
        <span className="text-[11px] text-[var(--mroya-text-muted)]">{tr(targetLabels[task.target]??'taskTypeOther',{ns:'chat'})}</span>
        {seconds!==null&&!editing&&(
          <span className="ml-auto text-[12.5px] font-semibold tabular-nums text-amber-700 dark:text-amber-400" role="timer" aria-live="off">
            {tr('taskConfirmLeft',{ns:'chat',seconds})}
          </span>
        )}
      </div>
      <p className="text-[13.5px] leading-snug font-medium text-[var(--mroya-text)] break-words">{task.title}</p>
      <p className="text-[11.5px] leading-snug text-[var(--mroya-text-muted)]">{tr('taskConfirmHint',{ns:'chat'})}</p>
      {notice&&<p className="text-[11.5px] leading-snug text-[var(--mroya-text-muted)]">{tr(notice,{ns:'chat'})}</p>}
      {editing?(
        <div className="space-y-2 pt-1 border-t border-amber-500/25">
          <p className="text-[11.5px] leading-snug text-[var(--mroya-text-muted)]">
            <span className="inline-flex items-center gap-1 font-semibold"><Ban className="w-3 h-3" />{tr('taskRevokedOriginal',{ns:'chat'})}</span>
          </p>
          <label className="block text-[11.5px] font-medium text-[var(--mroya-text)]" htmlFor={`task-edit-${task.id}`}>
            {tr('taskEditLabel',{ns:'chat'})}
          </label>
          <textarea id={`task-edit-${task.id}`} value={comment} onChange={event=>onComment?.(event.target.value)} rows={2}
            maxLength={15000}
            placeholder={tr('taskEditPlaceholder',{ns:'chat'})}
            className="w-full px-2.5 py-2 rounded-[8px] text-[13px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] text-[var(--mroya-text)] placeholder:text-[var(--mroya-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--mroya-primary)]" />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onSubmit} disabled={!comment.trim()||sending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[12.5px] font-semibold bg-[var(--mroya-primary)] text-[var(--mroya-on-primary)] disabled:opacity-40 cursor-pointer">
              {sending?<span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />:<Send className="w-3.5 h-3.5" />}
              {sending?tr('taskEditSending',{ns:'chat'}):tr('taskEditSubmit',{ns:'chat'})}
            </button>
            <button type="button" disabled={sending} onClick={onDiscard} className="px-3 py-1.5 text-[12px] text-[var(--mroya-text-muted)]">{tr('taskEditAbandon',{ns:'chat'})}</button>
          </div>
        </div>
      ):(
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onApprove} disabled={busy!==null||frozenTimer||!task.confirmDeadlineAt||!canApprove}
            aria-label={tr('taskConfirmSend',{ns:'chat'})}
            className="relative overflow-hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[12.5px] font-semibold bg-[var(--mroya-primary)] text-[var(--mroya-on-primary)] disabled:opacity-40 cursor-pointer">
            <span aria-hidden="true" className="absolute inset-y-0 left-0 bg-white/20 pointer-events-none transition-[width] duration-100" style={{width:`${Math.min(100,Math.max(0,100-(remaining??15000)/150))}%`}} />
            {busy==='approve'?<span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />:<CheckCircle2 className="w-3.5 h-3.5" />}
            {tr('taskConfirmSend',{ns:'chat'})}
          </button>
          <button type="button" onClick={onEdit} disabled={busy!==null||!task.confirmDeadlineAt||!canRevoke}
            aria-label={tr('taskConfirmEdit',{ns:'chat'})}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[12.5px] font-semibold bg-[var(--mroya-surface-muted)] hover:bg-[var(--mroya-surface-active)] text-[var(--mroya-primary)] disabled:opacity-40 cursor-pointer">
            {busy==='revoke'&&frozen?<span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />:<Pencil className="w-3.5 h-3.5" />}
            {tr('taskConfirmEdit',{ns:'chat'})}
          </button>
          <button type="button" onClick={onRevoke} disabled={busy!==null||frozenTimer||!task.confirmDeadlineAt||!canRevoke}
            aria-label={tr('taskConfirmCancel',{ns:'chat'})}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[12.5px] font-semibold bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-active)] disabled:opacity-40 cursor-pointer">
            {busy==='revoke'&&!frozen?<span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />:<X className="w-3.5 h-3.5" />}
            {tr('taskConfirmCancel',{ns:'chat'})}
          </button>
        </div>
      )}
    </div>
  );
}

export const AiTaskConfirmationCard:React.FC<AiTaskConfirmationCardProps>=({
  tasks,beginReview,approveTask,revokeTask,refreshTask,onEditSubmit,
})=>{
  if(!tasks.length)return null;
  return (
    <div className="space-y-2" role="group" aria-label={tr('taskCardGroup',{ns:'chat'})}>
      {tasks.map(task=>(
        <TaskConfirmationRow key={task.id} task={task} beginReview={beginReview} approveTask={approveTask} revokeTask={revokeTask} refreshTask={refreshTask} onEditSubmit={onEditSubmit} />
      ))}
    </div>
  );
};
