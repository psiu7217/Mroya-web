import React,{useMemo} from 'react';
import {createLiveSource} from './liveSource';
import {useSession} from '../hooks/useSession';
import {LoginScreen} from '../components/LoginScreen';
import {BrandMark} from '../components/BrandMark';
export default function ProductionRoot(){
  const source=useMemo(()=>createLiveSource(),[]);
  const {session,pending,error,login,logout}=useSession(source);
  if(session.status==='guest')return <LoginScreen pending={pending} error={error} onSubmit={login}/>;
  return <main className="min-h-screen flex items-center justify-center bg-[var(--mroya-bg)] text-[var(--mroya-text)] p-6"><section className="max-w-lg space-y-4"><BrandMark size="lg"/>
    {session.status==='loading'?<p role="status">Loading your session…</p>:session.status==='error'?<p role="alert">{session.message}</p>:<><h1 className="text-xl font-semibold">Welcome, {session.user.first_name||session.user.username}</h1><p>Session verified. The live workspace adapter is pending; this build is not approved for production cutover.</p><button onClick={()=>void logout()} disabled={pending} className="rounded-full px-4 py-2 bg-[var(--mroya-primary)] text-[var(--mroya-on-primary)]">Sign out</button></>}
  </section></main>;
}
