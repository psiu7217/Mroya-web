import type { ChatStreamEvent } from '../types/api.ts';
import {ApiError, StreamInterruptedError} from './errors.ts';
export async function readChatStream(body:ReadableStream<Uint8Array>,onEvent:(event:ChatStreamEvent)=>void):Promise<void> {
  const reader=body.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});
  let buffer='',terminal=false,sequence=0,turnNumber=0;
  function frame(text:string) {
    let event='message';const data:string[]=[];
    for(const line of text.split(/\r?\n/)) {
      if(line.startsWith('event:'))event=line.slice(6).trim();
      if(line.startsWith('data:'))data.push(line.slice(5).replace(/^ /,''));
    }
    if(new TextEncoder().encode(text).byteLength>2*1024*1024)throw new ApiError(502,'invalid_stream','Stream frame exceeds limit');
    if(!data.length)return;
    if(!['trace','delta','done','error','reasoning_delta','tool_activity'].includes(event))return;
    let value:unknown;
    try{value=JSON.parse(data.join('\n'));}catch{throw new ApiError(502,'invalid_stream','Invalid JSON in chat stream');}
    if(typeof value!=='object'||value===null||Array.isArray(value))throw new ApiError(502,'invalid_stream','Invalid event payload');
    const payload=value as Record<string,unknown>;
    if(event==='reasoning_delta'||event==='tool_activity'){
      if(!Number.isSafeInteger(payload.sequence)||(payload.sequence as number)<=sequence)
        throw new ApiError(502,'invalid_stream','Invalid live event sequence');
      sequence=payload.sequence as number;
      if(event==='reasoning_delta'){
        if(!Number.isSafeInteger(payload.turn_number)||(payload.turn_number as number)<1||(payload.turn_number as number)<turnNumber||typeof payload.text!=='string')
          throw new ApiError(502,'invalid_stream','Invalid reasoning event');
        turnNumber=payload.turn_number as number;
      }else{
        const activity=payload.activity as Record<string,unknown>|null;
        if(Object.keys(payload).some(key=>key!=='sequence'&&key!=='activity'))
          throw new ApiError(502,'invalid_stream','Unsupported tool activity schema');
        if(!activity||typeof activity!=='object'||Array.isArray(activity)||!['kind','status','title'].every(key=>typeof activity[key]==='string')
          ||Object.keys(activity).some(key=>!['kind','status','title'].includes(key))
          ||!['success','failure','neutral'].includes(activity.status as string)||!(activity.kind as string).trim()||!(activity.title as string).trim())
          throw new ApiError(502,'invalid_stream','Invalid tool activity');
      }
    }
    if(event==='delta'&&typeof payload.text!=='string')throw new ApiError(502,'invalid_stream','Invalid answer event');
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
      if(new TextEncoder().encode(buffer).byteLength>2*1024*1024)throw new ApiError(502,'invalid_stream','Stream frame exceeds limit');
      if(chunk.done)break;
    }
    if(!terminal)throw new StreamInterruptedError();
  } finally {await reader.cancel().catch(()=>{});reader.releaseLock();}
}
