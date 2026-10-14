import {useEffect,useMemo,useRef,useSyncExternalStore} from 'react';
import {ApiError} from '../api/errors.ts';
import {validTelegramLink} from '../api/client.ts';
import type {WorkspaceSource} from '../types/source.ts';
import type {TelegramPresentation} from '../types/workspace.ts';
type View=Omit<TelegramPresentation,'onConnect'|'onDisconnect'|'onCheck'|'onRetry'>;
type Action='status'|'connect'|'disconnect';
const initial=():View=>({status:null,phase:'loading',checking:false,error:null,link:null});
// Account-local coordinator; URL lives only here and in the current view props.
export class TelegramConnectionController {
 private current:View=initial();
 private listeners=new Set<()=>void>();
 private active=true;
 private generation=0;
 private request:AbortController|null=null;
 private pending:Promise<void>|null=null;
 private writing=false;
 private timer:ReturnType<typeof setTimeout>|null=null;
 private retryAction:Action='status';
 private csrfRequired=false;
 constructor(private source:WorkspaceSource,private onExpired:()=>void){}
 snapshot=()=>this.current;
 subscribe=(fn:()=>void)=>{this.listeners.add(fn);return ()=>{this.listeners.delete(fn);};};
 private emit(next:View){this.current=next;for(const listener of this.listeners)listener();}
 start(){this.active=true;}
 stop=()=>{
  this.active=false;this.generation++;this.request?.abort();this.request=null;this.pending=null;this.writing=false;
  this.clearTimer();this.emit(initial());
 };
 private clearTimer(){if(this.timer!==null)clearTimeout(this.timer);this.timer=null;}
 expire=(now=Date.now())=>{
  if(this.current.link&&Date.parse(this.current.link.expires_at)<=now){
   this.clearTimer();this.emit({...this.current,link:null,phase:this.current.status?.connected?'idle':'expired'});
  }
 };
 private armExpiry(){
  this.clearTimer();
  if(this.current.link)this.timer=setTimeout(()=>this.expire(),Math.min(2147483647,Math.max(0,Date.parse(this.current.link.expires_at)-Date.now())));
 }
 private failure(error:unknown,action:Action){
  if(error instanceof ApiError&&error.status===401){this.stop();this.onExpired();return;}
  this.retryAction=action;
  if(error instanceof ApiError&&error.status===403)this.csrfRequired=true;
  const message=error instanceof ApiError&&error.status===403?'Your session verification expired. Retry to refresh it.'
   :error instanceof ApiError&&error.code==='invalid_response'?'Telegram returned an invalid response. Please retry.'
   :error instanceof ApiError&&error.status===503?'Telegram is temporarily unavailable. Please retry.'
   :'Unable to '+(action==='connect'?'create the Telegram link':action==='disconnect'?'confirm Telegram disconnection':'check Telegram connection')+'. Please retry.';
  this.emit({...this.current,checking:false,phase:this.current.link?'pending':this.current.phase==='expired'?'expired':'idle',error:message});
 }
 check=():Promise<void>=>{
  if(!this.active||this.writing)return Promise.resolve();
  if(this.pending)return this.pending;
  const abort=new AbortController(),version=++this.generation;this.request=abort;
  this.emit({...this.current,checking:true});
  const run=Promise.resolve().then(async()=>{
   try{
    if(!this.active||version!==this.generation||abort.signal.aborted)return;
    if(!this.source.telegramStatus)throw new Error('Telegram unavailable');
    const status=await this.source.telegramStatus(abort.signal);
    if(!this.active||version!==this.generation||abort.signal.aborted)return;
    const link=status.connected?null:this.current.link;
    if(status.connected)this.clearTimer();
    this.emit({...this.current,status,link,checking:false,phase:status.connected?'idle':link?'pending':this.current.phase==='expired'?'expired':'idle',
      error:(status.connected&&this.retryAction!=='disconnect')||this.retryAction==='status'||(this.retryAction==='disconnect'&&!status.connected)?null:this.current.error});
    this.expire();
   }catch(error){if(this.active&&version===this.generation&&!abort.signal.aborted)this.failure(error,'status');}
   finally{if(version===this.generation){this.pending=null;this.request=null;}}
  });
  this.pending=run;return run;
 };
 connect=()=>this.write('connect');
 disconnect=()=>this.write('disconnect');
 private write(action:'connect'|'disconnect'):Promise<void>{
  if(!this.active||this.writing)return Promise.resolve();
  if(action==='connect'&&(!this.current.status?.configured||this.current.status.connected))return Promise.resolve();
  if(action==='disconnect'&&!this.current.status?.connected)return Promise.resolve();
  this.request?.abort();this.pending=null;
  const abort=new AbortController(),version=++this.generation;this.request=abort;this.writing=true;
  this.clearTimer();
  this.emit({...this.current,link:null,checking:false,error:null,phase:action==='connect'?'creating':'disconnecting'});
  let recheck=false;
  return (async()=>{
   try{
    if(this.csrfRequired){
     if(!this.source.refreshCsrf)throw new Error('CSRF unavailable');
     await this.source.refreshCsrf(abort.signal);
     if(!this.active||version!==this.generation||abort.signal.aborted)return;
     this.csrfRequired=false;
    }
    if(action==='connect'){
     if(!this.source.createTelegramLink)throw new Error('Telegram unavailable');
     const link=await this.source.createTelegramLink(abort.signal);
     if(!this.active||version!==this.generation||abort.signal.aborted)return;
     // Defend the source boundary too, without exposing the rejected URL.
     if(!validTelegramLink(link.url)||!Number.isFinite(Date.parse(link.expires_at)))throw new ApiError(502,'invalid_response','Invalid Telegram link');
     this.emit({...this.current,link,phase:'pending'});
     this.armExpiry();this.expire();
    }else{
     if(!this.source.disconnectTelegram)throw new Error('Telegram unavailable');
     await this.source.disconnectTelegram(abort.signal);
     if(!this.active||version!==this.generation||abort.signal.aborted)return;
     recheck=true;this.emit({...this.current,phase:'idle'});
    }
   }catch(error){
    if(!this.active||version!==this.generation||abort.signal.aborted)return;
    if(error instanceof ApiError&&error.status===409&&error.code==='already_linked'){
     recheck=true;this.retryAction='status';this.emit({...this.current,phase:'idle'});
    }else{
     this.failure(error,action);
     // A DELETE may have committed despite a lost/malformed response. Read before another write.
     recheck=action==='disconnect'&&(!(error instanceof ApiError)||error.status>=500);
    }
   }finally{
    if(version===this.generation){this.request=null;this.writing=false;if(recheck&&this.active)await this.check();}
   }
  })();
 }
 retry=async()=>{
  if(!this.active||this.writing||this.pending)return;
  const action=this.retryAction;
  if(action==='status'){await this.check();return;}
  if(action==='disconnect'){
   await this.check();
   if(!this.active||this.current.checking||!this.current.status?.connected)return;
   // A failed status read must not authorize another uncertain DELETE.
   if(this.retryAction==='status'&&this.current.error)return;
  }
  await this.write(action);
 };
}
// Kept alongside the hook so event lifetime can be regression-tested without a DOM framework.
export function observeTelegramReturn(controller:Pick<TelegramConnectionController,'expire'|'check'>,
 windowEvents:Pick<Window,'addEventListener'|'removeEventListener'>=window,
 page:Pick<Document,'visibilityState'|'addEventListener'|'removeEventListener'>=document){
 const refresh=()=>{if(page.visibilityState==='visible'){controller.expire();void controller.check();}};
 windowEvents.addEventListener('focus',refresh);page.addEventListener('visibilitychange',refresh);
 return ()=>{windowEvents.removeEventListener('focus',refresh);page.removeEventListener('visibilitychange',refresh);};
}
export function useTelegramConnection(source:WorkspaceSource,userId:number,activeTab:boolean,onExpired:()=>void){
 const expired=useRef(onExpired);expired.current=onExpired;
 const controller=useMemo(()=>new TelegramConnectionController(source,()=>expired.current()),[source,userId]);
 const view=useSyncExternalStore(controller.subscribe,controller.snapshot,controller.snapshot);
 useEffect(()=>{controller.start();return controller.stop;},[controller]);
 useEffect(()=>{if(activeTab)void controller.check();},[controller,activeTab]);
 useEffect(()=>{
  if(!activeTab&&!view.link&&view.phase!=='expired')return;
  return observeTelegramReturn(controller);
 },[controller,activeTab,!!view.link,view.phase==='expired']);
 return {...view,onConnect:()=>void controller.connect(),onDisconnect:()=>void controller.disconnect(),
  onCheck:()=>void controller.check(),onRetry:()=>void controller.retry(),stop:controller.stop};
}
