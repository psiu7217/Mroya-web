import {useEffect,useMemo,useSyncExternalStore} from 'react';
import type {WorkspaceSource} from '../types/source';
import {ChatAttachmentsController} from './ChatAttachmentsController';
export function useChatAttachments(source:WorkspaceSource,userId:number,capable=true){
 const controller=useMemo(()=>new ChatAttachmentsController(source),[source,userId]);
 useSyncExternalStore(controller.subscribe,controller.snapshot,controller.snapshot);
 useEffect(()=>{if(capable)controller.start();return()=>controller.stop();},[controller,capable]);
 return {controller,presentation:capable&&source.uploadStagedDocument?controller.presentation():undefined};
}
