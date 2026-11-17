import {useEffect,useMemo,useSyncExternalStore} from 'react';
import type {WorkspaceSource} from '../types/source';
import {FilesController,filesAvailable} from './FilesController';
export function useFiles(source:WorkspaceSource,userId:number,capable:boolean,visible:boolean,onExpired:()=>void){
 const controller=useMemo(()=>new FilesController(source,onExpired),[source,userId,onExpired]);
 useSyncExternalStore(controller.subscribe,controller.snapshot,controller.snapshot);
 const available=filesAvailable(source,capable);
 useEffect(()=>{if(available)controller.start();return()=>controller.stop();},[controller,available]);
 useEffect(()=>controller.setVisible(visible&&available),[controller,available,visible]);
 return {available,controller,presentation:controller.presentation()};
}
