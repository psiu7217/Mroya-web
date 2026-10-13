import type { ChatStreamEvent } from '../types/api.ts';
import {ApiError, StreamInterruptedError} from './errors.ts';
export async function readChatStream(body:ReadableStream<Uint8Array>,onEvent:(event:ChatStreamEvent)=>void):Promise<void> {
  const reader=body.getReader(),decoder=new TextDecoder();
  let buffer='',terminal=false;
  function frame(text:string) {
    let event='message';const data:string[]=[];
    for(const line of text.split(/\r?\n/)) {
      if(line.startsWith('event:'))event=line.slice(6).trim();
      if(line.startsWith('data:'))data.push(line.slice(5).replace(/^ /,''));
    }
    if(!data.length)return;
    if(!['trace','delta','done','error'].includes(event))return;
    let value:unknown;
    try{value=JSON.parse(data.join('\n'));}catch{throw new ApiError(502,'invalid_stream','Invalid JSON in chat stream');}
    if(typeof value!=='object'||value===null||Array.isArray(value))throw new ApiError(502,'invalid_stream','Invalid event payload');
    const item={event,data:value} as ChatStreamEvent;
    if(terminal)throw new ApiError(502,'invalid_stream','Events after terminal frame');
    onEvent(item);
    if(event==='error') { terminal=true;throw new ApiError(502,'chat_failed',typeof item.data.message==='string'?item.data.message:'Chat failed'); }
    if(event==='done')terminal=true;
  }
  try {
    while(true) {
      const chunk=await reader.read();buffer+=decoder.decode(chunk.value,{stream:!chunk.done});
      let boundary:RegExpExecArray|null;
      while((boundary=/\r?\n\r?\n/.exec(buffer))) {frame(buffer.slice(0,boundary.index));buffer=buffer.slice(boundary.index+boundary[0].length);}
      if(buffer.length>2*1024*1024)throw new ApiError(502,'invalid_stream','Stream frame exceeds limit');
      if(chunk.done)break;
    }
    if(!terminal)throw new StreamInterruptedError();
  } finally {await reader.cancel().catch(()=>{});reader.releaseLock();}
}
