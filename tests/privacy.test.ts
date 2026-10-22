import test from 'node:test';
import assert from 'node:assert/strict';
import {MroyaApi} from '../src/api/client.ts';
import {readPrivacy,readPrivacyReceipt} from '../src/api/privacy.ts';
const state={notice_version:'google-data-ai-v1',ai_consent:false,provider_approved:false,
 deletion_automatic:false,privacy_contact:'support@dotstech.app',notice:'Optional processing',requests:[]};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
test('privacy consent and request use existing session and CSRF transport',async()=>{
 const seen:{url:string;init:RequestInit}[]=[];
 const fetcher:typeof fetch=async(url,init={})=>{
  seen.push({url:String(url),init});
  if(String(url).endsWith('csrf/'))return json({csrf_token:'synthetic'});
  if(String(url).endsWith('requests/'))return json({id:'synthetic-request-id',kind:'account_deletion',status:'needs_review',deleted:false,message:'Review pending'},202);
  return json({...state,ai_consent:init.method==='PATCH'});
 };
 const api=new MroyaApi(fetcher);
 assert.equal((await api.privacySettings()).ai_consent,false);
 assert.equal((await api.savePrivacyConsent(true,state.notice_version)).ai_consent,true);
 assert.equal((await api.requestPrivacy('account_deletion')).deleted,false);
 const write=seen.find(v=>v.init.method==='PATCH')!;
 assert.equal(write.init.credentials,'same-origin');
 assert.equal((write.init.headers as Record<string,string>)['X-CSRFToken'],'synthetic');
 assert.deepEqual(JSON.parse(write.init.body as string),{ai_consent:true,notice_version:state.notice_version});
});
test('no completed deletion accepted from intake endpoint',()=>{
 for(const value of [{id:'x',kind:'account_deletion',status:'completed',deleted:true,message:'Done'},
  {id:'x',kind:'account_deletion',status:'needs_review',message:'Done'}]){
  assert.throws(()=>readPrivacyReceipt(value,'account_deletion'));
 }
 assert.throws(()=>readPrivacy({...state,deletion_automatic:true}));
});
test('failed privacy request is never converted into success',async()=>{
 const api=new MroyaApi(async url=>String(url).endsWith('csrf/')?json({csrf_token:'synthetic'}):json({error:{code:'unavailable'}},503));
 await assert.rejects(api.requestPrivacy('google_data_deletion'));
});
