import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
const key='__calendarDesignHooks';
const vite=await createServer({mode:'design',server:{middlewareMode:true},appType:'custom',plugins:[{
 name:'calendar-design-hooks',enforce:'pre',
 transform(code,id){if(/\/(useDemoWorkspace|useDemoDiagnostics|CalendarView|ConnectionsSettingsView)\.(tsx|ts)$/.test(id.replaceAll('\\','/')))return code.replace(/from 'react';/g,"from 'virtual:calendar-design-hooks';");},
 resolveId(id){if(id==='virtual:calendar-design-hooks')return '\0'+id;},
 load(id){if(id==='\0virtual:calendar-design-hooks')return `import React from 'react';
 ${['useState','useRef','useEffect','useMemo'].map(name=>`export const ${name}=(...args)=>globalThis.${key}.${name}(...args);`).join('\n')}
 export default {...React,useState,useRef,useEffect,useMemo};`;},
}]});
const {useDemoWorkspace}=await vite.ssrLoadModule('/src/demo/useDemoWorkspace.ts');
const {CalendarView}=await vite.ssrLoadModule('/src/components/CalendarView.tsx');
const {ConnectionsSettingsView}=await vite.ssrLoadModule('/src/components/ConnectionsSettingsView.tsx');
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

test('Connections disconnect updates Calendar; connect runs initial sync with auto OFF and no HTTP',()=>{
 const view=workspace();let props=settings(view.value),panel=mount(()=>ConnectionsSettingsView(props));panel.flush();
 button(panel.value,'Disconnect').props.onClick();view.flush();assert.equal(calendar(view.value).gcalSyncState,'disconnected');
 props=settings(view.value);panel.flush();button(panel.value,'Connect Google Calendar').props.onClick();view.flush();
 assert.equal(view.value.gcalSyncState,'connecting');assert.equal(view.value.syncSummary,null);assert.equal(view.value.lastSyncedTime,'');
 finish(view);assert.equal(view.value.gcalSyncState,'initial_syncing');assert.equal(view.value.autoSync,false);assert.equal(view.value.syncSummary,null);
 finish(view);assert.equal(view.value.gcalSyncState,'connected_auto_off');assert.equal(view.value.autoSync,false);assert.ok(view.value.syncSummary);assert.ok(Date.parse(view.value.lastSyncedTime));
 const calendarProps=calendar(view.value),page=mount(()=>CalendarView(calendarProps));page.flush();assert.match(text(page.value),/Connected · Automatic sync OFF/);
 props=settings(view.value);panel.flush();assert.doesNotMatch(text(panel.value),/\{googleCalendarEmail\}/);assert.match(text(panel.value),/Primary \/ Основной \(demo.calendar@example.test\)/);
 assert.notEqual(view.value.googleCalendarEmail,view.value.account.email);assert.equal(requests,0);page.unmount();panel.unmount();view.unmount();
});

test('auto ON/OFF and calendar selections survive page remounts; manual sync restores flag only after success',()=>{
 const view=workspace();call(view,'onChangeImportedCalendars',['personal']);call(view,'onChangeExportCalendar','work');call(view,'onToggleAutoSyncGoogleCalendar');
 let props=settings(view.value),page=mount(()=>ConnectionsSettingsView(props));page.flush();page.unmount();
 assert.equal(calendar(view.value).gcalSyncState,'connected_auto_on');props=settings(view.value);page=mount(()=>ConnectionsSettingsView(props));page.flush();
 assert.equal(props.autoSync,true);assert.deepEqual(props.importedCalendars,['personal']);assert.equal(props.exportCalendar,'work');
 const before=view.value.syncSummary;call(view,'onSyncNowGoogleCalendar');assert.equal(view.value.gcalSyncState,'syncing');assert.equal(view.value.syncSummary,before);
 finish(view);assert.equal(view.value.gcalSyncState,'connected_auto_on');assert.equal(view.value.autoSync,true);
 call(view,'onToggleAutoSyncGoogleCalendar');call(view,'onSyncNowGoogleCalendar');finish(view);assert.equal(view.value.gcalSyncState,'connected_auto_off');assert.equal(view.value.autoSync,false);
 page.unmount();view.unmount();
});

for(const stage of ['connecting','initial_syncing','syncing'])test(`disconnect cancels ${stage}, including an already queued late callback`,()=>{
 const view=workspace();call(view,'onDisconnectGoogleCalendar');
 if(stage==='syncing'){call(view,'onSetGcalSyncState','connected_auto_on');call(view,'onSyncNowGoogleCalendar');}
 else{call(view,'onConnectGoogleCalendar');if(stage==='initial_syncing')finish(view);}
 const late=[...timers.values()];assert.equal(late.length,1);call(view,'onDisconnectGoogleCalendar');assert.equal(timers.size,0);late.forEach(callback=>callback());view.flush();
 assert.equal(view.value.gcalSyncState,'disconnected');assert.equal(view.value.autoSync,false);assert.equal(view.value.syncSummary,null);assert.equal(view.value.lastSyncedTime,'');view.unmount();
});

test('conflict cancels sync without resolving or duplicating events; reconnect blocks sync; unmount cleans timers',()=>{
 const view=workspace();call(view,'onCalendarViewAddEvent',event);call(view,'onSyncNowGoogleCalendar');const late=[...timers.values()];
 call(view,'onSetGcalSyncState','conflict');late.forEach(callback=>callback());call(view,'onToggleAutoSyncGoogleCalendar');call(view,'onSyncNowGoogleCalendar');
 assert.equal(view.value.gcalSyncState,'conflict');assert.equal(view.value.events.length,1);assert.equal(view.value.events[0].syncStatus,'local_only');assert.equal(view.value.syncSummary,null);
 const page=mount(()=>ConnectionsSettingsView(settings(view.value)));page.flush();assert.doesNotMatch(text(page.value),/Acknowledge & keep both|Both versions have been preserved/);assert.match(text(page.value),/No duplicate events/);page.unmount();
 call(view,'onSetGcalSyncState','reconnect_required');call(view,'onSyncNowGoogleCalendar');assert.equal(view.value.gcalSyncState,'reconnect_required');assert.equal(timers.size,0);
 call(view,'onConnectGoogleCalendar');const stale=[...timers.values()];view.unmount();assert.equal(timers.size,0);stale.forEach(callback=>callback());assert.equal(timers.size,0);
});

test('new events stay local until queued and confirmed; disconnect preserves previously synced events',()=>{
 const view=workspace();call(view,'onCalendarViewAddEvent',event);assert.equal(view.value.events[0].syncStatus,'local_only');
 call(view,'onSyncNowGoogleCalendar');assert.equal(view.value.events[0].syncStatus,'pending');finish(view);assert.equal(view.value.events[0].syncStatus,'synced');
 call(view,'onDisconnectGoogleCalendar');assert.equal(view.value.events[0].syncStatus,'synced');
 call(view,'onSetGcalSyncState','conflict');call(view,'onCalendarViewAddEvent',event);assert.equal(view.value.events[1].syncStatus,'local_only');
 call(view,'onSetGcalSyncState','connected_auto_on');call(view,'onCalendarViewAddEvent',event);assert.equal(view.value.events[2].syncStatus,'pending');
 finish(view);assert.equal(view.value.events[2].syncStatus,'synced');assert.equal(requests,0);view.unmount();
});

test('Calendar edit supports a full date, preserves recurrence and rejects invalid civil dates/external edits',async()=>{
 const view=workspace(),edits=[];
 const recurring={...event,id:'old-month',date:'2024-02-12',dayOfMonth:12,recurrence:{frequency:'daily',interval:1,endCondition:'never'}};
 let props={...calendar(view.value),events:[recurring],onEditEvent:value=>edits.push(value)};
 const page=mount(()=>CalendarView(props));page.flush();
 button(page.value,'Month').props.onClick();page.flush();
 find(page.value,node=>node.type==='button'&&node.props.title==='Edit commitment').props.onClick();page.flush();
 let day=find(page.value,node=>node.type==='input'&&node.props.type==='date');assert.equal(day.props.value,'2024-02-12');
 day.props.onChange({target:{value:'2024-02-31'}});page.flush();await find(page.value,node=>node.type==='form').props.onSubmit({preventDefault(){}});page.flush();assert.equal(edits.length,0);
 find(page.value,node=>node.type==='input'&&node.props.type==='date').props.onChange({target:{value:'2024-02-28'}});page.flush();await find(page.value,node=>node.type==='form').props.onSubmit({preventDefault(){}});page.flush();
 assert.equal(edits[0].date,'2024-02-28');assert.deepEqual(edits[0].recurrence,recurring.recurrence);assert.equal(edits[0].syncStatus,'local_only');assert.match(text(page.value),/Not yet synchronized/);
 props={...props,events:[{...recurring,isReadOnly:true}]};page.flush();assert.equal(all(page.value,node=>node.type==='button'&&node.props.title==='Edit commitment').length,0);
 page.unmount();view.unmount();timers.clear();
});

test('Production receives no demo Google props and shows Coming soon even for a demo-shaped input',()=>{
 const view=workspace(),model={...view.value,runtime:{loading:false,error:null,busy:false}};
 const props=calendar(model);assert.equal(props.googleCalendarConnected,false);assert.equal(props.gcalSyncState,undefined);assert.equal(props.googleCalendarEmail,undefined);assert.equal(props.readOnly,true);
 const page=mount(()=>CalendarView(props));page.flush();assert.match(text(page.value),/Coming soon/);assert.doesNotMatch(text(page.value),/demo.calendar|Connected ·/);page.unmount();
 const connections=settings(model);assert.equal(connections.googleCalendarEmail,undefined);assert.equal(connections.onConnectGoogleCalendar,undefined);
 const panel=mount(()=>ConnectionsSettingsView(connections));panel.flush();assert.doesNotMatch(text(panel.value),/demo.calendar|Connected Google Account|Design Mode Scenarios/);panel.unmount();view.unmount();assert.equal(requests,0);
});


test('Calendar create emits local_only even when connected; every shared status reaches both page layouts',async()=>{
 const view=workspace(),created=[];
 let props={...calendar(view.value),onAddEvent:event=>created.push(event)};
 const page=mount(()=>CalendarView(props));page.flush();
 button(page.value,'+ Add event').props.onClick();page.flush();
 find(page.value,node=>node.type==='input'&&node.props.required).props.onChange({target:{value:'New local event'}});page.flush();
 await find(page.value,node=>node.type==='form').props.onSubmit({preventDefault(){}});page.flush();
 assert.equal(created.length,1);assert.equal(created[0].syncStatus,'local_only');
 for(const [state,label] of Object.entries({disconnected:'Disconnected',connecting:'Connecting',initial_syncing:'Initial syncing',syncing:'Syncing',sync_error:'Sync error',conflict:'Conflict',reconnect_required:'Reconnect required'})){
  props={...props,gcalSyncState:state};page.flush();assert.ok(text(page.value).includes(label),state);
 }
 page.unmount();view.unmount();assert.equal(requests,0);
});

test('live Connections uses the same Google card with real calendars, controlled ON/OFF and no scenario switcher',()=>{
 const view=workspace();let toggles=0;
 const account={id:'account-real',email:'owner@calendar.test',status:'connected',sync_enabled:false,calendars:[{id:'calendar-real',name:'Actual calendar',selected:true,available:true,read_only:false,is_primary:true,export_destination:true}]};
 const model={...view.value,runtime:{calendarAvailable:true},googleCalendarAvailable:true,googleConnections:[account],selectedGoogleConnectionId:account.id,
  googleCalendarEmail:account.email,importedCalendars:['calendar-real'],exportCalendar:'calendar-real',onToggleAutoSyncGoogleCalendar:()=>toggles++};
 const props=settings(model),page=mount(()=>ConnectionsSettingsView(props));page.flush();
 assert.match(text(page.value),/owner@calendar.test/);assert.match(text(page.value),/Actual calendar/);assert.doesNotMatch(text(page.value),/Design Mode ·|Harbor Labs|demo.calendar/);
 find(page.value,node=>node.type==='button'&&node.props.role==='switch').props.onClick();assert.equal(toggles,1);
 assert.ok(all(page.value,node=>node.type==='option'&&node.props.value==='calendar-real').length);page.unmount();view.unmount();
});

test('live Calendar retains failed creation draft; explicit retry confirms the original operation without another create',async()=>{
 const view=workspace();let creates=0,retries=0;
 const props={...calendar(view.value),readOnly:false,live:true,googleCalendarAvailable:true,
  calendar:{loading:false,busy:false,mutationPending:false,error:'Lost response',timezone:'UTC',onRangeChange(){},onLoadEventForEdit:async()=>null,onRetry:async()=>{retries++;return true;}},onAddEvent:async()=>{creates++;return false;}};
 const page=mount(()=>CalendarView(props));page.flush();button(page.value,'+ Add event').props.onClick();page.flush();
 find(page.value,node=>node.type==='input'&&node.props.required&&node.props.type==='text').props.onChange({target:{value:'Retained appointment'}});page.flush();
 await find(page.value,node=>node.type==='form').props.onSubmit({preventDefault(){}});page.flush();assert.equal(creates,1);
 assert.equal(find(page.value,node=>node.type==='input'&&node.props.required&&node.props.type==='text').props.value,'Retained appointment');
 button(page.value,'Retry / check calendar').props.onClick();await Promise.resolve();await Promise.resolve();page.flush();
 assert.equal(retries,1);assert.equal(creates,1);assert.equal(all(page.value,node=>node.type==='form').length,0);page.unmount();view.unmount();
});
