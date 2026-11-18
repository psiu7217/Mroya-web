import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createInstallController,INSTALL_KEY} from '../src/hooks/pwaInstall.ts';

function setup({ua='Android Chrome',standalone=false,saved=false,blocked=false,touch=1,iosStandalone=false}={}) {
 const events=new EventTarget(),media=new EventTarget() as EventTarget & {matches:boolean};media.matches=standalone;
 const storage=new Map(saved?[[INSTALL_KEY,'1']]:[]);
 const browser={navigator:{userAgent:ua,maxTouchPoints:touch,standalone:iosStandalone},
  matchMedia:()=>media,addEventListener:events.addEventListener.bind(events),removeEventListener:events.removeEventListener.bind(events),
  localStorage:{getItem:(k:string)=>{if(blocked)throw Error();return storage.get(k)??null;},setItem:(k:string,v:string)=>{if(blocked)throw Error();storage.set(k,v);},removeItem:(k:string)=>storage.delete(k)}} as unknown as Window;
 const controller=createInstallController(browser);
 return {controller,events,media,storage};
}
function offer(events:EventTarget,outcome:'accepted'|'dismissed'='accepted',fail=false){
 const event=new Event('beforeinstallprompt',{cancelable:true}) as Event & {prompt:()=>Promise<void>;userChoice:Promise<{outcome:'accepted'|'dismissed'}>};
 let calls=0;event.prompt=()=>{calls++;return fail?Promise.reject(Error('blocked')):Promise.resolve();};event.userChoice=Promise.resolve({outcome});events.dispatchEvent(event);
 assert.equal(event.defaultPrevented,true);
 return ()=>calls;
}
test('Android invokes native prompt synchronously, once per offer; completion hides and persists',async()=>{
 const {controller,events,storage}=setup();let updates=0;controller.subscribe(()=>updates++);
 assert.equal(controller.getSnapshot().showMobile,true);
 const calls=offer(events);const request=controller.install();assert.equal(calls(),1);await request;
 assert.equal(controller.getSnapshot().installed,false,'acceptance alone is not completion');
 events.dispatchEvent(new Event('appinstalled'));
 assert.deepEqual(controller.getSnapshot(),{installed:true,showMobile:false,instruction:null});assert.equal(storage.get(INSTALL_KEY),'1');
 await controller.install();assert.equal(calls(),1);assert.ok(updates>0);controller.dispose();
});
test('dismissed offer is consumed, retry shows fallback, fresh offer restores native install',async()=>{
 const {controller,events}=setup();const calls=offer(events,'dismissed');await controller.install();assert.equal(controller.getSnapshot().installed,false);
 await controller.install();assert.equal(calls(),1);assert.equal(controller.getSnapshot().instruction,'android');
 controller.close();assert.equal(controller.getSnapshot().instruction,null);
 const next=offer(events);await controller.install();assert.equal(next(),1);assert.equal(controller.getSnapshot().instruction,null);controller.dispose();
});
test('iPhone and desktop-UA iPad use the Share instruction without marking installed',async()=>{
 for(const options of [{ua:'iPhone Safari'},{ua:'Macintosh Safari',touch:5}]){
  const {controller,storage}=setup(options);assert.equal(controller.getSnapshot().showMobile,true);await controller.install();assert.equal(controller.getSnapshot().instruction,'ios');assert.equal(storage.size,0);controller.dispose();
 }
});
test('standalone, iOS standalone and persisted completion suppress install promotion',async()=>{
 for(const options of [{standalone:true},{iosStandalone:true},{saved:true}]){const {controller}=setup(options);assert.equal(controller.getSnapshot().installed,true);await controller.install();assert.equal(controller.getSnapshot().instruction,null);controller.dispose();}
});
test('browser offer after uninstall overrides the saved hint; blocked storage and rejected prompt recover',async()=>{
 const {controller,events,storage}=setup({saved:true});offer(events);assert.equal(controller.getSnapshot().installed,false);assert.equal(storage.has(INSTALL_KEY),false);controller.dispose();
 const blocked=setup({blocked:true});offer(blocked.events,'accepted',true);await blocked.controller.install();assert.equal(blocked.controller.getSnapshot().instruction,'android');blocked.events.dispatchEvent(new Event('appinstalled'));assert.equal(blocked.controller.getSnapshot().installed,true);blocked.controller.dispose();
});
test('display change confirms install and dispose removes listeners',()=>{
 const {controller,events,media}=setup();media.matches=true;media.dispatchEvent(new Event('change'));assert.equal(controller.getSnapshot().installed,true);controller.dispose();
 const other=setup();other.controller.dispose();other.events.dispatchEvent(new Event('appinstalled'));assert.equal(other.controller.getSnapshot().installed,false);
});
test('desktop has menu installation but no mobile promotion',async()=>{
 const {controller}=setup({ua:'Windows Chrome',touch:0});assert.equal(controller.getSnapshot().showMobile,false);await controller.install();assert.equal(controller.getSnapshot().instruction,'desktop');controller.dispose();
});
test('localized manifests share app identity and use existing emblem at actual icon dimensions',()=>{
 for(const [language,name] of [['ru','Мроя'],['en','Mroya']]){
  const manifest=JSON.parse(readFileSync(`public/manifest-${language}.webmanifest`,'utf8'));
  assert.equal(manifest.id,'/');assert.equal(manifest.start_url,'/');assert.equal(manifest.scope,'/');assert.equal(manifest.name,name);assert.equal(manifest.short_name,name);assert.equal(manifest.lang,language);assert.equal(manifest.display,'standalone');
  for(const size of [192,512]){const icon=manifest.icons.find((i:{sizes:string})=>i.sizes===`${size}x${size}`);const data=readFileSync('public'+icon.src);assert.equal(data.readUInt32BE(16),size);assert.equal(data.readUInt32BE(20),size);}
 }
});
test('early manifest language handles saved preference, Russian browser, other languages and blocked storage',()=>{
 const html=readFileSync('index.html','utf8');const script=html.match(/<script>([\s\S]*?)<\/script>/)![1];
 for(const [languages,saved,expected] of [[['ru-RU'],null,'ru'],[['fr-FR'],null,'en'],[['en-US'],'ru','ru'],[['ru'],'en','en'],[['en','ru'],null,'en'],[['ru'], 'blocked','ru']] as const){
  const link={href:''},meta={content:''};
  vm.runInNewContext(script,{document:{querySelector:(s:string)=>s.startsWith('link')?link:meta},navigator:{languages},localStorage:{getItem:()=>{if(saved==='blocked')throw Error();return saved;}}});
  assert.equal(link.href,`/manifest-${expected}.webmanifest`);assert.equal(meta.content,expected==='ru'?'Мроя':'Mroya');
 }
});
test('service worker bypasses APIs and assets; only navigation network failures receive uncached offline HTML',async()=>{
 const handlers:Record<string,(event:any)=>void>={};let networkCalls=0;
 const origin='https://app.heymroya.com';
 const context={URL,Response,self:{location:{origin},addEventListener:(name:string,fn:any)=>handlers[name]=fn},fetch:async()=>{networkCalls++;throw Error('offline');}};
 vm.runInNewContext(readFileSync('public/sw.js','utf8'),context);
 for(const [mode,path] of [['navigate','/api/v1/auth/me/'],['cors','/api/v1/chat/'],['no-cors','/assets/app.js']]){
  handlers.fetch({request:{mode,url:origin+path},respondWith:()=>assert.fail('must bypass')});
 }
 let response:Promise<Response>|undefined;handlers.fetch({request:{mode:'navigate',url:origin+'/'},respondWith:(value:Promise<Response>)=>response=value});
 const result=await response!;assert.equal(networkCalls,1);assert.equal(result.status,503);assert.equal(result.headers.get('Cache-Control'),'no-store');assert.match(await result.text(),/Connect to the internet/);
});
