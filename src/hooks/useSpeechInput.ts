import {useLayoutEffect,useMemo,useSyncExternalStore} from 'react';
import type {WorkspaceSource} from '../types/source';
import {SpeechInputController} from './SpeechInputController';
import type {SpeechPresentation} from '../types/speech';

export function useSpeechInput(source:WorkspaceSource,userId:number,context:string,onExpired:()=>void):SpeechPresentation {
  const controller=useMemo(()=>new SpeechInputController((audio,signal)=>{
    if(!source.transcribeAudio)throw new Error('Speech unavailable');
    return source.transcribeAudio(audio,signal);
  },onExpired),[source,userId,context,onExpired]);
  const state=useSyncExternalStore(controller.subscribe,controller.snapshot,controller.snapshot);
  useLayoutEffect(()=>{return controller.cancel;},[controller,context]);
  useLayoutEffect(()=>{
    const hidden=()=>{if(document.visibilityState==='hidden')controller.cancel();};
    const leave=()=>controller.cancel();
    document.addEventListener('visibilitychange',hidden);window.addEventListener('pagehide',leave);
    return ()=>{document.removeEventListener('visibilitychange',hidden);window.removeEventListener('pagehide',leave);};
  },[controller]);
  return {...state,onStart:()=>void controller.start(),onStop:controller.stop,onCancel:controller.cancel,onInserted:controller.inserted};
}
