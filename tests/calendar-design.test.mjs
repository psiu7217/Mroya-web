import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
const key='__calendarDesignHooks';
const vite=await createServer({mode:'design',server:{middlewareMode:true},appType:'custom',plugins:[{
 name:'calendar-design-hooks',enforce:'pre',
 transform(code,id){if(/\/(useDemoMemoryInbox|useDemoWorkspace|useDemoDiagnostics|useLiveCalendar|CalendarView|ConnectionsSettingsView)\.(tsx|ts)$/.test(id.replaceAll('\\','/')))return code.replace(/from 'react';/g,"from 'virtual:calendar-design-hooks';");},
 resolveId(id){if(id==='virtual:calendar-design-hooks')return '\0'+id;},
 load(id){if(id==='\0virtual:calendar-design-hooks')return `import React from 'react';
 ${['useState','useRef','useEffect','useMemo','useSyncExternalStore'].map(name=>`export const ${name}=(...args)=>globalThis.${key}.${name}(...args);`).join('\n')}
 export default {...React,useState,useRef,useEffect,useMemo,useSyncExternalStore};`;},
}]});
const {useDemoWorkspace}=await vite.ssrLoadModule('/src/demo/useDemoWorkspace.ts');
const liveCalendarModule=await vite.ssrLoadModule('/src/hooks/useLiveCalendar.ts');
const {CalendarView}=await vite.ssrLoadModule('/src/components/CalendarView.tsx');
const {ConnectionsSettingsView}=await vite.ssrLoadModule('/src/components/ConnectionsSettingsView.tsx');
const {WorkspaceView}=await vite.ssrLoadModule('/src/pages/WorkspaceView.tsx');
const originals=Object.fromEntries(['window','document','setTimeout','clearTimeout','fetch'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
let requests=0,timerId=0;const timers=new Map();
globalThis.window={matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}})};
globalThis.document={querySelectorAll:()=>[],documentElement:{setAttribute(){},removeAttribute(){}},addEventListener(){},removeEventListener(){}};
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

test('Profile timezone uses confirmed state, keeps failed selection and supports Retry with an injected transport',async()=>{
 const {UserTimezoneStore}=await vite.ssrLoadModule('/src/hooks/useUserTimezone.ts');
 const apiUser={id:71,username:'tester',email:'test@example.test',first_name:'',last_name:'',timezone:'UTC',nickname:'',preferences:{theme:'system'}};
 let confirmed=apiUser,fail=false;
 let resolve;const pending=new Promise(done=>resolve=done);
 let calls=0;
 const store=new UserTimezoneStore({kind:'live',session:async()=>({status:'authenticated',user:confirmed}),timezone:{initializeIfUnset:async()=>confirmed,save:async zone=>{calls++;if(calls===1)await pending;if(fail){fail=false;throw Error('Timezone request failed');}return confirmed={...confirmed,timezone:zone};}}},apiUser,()=>{});
 store.start();
 const view=workspace();
 const page=mount(()=>ConnectionsSettingsView({...settings(view.value),activeTab:'profile',live:true,account:{...view.value.account,timezone:store.snapshot().timezone},timezoneSettings:{...store.snapshot(),onChange:store.change,onRetry:()=>void store.retry()},onChangeTimezone:store.change}));page.flush();
 const select=()=>find(page.value,node=>node.type==='select'&&node.props.id==='mroya-timezone-select');
 assert.equal(select().props.disabled,false);assert.ok(all(page.value,node=>node.type==='option'&&node.props.value==='Pacific/Chatham').length);
 select().props.onChange({target:{value:'Pacific/Chatham'}});page.flush();assert.equal(select().props.value,'Pacific/Chatham');assert.equal(store.snapshot().timezone,'UTC');assert.match(text(page.value),/Saving timezone/);assert.doesNotMatch(text(page.value),/Saved ·/);
 resolve();for(let i=0;i<8;i++)await Promise.resolve();page.flush();assert.match(text(page.value),/Saved ·\s*Pacific\/Chatham/);
 fail=true;select().props.onChange({target:{value:'Asia/Tokyo'}});for(let i=0;i<8;i++)await Promise.resolve();page.flush();assert.equal(select().props.value,'Asia/Tokyo');assert.match(text(page.value),/Timezone request failed/);assert.doesNotMatch(text(page.value),/Saved ·/);
 button(page.value,'Retry timezone').props.onClick();for(let i=0;i<12;i++)await Promise.resolve();page.flush();assert.equal(store.snapshot().timezone,'Asia/Tokyo');assert.match(text(page.value),/Saved ·\s*Asia\/Tokyo/);
 page.unmount();view.unmount();store.stop();assert.equal(requests,0);
});

test('Design Profile custom timezone stays local and survives navigation',()=>{
 const view=workspace();let props={...settings(view.value),activeTab:'profile'};
 const page=mount(()=>ConnectionsSettingsView(props));page.flush();
 find(page.value,node=>node.type==='select'&&node.props.id==='mroya-timezone-select').props.onChange({target:{value:'__custom__'}});page.flush();
 find(page.value,node=>node.type==='input'&&node.props['aria-label']==='Custom IANA timezone').props.onChange({target:{value:'Etc/GMT+12'}});page.flush();button(page.value,'Use timezone').props.onClick();view.flush();
 assert.equal(view.value.account.timezone,'Etc/GMT+12');page.unmount();props={...settings(view.value),activeTab:'profile'};
 const returned=mount(()=>ConnectionsSettingsView(props));returned.flush();assert.equal(find(returned.value,node=>node.type==='select'&&node.props.id==='mroya-timezone-select').props.value,'Etc/GMT+12');assert.equal(requests,0);returned.unmount();view.unmount();
});

for(const live of [false,true])for(const dialog of ['create','edit','delete'])test(`${live?'Production':'Design'} ${dialog}: background refresh leaves modal markup stable; errors and saving remain visible`,async()=>{
 const view=workspace();let retries=0;
 const today=new Date();
 const date=live?`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`:'2024-02-12';
 const existing={...event,id:'stable-modal',date,dayOfMonth:Number(date.slice(8)),recurrence:{frequency:'daily',interval:1,endCondition:'never'}};
 let props={...calendar(view.value),events:[existing],live,readOnly:false,
  calendar:{loading:false,busy:false,mutationPending:false,error:null,timezone:'Europe/Minsk',onRangeChange(){},onLoadEventForEdit:async()=>existing,onRetry:async()=>{retries++;return false;}}};
 const page=mount(()=>CalendarView(props));page.flush();
 if(dialog==='create')button(page.value,'+ Add event').props.onClick();
 else{
  button(page.value,'Month').props.onClick();page.flush();
  await find(page.value,node=>node.type==='button'&&node.props.title===(dialog==='edit'?'Edit commitment':'Delete commitment')).props.onClick();
 }
 page.flush();
 // Compare native layout and text, excluding callback identities and internal component props.
 const markup=node=>{
  if(node===null||node===undefined||typeof node==='boolean')return null;
  if(typeof node!=='object')return node;
  return {type:typeof node.type==='string'?node.type:node.type.name, className:node.props?.className,role:node.props?.role,value:node.props?.value,
   children:[node.props?.children].flat(Infinity).map(markup).filter(value=>value!==null)};
 };
 const before=markup(page.value);
 props={...props,calendar:{...props.calendar,loading:true}};page.flush();
 assert.deepEqual(markup(page.value),before,'background GET must not insert a strip or shift fields');
 assert.doesNotMatch(text(page.value),/Loading calendar/);
 if(dialog!=='delete'){
  const form=find(page.value,node=>node.type==='form');
  const grid=find(form,node=>node.props?.className==='grid grid-cols-2 gap-3'&&all(node,item=>item.type==='input'&&item.props.type==='date').length>0);
  assert.deepEqual(all(grid,node=>node.type==='label').map(node=>text(node).trim()),['Date','Time','All day']);
  const inputs=all(grid,node=>node.type==='input');assert.equal(inputs[0].props.className,inputs[1].props.className);
 }
 props={...props,calendar:{...props.calendar,busy:true}};page.flush();assert.match(text(page.value),/Saving calendar change/);
 props={...props,calendar:{...props.calendar,loading:false,busy:false,error:'Calendar backend unavailable'}};page.flush();
 assert.match(text(find(page.value,node=>node.props?.role==='alert')),/Calendar backend unavailable/);
 button(page.value,'Retry / check calendar').props.onClick();await Promise.resolve();assert.equal(retries,1);
 props={...props,calendar:{...props.calendar,error:null}};page.flush();assert.deepEqual(markup(page.value),before);
 page.unmount();view.unmount();timers.clear();assert.equal(requests,0);
});

test('visible live Calendar still refreshes every 10 seconds and on focus/visibility; unmount cleans up',()=>{
 const saved={window:globalThis.window,document:globalThis.document,setInterval:globalThis.setInterval,clearInterval:globalThis.clearInterval};
 const listeners=new Map();let tick,delay,cleared=false,reads=0;
 const {useLiveCalendar}=liveCalendarModule;
 let page;
 try{
  globalThis.window={location:{href:'https://app.heymroya.com/'},history:{},addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)};
  globalThis.document={visibilityState:'visible',addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)};
  globalThis.setInterval=(fn,ms)=>{tick=fn;delay=ms;return 123;};globalThis.clearInterval=id=>{assert.equal(id,123);cleared=true;};
  const source={kind:'live',calendarEvents:async()=>{reads++;return {events:[],offset:0,limit:100};}};
  page=mount(()=>useLiveCalendar(source,1,'UTC',true,false,true,()=>{}));page.flush();
  const initial=reads;assert.equal(delay,10000);
  tick();assert.equal(reads,initial+1);
  listeners.get('focus')();assert.equal(reads,initial+2);
  listeners.get('visibilitychange')();assert.equal(reads,initial+3);
  globalThis.document.visibilityState='hidden';tick();assert.equal(reads,initial+3);
  page.unmount();page=null;assert.equal(cleared,true);assert.equal(listeners.size,0);
 }finally{page?.unmount();Object.assign(globalThis,saved);}
});

test('all create entry points use selected full date; open drafts are untouched and Cancel resets the next opening',()=>{
 const view=workspace(),page=mount(()=>CalendarView(calendar(view.value)));page.flush();button(page.value,'Month').props.onClick();page.flush();button(page.value,'22').props.onClick();page.flush();
 find(page.value,n=>n.type==='button'&&n.props['aria-label']==='New commitment').props.onClick();page.flush();
 const date=()=>find(page.value,n=>n.type==='input'&&n.props.type==='date');assert.equal(date().props.value,'2026-10-22');
 date().props.onChange({target:{value:'2028-02-29'}});page.flush();find(page.value,n=>n.type==='button'&&n.props['aria-label']==='New commitment').props.onClick();page.flush();assert.equal(date().props.value,'2028-02-29');
 button(page.value,'Cancel').props.onClick();page.flush();
 for(let i=0;i<3;i++){find(page.value,n=>n.type==='button'&&n.props.title==='Next month').props.onClick();page.flush();}
 button(page.value,'+ Add event').props.onClick();page.flush();assert.equal(date().props.value,'2027-01-22');page.unmount();view.unmount();
});

for(const editing of [false,true])test(`${editing?'edit':'create'} uses the same time mask, field error and explicit All day choice`,async()=>{
 const view=workspace(),writes=[];const existing={...event,id:'clock'};
 const props={...calendar(view.value),events:[existing],onAddEvent:async e=>{writes.push(e);return false;},onEditEvent:async e=>{writes.push(e);return false;}};
 const page=mount(()=>CalendarView(props));page.flush();
 if(editing){button(page.value,'Month').props.onClick();page.flush();find(page.value,n=>n.type==='button'&&n.props.title==='Edit commitment').props.onClick();}
 else find(page.value,n=>n.type==='button'&&n.props['aria-label']==='New commitment').props.onClick();
 page.flush();const form=()=>find(page.value,n=>n.type==='form');
 const title=find(form(),n=>n.type==='input'&&n.props.type==='text'&&!n.props['aria-label']);title.props.onChange({target:{value:'Clock test'}});page.flush();
 const clock=()=>find(page.value,n=>n.type==='input'&&n.props['aria-label']===(editing?'Edit event time':'New event time'));
 const input=raw=>{clock().props.onChange({target:{value:raw,selectionStart:raw.length}});page.flush();};
 input('1630');assert.equal(clock().props.value,'16:30');input('09:45');assert.equal(clock().props.value,'09:45');input('ab');assert.equal(clock().props.value,'');
 for(const bad of ['2400','1875','123']){input(bad);await form().props.onSubmit({preventDefault(){}});page.flush();assert.equal(writes.length,0);assert.match(text(form()),/00:00–23:59/);}
 input('16:3');assert.equal(clock().props.value,'16:3');input('16:');assert.equal(clock().props.value,'16');
 const allDay=find(form(),n=>n.type==='label'&&text(n).trim()==='All day');find(allDay,n=>n.type==='input').props.onChange({target:{checked:true}});page.flush();assert.equal(clock().props.disabled,true);
 await form().props.onSubmit({preventDefault(){}});page.flush();assert.equal(writes.length,1);assert.equal(writes[0].time,'All day');page.unmount();view.unmount();
});

test('month title width is stable for all 12 English months; Auto Sync uses confirmed boolean and keeps attention states',()=>{
 const view=workspace();let props={...calendar(view.value),googleCalendarConnected:true,autoSync:true,gcalSyncState:'connected_auto_on'};
 const page=mount(()=>CalendarView(props));page.flush();assert.doesNotMatch(text(page.value),/Google Calendar integration/);let monthClass;
 for(let i=0;i<12;i++){
  const month=find(page.value,n=>n.type==='button'&&n.props.title==='Click to jump to another month or year');monthClass??=month.props.className;assert.equal(month.props.className,monthClass);assert.match(month.props.className,/w-\[150px\]/);
  find(page.value,n=>n.type==='button'&&n.props.title==='Next month').props.onClick();page.flush();
 }
 for(const state of ['syncing','initial_syncing']){props={...props,gcalSyncState:state};page.flush();assert.doesNotMatch(text(page.value),/Google Calendar integration/);}
 for(const state of ['sync_error','conflict','reconnect_required']){props={...props,gcalSyncState:state};page.flush();assert.match(text(page.value),/Google Calendar integration/);button(page.value,'Manage connection');}
 props={...props,gcalSyncState:'connected_auto_on',autoSync:false};page.flush();assert.match(text(page.value),/Google Calendar integration/);
 assert.ok(all(page.value,n=>n.type==='button'&&n.props.onClick===props.onOpenConnections).length>=2,'mobile access remains');page.unmount();view.unmount();
});

test('live Upcoming respects selected November date, displays December and navigates to its actual year/date',()=>{
 const view=workspace(),year=new Date().getFullYear()+1;
 const events=[{...event,id:'old2',title:'OLD NOVEMBER 2',date:`${year}-11-02`},{...event,id:'old8',title:'OLD NOVEMBER 8',date:`${year}-11-08`},{...event,id:'dec',title:'December upcoming',date:`${year}-12-02`}];
 const props={...calendar(view.value),live:true,events:[],calendar:{...calendar(view.value).calendar,timezone:'Europe/Minsk',upcoming:{events,loading:false,error:null,onStartChange(){},onRetry(){}}}};
 const page=mount(()=>CalendarView(props));page.flush();
 find(page.value,n=>n.type==='button'&&n.props.title==='Click to jump to another month or year').props.onClick();page.flush();button(page.value,String(year)).props.onClick();page.flush();button(page.value,'Nov').props.onClick();page.flush();button(page.value,'Month').props.onClick();page.flush();button(page.value,'22').props.onClick();page.flush();
 assert.doesNotMatch(text(page.value),/OLD NOVEMBER/);assert.match(text(page.value),/December upcoming/);
 find(page.value,n=>n.type==='button'&&text(n).includes('December upcoming')).props.onClick();page.flush();find(page.value,n=>n.type==='button'&&n.props['aria-label']==='New commitment').props.onClick();page.flush();assert.equal(find(page.value,n=>n.type==='input'&&n.props.type==='date').props.value,`${year}-12-02`);page.unmount();view.unmount();
});

test('Calendar content swipes still change months; inner edge gesture is reserved for the mobile drawer',()=>{
 const view=workspace(),page=mount(()=>CalendarView(calendar(view.value)));page.flush();
 const gesture=(start,end)=>{page.value.props.onTouchStart({touches:[{clientX:start,clientY:200}]});page.value.props.onTouchEnd({changedTouches:[{clientX:end,clientY:205}]});page.flush();};
 assert.match(text(page.value),/October/);gesture(220,100);assert.match(text(page.value),/November/);
 gesture(100,220);assert.match(text(page.value),/October/);
 gesture(24,180);assert.match(text(page.value),/October/);
 page.unmount();view.unmount();
});

for(const kind of ['create','edit','delete'])test(`${kind} dialog cannot discard its form via Escape/backdrop/cancel while saving or unresolved`,async()=>{
 const view=workspace(),existing={...event,id:'protected-modal',date:'2024-02-12',dayOfMonth:12,recurrence:{frequency:'daily',interval:1,endCondition:'never'}};
 let props={...calendar(view.value),events:[existing],readOnly:false,calendar:{loading:false,busy:false,mutationPending:false,error:null,timezone:'UTC',onRangeChange(){},onLoadEventForEdit:async()=>existing,onRetry:async()=>false}};
 const page=mount(()=>CalendarView(props));page.flush();
 if(kind==='create')button(page.value,'+ Add event').props.onClick();else{button(page.value,'Month').props.onClick();page.flush();await find(page.value,n=>n.type==='button'&&n.props.title===(kind==='edit'?'Edit commitment':'Delete commitment')).props.onClick();}page.flush();
 const label={create:'new-event-title',edit:'edit-event-title',delete:'delete-event-dialog-title'}[kind];
 for(const patch of [{busy:true,mutationPending:false},{busy:false,mutationPending:true}]){
  props={...props,calendar:{...props.calendar,...patch}};page.flush();let dialog=find(page.value,n=>n.props?.['aria-labelledby']===label);
  dialog.props.onClose();dialog.props.onClick?.();page.flush();assert.ok(find(page.value,n=>n.props?.['aria-labelledby']===label));
  button(find(page.value,n=>n.props?.['aria-labelledby']===label),'Cancel').props.onClick();page.flush();assert.ok(find(page.value,n=>n.props?.['aria-labelledby']===label));
 }
 props={...props,calendar:{...props.calendar,busy:false,mutationPending:false}};page.flush();find(page.value,n=>n.props?.['aria-labelledby']===label).props.onClose();page.flush();assert.equal(all(page.value,n=>n.props?.['aria-labelledby']===label).length,0);
 page.unmount();view.unmount();
});
