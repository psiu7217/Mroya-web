import {useEffect,useMemo,useSyncExternalStore} from 'react';
import type {WorkspaceSource} from '../types/source.ts';
import {CalendarAnalysisController} from './CalendarAnalysisController.ts';
export function useCalendarAnalysis(source:WorkspaceSource,userId:number,connectionId:string|null,visible:boolean,onExpired:()=>void){
 const controller=useMemo(()=>new CalendarAnalysisController(source,onExpired),[source,userId,onExpired]);
 useSyncExternalStore(controller.subscribe,controller.snapshot,controller.snapshot);
 useEffect(()=>()=>controller.stop(),[controller]);
 useEffect(()=>{
  const update=()=>controller.setContext(connectionId,visible&&(typeof document==='undefined'||document.visibilityState!=='hidden'));
  update();if(typeof document!=='undefined')document.addEventListener('visibilitychange',update);
  return()=>{if(typeof document!=='undefined')document.removeEventListener('visibilitychange',update);controller.setContext(connectionId,false);};
 },[controller,connectionId,visible]);
 return {controller,presentation:controller.presentation()};
}
