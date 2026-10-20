import {useEffect,useMemo,useRef,useSyncExternalStore} from 'react';
import {ApiError} from '../api/errors.ts';
import type {WorkspaceSource} from '../types/source.ts';
import type {IntelligenceCapabilities,IntelligenceRuntime,IntelligenceProposal,ProposalDecision,DecisionBody,IntelligenceHistory} from '../types/intelligenceApi.ts';
import type {MemoryInboxPresentation,InboxProposal} from '../types/memoryInbox.ts';
import {inboxActions,inboxStatusLabels,proposalPresentation,runtimeNotice} from './inboxAdapters.ts';

type HistoryState={entries:IntelligenceHistory[];next:number|null;loading:boolean;error:string|null};
type Operation={id:string;action:ProposalDecision;body:DecisionBody};
export interface InboxState {
 available:boolean;loading:boolean;loadingMore:boolean;error:string|null;notice:string;
 capabilities:IntelligenceCapabilities|null;runtime:IntelligenceRuntime|null;
 proposals:IntelligenceProposal[];next:number|null;
 histories:Record<string,HistoryState>;busy:ReadonlySet<string>;uncertain:ReadonlySet<string>;errors:Record<string,string>;
}
const initial=():InboxState=>({available:false,loading:false,loadingMore:false,error:null,notice:'',capabilities:null,runtime:null,proposals:[],next:null,histories:{},busy:new Set(),uncertain:new Set(),errors:{}});
const waiting=(p:IntelligenceProposal,r:IntelligenceRuntime|null)=>!!r?.worker_enabled&&((p.status==='reanalyzing'&&r.deep_enabled)||(['pending_apply','applying','apply_retry','search_pending'].includes(p.status)&&r.apply_enabled));
const sort=(rows:IntelligenceProposal[])=>rows.sort((a,b)=>a.updated_at===b.updated_at?(a.id>b.id?-1:a.id<b.id?1:0):(a.updated_at>b.updated_at?-1:1));
const conflictText:Record<string,string>={proposal_version_conflict:'Предложение изменилось. Проверьте актуальную карточку и подтвердите решение заново.',idempotency_conflict:'Ключ запроса уже использован с другим действием. Обновите карточку.',source_revision_conflict:'Источник изменился. Требуется повторный анализ.',source_unavailable:'Источник недоступен.',memory_context_changed:'Память изменилась. Требуется повторная проверка.',apply_in_progress_or_completed:'Применение уже началось или завершено. Дождитесь подтверждённого результата.',new_entity_candidate_found:'Найден возможный существующий объект. Требуется уточнение.',link_identity_ambiguous:'Связь с объектом неоднозначна.',confirmed_memory_conflict:'Предложение конфликтует с подтверждённой памятью.',revision_target_changed:'Изменяемый факт уже изменился.',autonomy_changed:'Настройки автономности изменились.',canonical_context_changed:'Память изменилась во время применения.',proposal_not_approvable:'Это предложение нельзя подтвердить. Добавьте уточнение.',proposal_state_conflict:'Состояние предложения изменилось.',comment_limit_reached:'Достигнут лимит комментариев.'};
export class LiveMemoryInboxController {
 private current=initial();private listeners=new Set<()=>void>();private active=false;private generation=0;private visible=false;
 private reads=new Set<AbortController>();private operations=new Map<string,Operation>();
 private polling=false;private refreshFlight=false;private dataEpoch=0;private historyEpoch=new Map<string,number>();
 private pollTimer:ReturnType<typeof setTimeout>|null=null;private pollCount=0;private pollCursor=0;
 private source:WorkspaceSource;private expired:()=>void;private changed:()=>void;
 readonly scopeKey:string;
 constructor(source:WorkspaceSource,userId:number,expired:()=>void,changed:()=>void=()=>{}){this.changed=changed;this.source=source;this.expired=expired;this.scopeKey='inbox-'+userId+'-'+crypto.randomUUID();}
 snapshot=()=>this.current;
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
 private emit(patch:Partial<InboxState>){if(!this.active)return;this.current={...this.current,...patch};this.listeners.forEach(fn=>fn());}
 start=()=>{this.active=true;};
 stop=()=>{this.active=false;this.generation++;this.dataEpoch++;for(const abort of this.reads)abort.abort();this.reads.clear();this.operations.clear();this.historyEpoch.clear();this.refreshFlight=false;this.polling=false;this.clearTimer();this.current=initial();};
 private clearTimer(){if(this.pollTimer!==null)clearTimeout(this.pollTimer);this.pollTimer=null;}
 setVisible=(visible:boolean)=>{this.visible=visible;if(!visible){this.clearTimer();return;}this.pollCount=0;void this.refresh();};
 private request(){const abort=new AbortController();this.reads.add(abort);return abort;}
 private valid(abort:AbortController,generation:number){return this.active&&!abort.signal.aborted&&this.generation===generation;}
 private expiredError(error:unknown){if(error instanceof ApiError&&error.status===401){this.stop();this.expired();return true;}return false;}
 private message(error:unknown){return error instanceof ApiError?(conflictText[error.code]??(error.status===403?'Проверка сессии/CSRF не пройдена. Повторите действие вручную.':error.status===404?'Предложение или Inbox недоступны.':error.message)): 'Нет подтверждённого ответа сервера. Проверьте подключение и повторите запрос.';}
 private merge(rows:IntelligenceProposal[],base=this.current.proposals){const all=new Map(base.map(p=>[p.id,p]));for(const row of rows){const previous=all.get(row.id);if(!previous||row.version>=previous.version)all.set(row.id,row);}return sort([...all.values()]);}
 private putMany(rows:IntelligenceProposal[],patch:Partial<InboxState>={}){
  const changed=rows.some(p=>{const previous=this.current.proposals.find(old=>old.id===p.id);return previous&&p.version>=previous.version&&p.canonical_saved&&(!previous.canonical_saved||p.search_ready&&!previous.search_ready);});
  this.emit({proposals:this.merge(rows),...patch});if(changed)this.changed();
 }
 private put(p:IntelligenceProposal){this.putMany([p]);}
 refresh=async(more=false)=>{
  if(!this.active||!this.visible||this.refreshFlight)return;
  const s=this.source;if(!s.intelligenceSettings||!s.intelligenceStatus||!s.inboxProposals||!s.inboxProposal||!s.inboxHistory||!s.inboxDecision)return;
  const offset=more?this.current.next:0;if(offset===null)return;
  this.refreshFlight=true;const abort=this.request(),generation=this.generation,epoch=this.dataEpoch;
  this.emit(more?{loadingMore:true}:{loading:true,error:null});
  try{
   const [capabilities,runtime]=await Promise.all([s.intelligenceSettings(abort.signal),s.intelligenceStatus(abort.signal)]);
   if(!this.valid(abort,generation))return;
   this.emit({available:capabilities.inbox,capabilities,runtime,notice:runtimeNotice(capabilities,runtime)});
   if(!capabilities.inbox){this.emit({proposals:[],next:null});return;}
   const page=await s.inboxProposals(offset,abort.signal);
   if(!this.valid(abort,generation)||epoch!==this.dataEpoch)return;
   this.putMany(page.proposals,{next:more||this.current.proposals.length<=50?page.next_offset:this.current.next});
   if(more){const first=await s.inboxProposals(0,abort.signal);if(this.valid(abort,generation)&&epoch===this.dataEpoch)this.putMany(first.proposals);}
  }catch(error){if(this.valid(abort,generation)&&!this.expiredError(error)){
   if(error instanceof ApiError&&error.status===404&&!this.current.capabilities)this.emit({available:false,error:null});
   else this.emit({error:this.message(error),runtime:null,notice:runtimeNotice(this.current.capabilities??{stage:'',inbox:false,deep_analysis:false,memory_apply:false,auto_link:false,auto_write:false},null)});
  }}finally{this.reads.delete(abort);if(this.active&&generation===this.generation){this.refreshFlight=false;this.emit({loading:false,loadingMore:false});this.schedule();}}
 };
 more=()=>{void this.refresh(true);};
 private schedule(){
  this.clearTimer();if(!this.active||!this.visible||!this.current.proposals.some(p=>waiting(p,this.current.runtime)))return;
  if(this.pollCount>=12){this.emit({notice:runtimeNotice(this.current.capabilities!,this.current.runtime)+' Автообновление приостановлено. Нажмите «Обновить Inbox» для проверки результата.'});return;}
  this.pollTimer=setTimeout(()=>{this.pollTimer=null;void this.poll();},5000);
 }
 poll=async()=>{
  if(!this.active||!this.visible||this.polling||this.pollCount>=12)return;this.polling=true;this.clearTimer();this.pollCount++;
  const abort=this.request(),generation=this.generation;
  try{
   const runtime=await this.source.intelligenceStatus!(abort.signal);if(!this.valid(abort,generation))return;
   this.emit({runtime,notice:runtimeNotice(this.current.capabilities!,runtime)});
   const rows=this.current.proposals.filter(p=>waiting(p,runtime));
   // At most ten loaded cards per round; rotate so later loaded pages are not starved.
   const batch=rows.length?Array.from({length:Math.min(10,rows.length)},(_,i)=>rows[(this.pollCursor+i)%rows.length]):[];
   this.pollCursor+=batch.length;
   await Promise.all(batch.map(async p=>{try{const card=await this.source.inboxProposal!(p.id,abort.signal);if(this.valid(abort,generation))this.put(card);}catch(error){if(this.valid(abort,generation)&&!this.expiredError(error))this.emit({errors:{...this.current.errors,[p.id]:this.message(error)}});}}));
  }catch(error){if(this.valid(abort,generation)&&!this.expiredError(error))this.emit({runtime:null,error:this.message(error),notice:runtimeNotice(this.current.capabilities!,null)});}
  finally{this.reads.delete(abort);if(this.active&&generation===this.generation){this.polling=false;this.schedule();}}
 };
 open=async(id:string,more=false)=>{
  if(!this.active||!this.current.proposals.some(p=>p.id===id))return;
  const previous=this.current.histories[id],offset=more?previous?.next:0;if(offset==null)return;
  const historyEpoch=(this.historyEpoch.get(id)??0)+1;this.historyEpoch.set(id,historyEpoch);
  const abort=this.request(),generation=this.generation;
  const valid=()=>this.valid(abort,generation)&&this.historyEpoch.get(id)===historyEpoch;
  this.emit({histories:{...this.current.histories,[id]:{entries:previous?.entries??[],next:previous?.next??null,loading:true,error:null}}});
  try{
   const card=await this.source.inboxProposal!(id,abort.signal);if(!valid())return;this.put(card);
   const history=await this.source.inboxHistory!(id,offset,abort.signal);if(!valid())return;
   const entries=new Map((more?previous?.entries??[]:[]).map(entry=>[entry.version,entry]));for(const h of history.history)entries.set(h.version,h);
   this.emit({histories:{...this.current.histories,[id]:{entries:[...entries.values()].sort((a,b)=>b.version-a.version),next:history.next_offset,loading:false,error:null}}});
  }catch(error){if(valid()&&!this.expiredError(error))this.emit({histories:{...this.current.histories,[id]:{entries:previous?.entries??[],next:previous?.next??null,loading:false,error:this.message(error)}}});}
  finally{this.reads.delete(abort);}
 };
 private cardError(id:string,message:string){this.emit({errors:{...this.current.errors,[id]:message}});}
 decide=async(id:string,action:ProposalDecision,comment?:string):Promise<boolean>=>{
  if(!this.active||this.current.busy.has(id))return false;
  const pending=this.operations.get(id);
  if(pending){this.cardError(id,'Предыдущее действие ещё не подтверждено. Сначала повторите его с исходным ключом.');return false;}
  const card=this.current.proposals.find(p=>p.id===id),cap=this.current.capabilities,runtime=this.current.runtime;
  if(!card||!cap||!inboxActions(card,cap,runtime)[action])return false;
  if(action==='comment'&&(!comment?.trim()||Array.from(comment.trim()).length>2000)){this.cardError(id,'Комментарий должен содержать от 1 до 2000 символов.');return false;}
  const op={id,action,body:{version:card.version,request_id:crypto.randomUUID(),...(action==='comment'?{comment:comment!.trim()}:{})}};
  this.operations.set(id,op);return this.execute(op);
 };
 retry=async(id?:string):Promise<boolean>=>{
  if(!id){this.pollCount=0;await this.refresh();return false;}
  const op=this.operations.get(id);if(op)return this.execute(op);
  const p=this.current.proposals.find(p=>p.id===id);
  if(p&&this.current.capabilities&&inboxActions(p,this.current.capabilities,this.current.runtime).retry)return this.decide(id,'retry');
  await this.open(id);return false;
 };
 private execute=async(op:Operation):Promise<boolean>=>{
  const {id}=op;if(!this.active||this.current.busy.has(id))return false;
  const abort=this.request(),generation=this.generation;this.dataEpoch++;
  const busy=new Set(this.current.busy);busy.add(id);const errors={...this.current.errors};delete errors[id];this.emit({busy,errors});
  try{
   const result=await this.source.inboxDecision!(id,op.action,{...op.body},abort.signal);
   if(!this.valid(abort,generation))return false;
   this.operations.delete(id);const uncertain=new Set(this.current.uncertain);uncertain.delete(id);this.put(result.proposal);this.emit({uncertain});
   if(op.action==='comment'||this.current.histories[id])void this.open(id);
   this.pollCount=0;return true;
  }catch(error){
   if(!this.valid(abort,generation)||this.expiredError(error))return false;
   const uncertain=new Set(this.current.uncertain);
   if(error instanceof ApiError&&[400,404,409].includes(error.status)){
    this.operations.delete(id);uncertain.delete(id);
    this.emit({uncertain});this.cardError(id,this.message(error));
    if(error.status===404){this.emit({proposals:this.current.proposals.filter(p=>p.id!==id),histories:Object.fromEntries(Object.entries(this.current.histories).filter(([key])=>key!==id)),error:this.message(error)});}
    else {try{const latest=await this.source.inboxProposal!(id,abort.signal);if(this.valid(abort,generation))this.put(latest);}catch(readError){if(this.valid(abort,generation)&&!this.expiredError(readError))this.cardError(id,this.message(error)+' '+this.message(readError));}}
   }else{uncertain.add(id);this.emit({uncertain});this.cardError(id,this.message(error)+' Повторите исходное действие, чтобы получить подтверждение.');}
   return false;
  }finally{
   this.reads.delete(abort);if(this.active&&generation===this.generation){const busy=new Set(this.current.busy);busy.delete(id);this.emit({busy});this.schedule();}
  }
 };
 presentation=():MemoryInboxPresentation=>{
  const s=this.current;
  const proposals:InboxProposal[]=s.capabilities?s.proposals.map(p=>{
   const h=s.histories[p.id],busy=s.busy.has(p.id),uncertain=s.uncertain.has(p.id),view=proposalPresentation(p,s.capabilities!,s.runtime);
   return {...view,busy,uncertain,comment:h?.entries.find(entry=>entry.kind==='comment'&&entry.comment)?.comment,errorMessage:s.errors[p.id]??view.errorMessage,
    ...(h?{history:{loading:h.loading,error:h.error,hasMore:h.next!==null,entries:h.entries.map(entry=>({version:entry.version,kind:entry.kind,comment:entry.comment,createdAt:entry.created_at,
      summary:[inboxStatusLabels[entry.snapshot.status as keyof typeof inboxStatusLabels]??String(entry.snapshot.status??''),entry.snapshot.plan&&typeof entry.snapshot.plan==='object'&&!Array.isArray(entry.snapshot.plan)?JSON.stringify(entry.snapshot.plan):'',entry.snapshot.apply&&typeof entry.snapshot.apply==='object'&&!Array.isArray(entry.snapshot.apply)?JSON.stringify(entry.snapshot.apply):''].filter(Boolean).join(' · ')}))}}:{}),
   };
  }):[];
  return {available:s.available,scopeKey:this.scopeKey,proposals,loading:s.loading,error:s.error,notice:s.notice,emptyMessage:'В Memory Inbox сейчас нет предложений. Доступность фонового анализа указана выше.',hasMore:s.next!==null,loadingMore:s.loadingMore,onMore:this.more,
   onRefresh:()=>{this.pollCount=0;void this.refresh();},onOpenProposal:id=>{void this.open(id);},onMoreHistory:id=>{void this.open(id,true);},
   onAcceptProposal:id=>this.decide(id,'accept'),onRejectProposal:id=>this.decide(id,'reject'),onCommentProposal:(id,text)=>this.decide(id,'comment',text),onReconsiderProposal:id=>this.decide(id,'reconsider'),onRetryProposal:this.retry};
 };
}
export function useLiveMemoryInbox(source:WorkspaceSource,userId:number,visible:boolean,onExpired:()=>void,onMemoryChanged:()=>void=()=>{}){
 const expired=useRef(onExpired);expired.current=onExpired;
 const changed=useRef(onMemoryChanged);changed.current=onMemoryChanged;
 const controller=useMemo(()=>new LiveMemoryInboxController(source,userId,()=>expired.current(),()=>changed.current()),[source,userId]);
 const state=useSyncExternalStore(controller.subscribe,controller.snapshot,controller.snapshot);
 useEffect(()=>{controller.start();return controller.stop;},[controller]);
 useEffect(()=>{controller.setVisible(visible);if(!visible)return;
  const refresh=()=>controller.setVisible(document.visibilityState==='visible');
  window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);
  return()=>{controller.setVisible(false);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};
 },[controller,visible]);
 return {state,controller,presentation:controller.presentation()};
}
