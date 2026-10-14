import type {ApiUser,HistoryResponse,MemoriesResponse,MemoryMapResponse,Capabilities,TurnResponse,ChatStreamEvent,SendOptions} from '../types/api.ts';
import {ApiError} from './errors.ts';
import {readChatStream} from './sse.ts';
function checkedUser(value: unknown): ApiUser {
  if (!value || typeof value !== 'object') throw new ApiError(502,'invalid_response','Missing API user');
  const user=value as Record<string,unknown>;
  if (typeof user.id !== 'number' || !['username','email','first_name','last_name','timezone'].every(field=>typeof user[field]==='string')) throw new ApiError(502,'invalid_response','Invalid API user');
  return value as ApiUser;
}
export class MroyaApi {
  private token='';
  private csrfPending:Promise<void>|null=null;
  private fetcher:typeof fetch;
  constructor(fetcher:typeof fetch=(input,init)=>globalThis.fetch(input,init)) {this.fetcher=fetcher;}
  private async check(response:Response):Promise<void> {
    if(response.ok)return;
    const body=await response.json().catch(()=>({}));
    if(response.status===401)this.token='';
    throw new ApiError(response.status,typeof body?.error?.code==='string'?body.error.code:'http_error',typeof body?.error?.message==='string'?body.error.message:`HTTP ${response.status}`);
  }
  private async json<T>(path:string,body?:unknown,signal?:AbortSignal):Promise<T> {
    if(body!==undefined&&!this.token)await this.csrf(signal);
    const response=await this.fetcher('/api/v1/'+path,{method:body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',redirect:'error',signal,
      headers:body===undefined?{Accept:'application/json'}:{Accept:'application/json','Content-Type':'application/json','X-CSRFToken':this.token},body:body===undefined?undefined:JSON.stringify(body)});
    await this.check(response);
    if(!response.headers.get('Content-Type')?.includes('application/json'))throw new ApiError(502,'invalid_response','Expected API JSON, received a different response');
    return response.json() as Promise<T>;
  }
  async csrf(signal?:AbortSignal):Promise<string> {
    if(this.csrfPending){await this.csrfPending;return this.token;}
    this.csrfPending=(async()=>{const data=await this.json<{csrf_token:string}>('auth/csrf/',undefined,signal);if(typeof data.csrf_token!=='string'||!data.csrf_token)throw new ApiError(502,'invalid_response','Missing CSRF token');this.token=data.csrf_token;})();
    try{await this.csrfPending;return this.token;}finally{this.csrfPending=null;}
  }
  async startGoogleAuth(signal?:AbortSignal):Promise<void> {
    const caps=await this.capabilities(signal);
    if(!caps.google_oauth)throw new ApiError(400,'oauth_unavailable','Google sign-in is not configured on this server.');
    const token=await this.csrf(signal);
    if(typeof document!=='undefined'){
      const form=document.createElement('form');
      form.method='POST';
      form.action='/api/v1/auth/google/start/';
      form.style.display='none';
      const input=document.createElement('input');
      input.type='hidden';
      input.name='csrfmiddlewaretoken';
      input.value=token;
      form.appendChild(input);
      document.body.appendChild(form);
      form.submit();
    }
  }
  async me(signal?:AbortSignal):Promise<{user:ApiUser}>{const data=await this.json<{user:unknown}>('me/',undefined,signal);return {user:checkedUser(data.user)};}
  async login(username:string,password:string,signal?:AbortSignal):Promise<ApiUser>{const data=await this.json<{user:ApiUser;csrf_token:string}>('auth/login/',{username,password},signal);if(typeof data.csrf_token!=='string'||!data.csrf_token)throw new ApiError(502,'invalid_response','Missing login fields');this.token=data.csrf_token;return checkedUser(data.user);}
  async logout(signal?:AbortSignal):Promise<void>{const data=await this.json<{status:'logged_out';csrf_token:string}>('auth/logout/',{},signal);if(data.status!=='logged_out'||!data.csrf_token)throw new ApiError(502,'invalid_response','Missing logout fields');this.token=data.csrf_token;}
  history(before?:number,signal?:AbortSignal):Promise<HistoryResponse>{return this.json('chat/messages/'+(before===undefined?'':'?before='+encodeURIComponent(before)),undefined,signal);}
  memories(options:{state?:'active'|'history'|'all';q?:string;offset?:number;limit?:number}={},signal?:AbortSignal):Promise<MemoriesResponse>{const query=new URLSearchParams(Object.entries(options).filter(([,v])=>v!==undefined).map(([k,v])=>[k,String(v)]));return this.json('memories/'+(query.size?'?'+query:''),undefined,signal);}
  map(signal?:AbortSignal):Promise<MemoryMapResponse>{return this.json('memories/map/',undefined,signal);}
  capabilities(signal?:AbortSignal):Promise<Capabilities>{return this.json('capabilities/',undefined,signal);}
  turn(id:string,signal?:AbortSignal):Promise<TurnResponse>{if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))throw new Error('Invalid turn UUID');return this.json('chat/turns/'+id+'/',undefined,signal);}
  async send(content:string,submissionId:string,onEvent:(event:ChatStreamEvent)=>void,options:SendOptions={}):Promise<void>{
    if(!content.trim()||content.length>16000)throw new Error('Message must contain 1–16000 characters');
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(submissionId))throw new Error('Invalid submission UUID');
    if(!this.token)await this.csrf(options.signal);
    const response=await this.fetcher('/api/v1/chat/send/',{method:'POST',credentials:'same-origin',cache:'no-store',redirect:'error',signal:options.signal,
      headers:{Accept:'text/event-stream, application/json','Content-Type':'application/json','X-CSRFToken':this.token},
      body:JSON.stringify({content,submission_id:submissionId,...(options.retry===undefined?{}:{retry:options.retry}),...(options.timezone===undefined?{}:{timezone:options.timezone})})});
    await this.check(response);
    const turn=response.headers.get('X-Chat-Turn-ID');if(turn)options.onTurn?.(turn);
    if(response.headers.get('Content-Type')?.includes('application/json')){const data=await response.json();if(data.state!=='completed'||typeof data.content!=='string')throw new ApiError(502,'invalid_response','Invalid completed replay');onEvent({event:'replay',data});return;}
    if(!response.headers.get('Content-Type')?.includes('text/event-stream')||!response.body)throw new ApiError(502,'invalid_response','Expected chat event stream');
    await readChatStream(response.body,onEvent);
  }
}
