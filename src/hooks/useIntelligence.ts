import {useEffect,useMemo,useSyncExternalStore} from 'react';
import {ApiError} from '../api/errors.ts';
import type {WorkspaceSource} from '../types/source.ts';
import type {IntelligencePreferences,IntelligenceRuntime,IntelligenceSource,EventAnalysisStatus,IntelligencePresentation,EventAnalysisPresentation} from '../types/intelligenceApi.ts';
type State={available:boolean;loading:boolean;busy:boolean;error:string|null;preferences:IntelligencePreferences|null;runtime:IntelligenceRuntime|null;sources:IntelligenceSource[];next:number|null;eventId:string|null;eventLoading:boolean;eventError:string|null;eventUnavailable:boolean;event:EventAnalysisStatus|null};
const initial=():State=>({available:false,loading:false,busy:false,error:null,preferences:null,runtime:null,sources:[],next:null,eventId:null,eventLoading:false,eventError:null,eventUnavailable:false,event:null});
export class IntelligenceController {
 private state=initial();private active=false;private epoch=0;private eventEpoch=0;private reads=new Set<AbortController>();private eventAbort:AbortController|null=null;private listeners=new Set<()=>void>();private pendingEvent:string|null=null;
 private source:WorkspaceSource;private expired:()=>void;
 constructor(source:WorkspaceSource,expired:()=>void){this.source=source;this.expired=expired;}
 snapshot=()=>this.state;subscribe=(f:()=>void)=>{this.listeners.add(f);return()=>{this.listeners.delete(f);};};
 private emit(v:Partial<State>){if(this.active){this.state={...this.state,...v};this.listeners.forEach(f=>f());}}
 start=()=>{this.active=true;if(this.pendingEvent){const id=this.pendingEvent;this.pendingEvent=null;this.selectEvent(id);}};
 stop=()=>{this.active=false;this.pendingEvent=null;this.cancelSettings();this.eventEpoch++;this.eventAbort?.abort();this.state=initial();this.listeners.forEach(f=>f());};
 cancelSettings=()=>{this.epoch++;for(const abort of this.reads)abort.abort();this.reads.clear();this.emit({loading:false,busy:false});};
 private failure(e:unknown){if(e instanceof ApiError&&e.status===401){this.stop();this.expired();return true;}return false;}
 private message(e:unknown){return e instanceof ApiError&&[404,405,501].includes(e.status)?'Unavailable on this server.':e instanceof ApiError&&e.status===403?'Access/consent was denied. Refresh before retrying.':'Backend did not confirm this action. Refresh to check the actual state.';}
 refresh=async(more=false)=>{
  const s=this.source;if(!this.active||this.state.busy||this.state.loading)return;
  if(s.kind!=='live'||!s.intelligencePreferences||!s.intelligenceSources||!s.intelligenceStatus){this.emit({available:false,error:'Unavailable on this server.'});return;}
  const offset=more?this.state.next:0;if(offset===null)return;
  const abort=new AbortController(),epoch=++this.epoch;this.reads.add(abort);this.emit({loading:true,error:null,runtime:null});
  try{
   const [preferences,page,runtime]=await Promise.all([s.intelligencePreferences(abort.signal),s.intelligenceSources(offset,abort.signal),s.intelligenceStatus(abort.signal)]);
   if(!this.active||abort.signal.aborted||epoch!==this.epoch)return;
   this.emit({available:true,preferences,runtime,sources:more?[...new Map([...this.state.sources,...page.sources].map(x=>[x.id,x])).values()]:page.sources,next:page.next_offset});
  }catch(e){if(this.active&&!abort.signal.aborted&&epoch===this.epoch&&!this.failure(e))this.emit({error:this.message(e),available:!(e instanceof ApiError&&[404,405,501].includes(e.status))&&this.state.available});}
  finally{this.reads.delete(abort);if(this.active&&epoch===this.epoch)this.emit({loading:false});}
 };
 save=async(change:{id:string;enabled:boolean}|{autonomy:'review_all'|'auto_link'})=>{
  if(!this.active||!this.state.available||this.state.loading||this.state.busy||this.state.error)return;
  if('id' in change&&!this.state.sources.some(s=>s.id===change.id))return;
  const abort=new AbortController(),epoch=++this.epoch;this.reads.add(abort);this.emit({busy:true,error:null});
  try{
   if('id' in change){
    if(!this.source.saveIntelligenceSource)throw Error('Unavailable');
    const confirmed=await this.source.saveIntelligenceSource(change.id,change.enabled,abort.signal);
    if(this.active&&!abort.signal.aborted&&epoch===this.epoch)this.emit({sources:this.state.sources.map(s=>s.id===confirmed.id?{...s,enabled:confirmed.enabled}:s)});
   }else{
    if(!this.source.saveIntelligencePreferences||change.autonomy==='auto_link'&&!this.state.preferences?.capabilities.auto_link)throw Error('Unavailable');
    const confirmed=await this.source.saveIntelligencePreferences(change.autonomy,abort.signal);
    if(this.active&&!abort.signal.aborted&&epoch===this.epoch)this.emit({preferences:confirmed});
   }
  }catch(e){if(this.active&&!abort.signal.aborted&&epoch===this.epoch&&!this.failure(e))this.emit({error:this.message(e)});}
  finally{this.reads.delete(abort);if(this.active&&epoch===this.epoch)this.emit({busy:false});}
 };
 selectEvent=(id:string|null)=>{if(!this.active){this.pendingEvent=id;return;}this.eventEpoch++;this.eventAbort?.abort();this.emit({eventId:id,event:null,eventError:null,eventUnavailable:false,eventLoading:false});if(id)void this.refreshEvent();};
 refreshEvent=async()=>{
  const id=this.state.eventId;if(!this.active||!id||this.source.kind!=='live')return;
  if(!this.source.eventAnalysis){this.emit({eventUnavailable:true,eventError:'Unavailable on this server.'});return;}
  this.eventAbort?.abort();const abort=this.eventAbort=new AbortController(),epoch=++this.eventEpoch;this.emit({eventLoading:true,eventError:null,eventUnavailable:false});
  try{const data=await this.source.eventAnalysis(id,abort.signal);if(this.active&&!abort.signal.aborted&&epoch===this.eventEpoch)this.emit({event:data});}
  catch(e){if(this.active&&!abort.signal.aborted&&epoch===this.eventEpoch&&!this.failure(e))this.emit({event:null,eventError:this.message(e),eventUnavailable:e instanceof ApiError&&[404,405,501].includes(e.status)});}
  finally{if(this.active&&epoch===this.eventEpoch)this.emit({eventLoading:false});}
 };
}
export function useIntelligence(source:WorkspaceSource,userId:number,settingsVisible:boolean,onExpired:()=>void,onProposal:(id:string)=>void){
 const controller=useMemo(()=>new IntelligenceController(source,onExpired),[source,userId,onExpired]);
 const state=useSyncExternalStore(controller.subscribe,controller.snapshot,controller.snapshot);
 useEffect(()=>{controller.start();return controller.stop;},[controller]);
 useEffect(()=>{if(settingsVisible)void controller.refresh();else controller.cancelSettings();},[controller,settingsVisible]);
 const settings:IntelligencePresentation={...state,hasMore:state.next!==null,onRefresh:()=>void controller.refresh(),onMore:()=>void controller.refresh(true),onSource:(id,enabled)=>void controller.save({id,enabled}),onAutonomy:autonomy=>void controller.save({autonomy})};
 const event:EventAnalysisPresentation={eventId:state.eventId,loading:state.eventLoading,error:state.eventError,unavailable:state.eventUnavailable,data:state.event,onSelect:controller.selectEvent,onRefresh:()=>void controller.refreshEvent(),onProposal};
 return {controller,settings,event};
}
