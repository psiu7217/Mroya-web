import React,{useEffect,useMemo,useState} from 'react';
import {createLiveSource} from './liveSource';
import {useSession} from '../hooks/useSession';
import {BrandMark} from '../components/BrandMark';
import {LoginDialog} from '../components/LoginDialog';
import {GuestExperience} from './GuestExperience';
import {LiveExperience} from './LiveExperience';
import {readAndClearAuthError} from '../api/errors';
export default function ProductionRoot(){
 const source=useMemo(()=>createLiveSource(),[]);
 const {session,pending,error,setError,login,logout,refresh,startGoogleAuth,googleAvailable}=useSession(source);
 const [loginOpen,setLoginOpen]=useState(false);
 // Retain the return notice across session loading/errors and refresh attempts.
 const [oauthError,setOAuthError]=useState<string|null>(null);
 useEffect(()=>{
   const authMsg=readAndClearAuthError();
   if(authMsg){setOAuthError(authMsg);setLoginOpen(true);}
 },[]);
 useEffect(()=>{if(session.status==="authenticated")setLoginOpen(false);},[session.status]);
 const authNotice=oauthError&&<aside role="alert" className="fixed top-4 right-4 left-4 sm:left-auto z-50 max-w-md rounded-[14px] border border-[var(--mroya-divider)] bg-[var(--mroya-surface)] text-[var(--mroya-text)] p-4 shadow-[var(--mroya-shadow-subtle)]"><p>{oauthError}</p><button type="button" onClick={()=>setOAuthError(null)} className="mt-2 text-sm text-[var(--mroya-primary)]">Dismiss</button></aside>;
 if(session.status==='loading'||session.status==='error')return <>{authNotice}<main className="min-h-dvh flex items-center justify-center bg-[var(--mroya-bg)] text-[var(--mroya-text)] p-6"><section className="max-w-md space-y-4"><BrandMark size="lg"/>{session.status==='loading'?<p role="status">Checking your session…</p>:<><p role="alert">We couldn’t check your session. {session.message}</p><button onClick={refresh} className="rounded-full px-5 py-2 bg-[var(--mroya-primary)] text-[var(--mroya-on-primary)]">Try again</button></>}</section></main></>;
 if(session.status==='authenticated')return <>{authNotice}<LiveExperience key={session.user.id} source={source} user={session.user} onExpired={refresh} onLogout={()=>{setLoginOpen(false);void logout();}}/></>;
 return <><GuestExperience onSignIn={()=>setLoginOpen(true)}/>{loginOpen&&<LoginDialog pending={pending} error={error??oauthError} onSubmit={async(username,password)=>{setOAuthError(null);await login(username,password);}} onGoogleSignIn={googleAvailable?async()=>{setOAuthError(null);await startGoogleAuth();}:undefined} onClose={()=>{setLoginOpen(false);setError(null);setOAuthError(null);}}/>}</>;
}
