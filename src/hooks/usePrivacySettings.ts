import {useCallback,useEffect,useRef,useState} from 'react';
import type {WorkspaceSource} from '../types/source';
import type {PrivacyKind,PrivacyState} from '../api/privacy';
import {ApiError} from '../api/errors';
import type {PrivacyPresentation} from '../types/privacy';
export function usePrivacySettings(source:WorkspaceSource,ownerId:number,onExpired:()=>void):PrivacyPresentation {
 const [state,setState]=useState<PrivacyState|null>(null),[busy,setBusy]=useState(false);
 const [error,setError]=useState<string|null>(null),[message,setMessage]=useState<string|null>(null);
 const generation=useRef(0),pending=useRef<AbortController|null>(null);
 const run=useCallback(async(action:(signal:AbortSignal)=>Promise<PrivacyState|undefined>)=>{
  if(pending.current)return;const controller=new AbortController(),ticket=generation.current;
  pending.current=controller;setBusy(true);setError(null);setMessage(null);
  try{const value=await action(controller.signal);if(ticket===generation.current&&!controller.signal.aborted&&value)setState(value);}
  catch(e){if(ticket===generation.current&&!controller.signal.aborted){
   if(e instanceof ApiError&&e.status===401)onExpired();
   setError('Privacy action was not confirmed. Refresh before retrying.');
  }}
  finally{if(ticket===generation.current){pending.current=null;setBusy(false);}}
 },[source,ownerId,onExpired]);
 const refresh=useCallback(()=>void run(async signal=>{
  if(!source.privacySettings)throw new Error('Unavailable');return source.privacySettings(signal);
 }),[run,source]);
 useEffect(()=>{generation.current++;setState(null);refresh();return()=>{
  generation.current++;pending.current?.abort();pending.current=null;
 };},[source,ownerId]);
 return {state,busy,error,message,refresh,
  consent:enabled=>void run(async signal=>{
   if(!source.savePrivacyConsent||!state)throw new Error('Unavailable');
   return source.savePrivacyConsent(enabled,state.notice_version,signal);
  }),
  request:kind=>void run(async signal=>{
   if(!source.requestPrivacy||!source.privacySettings)throw new Error('Unavailable');
   const receipt=await source.requestPrivacy(kind,signal);
   const updated=await source.privacySettings(signal);
   if(!signal.aborted)setMessage(receipt.message+' Request ID: '+receipt.id);
   return updated;
  })};
}
