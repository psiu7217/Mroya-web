import {useEffect,useMemo,useRef,useSyncExternalStore} from 'react';
import type {WorkspaceSource} from '../types/source.ts';
import type {NotesPresentation} from '../types/notes.ts';
import {LiveNotesController,notePresentation,notesSourceAvailable} from './LiveNotesController.ts';
export function useLiveNotes(source:WorkspaceSource,userId:number,capable:boolean,visible:boolean,chatBusy:boolean,onExpired:()=>void){
 const controller=useMemo(()=>new LiveNotesController(source,onExpired),[source,userId,onExpired]);
 const state=useSyncExternalStore(controller.subscribe,controller.snapshot,controller.snapshot);
 const available=notesSourceAvailable(source,capable);
 useEffect(()=>{if(available)controller.start();return()=>controller.stop();},[controller,available]);
 useEffect(()=>{controller.setVisible(available&&visible);},[controller,available,visible]);
 const wasBusy=useRef(false);
 useEffect(()=>{
  // Chat may have created/updated/deleted a note. Never inspect tool payloads or read every body.
  if(wasBusy.current&&!chatBusy&&available&&visible)void controller.refresh();
  wasBusy.current=chatBusy;
 },[controller,available,visible,chatBusy]);
 const presentation:NotesPresentation={scopeKey:controller.scopeKey,loaded:state.loaded,loading:state.loading,loadingMore:state.loadingMore,error:state.error,hasMore:state.next!==null,
  selectedId:state.selectedId,selectedNote:state.selectedSummary?notePresentation(state.selectedSummary):null,detail:state.detail?notePresentation(state.detail):null,detailLoading:state.detailLoading,detailError:state.detailError,
  onSelect:controller.select,onRetry:()=>void controller.refresh(),onMore:()=>void controller.more(),onRetryDetail:controller.retryDetail};
 return {available,controller,presentation,notes:state.rows.map(notePresentation)};
}
