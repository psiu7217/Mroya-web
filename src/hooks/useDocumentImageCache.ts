import {useCallback,useLayoutEffect,useMemo,useRef} from 'react';
import {ApiError} from '../api/errors';
import type {WorkspaceSource} from '../types/source';
import type {SessionView} from './useSession';
import {DocumentImageCache} from './DocumentImageCache';
import {documentImageStorage} from './documentImageStorage';

type ImageScopeEvent={type:'session';owner:number|null}|{type:'deleted';owner:number;id:string};

export function useDocumentImageCache(source:WorkspaceSource,session:SessionView,refresh:()=>void){
  const owner=session.status==='authenticated'?session.user.id:null;
  const channel=useRef<BroadcastChannel|null>(null);
  const cache=useMemo(()=>owner!==null&&source.documentImage
    ?new DocumentImageCache(owner,source.documentImage,refresh)
    :null,[owner,source,refresh]);
  const revoke=useCallback(()=>{void cache?.clear();},[cache]);

  useLayoutEffect(()=>{
    cache?.start();
    if(session.status==='guest')void documentImageStorage.retainAccount(null).catch(()=>{});
    return ()=>cache?.stop();
  },[cache,session.status]);

  useLayoutEffect(()=>{
    if(typeof BroadcastChannel==='undefined')return;
    const broadcast=new BroadcastChannel('mroya-document-images');
    channel.current=broadcast;
    broadcast.onmessage=(event:MessageEvent<ImageScopeEvent>)=>{
      const notice=event.data;
      if(notice?.type==='session'&&owner!==null&&notice.owner!==owner){
        cache?.stop();
        refresh();
      }
      if(notice?.type==='deleted'&&notice.owner===owner&&typeof notice.id==='string')void cache?.forget(notice.id);
    };
    if(session.status==='guest'||session.status==='authenticated')broadcast.postMessage({type:'session',owner} satisfies ImageScopeEvent);
    return ()=>{channel.current=null;broadcast.close();};
  },[cache,owner,refresh,session.status]);

  const workspaceSource=useMemo<WorkspaceSource>(()=>!cache?source:{
    ...source,
    documentImage:cache.load,
    deleteDocument:source.deleteDocument?async(id,signal)=>{
      const receipt=await source.deleteDocument!(id,signal);
      void cache.forget(id);
      channel.current?.postMessage({type:'deleted',owner:owner!,id} satisfies ImageScopeEvent);
      return receipt;
    }:undefined,
    documentDetail:source.documentDetail?async(id,signal)=>{
      try{return await source.documentDetail!(id,signal);}
      catch(error){
        if(error instanceof ApiError&&error.status===404){
          void cache.forget(id);
          channel.current?.postMessage({type:'deleted',owner:owner!,id} satisfies ImageScopeEvent);
        }
        throw error;
      }
    }:undefined,
  },[cache,owner,source]);

  return {cache,workspaceSource,revoke};
}
