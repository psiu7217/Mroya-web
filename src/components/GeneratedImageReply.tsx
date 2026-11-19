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
    // Inspect only images that the Markdown renderer accepted as protected originals.
    const images=Array.from(body.current?.querySelectorAll<HTMLImageElement>(
      'img.mroya-chat-image, .mroya-chat-image img'
    )??[]);
    if(!images.length){setPreview('empty');return;}
    const pendingImages=images.filter(image=>decoded.current.get(image)!==image.src);
    if(!pendingImages.length){setPreview('ready');return;}

    let current=true;
    setPreview('loading');
    void Promise.allSettled(pendingImages.map(image=>image.decode())).then(results=>{
      if(!current)return;
      results.forEach((result,index)=>{
        const image=pendingImages[index];
        image.toggleAttribute('data-preview-error',result.status==='rejected');
        if(result.status==='fulfilled')decoded.current.set(image,image.src);
      });
      setPreview(results.some(result=>result.status==='rejected')?'failed':'ready');
    });
    return ()=>{current=false;};
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
