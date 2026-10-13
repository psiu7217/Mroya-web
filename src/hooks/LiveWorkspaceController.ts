import type {WorkspaceSource} from '../types/source.ts';
import type {HistoryResponse,MemoriesResponse,MemoryMapResponse,Capabilities} from '../types/api.ts';
import {ApiError} from '../api/errors.ts';
export interface LiveState {
 loading:boolean;busy:boolean;uncertain:boolean;error:string|null;capabilities:Capabilities|null;
 history:HistoryResponse;memories:MemoriesResponse;map:MemoryMapResponse;
}
export class LiveWorkspaceController {
 private state:LiveState={loading:true,busy:false,uncertain:false,error:null,capabilities:null,history:{conversation_id:'',messages:[],next_before:null},memories:{memories:[],total:0},map:{nodes:[],edges:[]}};
 private listeners=new Set<()=>void>();
 private abort=new AbortController();private epoch=0;private turnId:string|null=null;
 private source:WorkspaceSource;private expired:()=>void;private uuid:()=>string;
 constructor(source:WorkspaceSource,expired:()=>void,uuid:()=>string=()=>crypto.randomUUID()){this.source=source;this.expired=expired;this.uuid=uuid;}
 snapshot=()=>this.state;
 subscribe=(fn:()=>void)=>{this.listeners.add(fn);return()=>{this.listeners.delete(fn);};};
 private set(patch:Partial<LiveState>){this.state={...this.state,...patch};for(const fn of this.listeners)fn();}
 private failure(error:unknown){if(error instanceof ApiError&&error.status===401){this.abort.abort();this.epoch++;this.expired();return;}this.set({error:error instanceof Error?error.message:'Workspace unavailable'});}
 start(){if(this.abort.signal.aborted)this.abort=new AbortController();void this.load();}
 stop(){this.abort.abort();this.epoch++;}
 async load(){
  const epoch=this.epoch;this.set({loading:true,error:null});
  try {
   const capabilities=await this.source.capabilities(this.abort.signal);if(epoch!==this.epoch)return;
   this.set({capabilities});
   const results=await Promise.allSettled([capabilities.chat===true?this.source.history(undefined,this.abort.signal):Promise.resolve(this.state.history),capabilities.memory_read===true?this.source.memories({limit:25},this.abort.signal):Promise.resolve(this.state.memories),capabilities.memory_read===true?this.source.map(this.abort.signal):Promise.resolve(this.state.map)]);
   if(epoch!==this.epoch)return;
   for(const result of results)if(result.status==='rejected'&&result.reason instanceof ApiError&&result.reason.status===401){this.failure(result.reason);return;}
   if(results[0].status==='fulfilled')this.set({history:results[0].value});
   if(results[1].status==='fulfilled')this.set({memories:results[1].value});
   if(results[2].status==='fulfilled')this.set({map:results[2].value});
   const errors=results.filter(r=>r.status==='rejected').map(r=>(r as PromiseRejectedResult).reason);
   if(errors.length)this.failure(errors[0]);
  }catch(error){if(epoch===this.epoch)this.failure(error);}finally{if(epoch===this.epoch)this.set({loading:false});}
 }
 async older(){if(this.state.busy||this.state.loading||!this.state.history.next_before)return;const epoch=this.epoch;this.set({loading:true});try{const page=await this.source.history(this.state.history.next_before,this.abort.signal);if(epoch===this.epoch)this.set({history:{...page,messages:[...page.messages,...this.state.history.messages].filter((m,i,a)=>a.findIndex(x=>x.id===m.id)===i)}});}catch(error){if(epoch===this.epoch)this.failure(error);}finally{if(epoch===this.epoch)this.set({loading:false});}}
 async moreMemories(){if(this.state.loading||this.state.busy||this.state.memories.memories.length>=this.state.memories.total)return;const epoch=this.epoch;this.set({loading:true});try{const page=await this.source.memories({limit:25,offset:this.state.memories.memories.length},this.abort.signal);if(epoch===this.epoch)this.set({memories:{...page,memories:[...this.state.memories.memories,...page.memories].filter((m,i,a)=>a.findIndex(x=>x.uuid===m.uuid)===i)}});}catch(error){if(epoch===this.epoch)this.failure(error);}finally{if(epoch===this.epoch)this.set({loading:false});}}
 async send(content:string){
  if(this.state.busy||this.state.loading||this.state.uncertain)return;
  if(this.state.capabilities?.chat!==true){this.set({error:'Chat is unavailable on this server.'});return;}
  if(!content.trim()||content.length>16000){this.set({error:'Messages must contain 1–16000 characters.'});return;}
  const epoch=this.epoch,id=this.uuid(),now=new Date().toISOString();this.turnId=null;
  const messages=[...this.state.history.messages,{id:'pending:'+id,sequence:(this.state.history.messages.at(-1)?.sequence??0)+1,role:'user' as const,content,status:'pending',created_at:now,completed_at:null}];
  this.set({busy:true,error:null,history:{...this.state.history,messages}});
  let answer='';
  try {
   await this.source.send(content,id,event=>{if(epoch!==this.epoch)return;if(event.event==='delta'&&typeof event.data.text==='string')answer+=event.data.text;else if(event.event==='replay'&&typeof event.data.content==='string')answer=event.data.content;
    if(answer)this.set({history:{...this.state.history,messages:[...messages,{id:'reply:'+id,sequence:messages.at(-1)!.sequence+1,role:'assistant',content:answer,status:'streaming',created_at:now,completed_at:null}]}});
   },{signal:this.abort.signal,onTurn:id=>{this.turnId=id;}});
   if(epoch===this.epoch){await this.load();this.set({uncertain:false});}
  }catch(error){
   if(epoch!==this.epoch)return;
   this.failure(error);if(epoch!==this.epoch)return;
   // A known HTTP rejection/terminal error did not leave an ambiguous running turn.
   const uncertain=!(error instanceof ApiError&&(error.status<500||error.code==='chat_failed'));
   this.set({uncertain,error:uncertain?'The reply was interrupted. Check server status before sending another message.':this.state.error});
   if(!uncertain){try{const history=await this.source.history(undefined,this.abort.signal);if(epoch===this.epoch)this.set({history});}catch(e){if(epoch===this.epoch)this.failure(e);}}
  }finally{if(epoch===this.epoch)this.set({busy:false});}
 }
 async recover(){
  if(this.state.busy)return;
  const epoch=this.epoch;
  try{if(this.state.uncertain&&this.turnId){const turn=await this.source.turn(this.turnId,this.abort.signal);if(epoch!==this.epoch)return;if(turn.turn_status==='running'){this.set({error:'The server is still processing this message. Check status again shortly.'});return;}this.set({uncertain:false});}
   await this.load();
   if(epoch===this.epoch&&this.state.uncertain)this.set({error:'The submission could not be confirmed. Review server history and reload the page before starting a new message; nothing is automatically resent.'});
  }catch(error){if(epoch===this.epoch)this.failure(error);}
 }
}
