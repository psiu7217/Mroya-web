import type {AiTask} from '../types/aiTasks';
import {readTasksPayload} from '../api/aiTasks.ts';
import type {WorkspaceSource} from '../types/source.ts';
import type {ChatTimelineEntry} from '../types/mroya.ts';
import type {ConversationSummary,ReportContext,HistoryResponse,MemoriesResponse,MemoryMapResponse,Capabilities} from '../types/api.ts';
import {readReportContext} from '../api/reportContext.ts';
import {ApiError} from '../api/errors.ts';
import {readToolActivity,ToolActivityLifecycle} from '../api/toolActivity.ts';
function settleFailedTimeline(timeline:ChatTimelineEntry[]):ChatTimelineEntry[]{
 return timeline.map(entry=>entry.kind==='tool'&&entry.status==='running'?{...entry,status:'interrupted' as const}:entry);
}
export interface LiveState {
 executingTaskId:string|null;agentTasks:AiTask[];tasksLoading:boolean;tasksError:string|null;tasksNext:number|null;completedTask:AiTask|null;
 loading:boolean;busy:boolean;uncertain:boolean;error:string|null;capabilities:Capabilities|null;
 conversations:ConversationSummary[];activeConversationId:string|null;conversationBusy:boolean;operationUncertain:boolean;
 history:HistoryResponse;memories:MemoriesResponse;map:MemoryMapResponse;
}
export class LiveWorkspaceController {
 private state:LiveState={executingTaskId:null,agentTasks:[],tasksLoading:false,tasksError:null,tasksNext:null,completedTask:null,conversations:[],activeConversationId:null,conversationBusy:false,operationUncertain:false,loading:true,busy:false,uncertain:false,error:null,capabilities:null,history:{conversation_id:'',messages:[],next_before:null},memories:{memories:[],total:0},map:{nodes:[],edges:[]}};
 private taskAbort=new AbortController();private taskGeneration=0;private taskPending=false;
 private tasksOpen=false;private taskTimer:ReturnType<typeof setTimeout>|null=null;
 private taskStatuses=new Map<string,AiTask['status']>();private taskPages=1;
 private taskRefreshAgain=false;
 private taskWake=()=>{if(typeof document==='undefined'||document.visibilityState!=='hidden')void this.refreshTasks();};
 private scheduleTasks(){
  if(this.taskTimer)clearTimeout(this.taskTimer);
  this.taskTimer=null;
  if(!this.taskAbort.signal.aborted&&(this.state.executingTaskId||this.tasksOpen||this.state.agentTasks.some(t=>['pending_confirmation','queued','running','needs_clarification'].includes(t.status))))
   this.taskTimer=setTimeout(this.taskWake,this.state.executingTaskId?1000:10000);
 }
 private acceptTasks(tasks:AiTask[],next=this.state.tasksNext){
  // A list request started before a POST response must not regress its newer DTO.
  tasks=tasks.map(task=>{const current=this.state.agentTasks.find(t=>t.id===task.id);
   return current&&Date.parse(current.updatedAt)>Date.parse(task.updatedAt)?current:task;});
  let completedTask=this.state.completedTask;
  for(const task of tasks){
   const previous=this.taskStatuses.get(task.id);
   if(previous&&previous!=='completed'&&task.status==='completed')completedTask=task;
   this.taskStatuses.set(task.id,task.status);
  }
  this.set({agentTasks:tasks,tasksNext:next,completedTask});
 }
 async refreshTasks(){
  if(!this.source.agentTasks||this.taskAbort.signal.aborted)return;
  if(this.taskPending){this.taskRefreshAgain=true;return;}
  const generation=this.taskGeneration;this.taskPending=true;this.set({tasksLoading:true});
  try{
   let tasks:AiTask[]=[],offset=0,next:number|null=null;
   for(let page=0;page<this.taskPages;page++){
    const result=await this.source.agentTasks(offset,this.taskAbort.signal);
    if(generation!==this.taskGeneration)return;
    tasks.push(...result.tasks);next=result.nextOffset;
    if(next===null)break;offset=next;
   }
   // Loaded active tasks can move beyond the loaded page window as new tasks arrive.
   // Read those canonical IDs so polling never loses an unfinished task.
   const ids=new Set(tasks.map(t=>t.id));
   for(const task of this.state.agentTasks){
    if(!ids.has(task.id)&&['pending_confirmation','queued','running','needs_clarification'].includes(task.status)&&this.source.agentTask){
     tasks.push(await this.source.agentTask(task.id,this.taskAbort.signal));
     if(generation!==this.taskGeneration)return;
    }
   }
   this.acceptTasks([...new Map(tasks.map(t=>[t.id,t])).values()],next);this.set({tasksError:null});
  }catch(error){
   if(generation!==this.taskGeneration)return;
   if(error instanceof ApiError&&error.status===401){this.stop();this.expired();return;}
   this.set({tasksError:error instanceof Error?error.message:'Не удалось загрузить задачи'});
  }finally{
   if(generation===this.taskGeneration){this.taskPending=false;this.set({tasksLoading:false});
    if(this.taskRefreshAgain){this.taskRefreshAgain=false;void this.refreshTasks();}else this.scheduleTasks();
   }
  }
 }
 async executeTask(id:string){
  if(!this.source.executeAgentTask||this.taskAbort.signal.aborted||this.state.executingTaskId
   ||this.state.agentTasks.some(t=>t.status==='running')||this.state.agentTasks.find(t=>t.id===id)?.status!=='queued')return;
  const generation=this.taskGeneration;
  this.set({executingTaskId:id,tasksError:null});
  void this.refreshTasks();
  try{
   const task=await this.source.executeAgentTask(id,this.taskAbort.signal);
   if(generation!==this.taskGeneration)return;
   this.acceptTasks(this.state.agentTasks.map(t=>t.id===id?task:t));
  }catch(error){
   if(generation!==this.taskGeneration)return;
   if(error instanceof ApiError&&error.status===401){this.stop();this.expired();return;}
   this.set({tasksError:'Не удалось получить подтверждение запуска. Проверяем состояние задачи; повторный запуск не отправляется.'});
   await this.taskDetails(id);
  }finally{
   if(generation===this.taskGeneration){this.set({executingTaskId:null});void this.refreshTasks();}
  }
 }
 moreTasks=async()=>{if(this.taskPending||this.state.tasksNext===null)return;this.taskPages++;await this.refreshTasks();};
 openTasks=()=>{this.tasksOpen=true;void this.refreshTasks();};
 closeTasks=()=>{this.tasksOpen=false;this.scheduleTasks();};
 dismissTask=()=>this.set({completedTask:null});
 async taskDetails(id:string){
  if(!this.source.agentTask||this.taskAbort.signal.aborted||this.taskPending)return;
  const generation=this.taskGeneration;
  try{const task=await this.source.agentTask(id,this.taskAbort.signal);if(generation===this.taskGeneration){
   this.acceptTasks(this.state.agentTasks.map(t=>t.id===id?task:t));this.scheduleTasks();
  }}catch(error){if(generation===this.taskGeneration){if(error instanceof ApiError&&error.status===401){this.stop();this.expired();}else this.set({tasksError:error instanceof Error?error.message:'Не удалось загрузить задачу'});}}
 }
 private mergeTask(task:AiTask){
  // Chat cards and drawer rows reconcile against the same canonical row.
  if(this.state.agentTasks.some(t=>t.id===task.id))this.acceptTasks(this.state.agentTasks.map(t=>t.id===task.id?task:t));
 }
 /** Canonical GET used by Chat confirmation cards; the response is the authority. */
 readTask=async(id:string)=>{
  if(!this.source.agentTask)throw new ApiError(400,'invalid_request','Task reads unavailable');
  const generation=this.taskGeneration;
  const task=await this.source.agentTask(id,this.taskAbort.signal);
  if(generation===this.taskGeneration)this.mergeTask(task);
  return task;
 }
 approvePendingTask=async(id:string)=>{
  if(!this.source.approveAgentTask)throw new ApiError(400,'invalid_request','Task confirmation unavailable');
  const generation=this.taskGeneration;
  try{
   const task=await this.source.approveAgentTask(id,this.taskAbort.signal);
   if(generation===this.taskGeneration)this.mergeTask(task);
   return task;
  }catch(error){
   if(error instanceof ApiError&&error.status===401){this.stop();this.expired();}
   throw error;
  }
 }
 revokePendingTask=async(id:string)=>{
  if(!this.source.revokePendingAgentTask)throw new ApiError(400,'invalid_request','Task revocation unavailable');
  const generation=this.taskGeneration;
  try{
   const task=await this.source.revokePendingAgentTask(id,this.taskAbort.signal);
   if(generation===this.taskGeneration)this.mergeTask(task);
   return task;
  }catch(error){
   if(error instanceof ApiError&&error.status===401){this.stop();this.expired();}
   throw error;
  }
 }
 private listeners=new Set<()=>void>();
 private abort=new AbortController();private epoch=0;private turnId:string|null=null;private replyId:string|null=null;
 // Reasoning is request-local. Canonical history has no reasoning field.
 private reasoningByMessage=new Map<string,string>();
 private timelineByMessage=new Map<string,ChatTimelineEntry[]>();
 private failedAttemptsByMessage=new Map<string,ReportContext>();
 private sentHistoryIds=new Set<string>();
 private sentContent='';
 private sendInProgress=false;
 private unconfirmedCreate=false;
 private historyWithReasoning(history:HistoryResponse):HistoryResponse{
  const pending=this.state.history.messages.find(message=>message.id===this.replyId);
  // Bind only an unambiguous new, adjacent canonical user/assistant pair; never by list position alone.
  if((pending?.reasoning||pending?.timeline?.length)&&pending?.status==='completed'&&history.conversation_id===this.state.history.conversation_id){
   const candidates=history.messages.filter((message,index)=>{
    const user=history.messages[index-1];
    return message.role==='assistant'&&message.status==='completed'&&message.content===pending.content
     &&!this.sentHistoryIds.has(message.id)&&user?.role==='user'&&user.content===this.sentContent
     &&!this.sentHistoryIds.has(user.id)&&message.sequence===user.sequence+1;
   });
   if(candidates.length===1){
    if(pending.reasoning)this.reasoningByMessage.set(candidates[0].id,pending.reasoning);
    if(pending.timeline?.length)this.timelineByMessage.set(candidates[0].id,pending.timeline);
   }
  }
  if(pending?.status==='failed'&&(pending.reasoning||pending.timeline?.length)&&history.conversation_id===this.state.history.conversation_id){
   const context=readReportContext(pending.report_context);
   if(context&&context.turn_id===this.turnId){
    const candidates=history.messages.filter(message=>{
     const candidate=readReportContext(message.report_context);
     return message.role==='assistant'&&message.status==='failed'&&candidate?.turn_id===context.turn_id&&candidate.request_trace_id===context.request_trace_id;
    });
    if(candidates.length===1){
     const id=candidates[0].id;
     this.failedAttemptsByMessage.set(id,context);
     if(pending.reasoning)this.reasoningByMessage.set(id,pending.reasoning);
     if(pending.timeline?.length)this.timelineByMessage.set(id,settleFailedTimeline(pending.timeline));
    }else if(!history.messages.some(message=>readReportContext(message.report_context)?.turn_id===context.turn_id)){
     // History may lag the failed stream. Keep its own local reply, without binding to another message.
     return this.state.history;
    }
   }else if(!context){
    // Without a confirmed attempt pair, retain the transient reply instead of guessing a canonical target.
    return this.state.history;
   }
  }
  // A reused canonical message ID is not proof of the same failed attempt after Retry.
  return {...history,messages:history.messages.map(message=>{
   const expected=this.failedAttemptsByMessage.get(message.id),actual=readReportContext(message.report_context);
   if(expected&&(message.role!=='assistant'||message.status!=='failed'||history.conversation_id!==this.state.history.conversation_id
    ||actual?.turn_id!==expected.turn_id||actual.request_trace_id!==expected.request_trace_id)){
    this.failedAttemptsByMessage.delete(message.id);this.reasoningByMessage.delete(message.id);this.timelineByMessage.delete(message.id);
   }
   // Never accept reasoning/timeline supplied by history itself.
   return {...message,reasoning:message.role==='assistant'?this.reasoningByMessage.get(message.id):undefined,timeline:message.role==='assistant'?this.timelineByMessage.get(message.id):undefined};
  })};
 }
 private source:WorkspaceSource;private expired:()=>void;private uuid:()=>string;
 constructor(source:WorkspaceSource,expired:()=>void,uuid:()=>string=()=>crypto.randomUUID()){this.source=source;this.expired=expired;this.uuid=uuid;}
 snapshot=()=>this.state;
 subscribe=(fn:()=>void)=>{this.listeners.add(fn);return()=>{this.listeners.delete(fn);};};
 private set(patch:Partial<LiveState>){this.state={...this.state,...patch};for(const fn of this.listeners)fn();}
 private failure(error:unknown){if(error instanceof ApiError&&error.status===401){this.stop();this.expired();return;}this.set({error:error instanceof Error?error.message:'Workspace unavailable'});}
 start(){
  if(this.taskAbort.signal.aborted)this.taskAbort=new AbortController();
  if(typeof window!=='undefined')window.addEventListener('focus',this.taskWake);
  if(typeof document!=='undefined')document.addEventListener('visibilitychange',this.taskWake);
  void this.refreshTasks();
  if(this.abort.signal.aborted)this.abort=new AbortController();void this.load();}
 stop(){
  this.taskAbort.abort();this.taskGeneration++;this.taskPending=false;this.taskRefreshAgain=false;this.tasksOpen=false;
  if(this.taskTimer)clearTimeout(this.taskTimer);this.taskTimer=null;this.taskStatuses.clear();this.taskPages=1;
  if(typeof window!=='undefined')window.removeEventListener('focus',this.taskWake);
  if(typeof document!=='undefined')document.removeEventListener('visibilitychange',this.taskWake);
  this.set({executingTaskId:null,agentTasks:[],completedTask:null,tasksNext:null,tasksError:null,tasksLoading:false});
  this.abort.abort();this.epoch++;this.reasoningByMessage.clear();this.timelineByMessage.clear();this.failedAttemptsByMessage.clear();this.sentHistoryIds.clear();this.set({history:{...this.state.history,messages:this.state.history.messages.map(message=>({...message,reasoning:undefined,timeline:undefined}))}});}
 private get multi(){return !!this.source.conversations;}
 private resetChat(id:string|null){
  this.abort.abort();this.abort=new AbortController();this.epoch++;
  this.reasoningByMessage.clear();this.timelineByMessage.clear();this.failedAttemptsByMessage.clear();this.sentHistoryIds.clear();
  this.turnId=null;this.replyId=null;this.sentContent='';
  this.set({activeConversationId:id,history:{conversation_id:id??'',messages:[],next_before:null},uncertain:false,error:null});
 }
 private readHistory(before?:number){
  if(!this.multi)return this.source.history(before,this.abort.signal);
  const id=this.state.activeConversationId;
  if(!id)return Promise.resolve({conversation_id:'',messages:[],next_before:null} as HistoryResponse);
  if(!this.source.conversationHistory)throw new Error('Conversation history unavailable');
  return this.source.conversationHistory(id,before,this.abort.signal).then(history=>{
   if(history.conversation_id!==id)throw new ApiError(502,'invalid_response','History belongs to another conversation');return history;
  });
 }
 private async refreshConversations(epoch=this.epoch,selectFallback=!this.unconfirmedCreate){
  if(!this.source.conversations)return;
  let all:ConversationSummary[]=[];let offset=0;
  while(true){
   const page=await this.source.conversations(offset,this.abort.signal);if(epoch!==this.epoch)return;
   for(const item of page.conversations)if(!all.some(c=>c.id===item.id))all.push(item);
   if(page.next_offset===null)break;
   if(page.next_offset<=offset||page.next_offset>100000)throw new ApiError(502,'invalid_response','Invalid conversation cursor');
   offset=page.next_offset;
  }
  // Offset pages can shift during concurrent activity. Refresh the head once,
  // keeping its current metadata/order ahead of the deduplicated older pages.
  if(offset>0){
   const first=await this.source.conversations(0,this.abort.signal);if(epoch!==this.epoch)return;
   const head=first.conversations.filter((item,index,items)=>items.findIndex(c=>c.id===item.id)===index);
   all=first.next_offset===null?head:[...head,...all.filter(item=>!head.some(c=>c.id===item.id))];
  }
  this.set({conversations:all,operationUncertain:false});
  if(!this.state.activeConversationId||!all.some(c=>c.id===this.state.activeConversationId)){
   this.reasoningByMessage.clear();this.timelineByMessage.clear();this.failedAttemptsByMessage.clear();this.sentHistoryIds.clear();
   this.turnId=null;this.replyId=null;this.sentContent='';
   const id=selectFallback?all[0]?.id??null:null;this.set({activeConversationId:id,history:{conversation_id:id??'',messages:[],next_before:null}});
  }
  return all;
 }
 private chatLocked(){
  if(this.sendInProgress||this.state.busy||this.state.uncertain||this.state.conversationBusy||this.state.operationUncertain){this.set({error:'Wait for the current operation or check server status before managing chats.'});return true;}return false;
 }
 async selectConversation(id:string){
  if(!this.multi||this.chatLocked()||id===this.state.activeConversationId)return false;
  if(!this.state.conversations.some(c=>c.id===id))return false;
  this.unconfirmedCreate=false;
  this.resetChat(id);const epoch=this.epoch;this.set({loading:true});
  try{const history=await this.readHistory();if(epoch!==this.epoch)return false;this.set({history:this.historyWithReasoning(history)});return true;}
  catch(error){if(epoch===this.epoch){this.failure(error);if(error instanceof ApiError&&error.status===404)await this.reconcileMissing(epoch);}return false;}
  finally{if(epoch===this.epoch)this.set({loading:false});}
 }
 private async reconcileMissing(epoch:number,preserveSelection=false){
  let conversations:ConversationSummary[]|undefined;
  try{
   conversations=await this.refreshConversations(epoch,!preserveSelection);if(epoch!==this.epoch)return;
   const history=await this.readHistory();if(epoch!==this.epoch)return;
   this.set({history:this.historyWithReasoning(history)});
   return conversations?{conversations,historyLoaded:true}:undefined;
  }catch(error){
   if(epoch!==this.epoch)return;this.failure(error);
   // A history error does not invalidate a successfully reconciled chat list.
   return epoch===this.epoch&&conversations?{conversations,historyLoaded:false}:undefined;
  }
 }
 createConversation=()=>this.manageConversation('create');
 renameConversation=(id:string,title:string)=>this.manageConversation('rename',id,title);
 deleteConversation=(id:string)=>this.manageConversation('delete',id);
 private async manageConversation(action:'create'|'rename'|'delete',id?:string,title?:string,forSend=false):Promise<boolean>{
  if(!this.multi||(!forSend&&this.chatLocked())||this.state.loading)return false;
  if(this.state.operationUncertain){this.set({error:'Check server status before repeating a chat change.'});return false;}
  const epoch=this.epoch;this.set({conversationBusy:true,error:null});
  try{
   let created:ConversationSummary|undefined;
   if(action==='create'){if(!this.source.createConversation)throw new Error('Create unavailable');created=await this.source.createConversation(this.abort.signal);}
   if(action==='rename'){if(!this.source.renameConversation)throw new Error('Rename unavailable');const updated=await this.source.renameConversation(id!,title!,this.abort.signal);if(epoch!==this.epoch)return false;this.set({conversations:this.state.conversations.map(c=>c.id===id?updated:c)});}
   if(action==='delete'){if(!this.source.deleteConversation)throw new Error('Delete unavailable');await this.source.deleteConversation(id!,this.abort.signal);}
   if(epoch!==this.epoch)return false;
   if(created){this.unconfirmedCreate=false;this.resetChat(created.id);this.set({conversations:[created,...this.state.conversations],conversationBusy:false});return true;}
   if(action==='delete'){
    this.set({conversations:this.state.conversations.filter(c=>c.id!==id)});
    if(id===this.state.activeConversationId){this.resetChat(this.state.conversations[0]?.id??null);const current=this.epoch;this.set({loading:true,conversationBusy:false});try{const history=await this.readHistory();if(current===this.epoch)this.set({history:this.historyWithReasoning(history)});}catch(error){if(current===this.epoch)this.failure(error);}finally{if(current===this.epoch)this.set({loading:false});}return true;}
   }
   return true;
  }catch(error){
   if(epoch!==this.epoch)return false;this.failure(error);if(epoch!==this.epoch)return false;
   // Never replay writes automatically. Resolve the server list before another deliberate write.
   if(!(error instanceof ApiError)||error.status>=500||error.status===404){
    if(action==='create')this.unconfirmedCreate=true;
    this.set({operationUncertain:true});
    const confirmed=await this.reconcileMissing(epoch,action==='create'||this.unconfirmedCreate);if(epoch!==this.epoch)return false;
    if(action==='create')this.set({operationUncertain:true,error:'The new chat could not be confirmed. Check server status, then select a chat or use New chat. Your message was not sent.'});
    const row=confirmed?.conversations.find(c=>c.id===id);
    if(confirmed&&(action==='delete'&&!row||action==='rename'&&row?.title===title!.trim())){
     if(confirmed.historyLoaded)this.set({error:null});
     return true;
    }
    if(action!=='create'&&confirmed?.historyLoaded)this.set({error:'The chat change was not confirmed. Review the refreshed server list before trying again.'});
   }
   return false;
  }finally{if(epoch===this.epoch)this.set({conversationBusy:false});}
 }
 async load(){
  const epoch=this.epoch;this.set({loading:true,error:null});
  try {
   const capabilities=await this.source.capabilities(this.abort.signal);if(epoch!==this.epoch)return;
   this.set({capabilities});
   const results=await Promise.allSettled([capabilities.chat===true?(async()=>{await this.refreshConversations(epoch);if(epoch!==this.epoch)return this.state.history;return this.readHistory();})():Promise.resolve(this.state.history),capabilities.memory_read===true?this.source.memories({limit:25},this.abort.signal):Promise.resolve(this.state.memories),capabilities.memory_read===true?this.source.map(this.abort.signal):Promise.resolve(this.state.map)]);
   if(epoch!==this.epoch)return;
   for(const result of results)if(result.status==='rejected'&&result.reason instanceof ApiError&&result.reason.status===401){this.failure(result.reason);return;}
   if(results[0].status==='fulfilled')this.set({history:this.historyWithReasoning(results[0].value)});
   else if(this.multi&&results[0].reason instanceof ApiError&&results[0].reason.status===404)await this.reconcileMissing(epoch);
   if(results[1].status==='fulfilled')this.set({memories:results[1].value});
   if(results[2].status==='fulfilled')this.set({map:results[2].value});
   const errors=results.filter(r=>r.status==='rejected').map(r=>(r as PromiseRejectedResult).reason);
   if(errors.length)this.failure(errors[0]);
  }catch(error){if(epoch===this.epoch)this.failure(error);}finally{if(epoch===this.epoch)this.set({loading:false});}
 }
 async older(){if(this.state.busy||this.state.loading||!this.state.history.next_before)return;const epoch=this.epoch;this.set({loading:true});try{const page=await this.readHistory(this.state.history.next_before);if(epoch===this.epoch)this.set({history:{...page,messages:[...this.historyWithReasoning(page).messages,...this.state.history.messages].filter((m,i,a)=>a.findIndex(x=>x.id===m.id)===i)}});}catch(error){if(epoch===this.epoch)this.failure(error);}finally{if(epoch===this.epoch)this.set({loading:false});}}
 // Receipt notifications trigger authoritative reads only; never synthesize saved memory from a plan.
 async refreshMemory(){
  if(this.abort.signal.aborted||this.state.capabilities?.memory_read!==true)return;
  const epoch=this.epoch,signal=this.abort.signal;
  try{const [memories,map]=await Promise.all([this.source.memories({limit:25},signal),this.source.map(signal)]);
   if(epoch===this.epoch&&!signal.aborted)this.set({memories,map});
  }catch(error){if(epoch===this.epoch&&!signal.aborted)this.failure(error);}
 }
 async moreMemories(){if(this.state.loading||this.state.busy||this.state.memories.memories.length>=this.state.memories.total)return;const epoch=this.epoch;this.set({loading:true});try{const page=await this.source.memories({limit:25,offset:this.state.memories.memories.length},this.abort.signal);if(epoch===this.epoch)this.set({memories:{...page,memories:[...this.state.memories.memories,...page.memories].filter((m,i,a)=>a.findIndex(x=>x.uuid===m.uuid)===i)}});}catch(error){if(epoch===this.epoch)this.failure(error);}finally{if(epoch===this.epoch)this.set({loading:false});}}
 async send(content:string,onReady?:()=>void):Promise<boolean>{
  if(this.sendInProgress||this.state.busy||this.state.loading||this.state.uncertain||this.state.conversationBusy||this.state.operationUncertain)return false;
  if(this.state.capabilities?.chat!==true){this.set({error:'Chat is unavailable on this server.'});return false;}
  if(!content.trim()||content.length>16000){this.set({error:'Messages must contain 1–16000 characters.'});return false;}
  if(this.multi&&!this.state.activeConversationId&&this.unconfirmedCreate){this.set({error:'Select a chat or use New chat after checking server status. The previous creation was not confirmed; nothing is automatically resent.'});return false;}
  this.sendInProgress=true;
  try{
   if(this.multi&&!this.state.activeConversationId){
    const epoch=this.epoch;
    if(!await this.manageConversation('create',undefined,undefined,true)||this.epoch!==epoch+1||this.abort.signal.aborted)return false;
   }
   await this.sendActive(content,onReady);
   return true;
  }finally{this.sendInProgress=false;}
 }
 // The send lock spans CREATE and dispatch; only a confirmed conversation reaches here.
 private async sendActive(content:string,onReady?:()=>void){
  const epoch=this.epoch,id=this.uuid(),now=new Date().toISOString();this.turnId=null;this.replyId='reply:'+id;this.sentContent=content.trim();this.sentHistoryIds=new Set(this.state.history.messages.map(message=>message.id));
  const messages=[...this.state.history.messages,{id:'pending:'+id,sequence:(this.state.history.messages.at(-1)?.sequence??0)+1,role:'user' as const,content,status:'pending',created_at:now,completed_at:null}];
  this.set({busy:true,error:null,history:{...this.state.history,messages}});
  let answer='',reasoning='',failedActivity=false,completed=false,replyTasks:AiTask[]=[];
  let timeline:ChatTimelineEntry[]=[];let previousEvent='';const toolLifecycle=new ToolActivityLifecycle();
  try {
   onReady?.();
   const send=this.multi?this.source.sendConversation?.bind(this.source,this.state.activeConversationId!):this.source.send.bind(this.source);
   if(!send)throw new Error('Conversation send unavailable');
   await send(content,id,event=>{if(epoch!==this.epoch||this.replyId!=='reply:'+id)return;
    const adjacentReasoning=previousEvent==='reasoning_delta';previousEvent=event.event;
    if(event.event==='trace'&&event.data.turn_status==='failed'&&typeof event.data.assistant_content==='string'){
     failedActivity=true;
     const context=readReportContext(event.data.report_context);
     this.set({history:{...this.state.history,messages:[...messages,{id:'reply:'+id,sequence:messages.at(-1)!.sequence+1,role:'assistant',content:event.data.assistant_content,status:'failed',...(reasoning?{reasoning}:{}),...(timeline.length?{timeline:settleFailedTimeline(timeline)}:{ }),created_at:now,completed_at:null,
      ...(context&&(!this.turnId||context.turn_id===this.turnId)?{report_context:context}:{})}]}});
     return;
    }
    if(event.event==='tool_activity'){
     const data=readToolActivity(event.data),activity=data.activity;
     if('call_id' in activity){
      toolLifecycle.accept(activity);
      const index=timeline.findIndex(entry=>entry.kind==='tool'&&entry.callId===activity.call_id);
      const previous=index>=0&&timeline[index].kind==='tool'?timeline[index]:undefined;
      const entry:ChatTimelineEntry={
       kind:'tool',id:previous?.id??'tool:'+activity.call_id,sequence:previous?.sequence??data.sequence,
       callId:activity.call_id,toolName:activity.tool_name,turnNumber:activity.turn_number,phase:activity.phase,
       toolKind:activity.kind,title:activity.title,description:activity.tool_name,
       status:activity.status==='not_executed'?'skipped':activity.status,
       input:activity.input===null?previous?.input:{format:'json',text:JSON.stringify(activity.input,null,2)},
       output:activity.output===null?undefined:{format:'json',text:JSON.stringify(activity.output,null,2)},
       durationMs:activity.duration_ms??undefined,truncated:activity.truncated||previous?.truncated===true,
      };
      if(index<0)timeline=[...timeline,entry];else timeline=timeline.map((value,i)=>i===index?entry:value);
     }else{
      // Legacy sequence is a local React key, never a fabricated Backend call_id.
      timeline=[...timeline,{kind:'tool',id:'tool:'+data.sequence,sequence:data.sequence,toolKind:activity.kind,title:activity.title,status:activity.status}];
     }
    }
    if(event.event==='reasoning_delta'&&typeof event.data.text==='string'){
     reasoning+=event.data.text;
     const last=timeline.at(-1),turnNumber=event.data.turn_number as number,sequence=event.data.sequence as number;
     if(adjacentReasoning&&last?.kind==='reasoning'&&last.turnNumber===turnNumber)
      timeline=[...timeline.slice(0,-1),{...last,text:last.text+event.data.text}];
     else timeline=[...timeline,{kind:'reasoning',id:'reasoning:'+sequence,sequence,turnNumber,text:event.data.text}];
    }
    if(event.event==='delta'&&typeof event.data.text==='string')answer+=event.data.text;else if(event.event==='replay'&&typeof event.data.content==='string')answer=event.data.content;
    if(event.event==='done')toolLifecycle.complete();
    if(event.event==='done'||event.event==='replay'){
     completed=true;
     // Structured receipts ride the terminal frame; the card renders them verbatim.
     replyTasks=readTasksPayload(event.data.tasks);
     void this.refreshTasks();
    }
    if((answer||reasoning||timeline.length)&&!failedActivity)this.set({history:{...this.state.history,messages:[...messages,{id:'reply:'+id,sequence:messages.at(-1)!.sequence+1,role:'assistant',content:answer,status:completed?'completed':'streaming',created_at:now,completed_at:null,...(reasoning?{reasoning}:{}),...(timeline.length?{timeline}:{}),...(replyTasks.length?{tasks:replyTasks}:{})}]}});
   },{signal:this.abort.signal,onTurn:turnId=>{if(epoch===this.epoch&&this.replyId==='reply:'+id){
     if(this.turnId&&this.turnId!==turnId)throw new ApiError(502,'invalid_stream','Chat turn changed during streaming');
     this.turnId=turnId;
    }}});
   if(epoch===this.epoch){await this.load();this.set({uncertain:false});}
  }catch(error){
   if(epoch!==this.epoch)return;
   // Keep received activity as static failed context; discard any unconfirmed answer delta.
   this.set({history:{...this.state.history,messages:this.state.history.messages.map(message=>message.id===this.replyId?{...message,status:'failed',content:failedActivity?message.content:'',timeline:message.timeline?settleFailedTimeline(message.timeline):undefined}:message)}});
   this.failure(error);if(epoch!==this.epoch)return;
   // A known HTTP rejection/terminal error did not leave an ambiguous running turn.
   const uncertain=!(error instanceof ApiError&&(error.status<500||error.code==='chat_failed'));
   this.set({uncertain,error:uncertain?'The reply was interrupted. Check server status before sending another message.':this.state.error});
   if(uncertain&&this.turnId)await this.reconcileTurn();
   if(!uncertain){try{const history=await this.readHistory();if(epoch===this.epoch)this.set({history:this.historyWithReasoning(history)});}catch(e){if(epoch===this.epoch)this.failure(e);}}
  }finally{if(epoch===this.epoch){this.set({busy:false});void this.refreshTasks();}}
 }
 async recover(){
  if(this.sendInProgress||this.state.busy||this.state.conversationBusy)return;
  await this.reconcileTurn();
 }
 private async reconcileTurn(){
  const epoch=this.epoch;
  try{if(this.state.uncertain&&this.turnId){const turn=await this.source.turn(this.turnId,this.abort.signal);if(epoch!==this.epoch)return;if(turn.turn_status==='failed'){
    const context=readReportContext(turn.report_context);
    let messages=this.state.history.messages.map(message=>{
     if(message.id!==this.replyId)return message;
     const previous=readReportContext(message.report_context);
     const sameAttempt=!previous||(context?.turn_id===previous.turn_id&&context.request_trace_id===previous.request_trace_id);
     const hasActivity=!!message.reasoning||!!message.timeline?.length;
     // GET follows a reused turn's current trace. It cannot prove an unknown original trace.
     const confirmedContext=context?.turn_id===this.turnId&&(previous||!hasActivity)?context:undefined;
     return {...message,status:'failed',content:typeof turn.assistant_content==='string'?turn.assistant_content:message.content,
      reasoning:sameAttempt?message.reasoning:undefined,timeline:sameAttempt&&message.timeline?settleFailedTimeline(message.timeline):undefined,
      report_context:confirmedContext};
    });
    const pending=messages.at(-1);
    if(this.replyId&&context?.turn_id===this.turnId&&typeof turn.assistant_content==='string'&&pending?.id==='pending:'+this.replyId.slice(6)){
     messages=[...messages,{id:this.replyId,sequence:pending.sequence+1,role:'assistant',content:turn.assistant_content,status:'failed',created_at:pending.created_at,completed_at:null,report_context:context}];
    }
    this.set({history:{...this.state.history,messages}});
   }if(turn.turn_status==='completed'){
    const confirmedTasks=readTasksPayload(turn.tasks);
    // The authenticated ChatTurn wins over a local stream/parser failure.
    // Clear the transient failed status before historyWithReasoning reconciles it.
    this.set({error:null,history:{...this.state.history,messages:this.state.history.messages.map(message=>
     message.id===this.replyId?{...message,status:'completed',content:typeof turn.assistant_content==='string'?turn.assistant_content:message.content,report_context:undefined,...(confirmedTasks.length?{tasks:confirmedTasks}:{})}:message)}});
    void this.refreshTasks();
   }if(turn.turn_status==='running'){this.set({error:'The server is still processing this message. Check status again shortly.'});return;}this.set({uncertain:false});}
   await this.load();
   if(epoch===this.epoch&&this.state.uncertain)this.set({error:'The submission could not be confirmed. Review server history and reload the page before starting a new message; nothing is automatically resent.'});
  }catch(error){if(epoch===this.epoch)this.failure(error);}
 }
}
