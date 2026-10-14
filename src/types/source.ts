import type {ApiUser,HistoryResponse,MemoriesResponse,MemoryMapResponse,Capabilities,SendOptions,ChatStreamEvent,TurnResponse} from './api';
export type SessionState = {status:'guest'} | {status:'authenticated';user:ApiUser};
export interface WorkspaceSource {
  readonly kind:'design'|'live';
  session(signal?:AbortSignal):Promise<SessionState>;
  login(username:string,password:string,signal?:AbortSignal):Promise<ApiUser>;
  logout(signal?:AbortSignal):Promise<void>;
  history(before?:number,signal?:AbortSignal):Promise<HistoryResponse>;
  memories(options?:{state?:'active'|'history'|'all';q?:string;offset?:number;limit?:number},signal?:AbortSignal):Promise<MemoriesResponse>;
  map(signal?:AbortSignal):Promise<MemoryMapResponse>;
  capabilities(signal?:AbortSignal):Promise<Capabilities>;
  send(content:string,submissionId:string,onEvent:(event:ChatStreamEvent)=>void,options?:SendOptions):Promise<void>;
  turn(id:string,signal?:AbortSignal):Promise<TurnResponse>;
  startGoogleAuth?(signal?:AbortSignal):Promise<void>;
}
