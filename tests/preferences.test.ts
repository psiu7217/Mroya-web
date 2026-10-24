import test from 'node:test';
import assert from 'node:assert/strict';
import {UserPreferenceStore} from '../src/hooks/useUserPreferences.ts';
import {resolvedTheme,readGuestTheme} from '../src/hooks/useWorkspaceLayout.ts';
import {accountPresentation} from '../src/hooks/liveAdapters.ts';
import {ApiError} from '../src/api/errors.ts';
import type {ApiUser,PreferencesPatch} from '../src/types/api.ts';
import type {WorkspaceSource} from '../src/types/source.ts';
const user:ApiUser={id:7,username:'account',first_name:'Jane',last_name:'Doe',email:'x@example.com',timezone:'UTC',nickname:'',preferences:{theme:'system',language:'en'}};
const updated=(patch:PreferencesPatch):ApiUser=>({...user,nickname:patch.nickname??user.nickname,preferences:{theme:patch.theme??user.preferences.theme,...(patch.language?{language:patch.language}:user.preferences.language?{language:user.preferences.language}:{})}});
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

test('editing after an ambiguous committed write stays unsaved until explicit reconciliation',async()=>{
 let reads=0,writes=0;let server=user;
 const s=new UserPreferenceStore(source({savePreferences:async p=>{writes++;server=updated(p);if(writes===1)throw Error('Lost response');return server;},session:async()=>{reads++;return {status:'authenticated',user:server};}}),7,user,()=>{});
 s.setTheme('dark');await nextTick();s.setTheme('system');await nextTick();
 assert.equal(writes,1);assert.equal(s.snapshot().status,'unsaved');
 await s.retry();await nextTick();assert.equal(reads,1);assert.equal(writes,2);assert.equal(s.snapshot().theme,'system');assert.equal(s.snapshot().status,'saved');s.dispose();
});
test('retry reconciliation is single-flight and edits cannot PATCH ahead of its response',async()=>{
 let reads=0,writes=0;let finish!:(value:Awaited<ReturnType<WorkspaceSource['session']>>)=>void;
 const s=new UserPreferenceStore(source({savePreferences:async p=>{writes++;if(writes===1)throw new ApiError(500,'failed','Failed');return updated(p);},session:async()=>{reads++;return new Promise(resolve=>{finish=resolve;});}}),7,user,()=>{});
 s.setTheme('dark');await nextTick();const retry=s.retry();void s.retry();s.setNickname('Latest');
 assert.equal(reads,1);assert.equal(writes,1);
 finish({status:'authenticated',user});await retry;await nextTick();
 assert.equal(writes,2);assert.equal(s.snapshot().nickname,'Latest');assert.equal(s.snapshot().theme,'dark');s.dispose();
});

test('first authenticated preference fetch uses conditional language initialization and accepts backend authority',async()=>{
 const sent:PreferencesPatch[]=[];const uninitialized={...user,preferences:{theme:'system' as const}};const account={...user,preferences:{theme:'system' as const,language:'ru' as const}};
 const s=new UserPreferenceStore(source({savePreferences:async p=>{sent.push(p);return account;}}),7,uninitialized,()=>{},'en');
 s.start();await nextTick();
 assert.deepEqual(sent,[{language:'en',language_only_if_unset:true}]);
 assert.equal(s.snapshot().language,'ru');assert.equal(s.snapshot().languageStatus,'saved');s.dispose();
});

test('an existing account language wins over browser fallback and does not initialize again',async()=>{
 let writes=0;const account={...user,preferences:{theme:'system' as const,language:'ru' as const}};
 const s=new UserPreferenceStore(source({savePreferences:async()=>{writes++;return account;}}),7,account,()=>{},'en');
 s.start();await nextTick();assert.equal(s.snapshot().language,'ru');assert.equal(writes,0);s.dispose();
});

test('choosing the already saved language clears Saving without an unnecessary PATCH',async()=>{
 let writes=0;const s=new UserPreferenceStore(source({savePreferences:async p=>{writes++;return updated(p);}}),7,user,()=>{});
 s.setLanguage('en');await nextTick();
 assert.equal(writes,0);assert.equal(s.snapshot().languageStatus,'saved');assert.equal(s.snapshot().language,'en');s.dispose();
});

test('manual language choice made during automatic initialization survives its late response',async()=>{
 let finish:((value:ApiUser)=>void)|null=null;const sent:PreferencesPatch[]=[];const uninitialized={...user,preferences:{theme:'system' as const}};let server:ApiUser={...user,preferences:{theme:'system' as const,language:'ru' as const}};
 const s=new UserPreferenceStore(source({savePreferences:async p=>{sent.push(p);if(sent.length===1)return new Promise<ApiUser>(resolve=>{finish=resolve;});server={...server,preferences:{...server.preferences,language:p.language??server.preferences.language}};return server;}}),7,uninitialized,()=>{},'ru');
 s.start();s.setLanguage('en');assert.equal(s.snapshot().language,'en');
 (finish! as (value:ApiUser)=>void)(server);await nextTick();await nextTick();
 assert.deepEqual(sent,[{language:'ru',language_only_if_unset:true},{language:'en'}]);
 assert.equal(s.snapshot().language,'en');assert.equal(s.snapshot().languageStatus,'saved');s.dispose();
});

test('failed language save stays unsaved, preserves selection and retry confirms it',async()=>{
 let writes=0;let server:ApiUser={...user,preferences:{theme:'system' as const,language:'ru' as const}};
 const s=new UserPreferenceStore(source({savePreferences:async p=>{writes++;if(writes===1)throw new ApiError(400,'unsupported_language','Language update rejected');server={...server,preferences:{...server.preferences,language:p.language??server.preferences.language}};return server;}}),7,user,()=>{});
 s.setLanguage('ru');await nextTick();
 assert.equal(s.snapshot().language,'ru');assert.equal(s.snapshot().languageStatus,'unsaved');assert.match(s.snapshot().languageError??'',/Language update rejected/);
 await s.retry();await nextTick();
 assert.equal(writes,2);assert.equal(s.snapshot().language,'ru');assert.equal(s.snapshot().languageStatus,'saved');s.dispose();
});
test('manually selecting the same fallback language still writes an unset Backend preference',async()=>{
 const sent:PreferencesPatch[]=[];let writes=0;
 const uninitialized={...user,preferences:{theme:'system' as const}};
 const s=new UserPreferenceStore(source({savePreferences:async patch=>{
  sent.push(patch);writes++;
  if(writes===1)throw new ApiError(400,'initialization_failed','Initialization failed');
  return {...uninitialized,preferences:{theme:'system' as const,language:patch.language??undefined}};
 }}),7,uninitialized,()=>{},'en');
 s.start();await nextTick();assert.equal(s.snapshot().languageStatus,'unsaved');
 s.setLanguage('en');await nextTick();
 assert.deepEqual(sent,[{language:'en',language_only_if_unset:true},{language:'en'}]);
 assert.equal(s.snapshot().language,'en');assert.equal(s.snapshot().languageStatus,'saved');s.dispose();
});
test('changing language after an ambiguous PATCH waits for Backend reconciliation before retrying',async()=>{
 const events:string[]=[];let server:ApiUser={...user,preferences:{theme:'system' as const,language:'ru' as const}};
 const s=new UserPreferenceStore(source({savePreferences:async patch=>{
  events.push('PATCH '+patch.language);if(events.length===1){server={...server,preferences:{...server.preferences,language:patch.language}};throw Error('Lost response');}
  server={...server,preferences:{...server.preferences,language:patch.language??server.preferences.language}};return server;
 },session:async()=>{events.push('GET');return {status:'authenticated',user:server};}}),7,server,()=>{});
 s.setLanguage('en');await nextTick();assert.equal(s.snapshot().languageStatus,'unsaved');
 s.setLanguage('ru');await nextTick();assert.deepEqual(events,['PATCH en']);assert.equal(s.snapshot().languageStatus,'unsaved');
 await s.retry();await nextTick();await nextTick();
 assert.deepEqual(events,['PATCH en','GET','PATCH ru']);assert.equal(s.snapshot().language,'ru');assert.equal(s.snapshot().languageStatus,'saved');s.dispose();
});
test('normalizing an old nickname response does not overwrite a newer nickname or theme',async()=>{
 let finish!:(u:ApiUser)=>void;const sent:PreferencesPatch[]=[];
 const s=new UserPreferenceStore(source({savePreferences:async p=>{sent.push(p);return new Promise(resolve=>{finish=resolve;});}}),7,user,()=>{});
 s.setNickname(' Alice ');s.setNickname('Bob');s.setTheme('dark');
 finish(updated({nickname:'Alice'}));await nextTick();
 assert.deepEqual(sent,[{nickname:'Alice'},{nickname:'Bob',theme:'dark'}]);
 assert.equal(s.snapshot().nickname,'Bob');assert.equal(s.snapshot().theme,'dark');
 finish(updated({nickname:'Bob',theme:'dark'}));await nextTick();assert.equal(s.snapshot().status,'saved');s.dispose();
});
test('server changes to untouched fields are adopted without unintended PATCH overwrite',async()=>{
 const patches:PreferencesPatch[]=[];const s=new UserPreferenceStore(source({savePreferences:async p=>{patches.push(p);return updated({...p,nickname:'Server nickname'});}}),7,user,()=>{});
 s.setTheme('dark');await nextTick();assert.equal(s.snapshot().nickname,'Server nickname');assert.equal(patches.length,1);s.dispose();
});
test('failed CSRF refresh cannot release a PATCH; editing is queued until manual retry',async()=>{
 let writes=0,refreshes=0;
 const s=new UserPreferenceStore(source({savePreferences:async p=>{writes++;if(writes===1)throw new ApiError(403,'csrf_failed','Rejected');return updated(p);},refreshCsrf:async()=>{refreshes++;if(refreshes<=2)throw Error('Offline CSRF');return 'valid';}}),7,user,()=>{});
 s.setTheme('dark');await nextTick();s.setTheme('light');await nextTick();assert.equal(writes,1);
 await s.retry();await nextTick();assert.equal(writes,1);assert.equal(s.snapshot().status,'unsaved');
 await s.retry();await nextTick();assert.equal(writes,2);assert.equal(s.snapshot().status,'saved');s.dispose();
});
test('401 and wrong-user responses terminate the queue even before React unmounts',async()=>{
 for(const reply of ['expired','other-user']){
  let writes=0,expired=0;const s=new UserPreferenceStore(source({savePreferences:async()=>{writes++;if(reply==='expired')throw new ApiError(401,'authentication_required','Expired');return {...user,id:8};}}),7,user,()=>{expired++;});
  s.setTheme('dark');await nextTick();s.setNickname('Must not submit');await s.retry();
  assert.equal(writes,1);assert.equal(expired,1);assert.equal(s.snapshot().status,'unsaved');
 }
});
test('disposing during retry aborts its read and ignores a response from the old account',async()=>{
 let signal:AbortSignal|undefined;let finish!:(v:Awaited<ReturnType<WorkspaceSource['session']>>)=>void;let writes=0,expired=0;
 const s=new UserPreferenceStore(source({savePreferences:async()=>{writes++;throw Error('Network');},session:async abort=>{signal=abort;return new Promise(resolve=>{finish=resolve;});}}),7,user,()=>{expired++;});
 s.setTheme('dark');await nextTick();const retry=s.retry();s.dispose();assert.equal(signal?.aborted,true);
 finish({status:'authenticated',user:{...user,id:8}});await retry;assert.equal(writes,1);assert.equal(expired,0);
});
test('nickname validation counts trimmed Unicode characters and requires correction',async()=>{
 let calls=0;const s=new UserPreferenceStore(source({savePreferences:async p=>{calls++;return updated(p);}}),7,user,()=>{});
 s.setNickname(' '+ '😀'.repeat(80)+' ');await nextTick();assert.equal(calls,1);assert.equal(s.snapshot().status,'saved');
 s.setNickname('😀'.repeat(81));await s.retry();await nextTick();assert.equal(calls,1);assert.equal(s.snapshot().status,'unsaved');
 s.setNickname('');await nextTick();assert.equal(calls,2);assert.equal(s.snapshot().nickname,'');s.dispose();
});

test('guest theme storage is separate, validates values and tolerates blocked storage',()=>{
 const original=(globalThis as unknown as Record<string,unknown>).window;
 try{
  for(const choice of ['system','light','dark','invalid']){
   (globalThis as unknown as Record<string,unknown>).window={localStorage:{getItem(key:string){assert.equal(key,'mroya:guest-theme');return choice;}}};
   assert.equal(readGuestTheme(),choice==='invalid'?'system':choice);
  }
  (globalThis as unknown as Record<string,unknown>).window={localStorage:{getItem(){throw Error('Storage denied');}}};
  assert.equal(readGuestTheme(),'system');
 }finally{(globalThis as unknown as Record<string,unknown>).window=original;}
});
test('invalid nickname entered during reconciliation cannot become falsely saved',async()=>{
 let finish!:(v:Awaited<ReturnType<WorkspaceSource['session']>>)=>void;let calls=0;
 const s=new UserPreferenceStore(source({savePreferences:async()=>{calls++;throw Error('Lost response');},session:async()=>new Promise(resolve=>{finish=resolve;})}),7,user,()=>{});
 s.setTheme('dark');await nextTick();const retry=s.retry();s.setNickname('x'.repeat(81));
 finish({status:'authenticated',user});await retry;await nextTick();
 assert.equal(calls,1);assert.equal(s.snapshot().status,'unsaved');assert.match(s.snapshot().error??'',/80/);s.dispose();
});

test('nickname initials preserve Unicode and whitespace names fall back to username',()=>{
 assert.equal(accountPresentation(updated({nickname:'😀 One'})).initials,'😀O');
 assert.equal(accountPresentation({...user,first_name:' ',last_name:' '}).displayName,'account');
 assert.equal(user.id,7);assert.equal(user.username,'account');
});
