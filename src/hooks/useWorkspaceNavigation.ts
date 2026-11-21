import {useEffect,useRef,useState} from 'react';
import type {NavSection} from '../types/mroya';
import type {SettingsPage} from '../types/workspace';

interface Route {section:NavSection;settings?:SettingsPage;detail?:string}
const start:Route={section:'chat'};

export function useWorkspaceNavigation(onBack:()=>void) {
 const [route,setRoute]=useState<Route>(()=>typeof window!=='undefined'&&new URLSearchParams(window.location.search).has('calendar_google')
  ?{section:'connections',settings:'google'}:start);
 const current=useRef(route);
 const [scope]=useState(()=>crypto.randomUUID());
 const backCallback=useRef(onBack);
 backCallback.current=onBack;
 useEffect(()=>{
  const entry=(route:Route)=>({...window.history.state,mroyaWorkspace:{scope,route}});
  if(current.current.settings==='google'&&new URLSearchParams(window.location.search).has('calendar_google')){
   const returnUrl=new URL(window.location.href);
   const url=new URL(returnUrl);
   url.searchParams.delete('calendar_google');
   window.history.replaceState(entry({section:'connections',settings:'connections'}),'',url);
   window.history.pushState(entry(current.current),'',returnUrl);
  }else window.history.replaceState(entry(current.current),'');
  const pop=(event:PopStateEvent)=>{
   const entry=event.state?.mroyaWorkspace;
   if(entry?.scope!==scope)return;
   current.current=entry.route;
   setRoute(entry.route);
   backCallback.current();
  };
  window.addEventListener('popstate',pop);
  return ()=>window.removeEventListener('popstate',pop);
 },[scope]);
 const navigate=(next:Route)=>{
  if(next.section===current.current.section&&next.settings===current.current.settings&&next.detail===current.current.detail)return;
  window.history.pushState({...window.history.state,mroyaWorkspace:{scope:scope,route:next}},'');
  current.current=next;
  setRoute(next);
 };
 return {route,navigate,back:()=>window.history.back()};
}
