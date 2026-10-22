import React from 'react';
import type {PrivacyPresentation} from '../types/privacy';
export function PrivacyControls({privacy}:{privacy?:PrivacyPresentation}) {
 if(!privacy)return null;
 const {state,busy,error,message}=privacy;
 return <section aria-labelledby="privacy-heading" className="p-5 my-5 rounded-xl bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] space-y-4 text-sm">
  <h2 id="privacy-heading" className="text-base font-semibold">Privacy &amp; Google data</h2>
  <p><a href="https://heymroya.com/privacy" className="underline">Privacy Policy</a> · <a href="https://heymroya.com/terms" className="underline">Terms of Service</a></p>
  {!state?<p>Privacy settings unavailable. No changes have been saved.</p>:<>
   <p>{state.notice}</p>
   <label className="flex gap-3 items-start"><input type="checkbox" checked={state.ai_consent} disabled={busy} onChange={e=>privacy.consent(e.target.checked)}/>
   <span>Allow optional personalized AI processing of Google data through OpenRouter and approved inference providers, including selected calendar context and derived memory/embeddings. This is separate from Google authorization and automatic sync.</span></label>
   {!state.provider_approved&&<p>External AI is blocked until the operator has approved provider terms and routing. Giving consent alone does not enable it.</p>}
   <p>Disconnect stops future Google access and attempts revocation; it does not delete imported events, conversations or memory. Auto-sync OFF pauses automatic synchronization; explicit Sync Now can still run.</p>
   <p>Deletion requests require review of linked memory and backups. These buttons record a request, disable optional AI, and do not claim that deletion is complete.</p>
   <div className="flex flex-wrap gap-4">
    <button disabled={busy} onClick={()=>privacy.request('google_data_deletion')} className="underline">Request deletion of Google imports &amp; derived memory</button>
    <button disabled={busy} onClick={()=>privacy.request('account_deletion')} className="underline">Request account deletion</button>
    <button disabled={busy} onClick={()=>privacy.request('personal_information')} className="underline">Request privacy assistance</button>
   </div>
   <p>Contact <a href="mailto:support@dotstech.app" className="underline">support@dotstech.app</a>. No completion deadline is promised here.</p>
   <ul>{state.requests.map(item=><li key={item.id}>{item.kind}: {item.status} · {item.id}</li>)}</ul>
  </>}
  <button disabled={busy} onClick={privacy.refresh} className="underline">{busy?'Waiting for backend confirmation…':'Refresh privacy settings'}</button>
  {error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
 </section>;
}
