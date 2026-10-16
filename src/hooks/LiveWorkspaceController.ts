import type {WorkspaceSource} from '../types/source.ts';
import type {ChatTimelineEntry} from '../types/mroya.ts';
import type {HistoryResponse,MemoriesResponse,MemoryMapResponse,Capabilities} from '../types/api.ts';
import {readReportContext} from '../api/reportContext.ts';
import {ApiError} from '../api/errors.ts';
import {readToolActivity,ToolActivityLifecycle} from '../api/toolActivity.ts';
function interruptedTools(timeline:ChatTimelineEntry[]):ChatTimelineEntry[]{
 return timeline.filter(entry=>entry.kind==='tool').map(entry=>entry.kind==='tool'&&entry.status==='running'?{...entry,status:'interrupted' as const}:entry);
}
export interface LiveState {
 loading:boolean;busy:boolean;uncertain:boolean;error:string|null;capabilities:Capabilities|null;
 history:HistoryResponse;memories:MemoriesResponse;map:MemoryMapResponse;
}
export class LiveWorkspaceController {
 private state:LiveState={loading:true,busy:false,uncertain:false,error:null,capabilities:null,history:{conversation_id:'',messages:[],next_before:null},memories:{memories:[],total:0},map:{nodes:[],edges:[]}};
 private listeners=new Set<()=>void>();
 private abort=new AbortController();private epoch=0;private turnId:string|null=null;private replyId:string|null=null;
 // Reasoning is request-local. Canonical history has no reasoning field.
 private reasoningByMessage=new Map<string,string>();
 private timelineByMessage=new Map<string,ChatTimelineEntry[]>();
 private sentHistoryIds=new Set<string>();
 private sentContent='';
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
  if(pending?.status==='failed'&&pending.timeline?.length){
   const context=readReportContext(pending.report_context);
   if(context&&context.turn_id===this.turnId){
    const candidates=history.messages.filter(message=>{
     const candidate=readReportContext(message.report_context);
     return message.role==='assistant'&&message.status==='failed'&&candidate?.turn_id===context.turn_id&&candidate.request_trace_id===context.request_trace_id;
    });
    if(candidates.length===1)this.timelineByMessage.set(candidates[0].id,pending.timeline.filter(entry=>entry.kind==='tool'&&entry.phase!=='started'));
   }
  }
  // Ignore any server-supplied reasoning: only local SSE text for a bound message is eligible.
  return {...history,messages:history.messages.map(message=>({...message,reasoning:message.role==='assistant'?this.reasoningByMessage.get(message.id):undefined,timeline:message.role==='assistant'?this.timelineByMessage.get(message.id):undefined}))};
 }
 private source:WorkspaceSource;private expired:()=>void;private uuid:()=>string;
 constructor(source:WorkspaceSource,expired:()=>void,uuid:()=>string=()=>crypto.randomUUID()){this.source=source;this.expired=expired;this.uuid=uuid;}
 snapshot=()=>this.state;
 subscribe=(fn:()=>void)=>{this.listeners.add(fn);return()=>{this.listeners.delete(fn);};};
 private set(patch:Partial<LiveState>){this.state={...this.state,...patch};for(const fn of this.listeners)fn();}
 private failure(error:unknown){if(error instanceof ApiError&&error.status===401){this.stop();this.expired();return;}this.set({error:error instanceof Error?error.message:'Workspace unavailable'});}
 start(){if(this.abort.signal.aborted)this.abort=new AbortController();void this.load();}
 stop(){this.abort.abort();this.epoch++;this.reasoningByMessage.clear();this.timelineByMessage.clear();this.sentHistoryIds.clear();this.set({history:{...this.state.history,messages:this.state.history.messages.map(message=>({...message,reasoning:undefined,timeline:undefined}))}});}
 async load(){
  const epoch=this.epoch;this.set({loading:true,error:null});
  try {
   const capabilities=await this.source.capabilities(this.abort.signal);if(epoch!==this.epoch)return;
   this.set({capabilities});
   const results=await Promise.allSettled([capabilities.chat===true?this.source.history(undefined,this.abort.signal):Promise.resolve(this.state.history),capabilities.memory_read===true?this.source.memories({limit:25},this.abort.signal):Promise.resolve(this.state.memories),capabilities.memory_read===true?this.source.map(this.abort.signal):Promise.resolve(this.state.map)]);
   if(epoch!==this.epoch)return;
   for(const result of results)if(result.status==='rejected'&&result.reason instanceof ApiError&&result.reason.status===401){this.failure(result.reason);return;}
   if(results[0].status==='fulfilled')this.set({history:this.historyWithReasoning(results[0].value)});
   if(results[1].status==='fulfilled')this.set({memories:results[1].value});
   if(results[2].status==='fulfilled')this.set({map:results[2].value});
   const errors=results.filter(r=>r.status==='rejected').map(r=>(r as PromiseRejectedResult).reason);
   if(errors.length)this.failure(errors[0]);
  }catch(error){if(epoch===this.epoch)this.failure(error);}finally{if(epoch===this.epoch)this.set({loading:false});}
 }
 async older(){if(this.state.busy||this.state.loading||!this.state.history.next_before)return;const epoch=this.epoch;this.set({loading:true});try{const page=await this.source.history(this.state.history.next_before,this.abort.signal);if(epoch===this.epoch)this.set({history:{...page,messages:[...this.historyWithReasoning(page).messages,...this.state.history.messages].filter((m,i,a)=>a.findIndex(x=>x.id===m.id)===i)}});}catch(error){if(epoch===this.epoch)this.failure(error);}finally{if(epoch===this.epoch)this.set({loading:false});}}
 async moreMemories(){if(this.state.loading||this.state.busy||this.state.memories.memories.length>=this.state.memories.total)return;const epoch=this.epoch;this.set({loading:true});try{const page=await this.source.memories({limit:25,offset:this.state.memories.memories.length},this.abort.signal);if(epoch===this.epoch)this.set({memories:{...page,memories:[...this.state.memories.memories,...page.memories].filter((m,i,a)=>a.findIndex(x=>x.uuid===m.uuid)===i)}});}catch(error){if(epoch===this.epoch)this.failure(error);}finally{if(epoch===this.epoch)this.set({loading:false});}}
 async send(content:string){
  if(this.state.busy||this.state.loading||this.state.uncertain)return;
  if(this.state.capabilities?.chat!==true){this.set({error:'Chat is unavailable on this server.'});return;}
  if(!content.trim()||content.length>16000){this.set({error:'Messages must contain 1–16000 characters.'});return;}
  const epoch=this.epoch,id=this.uuid(),now=new Date().toISOString();this.turnId=null;this.replyId='reply:'+id;this.sentContent=content.trim();this.sentHistoryIds=new Set(this.state.history.messages.map(message=>message.id));
  const messages=[...this.state.history.messages,{id:'pending:'+id,sequence:(this.state.history.messages.at(-1)?.sequence??0)+1,role:'user' as const,content,status:'pending',created_at:now,completed_at:null}];
  this.set({busy:true,error:null,history:{...this.state.history,messages}});
  let answer='',reasoning='',failedActivity=false,completed=false;
  let timeline:ChatTimelineEntry[]=[];let previousEvent='';const toolLifecycle=new ToolActivityLifecycle();
  try {
   await this.source.send(content,id,event=>{if(epoch!==this.epoch||this.replyId!=='reply:'+id)return;
    const adjacentReasoning=previousEvent==='reasoning_delta';previousEvent=event.event;
    if(event.event==='trace'&&event.data.turn_status==='failed'&&typeof event.data.assistant_content==='string'){
     failedActivity=true;
     const context=readReportContext(event.data.report_context);
     this.set({history:{...this.state.history,messages:[...messages,{id:'reply:'+id,sequence:messages.at(-1)!.sequence+1,role:'assistant',content:event.data.assistant_content,status:'failed',...(timeline.length?{timeline:interruptedTools(timeline)}:{ }),created_at:now,completed_at:null,
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
    if(event.event==='done'||event.event==='replay')completed=true;
    if((answer||reasoning||timeline.length)&&!failedActivity)this.set({history:{...this.state.history,messages:[...messages,{id:'reply:'+id,sequence:messages.at(-1)!.sequence+1,role:'assistant',content:answer,status:completed?'completed':'streaming',created_at:now,completed_at:null,...(reasoning?{reasoning}:{}),...(timeline.length?{timeline}:{})}]}});
   },{signal:this.abort.signal,onTurn:turnId=>{if(epoch===this.epoch&&this.replyId==='reply:'+id){
     if(this.turnId&&this.turnId!==turnId)throw new ApiError(502,'invalid_stream','Chat turn changed during streaming');
     this.turnId=turnId;
    }}});
   if(epoch===this.epoch){await this.load();this.set({uncertain:false});}
  }catch(error){
   if(epoch!==this.epoch)return;
   // Provisional reasoning must not keep a failed/interrupted reply in Thinking/success state.
   this.set({history:{...this.state.history,messages:this.state.history.messages.map(message=>message.id===this.replyId?{...message,status:'failed',reasoning:undefined,timeline:message.timeline?interruptedTools(message.timeline):undefined}:message)}});
   this.failure(error);if(epoch!==this.epoch)return;
   // A known HTTP rejection/terminal error did not leave an ambiguous running turn.
   const uncertain=!(error instanceof ApiError&&(error.status<500||error.code==='chat_failed'));
   this.set({uncertain,error:uncertain?'The reply was interrupted. Check server status before sending another message.':this.state.error});
   if(!uncertain){try{const history=await this.source.history(undefined,this.abort.signal);if(epoch===this.epoch)this.set({history:this.historyWithReasoning(history)});}catch(e){if(epoch===this.epoch)this.failure(e);}}
  }finally{if(epoch===this.epoch)this.set({busy:false});}
 }
 async recover(){
  if(this.state.busy)return;
  const epoch=this.epoch;
  try{if(this.state.uncertain&&this.turnId){const turn=await this.source.turn(this.turnId,this.abort.signal);if(epoch!==this.epoch)return;if(turn.turn_status==='failed'){
    const context=readReportContext(turn.report_context);
    let messages=this.state.history.messages.map(message=>message.id===this.replyId?{...message,status:'failed',content:typeof turn.assistant_content==='string'?turn.assistant_content:message.content,report_context:context?.turn_id===this.turnId?context:undefined}:message);
    const pending=messages.at(-1);
    if(this.replyId&&context?.turn_id===this.turnId&&typeof turn.assistant_content==='string'&&pending?.id==='pending:'+this.replyId.slice(6)){
     messages=[...messages,{id:this.replyId,sequence:pending.sequence+1,role:'assistant',content:turn.assistant_content,status:'failed',created_at:pending.created_at,completed_at:null,report_context:context}];
    }
    this.set({history:{...this.state.history,messages}});
   }if(turn.turn_status==='running'){this.set({error:'The server is still processing this message. Check status again shortly.'});return;}this.set({uncertain:false});}
   await this.load();
   if(epoch===this.epoch&&this.state.uncertain)this.set({error:'The submission could not be confirmed. Review server history and reload the page before starting a new message; nothing is automatically resent.'});
  }catch(error){if(epoch===this.epoch)this.failure(error);}
 }
}
