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
 useEffect(()=>{
   const authMsg=readAndClearAuthError();
   if(authMsg){setError(authMsg);setLoginOpen(true);}
 },[setError]);
 useEffect(()=>{if(session.status!=="guest")setLoginOpen(false);},[session.status]);
 if(session.status==='loading'||session.status==='error')return <main className="min-h-dvh flex items-center justify-center bg-[var(--mroya-bg)] text-[var(--mroya-text)] p-6"><section className="max-w-md space-y-4"><BrandMark size="lg"/>{session.status==='loading'?<p role="status">Checking your session…</p>:<><p role="alert">We couldn’t check your session. {session.message}</p><button onClick={refresh} className="rounded-full px-5 py-2 bg-[var(--mroya-primary)] text-[var(--mroya-on-primary)]">Try again</button></>}</section></main>;
 if(session.status==='authenticated')return <LiveExperience key={session.user.id} source={source} user={session.user} onExpired={refresh} onLogout={()=>{setLoginOpen(false);void logout();}}/>;
 return <><GuestExperience onSignIn={()=>setLoginOpen(true)}/>{loginOpen&&<LoginDialog pending={pending} error={error} onSubmit={async(username,password)=>{await login(username,password);}} onGoogleSignIn={googleAvailable?startGoogleAuth:undefined} onClose={()=>{setLoginOpen(false);setError(null);}}/>}</>;
}
