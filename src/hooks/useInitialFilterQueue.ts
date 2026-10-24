import {InitialFilterResultsController} from './InitialFilterResultsController.ts';
import {useEffect,useMemo,useSyncExternalStore} from 'react';
import {ApiError} from '../api/errors.ts';
import type {WorkspaceSource} from '../types/source.ts';
import type {InitialQueuePresentation,InitialQueueReceipt,InitialQueueTotals} from '../types/initialQueue.ts';
import type {IntelligenceSource} from '../types/intelligenceApi.ts';
type State={sources:IntelligenceSource[];selectedId:string;loading:boolean;busy:boolean;error:string|null;totals:InitialQueueTotals|null;receipt:InitialQueueReceipt|null;next:number|null};
const initial=():State=>({sources:[],selectedId:'',loading:false,busy:false,error:null,totals:null,receipt:null,next:null});
export class InitialFilterQueueController {
 private current=initial();private active=false;private generation=0;private request:AbortController|null=null;private listeners=new Set<()=>void>();
 private onQueued:()=>void;private source:WorkspaceSource;private expired:()=>void;readonly scopeKey='initial-queue-'+crypto.randomUUID();
 constructor(source:WorkspaceSource,expired:()=>void,onQueued:()=>void=()=>{}){this.source=source;this.expired=expired;this.onQueued=onQueued;}
 snapshot=()=>this.current;subscribe=(fn:()=>void)=>{this.listeners.add(fn);return()=>{this.listeners.delete(fn);};};
 private emit(v:Partial<State>){if(this.active){this.current={...this.current,...v};this.listeners.forEach(fn=>fn());}}
 start=()=>{this.active=true;void this.refresh();};
 stop=()=>{this.active=false;this.generation++;this.request?.abort();this.current=initial();this.listeners.forEach(fn=>fn());};
 select=(id:string)=>{if(!this.current.busy)this.emit({selectedId:this.current.sources.some(s=>s.id===id)?id:'',receipt:null});};
 private valid(abort:AbortController,ticket:number){return this.active&&!abort.signal.aborted&&ticket===this.generation;}
 private fail(e:unknown){
  if(e instanceof ApiError&&e.status===401){this.stop();this.expired();return;}
  this.emit({error:e instanceof ApiError&&e.status===409&&e.code==='source_unavailable'?'Для календаря не включено согласие на анализ. Проверьте разрешения в настройках.':e instanceof ApiError&&e.status===403?'Проверка сессии/CSRF не пройдена. Обновите данные и повторите действие вручную.':e instanceof ApiError&&[404,405,501].includes(e.status)?'Календарь или очередь недоступны на этом сервере.':'Операция не подтверждена. Обновите счётчики. Автоматический повтор добавления не выполняется.'});
 }
 refresh=async(more=false)=>{
  if(!this.active||this.current.busy||this.current.loading)return;
  if(this.source.kind!=='live'||!this.source.initialFilterQueue||!this.source.intelligenceSources){this.emit({error:'Очередь недоступна на этом сервере.'});return;}
  const offset=more?this.current.next:0;if(offset===null)return;
  const abort=this.request=new AbortController(),ticket=++this.generation;this.emit({loading:true,error:null});
  try{
   const [page,totals]=await Promise.all([this.source.intelligenceSources(offset,abort.signal),this.source.initialFilterQueue(abort.signal)]);
   if(!this.valid(abort,ticket))return;
   const sources=more?[...new Map([...this.current.sources,...page.sources].map(s=>[s.id,s])).values()]:page.sources;
   this.emit({sources,totals,next:page.next_offset,selectedId:sources.some(s=>s.id===this.current.selectedId)?this.current.selectedId:''});
  }catch(e){if(this.valid(abort,ticket))this.fail(e);}
  finally{if(this.valid(abort,ticket))this.emit({loading:false});}
 };
 enqueue=async()=>{
  const s=this.source,id=this.current.selectedId;if(!this.active||this.current.busy||this.current.loading)return;
  if(!this.current.sources.find(source=>source.id===id)?.enabled){this.emit({error:'Выберите календарь с разрешением на анализ. Согласие включается только в настройках.'});return;}
  if(s.kind!=='live'||!s.enqueueInitialFilter||!s.initialFilterQueue)return;
  const abort=this.request=new AbortController(),ticket=++this.generation;this.emit({busy:true,error:null,receipt:null,totals:null});
  try{
   const receipt=await s.enqueueInitialFilter(id,abort.signal);if(!this.valid(abort,ticket))return;
   this.emit({receipt});this.onQueued();
   const totals=await s.initialFilterQueue(abort.signal);if(this.valid(abort,ticket))this.emit({totals});
  }catch(e){if(this.valid(abort,ticket)){
   if(this.current.receipt&&!(e instanceof ApiError&&e.status===401))this.emit({error:'Добавление подтверждено Backend, но счётчики не обновлены. Нажмите «Обновить»; повтор добавления не выполняется.'});
   else this.fail(e);
  }}
  finally{if(this.valid(abort,ticket))this.emit({busy:false});}
 };
}
export function useInitialFilterQueue(source:WorkspaceSource,userId:number,visible:boolean,onExpired:()=>void,onSettings:()=>void){
 const results=useMemo(()=>new InitialFilterResultsController(source,onExpired),[source,userId,onExpired]);
 const resultsState=useSyncExternalStore(results.subscribe,results.snapshot,results.snapshot);
 useEffect(()=>{if(visible)results.start();return results.stop;},[results,visible]);
 const controller=useMemo(()=>new InitialFilterQueueController(source,onExpired,()=>void results.refresh()),[source,userId,onExpired,results]);
 const state=useSyncExternalStore(controller.subscribe,controller.snapshot,controller.snapshot);
 useEffect(()=>{if(visible)controller.start();return controller.stop;},[controller,visible]);
 const presentation:InitialQueuePresentation={...state,results:{...resultsState,onDecision:results.select,onRefresh:()=>void results.refresh(),onNext:results.next,onPrevious:results.previous},scopeKey:controller.scopeKey,hasMoreSources:state.next!==null,onSelect:controller.select,onEnqueue:()=>void controller.enqueue(),onRefresh:()=>void controller.refresh(),onMoreSources:()=>void controller.refresh(true),onSettings};
 return {controller:{stop:()=>{controller.stop();results.stop();}},presentation};
}
