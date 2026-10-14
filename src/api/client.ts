import type {ReportContext,IssueReportResponse,TelegramConnectionStatus,TelegramLinkResponse,TelegramDisconnectResponse,ApiUser,PreferencesPatch,ThemeMode,HistoryResponse,MemoriesResponse,MemoryMapResponse,Capabilities,TurnResponse,ChatStreamEvent,SendOptions} from '../types/api.ts';
import {readReportContext,isTurnUuid} from './reportContext.ts';
import {ApiError} from './errors.ts';
import {readChatStream} from './sse.ts';
function checkedUser(value: unknown): ApiUser {
  if (!value || typeof value !== 'object') throw new ApiError(502,'invalid_response','Missing API user');
  const user=value as Record<string,unknown>;
  if (!Number.isSafeInteger(user.id)||typeof user.id !== 'number'||user.id<=0 || !['username','email','first_name','last_name','timezone'].every(field=>typeof user[field]==='string')) throw new ApiError(502,'invalid_response','Invalid API user');
  if(typeof user.nickname!=='string' || Array.from(user.nickname).length>80 || Array.isArray(user.preferences) || !user.preferences || typeof user.preferences!=='object'
    || !['system','light','dark'].includes((user.preferences as Record<string,unknown>).theme as ThemeMode))
    throw new ApiError(502,'invalid_response','Invalid API preferences');
  return value as ApiUser;
}
// A link is a bearer credential. Never include its value in errors or persistence.
export function validTelegramLink(value:string):boolean {
  try {
    const url=new URL(value);
    return url.protocol==='https:'&&url.host==='t.me'&&!url.username&&!url.password&&!url.hash
      && /^\/[A-Za-z0-9_]+$/.test(url.pathname)&&url.searchParams.size===1
      && /^[A-Za-z0-9_-]+$/.test(url.searchParams.get('start')??'');
  } catch {return false;}
}
export class MroyaApi {
  private token='';
  private csrfPending:Promise<void>|null=null;
  private fetcher:typeof fetch;
  constructor(fetcher:typeof fetch=(input,init)=>globalThis.fetch(input,init)) {this.fetcher=fetcher;}
  private async check(response:Response):Promise<void> {
    if(response.ok)return;
    const body=await response.json().catch(()=>({}));
    if(response.status===401||response.status===403)this.token='';
    const fields=body?.error?.fields;
    throw new ApiError(response.status,typeof body?.error?.code==='string'?body.error.code:'http_error',typeof body?.error?.message==='string'?body.error.message:`HTTP ${response.status}`,
      fields && typeof fields==='object' && !Array.isArray(fields) ? fields : undefined);
  }
  private async json<T>(path:string,body?:unknown,signal?:AbortSignal,method:'POST'|'PATCH'|'DELETE'='POST',acceptStatus?:(status:number)=>void):Promise<T> {
    if(body!==undefined&&!this.token)await this.csrf(signal);
    const response=await this.fetcher('/api/v1/'+path,{method:body===undefined?'GET':method,credentials:'same-origin',cache:'no-store',redirect:'error',signal,
      headers:body===undefined?{Accept:'application/json'}:{Accept:'application/json','Content-Type':'application/json','X-CSRFToken':this.token},body:body===undefined?undefined:JSON.stringify(body)});
    await this.check(response);
    acceptStatus?.(response.status);
    if(!response.headers.get('Content-Type')?.includes('application/json'))throw new ApiError(502,'invalid_response','Expected API JSON, received a different response');
    try{return await response.json() as T;}catch(error){if(signal?.aborted||(error instanceof Error&&error.name==='AbortError'))throw error;throw new ApiError(502,'invalid_response','Invalid API JSON');}
  }
  async csrf(signal?:AbortSignal):Promise<string> {
    if(this.csrfPending){await this.csrfPending;return this.token;}
    this.csrfPending=(async()=>{const data=await this.json<{csrf_token:string}>('auth/csrf/',undefined,signal);if(typeof data.csrf_token!=='string'||!data.csrf_token)throw new ApiError(502,'invalid_response','Missing CSRF token');this.token=data.csrf_token;})();
    try{await this.csrfPending;return this.token;}finally{this.csrfPending=null;}
  }
  async startGoogleAuth(signal?:AbortSignal):Promise<void> {
    const caps=await this.capabilities(signal);
    if(caps.google_oauth!==true)throw new ApiError(400,'oauth_unavailable','Google sign-in is not configured on this server.');
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
  async savePreferences(changes:PreferencesPatch,signal?:AbortSignal):Promise<ApiUser>{
    const keys=Object.keys(changes);
    if(keys.some(key=>key!=='theme'&&key!=='nickname'))throw new Error('Invalid preferences payload');
    const data=await this.json<{user:unknown}>('me/preferences/',changes,signal,'PATCH');
    return checkedUser(data.user);
  }
  async reportChatIssue(context:ReportContext,signal?:AbortSignal):Promise<IssueReportResponse>{
    const snapshot=readReportContext(context);
    if(!snapshot)throw new ApiError(400,'invalid_report','Invalid failure attempt');
    let status=0;
    const data=await this.json<unknown>('chat/turns/'+snapshot.turn_id+'/report/',{request_trace_id:snapshot.request_trace_id},signal,'POST',value=>{
      status=value;if(value!==200&&value!==201)throw new ApiError(502,'invalid_response','Invalid report status');
    });
    const v=data as Partial<IssueReportResponse>|null,issue=v?.issue;
    if(!v||Array.isArray(v)||typeof v.created!=='boolean'||v.created!==(status===201)||!issue||!isTurnUuid(issue.id)
      ||issue.turn_id!==snapshot.turn_id||issue.request_trace_id!==snapshot.request_trace_id
      ||!['new','investigating','resolved'].includes(issue.status)||typeof issue.created_at!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(issue.created_at)||!Number.isFinite(Date.parse(issue.created_at)))
      throw new ApiError(502,'invalid_response','Invalid report confirmation');
    return {issue:{id:issue.id,turn_id:issue.turn_id,request_trace_id:issue.request_trace_id,status:issue.status,created_at:issue.created_at},created:v.created};
  }
  async getChatErrorReport(turnId:string,signal?:AbortSignal):Promise<string>{
    if(!isTurnUuid(turnId))throw new ApiError(400,'invalid_report','Invalid turn UUID');
    const response=await this.fetcher('/api/v1/chat/turns/'+turnId+'/error/',{method:'GET',credentials:'same-origin',cache:'no-store',redirect:'error',signal,headers:{Accept:'text/plain'}});
    await this.check(response);
    if(response.status!==200||response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase()!=='text/plain')
      throw new ApiError(502,'invalid_response','Expected plain-text error report');
    const limit=16*1024,length=response.headers.get('Content-Length');
    if(length&&Number(length)>limit){await response.body?.cancel();throw new ApiError(502,'invalid_response','Error report exceeds limit');}
    if(!response.body)throw new ApiError(502,'invalid_response','Missing error report');
    const reader=response.body.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});let bytes=0,text='';
    try{
      while(true){signal?.throwIfAborted();const chunk=await reader.read();if(chunk.done)break;
        bytes+=chunk.value.byteLength;if(bytes>limit)throw new ApiError(502,'invalid_response','Error report exceeds limit');
        text+=decoder.decode(chunk.value,{stream:true});
      }
      text+=decoder.decode();signal?.throwIfAborted();
      if(!text.trim())throw new ApiError(502,'invalid_response','Empty error report');
      return text;
    }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
  }
  async telegramStatus(signal?:AbortSignal):Promise<TelegramConnectionStatus>{
    const data=await this.json<unknown>('me/telegram/',undefined,signal);
    if(!data||typeof data!=='object'||Array.isArray(data))throw new ApiError(502,'invalid_response','Invalid Telegram status');
    const v=data as Record<string,unknown>;
    if(typeof v.configured!=='boolean'||typeof v.connected!=='boolean'||typeof v.bot_username!=='string'
      || (v.telegram_username!==undefined&&typeof v.telegram_username!=='string')
      || (v.connected_at!==undefined&&(typeof v.connected_at!=='string'||!Number.isFinite(Date.parse(v.connected_at)))))
      throw new ApiError(502,'invalid_response','Invalid Telegram status');
    return data as TelegramConnectionStatus;
  }
  async createTelegramLink(signal?:AbortSignal):Promise<TelegramLinkResponse>{
    const data=await this.json<unknown>('me/telegram/link/',{},signal);
    if(!data||typeof data!=='object'||Array.isArray(data))throw new ApiError(502,'invalid_response','Invalid Telegram link');
    const v=data as Record<string,unknown>;
    if(typeof v.url!=='string'||!validTelegramLink(v.url)||typeof v.expires_at!=='string'||!Number.isFinite(Date.parse(v.expires_at)))
      throw new ApiError(502,'invalid_response','Invalid Telegram link');
    return data as TelegramLinkResponse;
  }
  async disconnectTelegram(signal?:AbortSignal):Promise<TelegramDisconnectResponse>{
    const data=await this.json<unknown>('me/telegram/',{},signal,'DELETE');
    if(!data||typeof data!=='object'||Array.isArray(data)||(data as Record<string,unknown>).connected!==false)
      throw new ApiError(502,'invalid_response','Invalid Telegram disconnect response');
    return {connected:false};
  }
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
