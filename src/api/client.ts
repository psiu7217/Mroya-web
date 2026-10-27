import {readAiTask,readAiTasksPage} from './aiTasks.ts';
import {readInitialResults} from './initialResults.ts';
import type {InitialDecision} from '../types/initialResults.ts';
import {readInitialQueue,readInitialQueueReceipt} from './initialQueue.ts';
import {readScanning} from './intelligence.ts';
import {readIntelligencePreferences,readIntelligenceSources,readIntelligenceSource,readEventAnalysis} from './intelligence.ts';
import {readNotesPage,readNoteDetail,noteId} from './notes.ts';
import {readNotificationSettings,readNotification,notificationUuid} from './notifications.ts';
import type {ProposalDecision,DecisionBody} from '../types/intelligenceApi.ts';
import {readIntelligenceSettings,readIntelligenceRuntime,readIntelligenceProposal,readProposalPage,readProposalHistory,validateDecision} from './intelligence.ts';
import type {GoogleConfiguration} from '../types/calendarApi.ts';
import {calendarUuid,readCalendarEvent,readCalendarPage,readCalendarOperation,readGoogleConnection,readGoogleConnections,googleAuthorizationUrl} from './calendar.ts';
import type {ReportContext,IssueReportResponse,TelegramConnectionStatus,TelegramLinkResponse,TelegramDisconnectResponse,ApiUser,PreferencesPatch,ThemeMode,HistoryResponse,MemoriesResponse,MemoryMapResponse,Capabilities,TurnResponse,ChatStreamEvent,SendOptions} from '../types/api.ts';
import {readReportContext,isTurnUuid} from './reportContext.ts';
import {ApiError} from './errors.ts';
import {conversationId,conversationTitle,readConversation,readConversationPage,readConversationHistory} from './conversations.ts';
import {readChatStream} from './sse.ts';
import {tr} from '../i18n/index.ts';
function checkedUser(value: unknown): ApiUser {
  if (!value || typeof value !== 'object') throw new ApiError(502,'invalid_response','Missing API user');
  const user=value as Record<string,unknown>;
  if (!Number.isSafeInteger(user.id)||typeof user.id !== 'number'||user.id<=0 || !['username','email','first_name','last_name','timezone'].every(field=>typeof user[field]==='string')) throw new ApiError(502,'invalid_response','Invalid API user');
  if(typeof user.nickname!=='string' || Array.from(user.nickname).length>80 || Array.isArray(user.preferences) || !user.preferences || typeof user.preferences!=='object'
    || !['system','light','dark'].includes((user.preferences as Record<string,unknown>).theme as ThemeMode))
    throw new ApiError(502,'invalid_response','Invalid API preferences');
  const reasoning=(user.preferences as Record<string,unknown>).show_model_reasoning;
  if(reasoning!==undefined&&typeof reasoning!=='boolean')throw new ApiError(502,'invalid_response','Invalid reasoning preference');
  const language=(user.preferences as Record<string,unknown>).language;
  if(language!==undefined&&language!==''&&language!=='en'&&language!=='ru')throw new ApiError(502,'invalid_response','Invalid interface language preference');
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
  async agentTasks(offset=0,signal?:AbortSignal){
    if(!Number.isSafeInteger(offset)||offset<0||offset>10000)throw new ApiError(400,'invalid_request','Invalid tasks offset');
    return readAiTasksPage(await this.json('agent-tasks/?limit=50&offset='+offset,undefined,signal),offset);
  }
  async agentTask(id:string,signal?:AbortSignal){
    if(!isTurnUuid(id))throw new ApiError(400,'invalid_request','Invalid task UUID');
    const data=await this.json<{task:unknown}>('agent-tasks/'+id+'/',undefined,signal);
    return readAiTask(data.task,id);
  }
  async initialFilterResults(decision:InitialDecision='APPROVE',offset=0,signal?:AbortSignal){
    if(!['APPROVE','REJECT'].includes(decision)||!Number.isSafeInteger(offset)||offset<0)throw new ApiError(400,'invalid_request','Invalid results page');
    return readInitialResults(await this.json(`memory-intelligence/initial-filter-results/?decision=${decision}&limit=50&offset=${offset}`,undefined,signal),decision,offset);
  }
  async initialFilterQueue(signal?:AbortSignal){return readInitialQueue(await this.json('memory-intelligence/initial-filter-queue/',undefined,signal));}
  async enqueueInitialFilter(calendarId:string,signal?:AbortSignal){
    if(!isTurnUuid(calendarId))throw new ApiError(400,'invalid_initial_queue_request','Invalid calendar UUID');
    return readInitialQueueReceipt(await this.json('memory-intelligence/initial-filter-queue/',{calendar_id:calendarId},signal,'POST',status=>{if(status!==200)throw new ApiError(502,'invalid_response','Queue registration was not confirmed');}));
  }

  async intelligencePreferences(signal?:AbortSignal){return readIntelligencePreferences(await this.json('memory-intelligence/settings/',undefined,signal));}
  async saveIntelligencePreferences(autonomy:'review_all'|'auto_link',signal?:AbortSignal){
    if(!['review_all','auto_link'].includes(autonomy))throw new ApiError(400,'invalid_autonomy','Unsupported autonomy');
    return readIntelligencePreferences(await this.json('memory-intelligence/settings/',{autonomy},signal,'PATCH'));
  }
  async intelligenceSources(offset=0,signal?:AbortSignal){if(!Number.isSafeInteger(offset)||offset<0||offset>10000)throw new Error('Invalid offset');return readIntelligenceSources(await this.json('memory-intelligence/sources/?limit=50&offset='+offset,undefined,signal),offset);}
  async saveIntelligenceSource(id:string,enabled:boolean,signal?:AbortSignal){if(!isTurnUuid(id)||typeof enabled!=='boolean')throw new Error('Invalid source');return readIntelligenceSource(await this.json('memory-intelligence/sources/calendar/'+id+'/',{enabled},signal,'PATCH'),id);}
  async eventAnalysis(id:string,signal?:AbortSignal){if(!isTurnUuid(id))throw new Error('Invalid event UUID');return readEventAnalysis(await this.json('memory-intelligence/calendar-events/'+id+'/status/',undefined,signal),id);}

  async notes(offset=0,signal?:AbortSignal){
    if(!Number.isSafeInteger(offset)||offset<0||offset>10000)throw new ApiError(400,'invalid_pagination','Invalid Notes offset');
    return readNotesPage(await this.json('notes/?limit=20&offset='+offset,undefined,signal),offset);
  }
  async note(id:string,signal?:AbortSignal){
    noteId(id);
    return readNoteDetail(await this.json('notes/'+id+'/',undefined,signal),id);
  }

  async notificationSettings(signal?:AbortSignal){return readNotificationSettings(await this.json('me/notifications/settings/',undefined,signal));}
  async saveNotificationSettings(enabled:boolean,signal?:AbortSignal){
    if(typeof enabled!=='boolean')throw new Error('Expected notification boolean');
    return readNotificationSettings(await this.json('me/notifications/settings/',{telegram_enabled:enabled},signal,'PATCH'));
  }
  async testNotification(requestId:string,signal?:AbortSignal){
    if(!notificationUuid(requestId))throw new Error('Invalid notification request UUID');
    return readNotification(await this.json('me/notifications/test/',{request_id:requestId},signal,'POST',status=>{
      if(status!==202)throw new ApiError(502,'invalid_response','Expected notification queue acknowledgement');
    }));
  }
  async notification(id:string,signal?:AbortSignal){
    if(!notificationUuid(id))throw new Error('Invalid notification UUID');
    return readNotification(await this.json('me/notifications/'+id+'/',undefined,signal),id);
  }
  async intelligenceSettings(signal?:AbortSignal){return readIntelligenceSettings(await this.json('memory-intelligence/settings/',undefined,signal));}
  async intelligenceScans(offset=0,signal?:AbortSignal){if(!Number.isSafeInteger(offset)||offset<0||offset>10000)throw Error('Invalid offset');return readScanning(await this.json('memory-intelligence/scans/?limit=50&offset='+offset,undefined,signal),offset);}
  async scanIntelligence(calendar_ids:string[],signal?:AbortSignal){if(!calendar_ids.length||calendar_ids.length>50||calendar_ids.some(id=>!isTurnUuid(id))||new Set(calendar_ids).size!==calendar_ids.length)throw Error('Invalid calendars');return readScanning(await this.json('memory-intelligence/scans/',{calendar_ids},signal));}
  async intelligenceStatus(signal?:AbortSignal){return readIntelligenceRuntime(await this.json('memory-intelligence/status/',undefined,signal));}
  async inboxProposals(offset=0,signal?:AbortSignal){return readProposalPage(await this.json('memory-intelligence/proposals/?limit=50&offset='+offset,undefined,signal),offset);}
  async inboxProposal(id:string,signal?:AbortSignal){if(!isTurnUuid(id))throw new Error('Invalid proposal UUID');const v=await this.json<{proposal:unknown}>('memory-intelligence/proposals/'+id+'/',undefined,signal);return readIntelligenceProposal(v.proposal,id);}
  async inboxHistory(id:string,offset=0,signal?:AbortSignal){if(!isTurnUuid(id))throw new Error('Invalid proposal UUID');return readProposalHistory(await this.json('memory-intelligence/proposals/'+id+'/history/?limit=50&offset='+offset,undefined,signal),offset);}
  async inboxDecision(id:string,action:ProposalDecision,body:DecisionBody,signal?:AbortSignal){
    validateDecision(id,action,body);
    const v=await this.json<{proposal:unknown;replayed:unknown}>('memory-intelligence/proposals/'+id+'/'+action+'/',body,signal);
    if(typeof v.replayed!=='boolean')throw new ApiError(502,'invalid_response','Invalid decision confirmation.');
    return {proposal:readIntelligenceProposal(v.proposal,id),replayed:v.replayed};
  }

  async calendarEvents(start:string,end:string,offset=0,signal?:AbortSignal){
    return readCalendarPage(await this.json('calendar/events/?'+new URLSearchParams({start_date:start,end_date:end,limit:'100',offset:String(offset)}),undefined,signal));
  }
  async calendarEvent(id:string,signal?:AbortSignal){if(!calendarUuid(id))throw new Error('Invalid calendar UUID');const data=await this.json<{event:unknown}>('calendar/events/'+id+'/',undefined,signal);return readCalendarEvent(data.event);}
  async mutateCalendar(method:'POST'|'PATCH'|'DELETE',id:string|null,body:unknown,signal?:AbortSignal){
    if(method!=='POST'&&!calendarUuid(id))throw new Error('Invalid calendar UUID');
    return readCalendarOperation(await this.json('calendar/events/'+(id?id+'/':''),body,signal,method),method==='DELETE');
  }
  async googleCalendarConnections(signal?:AbortSignal){return readGoogleConnections(await this.json('calendar/google/connections/',undefined,signal));}
  async startCalendarGoogle(id?:string,signal?:AbortSignal){if(id!==undefined&&!calendarUuid(id))throw new Error('Invalid connection UUID');return googleAuthorizationUrl(await this.json('calendar/google/start/',id?{connection_id:id}:{},signal));}
  async configureCalendarGoogle(id:string,changes:GoogleConfiguration,signal?:AbortSignal){
    if(!calendarUuid(id))throw new Error('Invalid connection UUID');
    const data=await this.json<{connection:unknown}>('calendar/google/connections/'+id+'/',changes,signal,'PATCH');return readGoogleConnection(data.connection);
  }
  async syncCalendarGoogle(id:string,signal?:AbortSignal){if(!calendarUuid(id))throw new Error('Invalid connection UUID');const data=await this.json<{status:string}>('calendar/google/connections/'+id+'/sync/',{},signal);if(data.status!=='pending')throw new ApiError(502,'invalid_response','Sync request was not confirmed');}
  async disconnectCalendarGoogle(id:string,signal?:AbortSignal){if(!calendarUuid(id))throw new Error('Invalid connection UUID');const data=await this.json<{status:string}>('calendar/google/connections/'+id+'/',{},signal,'DELETE');if(data.status!=='disconnected')throw new ApiError(502,'invalid_response','Disconnect was not confirmed');}
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
    if(keys.some(key=>key!=='theme'&&key!=='nickname'&&key!=='show_model_reasoning'&&key!=='timezone'&&key!=='timezone_only_if_unset'&&key!=='language'&&key!=='language_only_if_unset'))throw new Error('Invalid preferences payload');
    if(changes.language!==undefined&&changes.language!=='en'&&changes.language!=='ru')throw new Error('Invalid interface language');
    if(changes.language_only_if_unset!==undefined&&(typeof changes.language_only_if_unset!=='boolean'||changes.language===undefined))
      throw new ApiError(400,'invalid_preferences','Interface language is required with a boolean initialization flag.');
    if(changes.timezone!==undefined&&(typeof changes.timezone!=='string'||!changes.timezone||changes.timezone.length>128||changes.timezone.trim()!==changes.timezone))
      throw new ApiError(400,'invalid_preferences','Choose a non-empty IANA timezone without surrounding whitespace.');
    if('timezone_only_if_unset' in changes&&(typeof changes.timezone_only_if_unset!=='boolean'||changes.timezone===undefined))
      throw new ApiError(400,'invalid_preferences','Timezone is required with a boolean initialization flag.');
    const data=await this.json<{user:unknown}>('me/preferences/',changes,signal,'PATCH');
    const user=checkedUser(data.user);
    if(changes.show_model_reasoning!==undefined&&user.preferences.show_model_reasoning!==changes.show_model_reasoning)
      throw new ApiError(502,'invalid_response','Reasoning preference was not confirmed');
    if(changes.timezone!==undefined&&(!user.timezone||!changes.timezone_only_if_unset&&user.timezone!==changes.timezone))
      throw new ApiError(502,'invalid_response','Timezone was not confirmed by the backend.');
    if(changes.language!==undefined&&changes.language_only_if_unset===true&&!['en','ru'].includes(user.preferences.language??''))
      throw new ApiError(502,'invalid_response','The server did not return a confirmed interface language.');
    if(changes.language!==undefined&&changes.language_only_if_unset!==true&&user.preferences.language!==changes.language)
      throw new ApiError(502,'invalid_response','Interface language was not confirmed by the backend.');
    return user;
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
  getChatErrorReport(turnId:string,signal?:AbortSignal):Promise<string>{
    return this.readChatErrorReport(turnId,false,16*1024,signal);
  }
  getFullChatErrorReport(turnId:string,signal?:AbortSignal):Promise<string>{
    return this.readChatErrorReport(turnId,true,8*1024*1024,signal);
  }
  private async readChatErrorReport(turnId:string,full:boolean,limit:number,signal?:AbortSignal):Promise<string>{
    if(!isTurnUuid(turnId))throw new ApiError(400,'invalid_report','Invalid turn UUID');
    const response=await this.fetcher('/api/v1/chat/turns/'+turnId+'/error/'+(full?'full/':''),{method:'GET',credentials:'same-origin',cache:'no-store',redirect:'error',signal,headers:{Accept:'text/plain'}});
    await this.check(response);
    if(response.status!==200||response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase()!=='text/plain')
      throw new ApiError(502,'invalid_response','Expected plain-text error report');
    const length=response.headers.get('Content-Length');
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
  async conversations(offset=0,signal?:AbortSignal){
    if(!Number.isSafeInteger(offset)||offset<0||offset>100000)throw new ApiError(400,'invalid_pagination','Invalid conversation offset');
    return readConversationPage(await this.json('chat/conversations/?limit=100&offset='+offset,undefined,signal,'POST',status=>{if(status!==200)throw new ApiError(502,'invalid_response','Invalid list status');}),offset);
  }
  async createConversation(signal?:AbortSignal){
    const data=await this.json<{conversation:unknown}>('chat/conversations/',{},signal,'POST',status=>{if(status!==201)throw new ApiError(502,'invalid_response','Invalid create status');});
    return readConversation(data?.conversation);
  }
  async renameConversation(id:string,title:string,signal?:AbortSignal){
    const data=await this.json<{conversation:unknown}>('chat/conversations/'+conversationId(id)+'/',{title:conversationTitle(title)},signal,'PATCH',status=>{if(status!==200)throw new ApiError(502,'invalid_response','Invalid rename status');});
    const confirmed=readConversation(data?.conversation);if(confirmed.id!==id)throw new ApiError(502,'invalid_response','Conversation changed during rename');return confirmed;
  }
  async deleteConversation(id:string,signal?:AbortSignal):Promise<void>{
    const path='chat/conversations/'+conversationId(id)+'/';
    if(!this.token)await this.csrf(signal);
    const response=await this.fetcher('/api/v1/'+path,{method:'DELETE',credentials:'same-origin',cache:'no-store',redirect:'error',signal,headers:{Accept:'application/json','X-CSRFToken':this.token}});
    await this.check(response);
    if(response.status!==204)throw new ApiError(502,'invalid_response','Invalid delete confirmation');
  }
  async conversationHistory(id:string,before?:number,signal?:AbortSignal):Promise<HistoryResponse>{
    const path='chat/conversations/'+conversationId(id)+'/messages/';
    if(before!==undefined&&(!Number.isSafeInteger(before)||before<1))throw new ApiError(400,'invalid_pagination','Invalid history cursor');
    return readConversationHistory(await this.json(path+(before===undefined?'':'?before='+before),undefined,signal,'POST',status=>{if(status!==200)throw new ApiError(502,'invalid_response','Invalid history status');}),id);
  }
  sendConversation(id:string,content:string,submissionId:string,onEvent:(event:ChatStreamEvent)=>void,options:SendOptions={}):Promise<void>{
    return this.send(content,submissionId,onEvent,options,'chat/conversations/'+conversationId(id)+'/send/');
  }
  history(before?:number,signal?:AbortSignal):Promise<HistoryResponse>{return this.json('chat/messages/'+(before===undefined?'':'?before='+encodeURIComponent(before)),undefined,signal);}
  memories(options:{state?:'active'|'history'|'all';q?:string;offset?:number;limit?:number}={},signal?:AbortSignal):Promise<MemoriesResponse>{const query=new URLSearchParams(Object.entries(options).filter(([,v])=>v!==undefined).map(([k,v])=>[k,String(v)]));return this.json('memories/'+(query.size?'?'+query:''),undefined,signal);}
  map(signal?:AbortSignal):Promise<MemoryMapResponse>{return this.json('memories/map/',undefined,signal);}
  capabilities(signal?:AbortSignal):Promise<Capabilities>{return this.json('capabilities/',undefined,signal);}
  turn(id:string,signal?:AbortSignal):Promise<TurnResponse>{if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))throw new Error('Invalid turn UUID');return this.json('chat/turns/'+id+'/',undefined,signal);}
  async send(content:string,submissionId:string,onEvent:(event:ChatStreamEvent)=>void,options:SendOptions={},path='chat/send/'):Promise<void>{
    if(!content.trim()||content.length>16000)throw new Error(tr('messageLengthInvalid',{ns:'chat'}));
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(submissionId))throw new Error('Invalid submission UUID');
    if(!this.token)await this.csrf(options.signal);
    const response=await this.fetcher('/api/v1/'+path,{method:'POST',credentials:'same-origin',cache:'no-store',redirect:'error',signal:options.signal,
      headers:{Accept:'text/event-stream, application/json','Content-Type':'application/json','X-CSRFToken':this.token},
      body:JSON.stringify({content,submission_id:submissionId,...(options.retry===undefined?{}:{retry:options.retry}),...(options.timezone===undefined?{}:{timezone:options.timezone})})});
    await this.check(response);
    const turn=response.headers.get('X-Chat-Turn-ID');if(turn)options.onTurn?.(turn);
    if(response.headers.get('Content-Type')?.includes('application/json')){const data=await response.json();if(data.state!=='completed'||typeof data.content!=='string')throw new ApiError(502,'invalid_response','Invalid completed replay');onEvent({event:'replay',data});return;}
    if(!response.headers.get('Content-Type')?.includes('text/event-stream')||!response.body)throw new ApiError(502,'invalid_response','Expected chat event stream');
    await readChatStream(response.body,onEvent);
  }
}
