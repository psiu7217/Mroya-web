import type {Conversation} from '../types/mroya.ts';
import {tr} from '../i18n/index.ts';
export const GUEST_ACCOUNT={displayName:'Guest',initials:'G',email:'',description:'',timezone:'',spaceDescription:''};
// Replace the latest local exchange: no persisted drafts, unbounded history or repeated gates.
export function guestExchange(content:string, timestamp:string):Conversation {
 return {id:'guest',title:tr('welcomeTitle',{ns:'auth'}),group:tr('today',{ns:'sidebar'}),updatedAt:'',relatedMemoryIds:[],messages:[{id:'guest-input',sender:'user',content:content.trim().slice(0,16000),timestamp},{id:'guest-invite',sender:'assistant',content:tr('signInReply',{ns:'auth'}),timestamp,signInPrompt:true}]};
}
