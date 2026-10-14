import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import fs from 'node:fs';
const vite=await createServer({mode:'design',server:{middlewareMode:true},appType:'custom'});
after(()=>vite.close());
const {TelegramConnectionController,observeTelegramReturn}=await vite.ssrLoadModule('/src/hooks/useTelegramConnection.ts');
const {ConnectionsSettingsView}=await vite.ssrLoadModule('/src/components/ConnectionsSettingsView.tsx');
const {ApiError}=await vite.ssrLoadModule('/src/api/errors.ts');
const {INITIAL_CONNECTIONS}=await vite.ssrLoadModule('/src/demo/fixtures.ts');
const disconnected={configured:true,connected:false,bot_username:'MroyaBot'};
const connected={...disconnected,connected:true,telegram_username:'synthetic_user',connected_at:'2026-10-14T12:00:00Z'};
const link=()=>({url:'https://t.me/MroyaBot?start=synthetic_test_token',expires_at:new Date(Date.now()+720000).toISOString()});
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function setup(overrides={}){
 let reads=0,posts=0,deletes=0,expired=0,csrf=0,status=disconnected;
 const source={kind:'live',telegramStatus:async()=>{reads++;return status;},createTelegramLink:async()=>{posts++;return link();},disconnectTelegram:async()=>{deletes++;status=disconnected;return {connected:false};},refreshCsrf:async()=>{csrf++;return 'synthetic';},...overrides};
 const controller=new TelegramConnectionController(source,()=>expired++);
 return {controller,source,setStatus:v=>{status=v;},counts:()=>({reads,posts,deletes,expired,csrf})};
}
test('loading -> disconnected -> creating -> pending; only GET confirms connected and erases link',async()=>{
 const next=deferred(),s=setup({createTelegramLink:()=>next.promise}),c=s.controller;
 try{
  assert.equal(c.snapshot().status,null);assert.equal(c.snapshot().phase,'loading');
  await c.check();assert.deepEqual(c.snapshot().status,disconnected);
  const write=c.connect();assert.equal(c.snapshot().phase,'creating');
  await c.connect();next.resolve(link());await write;
  assert.equal(c.snapshot().phase,'pending');assert.equal(c.snapshot().status.connected,false);assert.ok(c.snapshot().link);
  s.setStatus(connected);await c.check();assert.equal(c.snapshot().status.connected,true);assert.equal(c.snapshot().link,null);
 }finally{c.stop();}
});
test('disconnect requires DELETE then authoritative GET; configured=false does not erase existing binding',async()=>{
 const s=setup(),c=s.controller;
 try{s.setStatus({...connected,configured:false});await c.check();await c.disconnect();assert.equal(c.snapshot().status.connected,false);assert.deepEqual(s.counts(),{reads:2,posts:0,deletes:1,expired:0,csrf:0});}
 finally{c.stop();}
});
test('configured=false disconnected never creates a link',async()=>{
 const s=setup(),c=s.controller;
 try{s.setStatus({...disconnected,configured:false});await c.check();await c.connect();assert.equal(s.counts().posts,0);}finally{c.stop();}
});
test('expiry drops URL, regeneration is explicit; expired link never overrides a confirmed binding',async()=>{
 const s=setup(),c=s.controller;
 try{await c.check();await c.connect();c.expire(Date.now()+721000);assert.equal(c.snapshot().link,null);assert.equal(c.snapshot().phase,'expired');assert.equal(s.counts().posts,1);
 await c.connect();assert.equal(s.counts().posts,2);assert.ok(c.snapshot().link);
 s.setStatus(connected);await c.check();c.expire(Date.now()+721000);assert.equal(c.snapshot().status.connected,true);assert.equal(c.snapshot().phase,'idle');
 }finally{c.stop();}
});
test('GET requests from focus/manual checking coalesce and cannot race a write',async()=>{
 const next=deferred();let reads=0;
 const s=setup({telegramStatus:()=>{reads++;return reads===1?Promise.resolve(disconnected):next.promise;}}),c=s.controller;
 try{await c.check();const a=c.check(),b=c.check();assert.equal(a,b);await Promise.resolve();assert.equal(reads,2);
 await c.connect();const fresh=c.check(); // pending link can be checked after write finishes
 next.resolve(connected);await a;await b;await fresh;
 // The stale read was invalidated; the fresh read uses a newer generation.
 await c.check();assert.equal(c.snapshot().status.connected,true);
 }finally{c.stop();}
});
test('logout aborts and invalidates late status/link results; another account starts empty',async()=>{
 for(const action of ['status','link']){
  const next=deferred();let signal;
  const s=setup(action==='status'?{telegramStatus:s=>{signal=s;return next.promise;}}:{createTelegramLink:s=>{signal=s;return next.promise;}}),c=s.controller;
  if(action==='link')await c.check();
  const pending=action==='status'?c.check():c.connect();await Promise.resolve();c.stop();assert.equal(signal.aborted,true);
  next.resolve(action==='status'?connected:link());await pending;
  assert.equal(c.snapshot().link,null);assert.equal(c.snapshot().status,null);
  const other=setup();assert.equal(other.controller.snapshot().status,null);other.controller.stop();
 }
});
test('401 expires existing session; 403 refreshes CSRF only on explicit retry and never replays automatically',async()=>{
 const denied=setup({telegramStatus:async()=>{throw new ApiError(401,'authentication_required','no');}});
 await denied.controller.check();assert.equal(denied.counts().expired,1);assert.equal(denied.controller.snapshot().status,null);
 let posts=0,csrf=0;const gate=deferred();
 const s=setup({createTelegramLink:async()=>{posts++;if(posts===1)throw new ApiError(403,'csrf_failed','no');return link();},refreshCsrf:()=>{csrf++;return gate.promise;}}),c=s.controller;
 try{await c.check();await c.connect();assert.equal(posts,1);assert.match(c.snapshot().error,/verification/);
 const retry=c.retry();assert.equal(csrf,1);assert.equal(posts,1);gate.resolve('fresh');await retry;assert.equal(posts,2);assert.ok(c.snapshot().link);
 }finally{c.stop();}
});
test('409 already_linked rechecks GET; 503 is an error, not mock success',async()=>{
 const s=setup({createTelegramLink:async()=>{s.setStatus(connected);throw new ApiError(409,'already_linked','no');}}),c=s.controller;
 try{await c.check();await c.connect();assert.equal(c.snapshot().status.connected,true);assert.equal(s.counts().reads,2);assert.equal(c.snapshot().link,null);}finally{c.stop();}
 const fail=setup({telegramStatus:async()=>{throw new ApiError(503,'telegram_unavailable','no');}});
 await fail.controller.check();assert.equal(fail.controller.snapshot().status,null);assert.match(fail.controller.snapshot().error,/temporarily/);fail.controller.stop();
});
test('ambiguous POST does not create another token without explicit user action',async()=>{
 let posts=0;const s=setup({createTelegramLink:async()=>{posts++;if(posts===1)throw new TypeError('connection lost with private payload');return link();}}),c=s.controller;
 try{await c.check();await c.connect();assert.equal(posts,1);assert.equal(c.snapshot().link,null);assert.doesNotMatch(c.snapshot().error,/private payload/);
 await c.check();assert.equal(posts,1);await c.retry();assert.equal(posts,2);
 }finally{c.stop();}
});
test('ambiguous DELETE reads status before retry; committed DELETE is accepted only from GET',async()=>{
 let deletes=0;
 const s=setup({disconnectTelegram:async()=>{deletes++;if(deletes===1)throw new TypeError('lost');s.setStatus(disconnected);return {connected:false};}}),c=s.controller;
 try{s.setStatus(connected);await c.check();await c.disconnect();assert.equal(deletes,1);assert.equal(s.counts().reads,2);assert.equal(c.snapshot().status.connected,true);assert.ok(c.snapshot().error);
 await c.retry();assert.equal(deletes,2);assert.equal(c.snapshot().status.connected,false);assert.equal(c.snapshot().error,null);
 }finally{c.stop();}
 const committed=setup({disconnectTelegram:async()=>{committed.setStatus(disconnected);throw new TypeError('lost');}});
 committed.setStatus(connected);await committed.controller.check();await committed.controller.disconnect();assert.equal(committed.controller.snapshot().status.connected,false);assert.equal(committed.controller.snapshot().error,null);committed.controller.stop();
});
test('invalid or hostile source links are rejected without being stored or rendered',async()=>{
 for(const url of ['javascript:alert(1)','https://foreign.test/?start=synthetic']){
  const s=setup({createTelegramLink:async()=>({...link(),url})}),c=s.controller;
  await c.check();await c.connect();assert.equal(c.snapshot().link,null);assert.match(c.snapshot().error,/invalid response/);assert.doesNotMatch(c.snapshot().error,/foreign|javascript/);c.stop();
 }
});
const noop=()=>{};
const props={account:{displayName:'Synthetic account',initials:'SA',email:'test@example.test',description:'',timezone:'UTC',spaceDescription:'Personal space',nickname:''},connections:INITIAL_CONNECTIONS,plan:'free',onSelectPlan:noop,theme:'light',onSelectTheme:noop,activeTab:'connections',onChangeTab:noop,isSidebarCollapsed:false,onExpandSidebar:noop,onOpenMobileMenu:noop,onToggleConnection:noop};
const view=(state,extra={})=>renderToStaticMarkup(React.createElement(ConnectionsSettingsView,{...props,live:true,telegram:{status:disconnected,phase:'idle',checking:false,error:null,link:null,onConnect:noop,onDisconnect:noop,onCheck:noop,onRetry:noop,...state},...extra}));
test('one shared Telegram card renders real states, safe explicit link and two unsupported services',()=>{
 const html=view({});
 assert.equal((html.match(/>Telegram<\/span>/g)||[]).length,1);assert.equal((html.match(/>Coming soon<\/button>/g)||[]).length,2);assert.match(html,/Connect Telegram/);assert.doesNotMatch(html,/alexlindqvist|Voice notes|morning briefings|calendar alerts/);
 const pending=view({phase:'pending',link:link()});
 assert.match(pending,/target="_blank" rel="noopener noreferrer"/);assert.match(pending,/Open Telegram/);assert.match(pending,/press Start/);assert.match(pending,/Check connection/);assert.doesNotMatch(pending,/Connected \(/);
 assert.match(view({status:connected}),/Connected \(@synthetic_user\)/);assert.match(view({status:connected}),/>Disconnect<\/button>/);
 for(const [state,label] of [[{phase:'loading',status:null},'Checking Telegram connection'],[{phase:'creating'},'Creating Telegram link'],[{phase:'disconnecting',status:connected},'Disconnecting Telegram'],[{phase:'expired'},'Link expired'],[{status:{...disconnected,configured:false}},'temporarily unavailable'],[{error:'Synthetic error'},'Retry']])assert.ok(view(state).includes(label),label);
});
test('shared card structure/styles and all five tabs remain; Design actions are local and have no bearer URL',()=>{
 const design=renderToStaticMarkup(React.createElement(ConnectionsSettingsView,{...props,live:false}));
 const live=view({});
 const cardClass='p-5 rounded-[12px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] flex flex-col sm:flex-row sm:items-start justify-between gap-4';
 assert.equal((design.split(cardClass).length-1),INITIAL_CONNECTIONS.length);assert.equal((live.split(cardClass).length-1),3);
 for(const html of [design,live])for(const label of ['Connected accounts','My plan','Appearance','Profile','Memory preferences'])assert.ok(html.includes(label));
 assert.doesNotMatch(design,/https:\/\/t\.me|start=/);assert.match(design,/Disconnect preview/);
 const source=fs.readFileSync('src/hooks/useTelegramConnection.ts','utf8');
 assert.doesNotMatch(source,/localStorage|sessionStorage|indexedDB|document\.cookie|console\.|window\.open|setInterval/);
 assert.match(source,/addEventListener\('focus'/);assert.match(source,/addEventListener\('visibilitychange'/);
 assert.match(fs.readFileSync('src/providers/LiveExperience.tsx','utf8'),/telegram\.stop\(\);preferences\.stop\(\);onLogout\(\)/);
});

test('stale pre-write GET cannot confirm Connected or discard the newer pending link',async()=>{
 const old=deferred(),fresh=deferred();let reads=0;
 const s=setup({telegramStatus:()=>{reads++;return reads===1?Promise.resolve(disconnected):reads===2?old.promise:fresh.promise;}}),c=s.controller;
 try{
  await c.check();const stale=c.check();await Promise.resolve();
  await c.connect();const latest=c.check();await Promise.resolve();
  old.resolve(connected);await stale;
  assert.equal(c.snapshot().status.connected,false);assert.ok(c.snapshot().link);assert.equal(c.snapshot().checking,true);
  fresh.resolve(connected);await latest;assert.equal(c.snapshot().status.connected,true);assert.equal(c.snapshot().link,null);
 }finally{c.stop();}
});
test('logout during CSRF refresh prevents the delayed explicit retry write',async()=>{
 const gate=deferred();let posts=0;
 const s=setup({createTelegramLink:async()=>{posts++;throw new ApiError(403,'csrf_failed','no');},refreshCsrf:()=>gate.promise}),c=s.controller;
 await c.check();await c.connect();const retry=c.retry();c.stop();gate.resolve('fresh');await retry;
 assert.equal(posts,1);assert.equal(c.snapshot().link,null);assert.equal(c.snapshot().status,null);
});

test('focus/visibility return refreshes once, skips hidden pages and removes listeners',async()=>{
 const waiting=deferred();let reads=0;
 const s=setup({telegramStatus:()=>{reads++;return reads===1?Promise.resolve(disconnected):waiting.promise;}}),c=s.controller;
 const windowEvents=new EventTarget(),page=new EventTarget();page.visibilityState='hidden';
 const dispose=observeTelegramReturn(c,windowEvents,page);
 try{
  await c.check();windowEvents.dispatchEvent(new Event('focus'));await Promise.resolve();assert.equal(reads,1);
  page.visibilityState='visible';windowEvents.dispatchEvent(new Event('focus'));page.dispatchEvent(new Event('visibilitychange'));await Promise.resolve();assert.equal(reads,2);
  waiting.resolve(connected);await c.check();assert.equal(c.snapshot().status.connected,true);
  dispose();windowEvents.dispatchEvent(new Event('focus'));page.dispatchEvent(new Event('visibilitychange'));await Promise.resolve();assert.equal(reads,2);
 }finally{dispose();c.stop();}
});
test('DELETE CSRF denial stays Connected until GET, and explicit retry refreshes CSRF before writing',async()=>{
 let writes=0,refreshes=0;
 const s=setup({disconnectTelegram:async()=>{writes++;if(writes===1)throw new ApiError(403,'csrf_failed','no');s.setStatus(disconnected);return {connected:false};},refreshCsrf:async()=>{refreshes++;return 'fresh';}}),c=s.controller;
 try{s.setStatus(connected);await c.check();await c.disconnect();assert.equal(writes,1);assert.equal(refreshes,0);assert.equal(c.snapshot().status.connected,true);assert.ok(c.snapshot().error);
 await c.retry();assert.equal(writes,2);assert.equal(refreshes,1);assert.equal(c.snapshot().status.connected,false);
 }finally{c.stop();}
});
