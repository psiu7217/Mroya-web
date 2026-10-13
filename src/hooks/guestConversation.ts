import type {Conversation} from '../types/mroya.ts';
export const GUEST_ACCOUNT={displayName:'Guest',initials:'G',email:'',description:'Sign in to get started',timezone:'',spaceDescription:''};
export const SIGN_IN_REPLY='To start chatting with me and unlock your personal memory, please sign in.';
// Replace the latest local exchange: no persisted drafts, unbounded history or repeated gates.
export function guestExchange(content:string, timestamp:string):Conversation {
 return {id:'guest',title:'Welcome to Mroya',group:'Today',updatedAt:'',relatedMemoryIds:[],messages:[{id:'guest-input',sender:'user',content:content.trim().slice(0,16000),timestamp},{id:'guest-invite',sender:'assistant',content:SIGN_IN_REPLY,timestamp,signInPrompt:true}]};
}
