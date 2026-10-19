import test from 'node:test';
import assert from 'node:assert/strict';
import {MroyaApi} from '../src/api/client.ts';
import {ApiError} from '../src/api/errors.ts';
import {createLiveSource} from '../src/providers/liveSource.ts';
import {UserTimezoneStore} from '../src/hooks/useUserTimezone.ts';
import type {ApiUser,PreferencesPatch} from '../src/types/api.ts';
const user:ApiUser={id:71,username:'timezone-owner',email:'owner@example.test',first_name:'',last_name:'',timezone:'',nickname:'',preferences:{theme:'system'}};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
const tick=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};

test('live adapter uses existing PATCH preferences with exact manual/atomic bodies, session and CSRF',async()=>{
 const calls:{url:string;init:RequestInit}[]=[];const abort=new AbortController();let saved={...user,timezone:'Asia/Tokyo'};
 const api=new MroyaApi((async(input,init)=>{
  calls.push({url:String(input),init:init!});
  if(String(input).endsWith('/csrf/'))return json({csrf_token:'tz-csrf'});
  const body=JSON.parse(init!.body as string);
  if(!body.timezone_only_if_unset)saved={...saved,timezone:body.timezone};
  return json({user:saved});
 }) as typeof fetch);
 const source=createLiveSource(api);
 // A competing manual setting is legitimate: initialize must adopt the returned value.
 assert.equal((await source.timezone!.initializeIfUnset('Europe/Sofia',abort.signal)).timezone,'Asia/Tokyo');
 assert.equal((await source.timezone!.save('Europe/Sofia',abort.signal)).timezone,'Europe/Sofia');
 assert.deepEqual(calls.slice(1).map(call=>JSON.parse(call.init.body as string)),[{timezone:'Europe/Sofia',timezone_only_if_unset:true},{timezone:'Europe/Sofia'}]);
 for(const {url,init} of calls.slice(1)){assert.equal(url,'/api/v1/me/preferences/');assert.equal(init.method,'PATCH');assert.equal(init.credentials,'same-origin');assert.equal(init.signal,abort.signal);assert.equal((init.headers as Record<string,string>)['X-CSRFToken'],'tz-csrf');}
});

test('manual timezone confirmations must match; only-if-unset may return an existing nonempty value',async()=>{
 const api=new MroyaApi((async(input)=>String(input).endsWith('/csrf/')?json({csrf_token:'t'}):json({user:{...user,timezone:'Asia/Tokyo'}})) as typeof fetch);
 await assert.rejects(api.savePreferences({timezone:'Europe/Sofia'}),(error:unknown)=>error instanceof ApiError&&error.code==='invalid_response');
 await assert.rejects(api.savePreferences({timezone:'Europe/Sofia',timezone_only_if_unset:false}),ApiError);
 assert.equal((await api.savePreferences({timezone:'Europe/Sofia',timezone_only_if_unset:true})).timezone,'Asia/Tokyo');
 const empty=new MroyaApi((async(input)=>String(input).endsWith('/csrf/')?json({csrf_token:'t'}):json({user})) as typeof fetch);
 await assert.rejects(empty.savePreferences({timezone:'UTC',timezone_only_if_unset:true}),ApiError);
});

test('invalid shape/flag is rejected locally; backend IANA errors remain visible without replay',async()=>{
 let calls=0,writes=0;
 const api=new MroyaApi((async(input)=>{calls++;if(String(input).endsWith('/csrf/'))return json({csrf_token:'t'});writes++;return json({error:{code:'invalid_preferences',message:'Invalid user preferences.',fields:{timezone:[{code:'invalid',message:'Enter a valid IANA timezone.'}]}}},400);}) as typeof fetch);
 for(const patch of [{timezone_only_if_unset:true},{timezone:'UTC',timezone_only_if_unset:'true'},{timezone:''},{timezone:' UTC'},{timezone:null}])await assert.rejects(api.savePreferences(patch as PreferencesPatch),ApiError);
 assert.equal(calls,0);
 const source=createLiveSource(api),store=new UserTimezoneStore(source,{...user,timezone:'UTC'},()=>{});
 store.start();store.change('not/a-zone');await new Promise(resolve=>setImmediate(resolve));
 assert.equal(writes,1);assert.equal(store.snapshot().draft,'not/a-zone');assert.equal(store.snapshot().timezone,'UTC');assert.equal(store.snapshot().status,'error');assert.match(store.snapshot().error!,/valid IANA timezone/);store.stop();
});

test('real adapter bootstrap persists and re-reads timezone without changing theme/nickname or initializing twice',async()=>{
 let persisted=user;const patches:PreferencesPatch[]=[];
 const api=new MroyaApi((async(input,init)=>{
  if(String(input).endsWith('/csrf/'))return json({csrf_token:'t'});
  if(init?.method==='GET')return json({user:persisted});
  const body=JSON.parse(init!.body as string);patches.push(body);
  if(!body.timezone_only_if_unset||!persisted.timezone)persisted={...persisted,timezone:body.timezone};
  return json({user:persisted});
 }) as typeof fetch);
 const source=createLiveSource(api),store=new UserTimezoneStore(source,user,()=>{},()=> 'Europe/Sofia');store.start();
 await new Promise(resolve=>setImmediate(resolve));assert.equal(store.snapshot().timezone,'Europe/Sofia');assert.equal(store.snapshot().status,'saved');assert.equal(patches.length,1);
 store.change('Pacific/Chatham');await new Promise(resolve=>setImmediate(resolve));store.stop();
 const session=await source.session();assert.equal(session.status,'authenticated');if(session.status!=='authenticated')assert.fail();
 const reloaded=new UserTimezoneStore(source,session.user,()=>{},()=>{throw Error('No detection for saved timezone');});reloaded.start();await tick();assert.equal(patches.length,2);assert.equal(reloaded.snapshot().timezone,'Pacific/Chatham');assert.equal(persisted.nickname,user.nickname);assert.deepEqual(persisted.preferences,user.preferences);reloaded.stop();
});
