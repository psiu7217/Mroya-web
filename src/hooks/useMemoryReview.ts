import {useEffect,useMemo,useSyncExternalStore} from 'react';
import type {WorkspaceSource} from '../types/source.ts';
import {MemoryReviewController} from './MemoryReviewController.ts';

export function useMemoryReview(source:WorkspaceSource,userId:number,visible:boolean,onExpired:()=>void){
 const controller=useMemo(()=>new MemoryReviewController(source,onExpired),[source,userId,onExpired]);
 const state=useSyncExternalStore(controller.subscribe,controller.snapshot,controller.snapshot);
 useEffect(()=>{
  if(visible)controller.start();
  return controller.stop;
 },[controller,visible]);
 const available=state.data&&(state.data.processing_enabled||state.data.summary.total>0);
 return {stop:controller.stop,presentation:visible&&available?{...state,onEnqueue:controller.enqueue,
  onRefresh:()=>void controller.refresh(),onRetry:controller.retry,onNext:controller.next,onPrevious:controller.previous}:undefined};
}
