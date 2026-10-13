import {useEffect,useMemo,useSyncExternalStore} from 'react';
import type {WorkspaceSource} from '../types/source';
import {LiveWorkspaceController} from './LiveWorkspaceController';
export function useLiveWorkspace(source:WorkspaceSource,onExpired:()=>void) {
 const controller=useMemo(()=>new LiveWorkspaceController(source,onExpired),[source,onExpired]);
 const state=useSyncExternalStore(controller.subscribe,controller.snapshot,controller.snapshot);
 useEffect(()=>{controller.start();return()=>controller.stop();},[controller]);
 return {state,controller};
}
