import {useEffect,useState} from 'react';
import type {Conversation} from '../types/mroya';
import type {GreetingPhase} from '../components/GuestWelcome';
import {guestExchange} from './guestConversation';
export function useGuestChat(initial?:GreetingPhase, initialMessage?:string) {
 const [phase,setPhase]=useState<GreetingPhase>(initial??'pause');
 const [conversation,setConversation]=useState<Conversation|null>(()=>initialMessage?guestExchange(initialMessage,''):null);
 useEffect(()=>{if(initial)return;const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;const first=setTimeout(()=>setPhase(reduce?'ready':'typing'),350);const second=reduce?undefined:setTimeout(()=>setPhase('ready'),1850);return()=>{clearTimeout(first);clearTimeout(second);};},[initial]);
 return {phase,conversation,send:(content:string)=>{if(!content.trim())return;setPhase('ready');setConversation(guestExchange(content,new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})));},clear:()=>setConversation(null)};
}
