import test from 'node:test';
import assert from 'node:assert/strict';
import {UserPreferenceStore} from '../src/hooks/useUserPreferences.ts';
import {resolvedTheme,readGuestTheme} from '../src/hooks/useWorkspaceLayout.ts';
import {accountPresentation} from '../src/hooks/liveAdapters.ts';
import {ApiError} from '../src/api/errors.ts';
import type {ApiUser,PreferencesPatch} from '../src/types/api.ts';
import type {WorkspaceSource} from '../src/types/source.ts';
const user:ApiUser={id:7,username:'account',first_name:'Jane',last_name:'Doe',email:'x@example.com',timezone:'UTC',nickname:'',preferences:{theme:'system'}};
const updated=(patch:PreferencesPatch):ApiUser=>({...user,nickname:patch.nickname??user.nickname,preferences:{theme:patch.theme??user.preferences.theme}});
const nextTick=()=>new Promise<void>(resolve=>setImmediate(resolve));
const source=(partial:Partial<WorkspaceSource>):WorkspaceSource=>({
 kind:'live',session:async()=>({status:'authenticated',user}),login:async()=>user,logout:async()=>{},
 history:async()=>({conversation_id:'',messages:[],next_before:null}),memories:async()=>({memories:[],total:0}),
 map:async()=>({nodes:[],edges:[]}),capabilities:async()=>({api_version:'v1',chat:true,memory_read:true,memory_mutations_via_chat:true,memory_mutations_rest:false,calendar_rest:false,connections_rest:false,reminders:false,local_recurrence:false,sse_token_streaming:false}),
 send:async()=>{},turn:async()=>({turn_status:'completed',summary:'',events:[]}),...partial,
});
test('rapid theme changes coalesce and serialize; old success cannot overwrite new theme',async()=>{
 let finish:((value:ApiUser)=>void)|null=null;const sent:PreferencesPatch[]=[];
 const s=new UserPreferenceStore(source({savePreferences:async p=>{sent.push(p);return new Promise<ApiUser>(resolve=>{finish=resolve;});}}),7,user,()=>{throw Error('Unexpected expiration');});
 s.setTheme('dark');s.setTheme('system');s.setTheme('light');assert.equal(s.snapshot().theme,'light');assert.equal(sent.length,1);
 const complete=finish! as (v:ApiUser)=>void;complete(updated({theme:'dark'}));
 await nextTick();assert.equal(sent.length,2);assert.deepEqual(sent[1],{theme:'light'});
 assert.equal(s.snapshot().theme,'light');(finish! as (v:ApiUser)=>void)(updated({theme:'light'}));
 await nextTick();assert.equal(s.snapshot().status,'saved');s.dispose();
});
test('nickname and theme changes use independent PATCH fields and clear nickname',async()=>{
 const sent:PreferencesPatch[]=[];let confirmed=user;
 const s=new UserPreferenceStore(source({savePreferences:async p=>{
  sent.push(p);confirmed={...confirmed,nickname:p.nickname??confirmed.nickname,preferences:{theme:p.theme??confirmed.preferences.theme}};
  return confirmed;
 }}),7,user,()=>{});
 s.setTheme('dark');await nextTick();s.setNickname('Alex');await nextTick();
 assert.deepEqual(sent,[{theme:'dark'},{nickname:'Alex'}]);
 s.setNickname('');await nextTick();assert.deepEqual(sent[2],{nickname:''});s.dispose();
});
test('network failure is unsaved; retry reconciles authoritative me before another write',async()=>{
 let patchCalls=0,meReads=0;
 const s=new UserPreferenceStore(source({
  savePreferences:async p=>{patchCalls++;if(patchCalls===1)throw Error('Connection interrupted');return updated(p);},
  session:async()=>{meReads++;return {status:'authenticated',user};},
 }),7,user,()=>{});
 s.setTheme('dark');await nextTick();assert.equal(s.snapshot().status,'unsaved');
 await s.retry();await nextTick();assert.equal(meReads,1);assert.equal(patchCalls,2);assert.equal(s.snapshot().status,'saved');s.dispose();
});
test('network failure already persisted is confirmed by me and not retried',async()=>{
 let patchCalls=0;
 const saved=updated({theme:'dark'});
 const s=new UserPreferenceStore(source({
  savePreferences:async()=>{patchCalls++;throw Error('Timeout after save');},
  session:async()=>({status:'authenticated',user:saved}),
 }),7,user,()=>{});
 s.setTheme('dark');await nextTick();await s.retry();await nextTick();
 assert.equal(patchCalls,1);assert.equal(s.snapshot().status,'saved');s.dispose();
});
test('400 validation is displayed, 403 refreshes CSRF without resubmitting',async()=>{
 const fields={nickname:[{code:'invalid',message:'Rejected'}]};let calls=0,csrf=0;
 const s=new UserPreferenceStore(source({
  savePreferences:async()=>{calls++;throw new ApiError(400,'invalid_preferences','Invalid',fields);},
 }),7,user,()=>{});
 s.setNickname('Invalid');await nextTick();assert.equal(s.snapshot().status,'unsaved');assert.match(s.snapshot().error??'',/nickname: Rejected/);s.dispose();
 const blocked=new UserPreferenceStore(source({
  savePreferences:async()=>{calls++;throw new ApiError(403,'csrf_failed','CSRF rejected');},
  refreshCsrf:async()=>{csrf++;return 'new-token';},
 }),7,user,()=>{});
 blocked.setTheme('dark');await nextTick();assert.equal(csrf,1);assert.equal(calls,2);
 assert.equal(blocked.snapshot().status,'unsaved');blocked.dispose();
});
test('401 expires once and a disposed store ignores late replies',async()=>{
 let expired=0;const s=new UserPreferenceStore(source({savePreferences:async()=>{throw new ApiError(401,'authentication_required','Expired');}}),7,user,()=>{expired++;});
 s.setTheme('dark');await nextTick();assert.equal(expired,1);s.dispose();
 let finish:((value:ApiUser)=>void)|null=null;
 const late=new UserPreferenceStore(source({savePreferences:async()=>new Promise<ApiUser>(resolve=>{finish=resolve;})}),7,user,()=>{});
 late.setTheme('dark');late.dispose();(finish! as (v:ApiUser)=>void)(updated({theme:'dark'}));await nextTick();
 assert.equal(late.snapshot().status,'saving');
});
test('account presentation uses nickname and falls back to name when cleared',()=>{
 assert.equal(accountPresentation(updated({nickname:'Alex'})).displayName,'Alex');
 assert.equal(accountPresentation(user).displayName,'Jane Doe');
 assert.equal(accountPresentation({...user,first_name:'',last_name:''}).displayName,'account');
});
test('system preference resolves without changing saved theme, guest defaults safely',()=>{
 assert.equal(resolvedTheme('system',true),'dark');assert.equal(resolvedTheme('system',false),'light');
 assert.equal(resolvedTheme('dark',false),'dark');assert.equal(readGuestTheme(),'system');
});
