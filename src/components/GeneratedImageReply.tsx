import React, {useLayoutEffect, useRef, useState} from 'react';
import {tr} from '../i18n';
import {AssistantMarkdown} from './AssistantMarkdown';
import {ImageGenerationCard} from './ImageGenerationCard';

interface GeneratedImageReplyProps {
  content:string;
  streaming:boolean;
  onImageOpen?:(url:string,title:string)=>void;
}

export function GeneratedImageReply({content,streaming,onImageOpen}:GeneratedImageReplyProps) {
  const body=useRef<HTMLDivElement>(null);
  const decoded=useRef(new WeakMap<HTMLImageElement,string>());
  const [attempt,setAttempt]=useState(0);
  const [preview,setPreview]=useState<'empty'|'loading'|'ready'|'failed'>('empty');

  useLayoutEffect(() => {
    const root=body.current;
    if(!root)return;
    let revision=0;
    const update=()=>{
      const current=++revision;
      const images=Array.from(root.querySelectorAll<HTMLImageElement>('img.mroya-chat-image, .mroya-chat-image img'));
      if(!images.length){setPreview('empty');return;}
      if(images.some(image=>image.dataset.imageRequest==='pending')){setPreview('loading');return;}
      const pendingImages=images.filter(image=>decoded.current.get(image)!==image.src);
      if(!pendingImages.length){setPreview('ready');return;}

      setPreview('loading');
      void Promise.allSettled(pendingImages.map(async image=>{
        if(image.dataset.imageRequest==='error')throw new Error('Image request failed');
        await image.decode();
      })).then(results=>{
        if(current!==revision)return;
        results.forEach((result,index)=>{
          const image=pendingImages[index];
          image.toggleAttribute('data-preview-error',result.status==='rejected');
          if(result.status==='fulfilled')decoded.current.set(image,image.src);
        });
        setPreview(results.some(result=>result.status==='rejected')?'failed':'ready');
      });
    };
    const observer=new MutationObserver(update);
    observer.observe(root,{subtree:true,attributes:true,attributeFilter:['src','data-image-request']});
    update();
    return ()=>{revision++;observer.disconnect();};
  }, [content,attempt,onImageOpen]);

  const pending=preview==='loading'||(preview==='empty'&&streaming);
  return <>
    {pending&&<ImageGenerationCard/>}
    {preview==='failed'&&(
      <div className="mb-2 flex flex-wrap items-baseline gap-2 text-sm text-[var(--mroya-text-muted)]">
        <p role="alert">{tr('imageNotice_loadFailed',{ns:'chat'})}</p>
        <button type="button" onClick={()=>setAttempt(previous=>previous+1)} className="font-medium text-[var(--mroya-primary)] underline cursor-pointer">
          {tr('imageRetry',{ns:'chat'})}
        </button>
      </div>
    )}
    <div key={attempt} ref={body} hidden={pending}>
      {content&&<AssistantMarkdown content={content} onImageOpen={onImageOpen} eagerImages/>}
    </div>
  </>;
}
