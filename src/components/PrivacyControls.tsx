import type {PrivacyPresentation} from '../types/privacy';
import type {PrivacyKind} from '../api/privacy';
import {tr} from '../i18n';

const kinds:PrivacyKind[]=['google_data_deletion','account_deletion','personal_information'];
const label=(key:string)=>tr(key,{ns:'connections'});

export function PrivacyControls({privacy}:{privacy?:PrivacyPresentation}) {
 if(!privacy)return null;
 const {state,busy,error,message}=privacy;
 return <section aria-labelledby="privacy-heading" className="p-5 my-5 rounded-xl bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] space-y-4 text-sm">
  <h2 id="privacy-heading" className="text-base font-semibold">{label('privacyHeading')}</h2>
  <p><a href="https://heymroya.com/privacy" className="underline">{label('privacyPolicyLink')}</a> · <a href="https://heymroya.com/terms" className="underline">{label('privacyTermsLink')}</a></p>
  {!state&&!busy&&<p>{label('privacyUnavailable')}</p>}
  {state&&<>
   <label className="flex gap-3 items-start"><input type="checkbox" checked={state.ai_consent} disabled={busy} onChange={e=>privacy.consent(e.target.checked)}/>
   <span>{label('privacyConsent')}</span></label>
   {!state.provider_approved&&<p>{label('privacyProviderPending')}</p>}
   <p>{label('privacyDisconnectHelp')}</p>
   <p>{label('privacyDeletionHelp')}</p>
   <div className="flex flex-wrap gap-4">
    {kinds.map(kind=><button key={kind} type="button" disabled={busy} onClick={()=>privacy.request(kind)} className="underline">{label('privacyKind_'+kind)}</button>)}
   </div>
   <a href="mailto:support@dotstech.app" className="underline">support@dotstech.app</a>
   {!!state.requests.length&&<ul>{state.requests.filter(item=>kinds.includes(item.kind)).map(item=><li key={item.id}>
    {label('privacyKind_'+item.kind)}{item.status==='needs_review'&&<> · {label('privacyNeedsReview')}</>}
   </li>)}</ul>}
  </>}
  <button type="button" disabled={busy} onClick={privacy.refresh} className="underline">{label(busy?'privacyWaiting':'privacyRefresh')}</button>
  {error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
 </section>;
}
