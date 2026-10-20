import {useEffect,useMemo,useRef,useSyncExternalStore} from 'react';
import {ApiError} from '../api/errors.ts';
import type {NotificationDto,NotificationSettings} from '../types/api.ts';
import type {WorkspaceSource} from '../types/source.ts';
import type {NotificationPresentation,TelegramPresentation} from '../types/workspace.ts';

type State={available:boolean;loading:boolean;saving:boolean;testing:boolean;settings:NotificationSettings|null;lastTest:NotificationDto|null;error:string|null};
type Action='refresh'|'toggle'|'test';
const initial=():State=>({available:false,loading:false,saving:false,testing:false,settings:null,lastTest:null,error:null});
const uncertain=(e:unknown)=>!(e instanceof ApiError)||e.status>=500;
// No persistence: settings, idempotency key and delivery receipts belong to this account lifetime.
export class NotificationSettingsController {
 private state:State=initial();
 private listeners=new Set<()=>void>();
 private active=true;
 private generation=0;
 private request:AbortController|null=null;
 private pending:Promise<void>|null=null;
 private connection:boolean|null=null;
 private retryAction:Action='refresh';
 private desired:boolean|null=null;
 private reconcile=false;
 private csrfRequired=false;
 private testRequestId:string|null=null;
 private testUncertain=false;
 constructor(private source:WorkspaceSource,private onExpired:()=>void,private uuid:()=>string=()=>crypto.randomUUID()){}
 snapshot=()=>this.state;
 subscribe=(fn:()=>void)=>{this.listeners.add(fn);return()=>{this.listeners.delete(fn);};};
 private emit(patch:Partial<State>){this.state={...this.state,...patch};for(const fn of this.listeners)fn();}
 start=()=>{this.active=true;};
 stop=()=>{
  this.active=false;this.generation++;this.request?.abort();this.request=null;this.pending=null;
  this.connection=null;this.desired=null;this.reconcile=false;this.csrfRequired=false;this.testRequestId=null;this.testUncertain=false;
  this.retryAction='refresh';this.emit(initial());
 };
 setConnection=(connected:boolean|null)=>{
  if(!this.active||this.connection===connected)return;
  const previous=this.connection;this.connection=connected;
  if(connected===false){
   // Unlink disables actions immediately, but never fabricates a persisted opt-out.
   if(this.state.saving)this.reconcile=true;
   if(this.state.testing)this.testUncertain=true;
   this.generation++;this.request?.abort();this.request=null;this.pending=null;
   this.emit({loading:false,saving:false,testing:false});
   void this.refresh();
  }
  if(connected===true&&previous===false)void this.refresh();
 };
 private failure(error:unknown,action:Action){
  if(error instanceof ApiError&&error.status===401){this.stop();this.onExpired();return;}
  if(error instanceof ApiError&&error.status===403)this.csrfRequired=true;
  this.retryAction=action;
  const message=error instanceof ApiError&&error.status===403?'Session verification failed. Retry explicitly to refresh it.'
   :error instanceof ApiError&&error.status===404?'Notifications are not available on this server.'
   :error instanceof ApiError&&error.status===409?'Notification action was not accepted. Refresh settings and check Telegram connection.'
   :error instanceof ApiError&&error.status===429?'Test notification rate limit reached. Try again later.'
   :error instanceof ApiError&&error.status===503?'Notifications are temporarily unavailable. Check configuration and worker readiness, then retry.'
   :'Unable to confirm notification operation. Refresh or retry explicitly.';
  this.emit({error:message,...(error instanceof ApiError&&error.status===404?{available:false}:{})});
 }
 private run(action:Action,work:(signal:AbortSignal,valid:()=>boolean)=>Promise<void>):Promise<void>{
  if(!this.active||this.source.kind!=='live')return Promise.resolve();
  if(this.pending)return this.pending;
  const request=new AbortController(),version=++this.generation;this.request=request;
  const valid=()=>this.active&&version===this.generation&&!request.signal.aborted;
  this.emit({loading:action==='refresh',saving:action==='toggle',testing:action==='test',error:null});
  const run=Promise.resolve().then(async()=>{
   try{if(valid())await work(request.signal,valid);}
   catch(error){if(valid())this.failure(error,action);}
   finally{if(valid()){this.pending=null;this.request=null;this.emit({loading:false,saving:false,testing:false});}}
  });
  this.pending=run;return run;
 }
 private readSettings=async(signal:AbortSignal,valid:()=>boolean)=>{
  if(!this.source.notificationSettings)throw new ApiError(404,'not_found','Unavailable');
  const settings=await this.source.notificationSettings(signal);
  if(valid())this.emit({settings,available:true});
  return settings;
 };
 private refreshCsrf=async(signal:AbortSignal,valid:()=>boolean)=>{
  if(this.csrfRequired){
   if(!this.source.refreshCsrf)throw new ApiError(403,'csrf_failed','Unavailable');
   await this.source.refreshCsrf(signal);if(valid())this.csrfRequired=false;
  }
 };
 refresh=()=>this.run('refresh',async(signal,valid)=>{
  const settings=await this.readSettings(signal,valid);if(!valid())return;
  if(this.reconcile){
   this.reconcile=false;
   if(settings.channels.telegram.enabled===this.desired){this.desired=null;this.retryAction='refresh';}
   else{this.retryAction='toggle';this.emit({error:'The requested setting is not confirmed. Retry explicitly to save it.'});}
  }
  if(this.state.lastTest&&this.source.notification){
   const lastTest=await this.source.notification(this.state.lastTest.notification_id,signal);
   if(valid())this.emit({lastTest});
  }
 });
 toggle=(enabled:boolean):Promise<void>=>{
  if(!this.active||this.pending)return this.pending??Promise.resolve();
  const view=this.presentation();
  if(!view.available||enabled&&!view.canEnable)return Promise.resolve();
  this.desired=enabled;return this.writeToggle();
 };
 private writeToggle=()=>this.run('toggle',async(signal,valid)=>{
  const desired=this.desired;if(desired===null)return;
  if(this.reconcile){
   const settings=await this.readSettings(signal,valid);if(!valid())return;
   this.reconcile=false;if(settings.channels.telegram.enabled===desired){this.desired=null;return;}
  }
  if(desired&&!this.presentation().canEnable)throw new ApiError(409,'telegram_not_connected','Unavailable');
  await this.refreshCsrf(signal,valid);if(!valid())return;
  if(!this.source.saveNotificationSettings)throw new ApiError(404,'not_found','Unavailable');
  try{
   const settings=await this.source.saveNotificationSettings(desired,signal);if(!valid())return;
   this.emit({settings,available:true});
   if(settings.channels.telegram.enabled!==desired)throw new ApiError(502,'invalid_response','Setting was not confirmed');
   this.desired=null;this.retryAction='refresh';
  }catch(error){
   if(!valid())return;
   if(uncertain(error)){
    this.reconcile=true;
    const settings=await this.readSettings(signal,valid);if(!valid())return;
    this.reconcile=false;
    if(settings.channels.telegram.enabled===desired){this.desired=null;this.retryAction='refresh';return;}
   }
   throw error;
  }
 });
 sendTest=():Promise<void>=>{
  if(!this.active||this.pending)return this.pending??Promise.resolve();
  if(!this.presentation().canSendTest)return Promise.resolve();
  // Unknown POST result must be retried as the same operation, never with a fresh token.
  if(this.testUncertain)return this.writeTest();
  if(this.state.lastTest&&['pending','processing','retry'].includes(this.state.lastTest.deliveries[0].status))return this.refresh();
  this.testRequestId=this.uuid();this.emit({lastTest:null});return this.writeTest();
 };
 private writeTest=()=>this.run('test',async(signal,valid)=>{
  if(!this.testRequestId||!this.presentation().canSendTest)return;
  this.testUncertain=true;
  await this.refreshCsrf(signal,valid);if(!valid())return;
  if(!this.source.testNotification)throw new ApiError(404,'not_found','Unavailable');
  const lastTest=await this.source.testNotification(this.testRequestId,signal);if(!valid())return;
  this.testUncertain=false;this.retryAction='refresh';this.emit({lastTest});
 });
 retry=():Promise<void>=>{
  if(!this.active||this.pending)return this.pending??Promise.resolve();
  if(this.retryAction==='toggle'&&this.desired!==null)return this.writeToggle();
  if(this.retryAction==='test'&&this.testRequestId)return this.writeTest();
  return this.refresh();
 };
 presentation=():NotificationPresentation=>{
  const s=this.state,t=s.settings?.channels.telegram;
  const connected=this.connection!==false&&t?.connected===true;
  const canEnable=s.available&&connected&&t?.configured===true;
  return {available:s.available,loading:s.loading,saving:s.saving,testing:s.testing,simulated:false,
   enabled:t?.enabled??false,connected,configured:t?.configured??false,deliveryReady:connected&&t?.delivery_ready===true,
   canEnable,canSendTest:canEnable&&t?.delivery_ready===true,error:s.error,lastTest:s.lastTest,lastTestStatus:s.lastTest?.deliveries[0].status??null,
   onToggleTelegram:this.toggle,onSendTest:this.sendTest,onRefresh:this.refresh,onRetry:this.retry};
 };
}
export function useNotificationSettings(source:WorkspaceSource,userId:number,telegram:Pick<TelegramPresentation,'phase'|'status'>,onExpired:()=>void){
 const expired=useRef(onExpired);expired.current=onExpired;
 const controller=useMemo(()=>new NotificationSettingsController(source,()=>expired.current()),[source,userId]);
 useSyncExternalStore(controller.subscribe,controller.snapshot,controller.snapshot);
 const connected=telegram.phase==='disconnecting'?false:telegram.status?.connected??null;
 useEffect(()=>{controller.start();void controller.refresh();return controller.stop;},[controller]);
 useEffect(()=>{controller.setConnection(connected);},[controller,connected]);
 const presentation=controller.presentation();
 // The disconnect render gates actions even before the connection effect runs.
 if(connected===false){presentation.connected=false;presentation.deliveryReady=false;presentation.canEnable=false;presentation.canSendTest=false;}
 return {controller,presentation};
}
