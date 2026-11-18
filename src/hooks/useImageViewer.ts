import {useEffect,useMemo,useSyncExternalStore} from 'react';
import {ImageViewerController} from './ImageViewerController';
import type {WorkspaceSource} from '../types/source';

export function useImageViewer(source:WorkspaceSource,userId:number,scope:string,onExpired:()=>void){
 const controller=useMemo(()=>new ImageViewerController(source,onExpired),[source,userId,onExpired]);
 useSyncExternalStore(controller.subscribe,controller.snapshot,controller.snapshot);
 useEffect(()=>{controller.start();return()=>controller.stop();},[controller]);
 useEffect(()=>{controller.close();},[controller,scope]);
 return {controller,presentation:controller.presentation()};
}
