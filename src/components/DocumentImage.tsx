import React,{createContext,useContext,useEffect,useEffectEvent,useRef,useState} from 'react';
import {documentImageId} from '../utils/documentImage';

interface DocumentImages {
  load:(id:string,signal:AbortSignal)=>Promise<File>;
  discard:(id:string)=>void;
}

export const DocumentImagesContext=createContext<DocumentImages|null>(null);

export function DocumentImage({src,loading='lazy',onFailure,...props}:{
  src:string;loading?:'lazy'|'eager';onFailure?:()=>void;
}&Omit<React.ImgHTMLAttributes<HTMLImageElement>,'src'|'loading'|'onError'>){
  const images=useContext(DocumentImagesContext);
  const id=documentImageId(src);
  const element=useRef<HTMLImageElement>(null);
  const [preview,setPreview]=useState<{id:string;url:string|null}>();
  const reportFailure=useEffectEvent(()=>onFailure?.());

  useEffect(()=>{
    if(!images||!id)return;
    const request=new AbortController();
    let url:string|undefined;
    const load=()=>{
      void images.load(id,request.signal).then(file=>{
        if(request.signal.aborted)return;
        url=URL.createObjectURL(file);
        setPreview({id,url});
      },()=>{
        if(request.signal.aborted)return;
        setPreview({id,url:null});
        reportFailure();
      });
    };
    let observer:IntersectionObserver|undefined;
    if(loading==='lazy'&&element.current&&typeof IntersectionObserver!=='undefined'){
      observer=new IntersectionObserver(entries=>{
        if(!entries.some(entry=>entry.isIntersecting))return;
        observer?.disconnect();
        load();
      },{rootMargin:'200px'});
      observer.observe(element.current);
    }else load();
    return ()=>{
      request.abort();
      observer?.disconnect();
      if(url)URL.revokeObjectURL(url);
    };
  },[images,id,loading]);

  const cached=images&&id;
  const result=preview?.id===id?preview:undefined;
  return <img {...props} ref={element} src={cached?result?.url??undefined:src} loading={cached?'eager':loading}
    data-image-request={cached&&!result?.url?(result?'error':'pending'):undefined}
    onError={()=>{if(images&&id)images.discard(id);onFailure?.();}}/>;
}
