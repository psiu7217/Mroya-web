import {useCallback,useEffect,useRef,useState} from 'react';
import type {WorkspaceSource,SessionState} from '../types/source';
export type SessionView = SessionState | {status:'loading'} | {status:'error';message:string};
export function useSession(source:WorkspaceSource) {
  const [session,setSession]=useState<SessionView>({status:'loading'});
  const [pending,setPending]=useState(false),[error,setError]=useState<string|null>(null);
  const generation=useRef(0);
  const [attempt,setAttempt]=useState(0);
  const refresh=useCallback(()=>{generation.current++;setSession({status:"loading"});setError(null);setPending(false);setAttempt(v=>v+1);},[]);
  useEffect(()=>{const abort=new AbortController(),version=++generation.current;source.session(abort.signal).then(value=>{if(version===generation.current&&!abort.signal.aborted)setSession(value);}).catch(e=>{if(!abort.signal.aborted&&version===generation.current)setSession({status:'error',message:e instanceof Error?e.message:'Session unavailable'});});return()=>{abort.abort();generation.current++;};},[source,attempt]);
  const login=useCallback(async(username:string,password:string)=>{const version=++generation.current;setPending(true);setError(null);try{const user=await source.login(username,password);if(version===generation.current)setSession({status:'authenticated',user});}catch(e){if(version===generation.current){setSession({status:'guest'});setError(e instanceof Error?e.message:'Sign in failed');}}finally{if(version===generation.current)setPending(false);}},[source]);
  const logout=useCallback(async()=>{const version=++generation.current;setPending(true);setError(null);try{await source.logout();if(version===generation.current)setSession({status:'guest'});}catch(e){if(version===generation.current){setSession({status:'error',message:'Logout could not be confirmed. Reload your session.'});setError(e instanceof Error?e.message:'Logout failed');}}finally{if(version===generation.current)setPending(false);}},[source]);
  return {session,pending,error,login,logout,refresh};
}
