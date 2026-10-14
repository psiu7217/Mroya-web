import {useEffect,useMemo,useSyncExternalStore} from 'react';
import {ApiError} from '../api/errors.ts';
import type {ApiUser,PreferencesPatch,ThemeMode} from '../types/api.ts';
import type {WorkspaceSource} from '../types/source.ts';

type Saved = {theme:ThemeMode;nickname:string};
export type PreferenceView = Saved & {status:'saved'|'saving'|'unsaved';error:string|null};
const values=(user:ApiUser):Saved=>({theme:user.preferences.theme,nickname:user.nickname});
const difference=(desired:Saved,confirmed:Saved):PreferencesPatch=>{
  const patch:PreferencesPatch={};
  if(desired.theme!==confirmed.theme)patch.theme=desired.theme;
  if(desired.nickname!==confirmed.nickname)patch.nickname=desired.nickname;
  return patch;
};
const validation=(error:ApiError):string=>{
  if(!error.fields)return error.message;
  const messages=Object.entries(error.fields).flatMap(([field,issues])=>
    Array.isArray(issues)?issues.map(issue=>field+': '+(typeof issue?.message==='string'?issue.message:'Invalid value')):[]);
  return messages.join('; ')||error.message;
};

/** One serialized PATCH queue per mounted authenticated user; no account data in localStorage. */
export class UserPreferenceStore {
  private current:PreferenceView;
  private confirmed:Saved;
  private listeners=new Set<()=>void>();
  private busy=false;
  private blocked=false;
  private active=true;
  private ambiguous=false;
  private controller:AbortController|null=null;
  private csrfRefresh:Promise<unknown>|null=null;
  private source:WorkspaceSource;
  private userId:number;
  private onExpired:()=>void;
  constructor(source:WorkspaceSource,userId:number,user:ApiUser,onExpired:()=>void){
    this.source=source;this.userId=userId;this.onExpired=onExpired;
    this.confirmed=values(user);
    this.current={...this.confirmed,status:'saved',error:null};
  }
  readonly snapshot=()=>this.current;
  readonly subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
  private emit(next:PreferenceView){if(!this.active)return;this.current=next;this.listeners.forEach(listener=>listener());}
  setTheme=(theme:ThemeMode)=>{if(!['system','light','dark'].includes(theme))return;this.edit({theme});};
  setNickname=(nickname:string)=>{
    if(typeof nickname!=='string'||nickname.length>80){
      this.emit({...this.current,status:'unsaved',error:'Nickname must be at most 80 characters.'});return;
    }
    this.edit({nickname});
  };
  private edit(changes:Partial<Saved>){
    if(!this.active)return;
    this.blocked=false;
    this.ambiguous=false;
    this.emit({...this.current,...changes,status:'saving',error:null});
    void this.flush();
  }
  private async flush():Promise<void>{
    if(!this.active||this.busy||this.blocked)return;
    const patch=difference(this.current,this.confirmed);
    if(!Object.keys(patch).length){
      this.emit({...this.current,status:'saved',error:null});return;
    }
    if(!this.source.savePreferences){
      this.emit({...this.current,status:'unsaved',error:'Preferences API is unavailable.'});this.blocked=true;return;
    }
    this.busy=true;
    const abort=new AbortController();
    this.controller=abort;
    try {
      const user=await this.source.savePreferences(patch,abort.signal);
      if(!this.active||abort.signal.aborted)return;
      if(user.id!==this.userId)throw new Error('Account changed during preferences update.');
      this.confirmed=values(user);
      const next={...this.current};
      // An older response cannot replace a newer local selection.
      if(patch.theme!==undefined&&next.theme===patch.theme)next.theme=this.confirmed.theme;
      if(patch.nickname!==undefined&&next.nickname===patch.nickname)next.nickname=this.confirmed.nickname;
      this.emit({...next,status:'saving',error:null});
    }catch(error){
      if(!this.active||abort.signal.aborted)return;
      this.blocked=true;
      this.ambiguous=!(error instanceof ApiError)||error.status>=500;
      const message=error instanceof ApiError
        ? error.status===403?'Security token expired. Retry saving after refreshing CSRF.':
          error.status===401?'Your session has expired.':
          error.status===400?validation(error):error.message
        : error instanceof Error?error.message:'Cannot save preferences';
      this.emit({...this.current,status:'unsaved',error:message});
      if(error instanceof ApiError&&error.status===401)this.onExpired();
      if(error instanceof ApiError&&error.status===403&&this.source.refreshCsrf){
        this.csrfRefresh=this.source.refreshCsrf(abort.signal).catch(()=>{}).finally(()=>{this.csrfRefresh=null;});
      }
    }finally{
      this.busy=false;
      if(this.controller===abort)this.controller=null;
      if(this.active&&!this.blocked)void this.flush();
    }
  }
  retry=async()=>{
    if(!this.active||this.busy)return;
    try{
      if(this.csrfRefresh)await this.csrfRefresh;
      if(this.ambiguous){
        // A failed network response may have committed the PATCH on the server.
        const session=await this.source.session();
        if(!this.active)return;
        if(session.status!=='authenticated'||session.user.id!==this.userId){
          this.onExpired();return;
        }
        this.confirmed=values(session.user);
      }
      this.ambiguous=false;
      this.blocked=false;
      if(!this.active)return;
      this.emit({...this.current,status:'saving',error:null});
      void this.flush();
    }catch(error){
      if(!this.active)return;
      this.emit({...this.current,status:'unsaved',error:error instanceof Error?error.message:'Unable to recheck saved preferences.'});
    }
  };
  dispose(){this.active=false;this.controller?.abort();this.listeners.clear();}
}
export function useUserPreferences(source:WorkspaceSource,user:ApiUser,onExpired:()=>void){
  const store=useMemo(()=>new UserPreferenceStore(source,user.id,user,onExpired),[source,user.id,onExpired]);
  useEffect(()=>()=>store.dispose(),[store]);
  const view=useSyncExternalStore(store.subscribe,store.snapshot,store.snapshot);
  return {...view,setTheme:store.setTheme,saveNickname:store.setNickname,retry:store.retry};
}
