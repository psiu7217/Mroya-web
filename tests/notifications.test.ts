import test,{after} from 'node:test';
import {createServer} from 'vite';
const vite=await createServer({mode:'design',server:{middlewareMode:true},appType:'custom'});
after(()=>vite.close());
import assert from 'node:assert/strict';
import fs from 'node:fs';
const {MroyaApi}=await vite.ssrLoadModule('/src/api/client.ts') as typeof import('../src/api/client.ts');
const {ApiError}=await vite.ssrLoadModule('/src/api/errors.ts') as typeof import('../src/api/errors.ts');
const {createLiveSource}=await vite.ssrLoadModule('/src/providers/liveSource.ts') as typeof import('../src/providers/liveSource.ts');
const {readNotification,readNotificationSettings}=await vite.ssrLoadModule('/src/api/notifications.ts') as typeof import('../src/api/notifications.ts');
const {NotificationSettingsController}=await vite.ssrLoadModule('/src/hooks/useNotificationSettings.ts') as typeof import('../src/hooks/useNotificationSettings.ts');
const {TelegramConnectionController}=await vite.ssrLoadModule('/src/hooks/useTelegramConnection.ts') as typeof import('../src/hooks/useTelegramConnection.ts');
const {demoNotifications,NOTIFICATION_DEMO_SCENARIOS}=await vite.ssrLoadModule('/src/demo/notifications.ts') as typeof import('../src/demo/notifications.ts');
import type {NotificationDto,NotificationDeliveryStatus,NotificationSettings} from '../src/types/api.ts';
import type {WorkspaceSource} from '../src/types/source.ts';
const id='10000000-0000-4000-8000-000000000035',requestId='20000000-0000-4000-8000-000000000035',date='2026-10-21T12:00:00Z';
const settings=(enabled=true):NotificationSettings=>({channels:{telegram:{enabled,connected:true,configured:true,delivery_ready:enabled}}});
const receipt=(status:NotificationDeliveryStatus='pending'):NotificationDto=>({notification_id:id,kind:'system.test',created_at:date,scheduled_at:date,expires_at:null,
 deliveries:[{channel:'telegram',status,attempts:0,next_attempt_at:['pending','retry'].includes(status)?date:null,sent_at:status==='sent'?date:null,error_code:null,parts_sent:0}]});
const gate=()=>{let resolve!:(v?:any)=>void;const promise=new Promise<any>(r=>resolve=r);return {promise,resolve};};
const settle=()=>new Promise(resolve=>setTimeout(resolve,0));
function setup(overrides:Partial<WorkspaceSource>={}){
 const calls={get:0,patch:[] as boolean[],post:[] as string[],detail:0,expired:0,csrf:0};let saved=settings();
 const source={kind:'live',notificationSettings:async()=>{calls.get++;return saved;},saveNotificationSettings:async enabled=>{calls.patch.push(enabled);saved=settings(enabled);return saved;},
 testNotification:async request=>{calls.post.push(request);return receipt();},notification:async()=>{calls.detail++;return receipt('sent');},refreshCsrf:async()=>{calls.csrf++;return 'test';},...overrides} as WorkspaceSource;
 const c=new NotificationSettingsController(source,()=>calls.expired++,()=>requestId);
 return {c,calls,source};
}

test('strict DTOs accept all actual statuses; reject malformed, mismatched and fictional delivery claims',()=>{
 for(const status of ['pending','processing','retry','sent','failed','cancelled','expired'] as NotificationDeliveryStatus[])assert.equal(readNotification(receipt(status),id).deliveries[0].status,status);
 for(const patch of [{notification_id:'bad'},{kind:'arbitrary'},{created_at:'yesterday'},{deliveries:[]},{deliveries:[{...receipt().deliveries[0],status:'delivered'}]},{deliveries:[{...receipt().deliveries[0],sent_at:date}]},{deliveries:[{...receipt().deliveries[0],attempts:-1}]}])assert.throws(()=>readNotification({...receipt(),...patch}));
 assert.throws(()=>readNotification(receipt(),requestId));
 assert.throws(()=>readNotificationSettings({channels:{telegram:{...settings().channels.telegram,enabled:'true'}}}));
 assert.throws(()=>readNotificationSettings({channels:{telegram:{...settings(false).channels.telegram,delivery_ready:true}}}));
 // Return only permitted fields, even if a server mistakenly includes metadata.
 assert.equal('chat_id' in readNotificationSettings({channels:{telegram:{...settings().channels.telegram,chat_id:'not-returned'}}}).channels.telegram,false);
});

test('existing session client uses same-origin GET/PATCH/POST/detail, CSRF and exact DTOs; 202 is only queueing',async()=>{
 const calls:any[]=[];const api=new MroyaApi(async(url,init)=>{calls.push({url,init});const path=String(url);let data:any=settings();
 if(path.endsWith('/csrf/'))data={csrf_token:'synthetic-csrf'};
 if(path.endsWith('/test/')||path.endsWith('/'+id+'/'))data=receipt();
 return new Response(JSON.stringify(data),{status:path.endsWith('/test/')?202:200,headers:{'Content-Type':'application/json'}});
 });const source=createLiveSource(api);
 await source.notificationSettings!();await source.saveNotificationSettings!(true);const queued=await source.testNotification!(requestId);await source.notification!(id);
 assert.equal(queued.deliveries[0].status,'pending');assert.equal(calls.filter(c=>c.url.endsWith('/csrf/')).length,1);
 for(const {url,init} of calls){assert.ok(url.startsWith('/api/v1/'));assert.equal(init.credentials,'same-origin');assert.equal(init.cache,'no-store');if(init.body)assert.equal(init.headers['X-CSRFToken'],'synthetic-csrf');}
 assert.deepEqual(JSON.parse(calls.find(c=>c.init.method==='PATCH').init.body),{telegram_enabled:true});
 assert.deepEqual(JSON.parse(calls.find(c=>c.url.endsWith('/test/')).init.body),{request_id:requestId});
 const bad=new MroyaApi(async(url)=>new Response(JSON.stringify(String(url).endsWith('/csrf/')?{csrf_token:'x'}:receipt()),{status:200,headers:{'Content-Type':'application/json'}}));
 await assert.rejects(bad.testNotification(requestId),/queue acknowledgement/);
 await assert.rejects(api.notification('bad'),/UUID/);
});

test('GET, refresh and remount never send tests; single-flight keeps one POST and only GET confirms sent',async()=>{
 const wait=gate(),s=setup({testNotification:async request=>{s.calls.post.push(request);await wait.promise;return receipt();}});await s.c.refresh();await s.c.refresh();assert.equal(s.calls.post.length,0);
 const first=s.c.sendTest(),second=s.c.sendTest();await settle();assert.equal(s.calls.post.length,1);assert.equal(s.c.presentation().testing,true);
 wait.resolve();await Promise.all([first,second]);assert.equal(s.c.presentation().lastTestStatus,'pending');await s.c.sendTest();assert.equal(s.calls.post.length,1);assert.equal(s.c.presentation().lastTestStatus,'sent');
 s.c.stop();s.c.start();await s.c.refresh();assert.equal(s.calls.post.length,1);assert.equal(s.c.presentation().lastTest,null);s.c.stop();
});

test('toggle has no optimistic success; uncertain PATCH reconciles GET before any explicit retry write',async()=>{
 const wait=gate();let reads=0;const s=setup({notificationSettings:async()=>{reads++;return settings(false);},saveNotificationSettings:async enabled=>{s.calls.patch.push(enabled);await wait.promise;throw new TypeError('lost');}});
 await s.c.refresh();const saving=s.c.toggle(true);await settle();assert.equal(s.c.presentation().enabled,false);assert.equal(s.c.presentation().saving,true);
 const duplicate=s.c.toggle(true);wait.resolve();await Promise.all([saving,duplicate]);
 assert.equal(reads,2);assert.deepEqual(s.calls.patch,[true]);assert.equal(s.c.presentation().enabled,false);assert.ok(s.c.presentation().error);
 await s.c.retry();assert.deepEqual(s.calls.patch,[true,true]);assert.equal(s.c.presentation().enabled,false);s.c.stop();
});

test('lost PATCH response with confirmed desired GET result succeeds without a second write',async()=>{
 let saved=settings(false);const s=setup({notificationSettings:async()=>saved,saveNotificationSettings:async()=>{saved=settings();s.calls.patch.push(true);throw new ApiError(503,'unavailable','test');}});
 await s.c.refresh();await s.c.toggle(true);assert.equal(s.c.presentation().enabled,true);assert.equal(s.c.presentation().error,null);assert.deepEqual(s.calls.patch,[true]);s.c.stop();
});

test('failed reconciliation keeps write uncertain; next retry reads first and does not repeat confirmed PATCH',async()=>{
 let gets=0;const s=setup({notificationSettings:async()=>{if(++gets===2)throw new TypeError('offline');return settings(gets>2);},saveNotificationSettings:async()=>{s.calls.patch.push(true);throw new TypeError('lost');}});
 await s.c.refresh();await s.c.toggle(true);assert.equal(s.c.presentation().enabled,false);assert.ok(s.c.presentation().error);
 await s.c.retry();assert.equal(gets,3);assert.deepEqual(s.calls.patch,[true]);assert.equal(s.c.presentation().enabled,true);s.c.stop();
});

test('uncertain test POST and explicit CSRF retry retain the original UUID; GET errors never send',async()=>{
 let attempt=0;const s=setup({testNotification:async request=>{s.calls.post.push(request);if(++attempt===1)throw new ApiError(403,'csrf_failed','test');if(attempt===2)throw new TypeError('lost');return receipt();}});
 await s.c.refresh();await s.c.sendTest();assert.ok(s.c.presentation().error);assert.equal(s.calls.csrf,0);
 await s.c.retry();assert.equal(s.calls.csrf,1);assert.equal(s.c.presentation().lastTest,null);
 await s.c.refresh();assert.equal(s.calls.post.length,2);await s.c.sendTest();assert.deepEqual(s.calls.post,[requestId,requestId,requestId]);assert.equal(s.c.presentation().lastTestStatus,'pending');s.c.stop();
});

test('401 resets account state; logout and account replacement fence late POST receipts',async()=>{
 const s=setup({saveNotificationSettings:async()=>{throw new ApiError(401,'authentication_required','test');}});await s.c.refresh();await s.c.toggle(false);
 assert.equal(s.calls.expired,1);assert.equal(s.c.presentation().available,false);assert.equal(s.c.presentation().lastTest,null);await s.c.sendTest();assert.equal(s.calls.post.length,0);
 const wait=gate(),old=setup({testNotification:async()=>wait.promise});await old.c.refresh();const pending=old.c.sendTest();await settle();old.c.stop();
 const next=setup();await next.c.refresh();wait.resolve(receipt('sent'));await pending;
 assert.equal(old.c.presentation().lastTest,null);assert.equal(next.c.presentation().lastTest,null);next.c.stop();
});

test('logout aborts pending settings and ignores late responses even when transport ignores AbortSignal',async()=>{
 const wait=gate();let signal:AbortSignal|undefined;const s=setup({notificationSettings:async supplied=>{signal=supplied;return wait.promise;}});
 const read=s.c.refresh();await settle();s.c.stop();assert.equal(signal?.aborted,true);wait.resolve(settings());await read;assert.equal(s.c.presentation().available,false);assert.equal(s.c.presentation().enabled,false);
});

test('409/503 remain errors without automatic writes; 404 marks feature unavailable',async()=>{
 for(const status of [409,503]){
  const s=setup({testNotification:async request=>{s.calls.post.push(request);throw new ApiError(status,'unavailable','not displayed');}});
  await s.c.refresh();await s.c.sendTest();assert.ok(s.c.presentation().error);assert.equal(s.c.presentation().lastTest,null);await settle();assert.equal(s.calls.post.length,1);s.c.stop();
 }
 const s=setup({notificationSettings:async()=>{throw new ApiError(404,'not_found','test');}});await s.c.refresh();assert.equal(s.c.presentation().available,false);assert.ok(s.c.presentation().error);s.c.stop();
});

test('disconnect gates delivery and preserves opt-in; reconnect re-reads actual settings, no second connection manager',async()=>{
 const s=setup();await s.c.refresh();s.c.setConnection(false);assert.equal(s.c.presentation().enabled,true);assert.equal(s.c.presentation().connected,false);assert.equal(s.c.presentation().canSendTest,false);
 await settle();await s.c.sendTest();await s.c.toggle(true);assert.equal(s.calls.post.length,0);assert.equal(s.calls.patch.length,0);
 const reads=s.calls.get;s.c.setConnection(true);await settle();assert.equal(s.calls.get,reads+1);assert.equal(s.c.presentation().deliveryReady,true);s.c.stop();
 const source=fs.readFileSync('src/providers/LiveExperience.tsx','utf8');assert.match(source,/useNotificationSettings\(source,user.id,telegram,onExpired\)/);assert.match(source,/notifications.controller.stop\(\)/);
 assert.equal((source.match(/useTelegramConnection\(source/g)??[]).length,1);
});

test('disconnect during test aborts stale receipt and preserves the operation UUID on manual retry',async()=>{
 const wait=gate();let attempt=0;const s=setup({testNotification:async request=>{s.calls.post.push(request);return ++attempt===1?wait.promise:receipt();}});await s.c.refresh();
 const pending=s.c.sendTest();await settle();s.c.setConnection(false);await settle();wait.resolve(receipt('sent'));await pending;assert.equal(s.c.presentation().lastTest,null);
 s.c.setConnection(true);await settle();await s.c.sendTest();assert.deepEqual(s.calls.post,[requestId,requestId]);assert.equal(s.c.presentation().lastTestStatus,'pending');s.c.stop();
});

test('existing Telegram controller connect/check/disconnect behavior is preserved',async()=>{
 let connected=false,links=0,deletes=0;
 const source={kind:'live',telegramStatus:async()=>({configured:true,connected,bot_username:'test_bot'}),createTelegramLink:async()=>{links++;return {url:'https://t.me/test_bot?start=synthetic',expires_at:new Date(Date.now()+60000).toISOString()};},disconnectTelegram:async()=>{deletes++;connected=false;return {connected:false};}} as WorkspaceSource;
 const telegram=new TelegramConnectionController(source,()=>{},()=>({navigate:()=>true,close:()=>{}}));await telegram.check();await telegram.connect();assert.equal(links,1);assert.equal(telegram.snapshot().status?.connected,false);
 connected=true;await telegram.check();assert.equal(telegram.snapshot().status?.connected,true);await telegram.disconnect();assert.equal(deletes,1);assert.equal(telegram.snapshot().status?.connected,false);telegram.stop();
});

test('Design scenarios and actions are local simulations; live controller refuses Design transport',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>{throw new Error('Unexpected network');};
 try{
  for(const scenario of NOTIFICATION_DEMO_SCENARIOS){let next=scenario;const view=demoNotifications(scenario,true,value=>next=value);assert.equal(view.simulated,true);await view.onRefresh();if(scenario==='queued')assert.equal(next,'delivered');}
  let next='disabled';await demoNotifications('disabled',true,s=>next=s).onToggleTelegram(true);assert.equal(next,'enabled');await demoNotifications('enabled',true,s=>next=s).onSendTest();assert.equal(next,'queued');
  const s=setup({kind:'design'});await s.c.refresh();await s.c.sendTest();assert.equal(s.calls.get,0);assert.equal(s.calls.post.length,0);s.c.stop();
 }finally{globalThis.fetch=original;}
});


test('a new explicit test clears the old sent receipt; retry of that attempt preserves its UUID',async()=>{
 const wait=gate();let count=0;
 const s=setup({testNotification:async request=>{s.calls.post.push(request);if(++count===1)return receipt('sent');await wait.promise;throw new TypeError('lost');}});
 await s.c.refresh();await s.c.sendTest();assert.equal(s.c.presentation().lastTestStatus,'sent');
 const next=s.c.sendTest();await settle();assert.equal(s.c.presentation().lastTest,null);assert.equal(s.c.presentation().testing,true);
 wait.resolve();await next;assert.equal(s.c.presentation().lastTestStatus,null);assert.ok(s.c.presentation().error);s.c.stop();
});

test('disconnect does not prevent disabling a confirmed persisted opt-in; an unconfirmed PATCH is never success',async()=>{
 const s=setup({saveNotificationSettings:async enabled=>{s.calls.patch.push(enabled);return settings();}});await s.c.refresh();s.c.setConnection(false);await settle();
 await s.c.toggle(false);assert.deepEqual(s.calls.patch,[false]);assert.equal(s.c.presentation().enabled,true);assert.ok(s.c.presentation().error);s.c.stop();
});
