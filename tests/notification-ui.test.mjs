import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer,build} from 'vite';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
const key='__notificationUiHooks';
const vite=await createServer({mode:'design',server:{middlewareMode:true},appType:'custom',plugins:[{
 name:'notification-ui-hooks',enforce:'pre',
 transform(code,id){if(/\/(IntelligencePreviews|StudioIntelligencePreviews|useDemoMemoryInbox|useDemoWorkspace|useDemoDiagnostics|useLiveCalendar|CalendarView|ConnectionsSettingsView)\.(tsx|ts)$/.test(id.replaceAll('\\','/')))return code.replace(/from 'react';/g,"from 'virtual:notification-ui-hooks';");},
 resolveId(id){if(id==='virtual:notification-ui-hooks')return '\0'+id;},
 load(id){if(id==='\0virtual:notification-ui-hooks')return `import React from 'react';
 ${['useState','useRef','useEffect','useMemo','useSyncExternalStore'].map(name=>`export const ${name}=(...args)=>globalThis.${key}.${name}(...args);`).join('\n')}
 export default {...React,useState,useRef,useEffect,useMemo,useSyncExternalStore};`;},
}]});
const {useDemoWorkspace}=await vite.ssrLoadModule('/src/demo/useDemoWorkspace.ts');
const liveCalendarModule=await vite.ssrLoadModule('/src/hooks/useLiveCalendar.ts');
const {CalendarView}=await vite.ssrLoadModule('/src/components/CalendarView.tsx');
const {ConnectionsSettingsView}=await vite.ssrLoadModule('/src/components/ConnectionsSettingsView.tsx');
const {demoNotifications}=await vite.ssrLoadModule('/src/demo/notifications.ts');
const {NotificationSettingsController}=await vite.ssrLoadModule('/src/hooks/useNotificationSettings.ts');
const {ApiError}=await vite.ssrLoadModule('/src/api/errors.ts');
const {EventAnalysisPreview,IntelligenceSourcesPreview,IntelligenceAutonomyPreview}=await vite.ssrLoadModule('/src/components/IntelligencePreviews.tsx');
const {designIntelligence}=await vite.ssrLoadModule('/src/demo/StudioIntelligencePreviews.tsx');
const {WorkspaceView}=await vite.ssrLoadModule('/src/pages/WorkspaceView.tsx');
const originals=Object.fromEntries(['window','document','setTimeout','clearTimeout','fetch'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
let requests=0,timerId=0;const timers=new Map();
globalThis.window={matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}})};
globalThis.document={documentElement:{setAttribute(){},removeAttribute(){}},addEventListener(){},removeEventListener(){}};
globalThis.setTimeout=callback=>{const id=++timerId;timers.set(id,callback);return id;};
globalThis.clearTimeout=id=>timers.delete(id);
globalThis.fetch=()=>{requests++;throw new Error('Design must stay offline');};
after(async()=>{for(const [key,descriptor] of Object.entries(originals)){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}delete globalThis[key];await vite.close();});
function mount(render){
 const slots=[];let cursor=0,dirty=false,effects=[],value;
 const hooks={
  useSyncExternalStore(subscribe,snapshot){return snapshot();},
  useState(initial){const i=cursor++;slots[i]??={value:typeof initial==='function'?initial():initial};return [slots[i].value,next=>{const value=typeof next==='function'?next(slots[i].value):next;if(!Object.is(value,slots[i].value)){slots[i].value=value;dirty=true;}}];},
  useRef(initial){const i=cursor++;slots[i]??={current:initial};return slots[i];},
  useEffect(effect,deps){const i=cursor++,previous=slots[i];if(!previous||!deps||deps.some((v,index)=>!Object.is(v,previous.deps[index]))){slots[i]={deps};effects.push(()=>{previous?.cleanup?.();slots[i].cleanup=effect();});}},
  useMemo(factory,deps){const i=cursor++,previous=slots[i];if(!previous||deps.some((v,index)=>!Object.is(v,previous.deps[index])))slots[i]={deps,value:factory()};return slots[i].value;},
 };
 function flush(){globalThis[key]=hooks;let passes=0;do{assert.ok(++passes<20,'render settles');dirty=false;cursor=0;value=render();const queue=effects;effects=[];queue.forEach(effect=>effect());}while(dirty);return value;}
 return {flush,get value(){return value;},unmount(){slots.forEach(slot=>slot.cleanup?.());}};
}
function all(node,predicate){if(!node||typeof node!=='object')return [];return [...(predicate(node)?[node]:[]),...[node.props?.children].flat(Infinity).flatMap(child=>all(child,predicate))];}
function find(tree,predicate){const node=all(tree,predicate)[0];assert.ok(node,'expected element');return node;}
function text(node){if(node===null||node===undefined||typeof node==='boolean')return '';if(typeof node!=='object')return String(node);return [node.props?.children].flat(Infinity).map(text).join(' ');}
const button=(tree,label)=>find(tree,node=>node.type==='button'&&text(node).trim()===label);
const child=(model,section,type)=>find(WorkspaceView({model:{...model,activeSection:section}}),node=>node.type===type).props;
const calendar=model=>child(model,'calendar',CalendarView);
const settings=model=>child(model,'connections',ConnectionsSettingsView);
const event={title:'Local appointment',date:'2026-10-12',dayOfMonth:12,time:'12:00',duration:'1h',category:'meeting',source:'manual',notes:''};
function workspace(){const view=mount(()=>useDemoWorkspace('empty'));view.flush();return view;}
function call(view,method,...args){view.value[method](...args);view.flush();}
function finish(view){const [id,callback]=timers.entries().next().value??[];assert.ok(callback,'scheduled transition');timers.delete(id);callback();view.flush();}

const blank={available:true,loading:false,saving:false,testing:false,enabled:false,connected:true,configured:true,deliveryReady:false,canEnable:true,canSendTest:false,simulated:false,error:null,lastTest:null,lastTestStatus:null,onToggleTelegram:async()=>{},onSendTest:async()=>{},onRefresh:async()=>{},onRetry:async()=>{}};
function panel(notifications=blank,extra={}){
 const workspaceView=workspace(),props={...settings(workspaceView.value),live:true,notifications,...extra};
 const page=mount(()=>ConnectionsSettingsView(props));page.flush();return {workspaceView,props,page,close(){page.unmount();workspaceView.unmount();}};
}
const toggle=tree=>find(tree,n=>n.type==='input'&&n.props['aria-label']==='Telegram notifications');

test('controlled toggle calls once, keeps Backend value until confirmed and respects busy/disconnected opt-in',async()=>{
 const calls=[];const p=panel({...blank,onToggleTelegram:async value=>calls.push(value)});
 await toggle(p.page.value).props.onChange({target:{checked:true}});p.page.flush();assert.deepEqual(calls,[true]);assert.equal(toggle(p.page.value).props.checked,false);
 p.props.notifications={...blank,enabled:true,canEnable:false,connected:false,canSendTest:false};p.page.flush();assert.equal(toggle(p.page.value).props.checked,true);assert.equal(toggle(p.page.value).props.disabled,false);assert.equal(button(p.page.value,'Send test notification').props.disabled,true);
 p.props.notifications={...p.props.notifications,saving:true};p.page.flush();assert.equal(toggle(p.page.value).props.disabled,true);assert.match(text(p.page.value),/Saving notification settings/);p.close();
});

test('test, refresh and retry are controller actions; uncertain test retry retains UUID, never a local success timer',async()=>{
 const sent=[],id='30000000-0000-4000-8000-000000000035',date='2026-10-21T12:00:00Z';let reads=0,release;
 const gate=new Promise(resolve=>release=resolve);
 const dto={notification_id:id,kind:'system.test',created_at:date,scheduled_at:date,expires_at:null,deliveries:[{channel:'telegram',status:'pending',attempts:0,next_attempt_at:date,sent_at:null,error_code:null,parts_sent:0}]};
 const controller=new NotificationSettingsController({kind:'live',notificationSettings:async()=>{reads++;return {channels:{telegram:{enabled:true,connected:true,configured:true,delivery_ready:true}}};},testNotification:async request=>{sent.push(request);if(sent.length===1){await gate;throw new TypeError('lost');}return dto;},notification:async()=>dto},()=>{},()=>id);
 await controller.refresh();const p=panel(controller.presentation());const timerCount=timers.size;
 const send=button(p.page.value,'Send test notification').props.onClick;send();send();const first=controller.sendTest();for(let i=0;i<6;i++)await Promise.resolve();assert.equal(sent.length,1);release();await first;
 p.props.notifications=controller.presentation();p.page.flush();assert.ok(controller.presentation().error);
 button(p.page.value,'Retry').props.onClick();await controller.retry();p.props.notifications=controller.presentation();p.page.flush();
 assert.deepEqual(sent,[id,id]);assert.equal(controller.presentation().lastTestStatus,'pending');assert.match(text(p.page.value),/Queued/);assert.doesNotMatch(text(p.page.value),/Delivered to Telegram|notification in queue|Test alert received/);
 const before=sent.length;find(p.page.value,n=>n.type==='button'&&n.props.title==='Refresh status').props.onClick();await controller.refresh();assert.equal(sent.length,before);assert.ok(reads>=2);assert.equal(timers.size,timerCount);controller.stop();p.close();
});

test('raw delivery statuses have truthful labels; Ready and no receipt never imply delivery',()=>{
 const labels={pending:'Queued',processing:'Processing',retry:'Retrying',sent:'Delivered to Telegram',failed:'Delivery failed',cancelled:'Cancelled',expired:'Expired'};
 const p=panel();
 for(const [status,label] of Object.entries(labels)){
  p.props.notifications={...blank,enabled:true,lastTestStatus:status,lastTest:{deliveries:[{status,error_code:null}]} };p.page.flush();assert.ok(text(p.page.value).includes(label));if(status!=='sent')assert.doesNotMatch(text(p.page.value),/Delivered to Telegram/);
 }
 p.props.notifications={...blank,enabled:true,deliveryReady:true,lastTestStatus:'sent',lastTest:null};p.page.flush();assert.match(text(p.page.value),/Ready · Bot connected/);assert.doesNotMatch(text(p.page.value),/Delivered to Telegram/);
 p.props.notifications={...blank,available:false};p.page.flush();assert.match(text(p.page.value),/Soon · Функция скоро появится/);assert.equal(toggle(p.page.value).props.disabled,true);assert.equal(button(p.page.value,'Send test notification').props.disabled,true);p.close();
});

test('404/409/429/503 errors are separate from delivery receipts; explicit Retry invokes exactly its callback',()=>{
 const p=panel();let retries=0;
 for(const code of [404,409,429,503]){p.props.notifications={...blank,enabled:true,error:'HTTP '+code,onRetry:async()=>{retries++;}};p.page.flush();assert.match(text(p.page.value),new RegExp('HTTP '+code));assert.doesNotMatch(text(p.page.value),/Delivered to Telegram|Test alert received/);button(p.page.value,'Retry').props.onClick();}
 assert.equal(retries,4);p.close();
});

test('Workspace forwards one presentation; Design scenarios are offline and not a competing component state',()=>{
 const w=workspace();const props=settings(w.value);assert.equal(props.notifications,w.value.notifications);assert.ok(props.notificationPreview);assert.ok(props.designIntelligence);
 const page=mount(()=>ConnectionsSettingsView(settings(w.value)));page.flush();assert.match(text(page.value),/Simulation/);
 button(page.value,'Delivered').props.onClick();w.flush();page.flush();assert.equal(w.value.notifications.lastTestStatus,'sent');assert.match(text(page.value),/Delivered to Telegram/);
 all(page.value,n=>n.type==='button'&&text(n).trim()==='Disconnected').at(-1).props.onClick();w.flush();page.flush();assert.equal(w.value.notifications.enabled,true);assert.equal(toggle(page.value).props.disabled,false);assert.equal(w.value.notifications.canSendTest,false);assert.equal(button(page.value,'Send test notification').props.disabled,true);
 const runtimeProps=settings({...w.value,runtime:{},notificationPreview:w.value.notificationPreview});assert.equal(runtimeProps.notificationPreview,undefined);assert.equal(runtimeProps.designIntelligence,undefined);assert.equal(calendar({...w.value,runtime:{}}).designEventAnalysis,undefined);
 assert.equal(requests,0);page.unmount();w.unmount();
});

test('Studio panels exist in Production as inert Preview/Soon examples, separate from real events and memory',()=>{
 const w=workspace();let memoryActions=0;
 const source=mount(()=>IntelligenceSourcesPreview({preview:true}));source.flush();assert.match(text(source.value),/Preview|Пример/);assert.match(text(source.value),/Soon/);
 for(const control of all(source.value,n=>n.type==='input')){assert.equal(control.props.disabled,true);assert.equal(control.props.onChange,undefined);}
 const autonomy=mount(()=>IntelligenceAutonomyPreview({preview:true}));autonomy.flush();assert.match(text(autonomy.value),/Soon/);assert.doesNotMatch(text(autonomy.value),/Сохранено|Сохранение…/);
 assert.equal(all(autonomy.value,n=>n.type==='input'&&n.props.type==='radio').length,3);
 for(const control of all(autonomy.value,n=>n.type==='input')){assert.equal(control.props.disabled,true);assert.equal(control.props.onChange,undefined);}
 for(const label of all(autonomy.value,n=>n.type==='label'))assert.equal(label.props.onClick,undefined);
 const now=new Date(),currentDate=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
 const props={...calendar(w.value),live:true,selectedEventId:'owned-event',events:[{...event,date:currentDate,dayOfMonth:now.getDate(),id:'owned-event',person:'PRIVATE PERSON',organization:'PRIVATE COMPANY'}],onOpenMemory:()=>memoryActions++,designEventAnalysis:designIntelligence.EventAnalysis};
 const page=mount(()=>CalendarView(props));page.flush();button(page.value,'Month').props.onClick();page.flush();button(page.value,'View details').props.onClick();page.flush();const preview=find(page.value,n=>n.type===EventAnalysisPreview);assert.equal(preview.props.event,undefined);assert.equal(preview.props.onViewProposal,undefined);
 const example=mount(()=>EventAnalysisPreview(preview.props));example.flush();assert.match(text(example.value),/Preview/);assert.match(text(example.value),/94%/);assert.match(text(example.value),/не результат обработки вашего события/);assert.doesNotMatch(text(example.value),/PRIVATE PERSON|PRIVATE COMPANY|Проанализировано AI|Предложение принято|Подтверждено/);
 for(const action of all(example.value,n=>n.type==='button')){assert.equal(action.props.disabled,true);assert.equal(action.props.onClick,undefined);}
 const p=panel(blank,{activeTab:'settings',designIntelligence});assert.equal(all(p.page.value,n=>n.type===IntelligenceAutonomyPreview).length,1);p.close();
 const connections=panel(blank,{designIntelligence});assert.equal(all(connections.page.value,n=>n.type===IntelligenceSourcesPreview).length,1);connections.close();
 const design=designIntelligence.EventAnalysis({event:{...event,id:'evt-oct14-alex'},onOpenMemory:()=>memoryActions++});
 const eventView=mount(()=>EventAnalysisPreview(design.props));eventView.flush();assert.equal(button(eventView.value,'Подтвердить факт').props.disabled,false);button(eventView.value,'Подтвердить факт').props.onClick();eventView.flush();assert.match(text(eventView.value),/Предложение принято/);
 assert.equal(memoryActions,0);assert.equal(requests,0);eventView.unmount();example.unmount();page.unmount();autonomy.unmount();source.unmount();w.unmount();
});

test('Shared Preview markup retains original Studio class attributes',()=>{
 const studioCalendar=execFileSync('git',['show','654a31763e03dc8b0bf5d2d462e2c58b43253619:src/components/CalendarView.tsx'],{encoding:'utf8'});
 const studioSettings=execFileSync('git',['show','654a31763e03dc8b0bf5d2d462e2c58b43253619:src/components/ConnectionsSettingsView.tsx'],{encoding:'utf8'});
 const moved=fs.readFileSync('src/components/IntelligencePreviews.tsx','utf8');
 const classes=s=>[...s.matchAll(/className=(?:"([^"]*)"|`([^`]+)`|\{`([^`]+)`\})/g)].map(m=>m[1]??m[2]??m[3]);
 const section=(s,start,end)=>s.slice(s.indexOf(start),s.indexOf(end,s.indexOf(start)));
 const analysis=section(studioCalendar,'{/* Memory Intelligence Event Analysis Section */}','{/* Footer buttons */}');
 const source=section(studioSettings,'{/* Memory Intelligence —',"{activeTab === 'plan'");
 const autonomy=section(studioSettings,'{/* Memory Intelligence Autonomy Card */}','Memory transparency & control');
 // Each unchanged original attribute remains present; the surrounding shared page containers are excluded.
 for(const cls of classes(analysis))assert.ok(moved.replace(/\s+/g,' ').includes(cls.replace(/\s+/g,' ')),cls);
 for(const cls of classes(source).slice(0,-1))assert.ok(moved.replace(/\s+/g,' ').includes(cls.replace(/\s+/g,' ')),cls);
 for(const cls of classes(autonomy).slice(0,-3))assert.ok(moved.replace(/\s+/g,' ').includes(cls.replace(/\s+/g,' ')),cls);
});

test('actual Production graph includes public Soon previews but excludes account fixtures and private demo runtime',async()=>{
 const result=await build({mode:'production',logLevel:'silent',build:{write:false}});
 const chunks=(Array.isArray(result)?result:[result]).flatMap(bundle=>bundle.output).filter(item=>item.type==='chunk');
 assert.equal(chunks.flatMap(c=>c.moduleIds).some(id=>id.replaceAll('\\','/').includes('/src/demo/')),false);
 assert.ok(chunks.flatMap(c=>c.moduleIds).some(id=>id.replaceAll('\\','/').endsWith('/src/components/IntelligencePreviews.tsx')));
 const js=chunks.map(c=>c.code).join('\n');
 assert.ok(js.includes('Пример · Soon'));assert.ok(js.includes('не результат обработки вашего события'));
 for(const marker of ['Harbor Labs','mem-schedule-pref','evt-oct14-alex','Test alert received','1 notification in queue','Design simulation: notification service unavailable.'])assert.equal(js.includes(marker),false,marker);
});
