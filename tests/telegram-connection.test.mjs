import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import fs from 'node:fs';
const vite=await createServer({mode:'design',server:{middlewareMode:true},appType:'custom'});
after(()=>vite.close());
const {TelegramConnectionController,observeTelegramReturn,openTelegramPopup}=await vite.ssrLoadModule('/src/hooks/useTelegramConnection.ts');
const {ConnectionsSettingsView}=await vite.ssrLoadModule('/src/components/ConnectionsSettingsView.tsx');
const {MroyaApi}=await vite.ssrLoadModule('/src/api/client.ts');
const {ApiError}=await vite.ssrLoadModule('/src/api/errors.ts');
const {INITIAL_CONNECTIONS}=await vite.ssrLoadModule('/src/demo/fixtures.ts');
const disconnected={configured:true,connected:false,bot_username:'MroyaBot'};
const connected={...disconnected,connected:true,telegram_username:'synthetic_user',connected_at:'2026-10-14T12:00:00Z'};
const link=()=>({url:'https://t.me/MroyaBot?start=synthetic_test_token',expires_at:new Date(Date.now()+720000).toISOString()});
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function setup(overrides={},openPopup){
 let reads=0,posts=0,deletes=0,expired=0,csrf=0,status=disconnected;
 const source={kind:'live',telegramStatus:async()=>{reads++;return status;},createTelegramLink:async()=>{posts++;return link();},disconnectTelegram:async()=>{deletes++;status=disconnected;return {connected:false};},refreshCsrf:async()=>{csrf++;return 'synthetic';},...overrides};
 const controller=new TelegramConnectionController(source,()=>expired++,openPopup);
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
 const pending=view({phase:'pending',link:link(),openFallback:true});
 assert.match(pending,/target="_blank" rel="noopener noreferrer"/);assert.match(pending,/Open Telegram/);assert.match(pending,/press Start/);assert.match(pending,/Check connection/);assert.doesNotMatch(pending,/Connected \(/);
 assert.match(view({status:connected}),/Connected \(@synthetic_user\)/);assert.match(view({status:connected}),/>Disconnect<\/button>/);
 for(const [state,label] of [[{phase:'loading',status:null},'Checking Telegram connection'],[{phase:'creating'},'Creating Telegram link'],[{phase:'disconnecting',status:connected},'Disconnecting Telegram'],[{phase:'expired'},'Link expired'],[{status:{...disconnected,configured:false}},'temporarily unavailable'],[{error:'Synthetic error'},'Retry']])assert.ok(view(state).includes(label),label);
});
test('shared card structure/styles and all five tabs remain; Design actions are local and have no bearer URL',()=>{
 const design=renderToStaticMarkup(React.createElement(ConnectionsSettingsView,{...props,live:false}));
 const live=view({});
 const cardClass='p-5 rounded-[12px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] flex flex-col sm:flex-row sm:items-start justify-between gap-4';
 assert.equal((design.split(cardClass).length-1),INITIAL_CONNECTIONS.length);assert.equal((live.split(cardClass).length-1),3);
 for(const html of [design,live])for(const label of ['Connected accounts','My plan','Appearance','Profile','Assistant preferences'])assert.ok(html.includes(label));
 assert.doesNotMatch(design,/https:\/\/t\.me|start=/);assert.match(design,/Disconnect preview/);
 const source=fs.readFileSync('src/hooks/useTelegramConnection.ts','utf8');
 assert.doesNotMatch(source,/localStorage|sessionStorage|indexedDB|document\.cookie|console\.|setInterval/);
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

function fakeBrowser(){
 const events=[],tabs=[];let blocked=false;
 const open=()=>{
  events.push('open');
  if(blocked)return null;
  const tab={blank:true,closed:false,navigations:[],navigate(url){events.push('navigate');if(this.closed||!this.blank)return false;this.navigations.push(url);this.blank=false;return true;},close(){if(this.blank&&!this.closed){this.closed=true;events.push('close');}}};
  tabs.push(tab);return tab;
 };
 return {events,tabs,open,block:()=>{blocked=true;}};
}
test('one click synchronously reserves one tab before POST, double clicks create no extra tabs/tokens',async()=>{
 const browser=fakeBrowser(),post=deferred();let posts=0;
 const s=setup({createTelegramLink:()=>{browser.events.push('post');posts++;return post.promise;}},browser.open),c=s.controller;
 try{
  await c.check();assert.equal(browser.tabs.length,0);
  const write=c.connect();assert.deepEqual(browser.events,['open','post']);
  assert.equal(posts,1);await c.connect();assert.equal(browser.tabs.length,1);assert.equal(posts,1);
  post.resolve(link());await write;
  assert.equal(browser.tabs[0].navigations.length,1);assert.equal(c.snapshot().openFallback,false);assert.equal(c.snapshot().status.connected,false);
  await c.connect();await c.check();assert.equal(posts,1);assert.equal(browser.tabs.length,1);
 }finally{c.stop();}
 assert.equal(browser.tabs[0].closed,false,'A navigated Telegram tab no longer belongs to the app');
});
test('blank tab is reserved synchronously before explicit Retry awaits CSRF refresh',async()=>{
 const browser=fakeBrowser(),gate=deferred();let posts=0;
 const s=setup({createTelegramLink:async()=>{posts++;if(posts===1)throw new ApiError(403,'csrf_failed','no');return link();},refreshCsrf:()=>{browser.events.push('csrf');return gate.promise;}},browser.open),c=s.controller;
 try{
  await c.check();await c.connect();assert.equal(browser.tabs[0].closed,true);assert.equal(posts,1);
  browser.events.length=0;const retry=c.retry();
  assert.deepEqual(browser.events,['open','csrf']);assert.equal(posts,1);
  gate.resolve('fresh');await retry;assert.equal(posts,2);assert.equal(browser.tabs[1].navigations.length,1);
 }finally{c.stop();}
});
test('API errors close the temporary tab without navigation or automatic POST replay',async()=>{
 for(const code of [401,403,409,503]){
  const browser=fakeBrowser();let posts=0;
  const s=setup({createTelegramLink:async()=>{posts++;throw new ApiError(code,code===409?'already_linked':'failed','no');}},browser.open),c=s.controller;
  try{await c.check();await c.connect();assert.equal(posts,1);assert.equal(browser.tabs[0].closed,true);assert.equal(browser.tabs[0].navigations.length,0);assert.equal(c.snapshot().link,null);}
  finally{c.stop();}
 }
});
test('blocked popup keeps one-time link as explicit safe fallback; normal success hides Open Telegram',async()=>{
 const browser=fakeBrowser();browser.block();const s=setup({},browser.open),c=s.controller;
 try{await c.check();await c.connect();assert.equal(s.counts().posts,1);assert.equal(c.snapshot().openFallback,true);assert.ok(c.snapshot().link);
 const html=view(c.snapshot());assert.match(html,/Open Telegram/);assert.match(html,/browser may have blocked/);assert.match(html,/target="_blank" rel="noopener noreferrer"/);
 const normal=view({...c.snapshot(),openFallback:false});assert.doesNotMatch(normal,/>Open Telegram<|browser may have blocked/);assert.match(normal,/Waiting for Telegram/);assert.match(normal,/Check connection/);
 }finally{c.stop();}
});
test('expired link regenerates once with a newly reserved tab; expired/invalid responses never navigate',async()=>{
 const browser=fakeBrowser(),s=setup({},browser.open),c=s.controller;
 try{await c.check();await c.connect();c.expire(Date.now()+721000);await c.connect();assert.equal(s.counts().posts,2);assert.equal(browser.tabs.length,2);assert.equal(browser.tabs[1].navigations.length,1);}
 finally{c.stop();}
 for(const response of [{...link(),expires_at:'2000-01-01T00:00:00Z'},{...link(),url:'javascript:alert(1)'},{...link(),url:'https://foreign.test/?start=synthetic'}]){
  const b=fakeBrowser(),failed=setup({createTelegramLink:async()=>response},b.open);
  await failed.controller.check();await failed.controller.connect();assert.equal(b.tabs[0].closed,true);assert.equal(b.tabs[0].navigations.length,0);assert.equal(failed.controller.snapshot().link,null);failed.controller.stop();
 }
});
test('logout/account replacement closes only pending blank tab and ignores the late URL',async()=>{
 const browser=fakeBrowser(),late=deferred();
 const s=setup({createTelegramLink:()=>late.promise},browser.open),c=s.controller;
 await c.check();const write=c.connect();c.stop();assert.equal(browser.tabs[0].closed,true);
 const next=setup({},browser.open);await next.controller.check();
 late.resolve(link());await write;assert.equal(browser.tabs[0].navigations.length,0);assert.equal(next.controller.snapshot().link,null);assert.equal(c.snapshot().link,null);
 await next.controller.connect();assert.equal(browser.tabs[1].navigations.length,1);next.controller.stop();
});
test('GET, disconnect and Design Mode cannot open Telegram tabs',async()=>{
 const browser=fakeBrowser(),s=setup({},browser.open),c=s.controller;
 try{s.setStatus(connected);await c.check();await c.check();await c.disconnect();assert.equal(browser.tabs.length,0);}
 finally{c.stop();}
 const design=setup({kind:'design'},browser.open);
 await design.controller.check();await design.controller.connect();assert.equal(browser.tabs.length,0);assert.equal(design.counts().posts,0);design.controller.stop();
});
test('browser adapter opens about:blank and isolates opener before returning; only owned blank tabs can navigate/close',()=>{
 const original=globalThis.window;const events=[];let href='about:blank',closed=false,opener={};
 const tab={get closed(){return closed;},get opener(){return opener;},set opener(value){events.push('isolate');opener=value;},location:{get href(){return href;},replace(value){events.push('navigate');href=value;}},close(){events.push('close');closed=true;}};
 globalThis.window={open:(url,target)=>{events.push('open');assert.equal(url,'about:blank');assert.equal(target,'_blank');return tab;}};
 try{
  const popup=openTelegramPopup();assert.deepEqual(events,['open','isolate']);assert.equal(opener,null);
  assert.equal(popup.navigate('javascript:alert(1)'),false);assert.equal(popup.navigate('https://foreign.test/?start=x'),false);
  assert.equal(popup.navigate(link().url),true);popup.close();assert.equal(closed,false);assert.deepEqual(events,['open','isolate','navigate']);
  href='https://user-selected.test/';assert.equal(popup.navigate(link().url),false);popup.close();assert.equal(closed,false);
  href='about:blank';popup.close();assert.equal(closed,true);
 }finally{globalThis.window=original;}
});
test('browser adapter tolerates popup denial, closed tabs, lost access and failed isolation',()=>{
 const original=globalThis.window;
 try{
  for(const open of [()=>null,()=>{throw new Error('Denied');}]){
   globalThis.window={open};assert.equal(openTelegramPopup(),null);
  }
  let closed=false,href='about:blank';
  const tab={closed:false,opener:{},location:{get href(){if(href==='inaccessible')throw new Error('Cross origin');return href;},replace(){throw new Error('Navigation denied');}},close(){closed=true;}};
  globalThis.window={open:()=>tab};
  const popup=openTelegramPopup();assert.equal(popup.navigate(link().url),false);
  href='inaccessible';popup.close();assert.equal(closed,false);
  href='about:blank';tab.closed=true;assert.equal(popup.navigate(link().url),false);popup.close();assert.equal(closed,false);
  tab.closed=false;Object.defineProperty(tab,'opener',{set(){throw new Error('Cannot isolate');}});
  assert.equal(openTelegramPopup(),null);assert.equal(closed,true);
 }finally{globalThis.window=original;}
});

test('initial CSRF acquisition starts only after the synchronous popup reservation',async()=>{
 const browser=fakeBrowser(),csrf=deferred();let writes=0;
 const api=new MroyaApi(async(url,init)=>{
  if(String(url).endsWith('csrf/')){browser.events.push('csrf');return csrf.promise;}
  browser.events.push('post');writes++;return new Response(JSON.stringify(link()),{headers:{'Content-Type':'application/json'}});
 });
 const s=setup({createTelegramLink:signal=>api.createTelegramLink(signal)},browser.open),c=s.controller;
 try{
  await c.check();const write=c.connect();assert.deepEqual(browser.events,['open','csrf']);assert.equal(writes,0);
  csrf.resolve(new Response(JSON.stringify({csrf_token:'synthetic'}),{headers:{'Content-Type':'application/json'}}));await write;
  assert.equal(writes,1);assert.deepEqual(browser.events,['open','csrf','post','navigate']);
 }finally{c.stop();}
});
test('lost/closed/user-navigated popup and failed navigation fall back without taking over another page',async()=>{
 for(const mode of ['closed','user-navigated','denied']){
  const browser=fakeBrowser(),post=deferred(),s=setup({createTelegramLink:()=>post.promise},browser.open),c=s.controller;
  try{
   await c.check();const write=c.connect();const tab=browser.tabs[0];
   if(mode==='closed')tab.closed=true;
   else if(mode==='user-navigated')tab.blank=false;
   else tab.navigate=()=>{throw new Error('Denied');};
   post.resolve(link());await write;
   assert.equal(c.snapshot().openFallback,true);assert.ok(c.snapshot().link);assert.equal(tab.navigations.length,0);
   if(mode==='user-navigated')assert.equal(tab.closed,false);
   if(mode==='denied')assert.equal(tab.closed,true);
  }finally{c.stop();}
 }
});
