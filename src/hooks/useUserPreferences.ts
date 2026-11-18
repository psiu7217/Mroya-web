import {useEffect,useMemo,useSyncExternalStore} from 'react';
import {ApiError} from '../api/errors.ts';
import type {ApiUser,PreferencesPatch,ThemeMode} from '../types/api.ts';
import type {WorkspaceSource} from '../types/source.ts';
import type {AppLanguage} from '../types/api.ts';

type Saved = {theme:ThemeMode;nickname:string;show_model_reasoning:boolean;language:AppLanguage};
export type PreferenceView = Saved & {status:'saved'|'saving'|'unsaved';error:string|null;languageStatus:'saved'|'saving'|'unsaved';languageError:string|null};
const validLanguage=(value:unknown):AppLanguage|null=>value==='en'||value==='ru'?value:null;
const values=(user:ApiUser,fallbackLanguage:AppLanguage):Saved=>({theme:user.preferences.theme,nickname:user.nickname,show_model_reasoning:user.preferences.show_model_reasoning??false,language:validLanguage(user.preferences.language)??fallbackLanguage});
const difference=(desired:Saved,confirmed:Saved):PreferencesPatch=>{
  const patch:PreferencesPatch={};
  if(desired.theme!==confirmed.theme)patch.theme=desired.theme;
  if(desired.nickname!==confirmed.nickname)patch.nickname=desired.nickname;
  if(desired.show_model_reasoning!==confirmed.show_model_reasoning)patch.show_model_reasoning=desired.show_model_reasoning;
  if(desired.language!==confirmed.language)patch.language=desired.language;
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
  private csrfRequired=false;
  private csrfController:AbortController|null=null;
  private validationError:string|null=null;
  private dirty={theme:false,nickname:false,show_model_reasoning:false,language:false};
  private revisions={theme:0,nickname:0,show_model_reasoning:0,language:0};
  private automaticLanguageInitPending=false;
  private languageConfirmed:boolean;
  private fallbackLanguage:AppLanguage;
  private source:WorkspaceSource;
  private userId:number;
  private onExpired:()=>void;
  constructor(source:WorkspaceSource,userId:number,user:ApiUser,onExpired:()=>void,fallbackLanguage:AppLanguage='en'){
    this.source=source;this.userId=userId;this.onExpired=onExpired;this.fallbackLanguage=fallbackLanguage;
    const savedLanguage=validLanguage(user.preferences.language);
    this.languageConfirmed=savedLanguage!==null;
    this.confirmed=values(user,savedLanguage??fallbackLanguage);
    this.current={...this.confirmed,status:'saved',error:null,languageStatus:this.languageConfirmed?'saved':'saving',languageError:null};
    this.automaticLanguageInitPending=!savedLanguage;
  }
  readonly snapshot=()=>this.current;
  readonly subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
  start(){if(!this.active||!this.automaticLanguageInitPending)return;this.emit({...this.current,status:'saving',error:null,languageStatus:'saving',languageError:null});void this.flush();}
  private emit(next:PreferenceView){if(!this.active)return;this.current=next;this.listeners.forEach(listener=>listener());}
  setTheme=(theme:ThemeMode)=>{if(!['system','light','dark'].includes(theme))return;this.edit({theme});};
  setLanguage=(language:AppLanguage)=>{
    if(!validLanguage(language))return;
    this.automaticLanguageInitPending=false;
    if(this.blocked&&!this.ambiguous&&!this.csrfRequired&&!this.validationError)this.blocked=false;
    this.dirty.language=true;this.revisions.language++;
    this.current={...this.current,language,languageStatus:this.blocked?'unsaved':'saving',languageError:this.blocked?this.current.languageError:null};
    this.emit({...this.current,status:this.busy?'saving':this.blocked?'unsaved':'saving',error:this.blocked?this.current.error:null});
    if(!this.blocked)void this.flush();
  };
  setShowModelReasoning=(enabled:boolean)=>{if(typeof enabled==='boolean')this.edit({show_model_reasoning:enabled});};
  setNickname=(nickname:string)=>{
    nickname=typeof nickname==='string'?nickname.trim():nickname;
    if(typeof nickname!=='string'||Array.from(nickname).length>80){
      this.validationError='Nickname must be at most 80 characters.';this.blocked=true;
      this.emit({...this.current,status:'unsaved',error:this.validationError});return;
    }
    if(this.validationError&&!this.ambiguous&&!this.csrfRequired)this.blocked=false;
    this.validationError=null;
    this.edit({nickname});
  };
  private edit(changes:Partial<Saved>){
    if(!this.active)return;
    for(const field of Object.keys(changes) as (keyof Saved)[]){this.dirty[field]=true;this.revisions[field]++;}
    // Failed/ambiguous writes require explicit reconciliation, even after another edit.
    this.emit({...this.current,...changes,status:this.busy?'saving':this.blocked?'unsaved':'saving',error:this.blocked?this.current.error:null});
    void this.flush();
  }
  private async flush():Promise<void>{
    if(!this.active||this.busy||this.blocked||this.validationError)return;
    const patch=difference(this.current,this.confirmed);
    if(this.dirty.language&&!this.languageConfirmed&&patch.language===undefined)patch.language=this.current.language;
    if(this.automaticLanguageInitPending&&!('language' in patch)){
      patch.language=this.current.language;patch.language_only_if_unset=true;
    }
    if(!Object.keys(patch).length){
      if(!this.automaticLanguageInitPending&&this.current.language===this.confirmed.language){
        this.dirty.language=false;
        this.emit({...this.current,status:'saved',error:null,languageStatus:'saved',languageError:null});
      }else this.emit({...this.current,status:'saved',error:null});
      return;
    }
    if(!this.source.savePreferences){
      const error='Preferences API is unavailable.';this.emit({...this.current,status:'unsaved',error,languageStatus:this.automaticLanguageInitPending||this.dirty.language?'unsaved':this.current.languageStatus,languageError:this.automaticLanguageInitPending||this.dirty.language?error:this.current.languageError});this.blocked=true;return;
    }
    this.busy=true;
    if(patch.language!==undefined)this.emit({...this.current,languageStatus:'saving',languageError:null,status:'saving',error:null});
    const sent={...this.revisions};
    const abort=new AbortController();
    this.controller=abort;
    try {
      const user=await this.source.savePreferences(patch,abort.signal);
      if(!this.active||abort.signal.aborted)return;
      if(user.id!==this.userId)throw new ApiError(401,'session_changed','Account changed during preferences update.');
      if(validLanguage(user.preferences.language))this.languageConfirmed=true;
      this.accept(user,patch,sent);
      if(patch.language!==undefined){
        const savedLanguage=validLanguage(user.preferences.language);
        if(!savedLanguage)throw new ApiError(502,'invalid_response','The server did not confirm the saved interface language.');
        this.automaticLanguageInitPending=false;
        if(this.revisions.language===sent.language&&this.current.language===savedLanguage){this.dirty.language=false;this.current={...this.current,languageStatus:'saved',languageError:null};}
      }
      this.emit({...this.current,status:this.blocked?'unsaved':'saving',error:this.validationError});
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
      if(patch.language!==undefined)this.emit({...this.current,status:'unsaved',error:message,languageStatus:'unsaved',languageError:message});
      if(error instanceof ApiError&&error.status===401){this.dispose();this.onExpired();}
      if(error instanceof ApiError&&error.status===403&&this.source.refreshCsrf){
        this.csrfRequired=true;this.csrfController=abort;
        this.csrfRefresh=this.source.refreshCsrf(abort.signal).then(()=>{if(this.active&&!abort.signal.aborted)this.csrfRequired=false;}).catch(()=>{}).finally(()=>{this.csrfRefresh=null;if(this.csrfController===abort)this.csrfController=null;});
      }
    }finally{
      this.busy=false;
      if(this.controller===abort)this.controller=null;
      if(this.active&&!this.blocked)void this.flush();
    }
  }
  private accept(user:ApiUser,patch:PreferencesPatch={},sent=this.revisions){
    if(validLanguage(user.preferences.language))this.languageConfirmed=true;
    this.confirmed=values(user,this.fallbackLanguage);
    let next={...this.current};
    for(const field of ['theme','nickname','show_model_reasoning','language'] as const){
      const canAdopt=field!=='language'||this.languageConfirmed;
      if(canAdopt&&(!this.dirty[field]||(patch[field]!==undefined&&this.revisions[field]===sent[field]))){
        next={...next,[field]:this.confirmed[field]};this.dirty[field]=false;
      }else if(canAdopt&&next[field]===this.confirmed[field])this.dirty[field]=false;
    }
    if(this.languageConfirmed&&(!this.dirty.language||(patch.language!==undefined&&this.revisions.language===sent.language)||next.language===this.confirmed.language)){this.dirty.language=false;next={...next,languageStatus:'saved',languageError:null};}
    this.current=next;
  }
  retry=async()=>{
    if(!this.active||this.busy)return;
    if(this.validationError){this.blocked=true;this.emit({...this.current,status:'unsaved',error:this.validationError});return;}
    this.busy=true;
    this.blocked=false;this.emit({...this.current,status:'saving',error:null,languageStatus:this.dirty.language||this.automaticLanguageInitPending?'saving':this.current.languageStatus,languageError:null});
    const abort=new AbortController();this.controller=abort;
    try{
      if(this.csrfRefresh)await this.csrfRefresh;
      if(!this.active||abort.signal.aborted)return;
      if(this.csrfRequired&&this.source.refreshCsrf){
        await this.source.refreshCsrf(abort.signal);
        if(!this.active||abort.signal.aborted)return;
        this.csrfRequired=false;
      }
      if(this.ambiguous){
        const session=await this.source.session(abort.signal);
        if(!this.active||abort.signal.aborted)return;
        if(session.status!=='authenticated'||session.user.id!==this.userId){
          this.dispose();this.onExpired();return;
        }
        this.accept(session.user);
      }
      if(this.validationError){this.blocked=true;this.emit({...this.current,status:'unsaved',error:this.validationError});return;}
      this.ambiguous=false;this.blocked=false;
      this.emit({...this.current,status:'saving',error:null});
    }catch(error){
      if(!this.active||abort.signal.aborted)return;
      this.blocked=true;
      this.emit({...this.current,status:'unsaved',error:error instanceof Error?error.message:'Unable to recheck saved preferences.'});
    }finally{
      this.busy=false;
      if(this.controller===abort)this.controller=null;
      if(this.active&&!this.blocked)void this.flush();
    }
  };
  dispose(){this.active=false;this.controller?.abort();this.csrfController?.abort();this.listeners.clear();}
}
export function useUserPreferences(source:WorkspaceSource,user:ApiUser,onExpired:()=>void,fallbackLanguage:AppLanguage='en'){
  const store=useMemo(()=>new UserPreferenceStore(source,user.id,user,onExpired,fallbackLanguage),[source,user.id,onExpired]);
  useEffect(()=>{store.start();return()=>store.dispose();},[store]);
  const view=useSyncExternalStore(store.subscribe,store.snapshot,store.snapshot);
  return {...view,setTheme:store.setTheme,setLanguage:store.setLanguage,saveNickname:store.setNickname,setShowModelReasoning:store.setShowModelReasoning,retry:store.retry,stop:()=>store.dispose()};
}
