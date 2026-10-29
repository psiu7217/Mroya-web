import React,{useEffect,useLayoutEffect,useMemo,useState} from 'react';
import {createLiveSource} from './liveSource';
import {useSession} from '../hooks/useSession';
import {BrandMark} from '../components/BrandMark';
import {LoginDialog} from '../components/LoginDialog';
import {GuestExperience} from './GuestExperience';
import {LiveExperience} from './LiveExperience';
import {readAndClearAuthError} from '../api/errors';
import {initialGuestLanguage,setAppLanguage,tr} from '../i18n/index';
import {supportedLanguage} from '../i18n/language';
import {usePwaInstall} from '../hooks/usePwaInstall';
import {InstallDialog} from '../components/InstallDialog';
import type {InstallPresentation} from '../types/install';
export default function ProductionRoot(){
 const install=usePwaInstall();
 return <><ProductionSession install={install}/><InstallDialog install={install}/></>;
}
function ProductionSession({install}:{install:InstallPresentation}){
 const source=useMemo(()=>createLiveSource(),[]);
 const {session,pending,error,setError,login,logout,refresh,startGoogleAuth,googleAvailable}=useSession(source);
 const [loginOpen,setLoginOpen]=useState(false);
 // Retain the return notice across session loading/errors and refresh attempts.
 const [oauthError,setOAuthError]=useState<string|null>(null);
 const sessionLanguage=session.status==='authenticated'?session.user.preferences.language:undefined;
 const sessionUserId=session.status==='authenticated'?session.user.id:null;
 useLayoutEffect(()=>{
   const next=session.status==='authenticated'?supportedLanguage(sessionLanguage)??initialGuestLanguage:session.status==='guest'?initialGuestLanguage:null;
   if(next)setAppLanguage(next);
 },[session.status,sessionUserId,sessionLanguage]);
 useEffect(()=>{
   const authMsg=readAndClearAuthError();
   if(authMsg){setOAuthError(authMsg);setLoginOpen(true);}
 },[]);
 useEffect(()=>{if(session.status==="authenticated")setLoginOpen(false);},[session.status]);
 const authMessages:Record<string,string>={
  'Google sign-in was cancelled.':tr('googleCancelled',{ns:'auth'}),
  'Google sign-in failed. Please try again.':tr('googleFailed',{ns:'auth'}),
  'An account with this email already exists. Please use its existing sign-in method.':tr('googleConflict',{ns:'auth'}),
  'You are already signed in.':tr('alreadySignedIn',{ns:'auth'}),
 };
 const authNotice=oauthError&&<aside role="alert" className="fixed top-4 right-4 left-4 sm:left-auto z-50 max-w-md rounded-[14px] border border-[var(--mroya-divider)] bg-[var(--mroya-surface)] text-[var(--mroya-text)] p-4 shadow-[var(--mroya-shadow-subtle)]"><p>{authMessages[oauthError]??tr('googleFailed',{ns:'auth'})}</p><button type="button" onClick={()=>setOAuthError(null)} className="mt-2 text-sm text-[var(--mroya-primary)]">{tr('dismiss',{ns:'auth'})}</button></aside>;
 if(session.status==='loading'||session.status==='error')return <>{authNotice}<main className="min-h-dvh flex items-center justify-center bg-[var(--mroya-bg)] text-[var(--mroya-text)] p-6"><section className="max-w-md space-y-4"><BrandMark size="lg"/>{session.status==='loading'?<p role="status">{tr('checkingSession',{ns:'auth'})}</p>:<><p role="alert">{tr('sessionCheckFailed',{ns:'auth',message:tr('sessionUnavailable',{ns:'auth'})})}</p><button onClick={refresh} className="rounded-full px-5 py-2 bg-[var(--mroya-primary)] text-[var(--mroya-on-primary)]">{tr('retry',{ns:'common'})}</button></>}</section></main></>;
 if(session.status==='authenticated')return <>{authNotice}<LiveExperience install={install} key={session.user.id} source={source} user={session.user} onExpired={refresh} onLogout={()=>{setLoginOpen(false);void logout();}}/></>;
 return <><GuestExperience install={install} onSignIn={()=>setLoginOpen(true)}/>{loginOpen&&<LoginDialog pending={pending} error={error??oauthError} onSubmit={async(username,password)=>{setOAuthError(null);await login(username,password);}} onGoogleSignIn={googleAvailable?async()=>{setOAuthError(null);await startGoogleAuth();}:undefined} onClose={()=>{setLoginOpen(false);setError(null);setOAuthError(null);}}/>}</>;
}
