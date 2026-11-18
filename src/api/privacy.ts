import {ApiError} from './errors.ts';
export type PrivacyKind='google_data_deletion'|'account_deletion'|'personal_information';
export interface PrivacyState {
 notice_version:string;ai_consent:boolean;provider_approved:boolean;notice:string;
 deletion_automatic:false;privacy_contact:string;
 requests:{id:string;kind:PrivacyKind;status:string;reason_code:string;created_at:string}[];
}
export interface PrivacyReceipt {id:string;status:'needs_review';kind:PrivacyKind;deleted:false;message:string}
const invalid=()=>new ApiError(502,'invalid_response','Privacy operation was not confirmed.');
export function readPrivacy(value:unknown):PrivacyState {
 if(!value||typeof value!=='object')throw invalid();
 const v=value as Record<string,unknown>;
 if(typeof v.notice_version!=='string'||!v.notice_version||typeof v.ai_consent!=='boolean'
 ||typeof v.provider_approved!=='boolean'||typeof v.notice!=='string'||typeof v.privacy_contact!=='string'
 ||v.deletion_automatic!==false||!Array.isArray(v.requests))throw invalid();
 for(const item of v.requests)if(!item||typeof item!=='object'||!['id','kind','status','reason_code','created_at'].every(k=>typeof item[k]==='string'))throw invalid();
 return value as PrivacyState;
}
export function readPrivacyReceipt(value:unknown,kind:PrivacyKind):PrivacyReceipt {
 if(!value||typeof value!=='object')throw invalid();
 const v=value as Record<string,unknown>;
 if(typeof v.id!=='string'||!v.id||v.status!=='needs_review'||v.deleted!==false||v.kind!==kind||typeof v.message!=='string')throw invalid();
 return value as PrivacyReceipt;
}
