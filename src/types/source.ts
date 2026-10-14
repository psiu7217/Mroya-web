import type {ReportContext,IssueReportResponse,TelegramConnectionStatus,TelegramLinkResponse,TelegramDisconnectResponse,ApiUser,PreferencesPatch,HistoryResponse,MemoriesResponse,MemoryMapResponse,Capabilities,SendOptions,ChatStreamEvent,TurnResponse} from './api';
export type SessionState = {status:'guest'} | {status:'authenticated';user:ApiUser};
export interface WorkspaceSource {
  readonly kind:'design'|'live';
  session(signal?:AbortSignal):Promise<SessionState>;
  login(username:string,password:string,signal?:AbortSignal):Promise<ApiUser>;
  logout(signal?:AbortSignal):Promise<void>;
  savePreferences?(changes:PreferencesPatch,signal?:AbortSignal):Promise<ApiUser>;
  refreshCsrf?(signal?:AbortSignal):Promise<string>;
  history(before?:number,signal?:AbortSignal):Promise<HistoryResponse>;
  memories(options?:{state?:'active'|'history'|'all';q?:string;offset?:number;limit?:number},signal?:AbortSignal):Promise<MemoriesResponse>;
  map(signal?:AbortSignal):Promise<MemoryMapResponse>;
  capabilities(signal?:AbortSignal):Promise<Capabilities>;
  send(content:string,submissionId:string,onEvent:(event:ChatStreamEvent)=>void,options?:SendOptions):Promise<void>;
  turn(id:string,signal?:AbortSignal):Promise<TurnResponse>;
  telegramStatus?(signal?:AbortSignal):Promise<TelegramConnectionStatus>;
  createTelegramLink?(signal?:AbortSignal):Promise<TelegramLinkResponse>;
  disconnectTelegram?(signal?:AbortSignal):Promise<TelegramDisconnectResponse>;
  reportChatIssue?(context:ReportContext,signal?:AbortSignal):Promise<IssueReportResponse>;
  getChatErrorReport?(turnId:string,signal?:AbortSignal):Promise<string>;
  startGoogleAuth?(signal?:AbortSignal):Promise<void>;
}
