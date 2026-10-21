import type {PrivacyKind,PrivacyState} from '../api/privacy';
export interface PrivacyPresentation {
 state:PrivacyState|null;busy:boolean;error:string|null;message:string|null;
 refresh:()=>void;consent:(enabled:boolean)=>void;request:(kind:PrivacyKind)=>void;
}
