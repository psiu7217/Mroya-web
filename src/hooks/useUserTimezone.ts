import {useEffect,useMemo,useRef,useSyncExternalStore} from 'react';
import {ApiError} from '../api/errors.ts';
import {browserTimezone} from '../utils/timezones.ts';
import type {ApiUser} from '../types/api.ts';
import type {WorkspaceSource} from '../types/source.ts';

export type TimezoneState={timezone:string;draft:string;status:'idle'|'saving'|'saved'|'error';error:string|null;apiReady:boolean};
/** Frontend port only; HTTP routing/payload must be added after the backend contract exists. */
export type TimezoneTransport=NonNullable<WorkspaceSource['timezone']>;
export class UserTimezoneStore {
 private current:TimezoneState;
 private listeners=new Set<()=>void>();private active=false;private generation=0;
 private initializePending=false;private attempted=false;private busy=false;private blocked=false;private dirty=false;private revision=0;
 private request:AbortController|null=null;
 private source:WorkspaceSource;private userId:number;private expired:()=>void;private detect:()=>string|null;
 constructor(source:WorkspaceSource,user:ApiUser,expired:()=>void,detect:()=>string|null=browserTimezone){
  this.source=source;this.userId=user.id;this.expired=expired;this.detect=detect;
  this.current={timezone:user.timezone,draft:user.timezone,status:user.timezone?'saved':'idle',error:null,apiReady:!!source.timezone};
 }
 snapshot=()=>this.current;
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
 private emit(patch:Partial<TimezoneState>){if(!this.active)return;this.current={...this.current,...patch};this.listeners.forEach(fn=>fn());}
 start=()=>{
  this.active=true;const generation=this.generation;
  // StrictMode cleanup happens before this microtask; an abandoned mount never initializes.
  void Promise.resolve().then(()=>{
   if(!this.active||generation!==this.generation||this.attempted||this.current.timezone||this.dirty)return;
   this.attempted=true;
   if(!this.source.timezone){this.failure(new Error('Timezone setup is waiting for the backend API. Choose your timezone in Profile after the integration is enabled.'));return;}
   const detected=this.detect();
   if(!detected){this.failure(new Error('Your browser timezone could not be detected. Choose an IANA timezone manually in Profile.'));return;}
   this.initializePending=true;this.emit({draft:detected});void this.write(detected,true);
  });
 };
 stop=()=>{this.active=false;this.generation++;this.request?.abort();this.request=null;this.busy=false;};
 hydrate=(user:ApiUser)=>{
  if(!this.active||user.id!==this.userId||this.busy||this.dirty||this.attempted||this.revision>0)return;
  if(user.timezone!==this.current.timezone)this.emit({timezone:user.timezone,draft:user.timezone,status:user.timezone?'saved':'idle',error:null});
 };
 change=(zone:string)=>{
  if(!this.active)return;
  if(zone&&zone===this.current.timezone&&!this.busy&&!this.blocked){this.dirty=false;this.emit({draft:zone,status:'saved',error:null});return;}
  this.initializePending=false;this.dirty=true;this.revision++;
  this.emit({draft:zone,status:this.busy?'saving':this.blocked?'error':'saving',error:this.blocked?this.current.error:null});
  if(!zone.trim()){this.failure(new Error('Choose a non-empty IANA timezone.'));return;}
  if(!this.busy&&!this.blocked)void this.write(zone,false);
 };
 private accept(user:ApiUser,sentRevision:number,requested?:string){
  if(user.id!==this.userId)throw new ApiError(401,'session_changed','Account changed while saving timezone.');
  if(typeof user.timezone!=='string'||!user.timezone.trim()||requested!==undefined&&user.timezone!==requested)throw new Error('The backend did not confirm the selected timezone. Retry or choose a valid IANA timezone.');
  const unchanged=this.revision===sentRevision;
  if(unchanged)this.dirty=false;
  this.emit({timezone:user.timezone,...(unchanged?{draft:user.timezone}:{}),status:unchanged?'saved':'saving',error:null});
 }
 private failure(error:unknown){
  if(error instanceof ApiError&&error.status===401){this.stop();this.expired();return;}
  this.blocked=true;
  const message=error instanceof ApiError&&error.status===403?'Security check failed. Retry saving timezone to refresh CSRF.':error instanceof Error?error.message:'Timezone could not be saved. Choose a timezone manually and retry.';
  this.emit({status:'error',error:message});
 }
 private async write(zone:string,initialize:boolean){
  if(!this.active||this.busy)return;
  if(!this.source.timezone){this.failure(new Error('Timezone saving is not connected to the backend yet. Your selection has not been saved.'));return;}
  this.busy=true;const abort=new AbortController(),generation=this.generation,sent=this.revision;this.request=abort;
  this.emit({status:'saving',error:null});
  try{
   const user=await (initialize?this.source.timezone.initializeIfUnset(zone,abort.signal):this.source.timezone.save(zone,abort.signal));
   if(!this.active||abort.signal.aborted||generation!==this.generation)return;
   this.accept(user,sent,initialize?undefined:zone);this.initializePending=false;this.blocked=false;
  }catch(error){if(this.active&&!abort.signal.aborted&&generation===this.generation)this.failure(error);}
  finally{
   if(this.request===abort)this.request=null;
   if(generation===this.generation){this.busy=false;this.flush();}
  }
 }
 private flush(){
  if(!this.active||this.busy||this.blocked)return;
  if(this.dirty&&this.current.draft===this.current.timezone){this.dirty=false;this.emit({status:'saved',error:null});return;}
  if(this.dirty)void this.write(this.current.draft,false);
  else if(this.initializePending)void this.write(this.current.draft,true);
 }
 retry=async()=>{
  if(!this.active||this.busy)return;
  if(!this.source.timezone){this.failure(new Error('Timezone saving is waiting for the backend API. No change has been saved.'));return;}
  this.busy=true;const abort=new AbortController(),generation=this.generation,sent=this.revision;this.request=abort;
  this.emit({status:'saving',error:null});
  try{
   // A lost write response may already have persisted. Read before another mutation.
   const session=await this.source.session(abort.signal);
   if(!this.active||abort.signal.aborted||generation!==this.generation)return;
   if(session.status!=='authenticated'||session.user.id!==this.userId)throw new ApiError(401,'session_changed','Sign in again to save timezone.');
   const confirmed=session.user.timezone;
   this.emit({timezone:confirmed});
   if(confirmed&&(!this.dirty||confirmed===this.current.draft)){
    this.accept(session.user,confirmed===this.current.draft?this.revision:sent);this.initializePending=false;this.blocked=false;
   }else{
    if(this.source.refreshCsrf)await this.source.refreshCsrf(abort.signal);
    if(!this.active||abort.signal.aborted||generation!==this.generation)return;
    this.blocked=false;
    if(!this.current.draft){this.failure(new Error('Choose a valid IANA timezone manually in Profile.'));return;}
    if(!this.initializePending)this.dirty=true;
   }
  }catch(error){if(this.active&&!abort.signal.aborted&&generation===this.generation)this.failure(error);}
  finally{
   if(this.request===abort)this.request=null;
   if(generation===this.generation){this.busy=false;this.flush();}
  }
 };
}
export function useUserTimezone(source:WorkspaceSource,user:ApiUser,onExpired:()=>void){
 const expired=useRef(onExpired);expired.current=onExpired;
 const store=useMemo(()=>new UserTimezoneStore(source,user,()=>expired.current()),[source,user.id]);
 const state=useSyncExternalStore(store.subscribe,store.snapshot,store.snapshot);
 useEffect(()=>{store.start();return store.stop;},[store]);
 useEffect(()=>{store.hydrate(user);},[store,user.timezone]);
 return {...state,onChange:store.change,onRetry:()=>void store.retry(),stop:store.stop,user:{...user,timezone:state.timezone}};
}
