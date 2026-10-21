import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const vite=await createServer({mode:'design',server:{middlewareMode:true},appType:'custom'});
after(()=>vite.close());
const {ConnectionsSettingsView}=await vite.ssrLoadModule('/src/components/ConnectionsSettingsView.tsx');
const {Sidebar}=await vite.ssrLoadModule('/src/components/Sidebar.tsx');
const {WorkspaceView}=await vite.ssrLoadModule('/src/pages/WorkspaceView.tsx');
const {useDemoWorkspace}=await vite.ssrLoadModule('/src/demo/useDemoWorkspace.ts');
const {UserPreferenceStore}=await vite.ssrLoadModule('/src/hooks/useUserPreferences.ts');
const {accountPresentation}=await vite.ssrLoadModule('/src/hooks/liveAdapters.ts');
const {ApiError}=await vite.ssrLoadModule('/src/api/errors.ts');
const noop=()=>{};
const account={displayName:'Real account',initials:'RA',email:'real@example.test',description:'',timezone:'Europe/Moscow',spaceDescription:'Personal space',nickname:'Real account'};
const settings={account,connections:[],plan:'free',onSelectPlan:noop,theme:'system',onSelectTheme:noop,activeTab:'connections',onChangeTab:noop,isSidebarCollapsed:false,onExpandSidebar:noop,onOpenMobileMenu:noop,onToggleConnection:noop};
const sidebar={account,activeSection:'connections',onSelectSection:noop,conversations:[],activeConversationId:null,onSelectConversation:noop,onNewChat:noop,plan:'free',onTogglePlan:noop,onOpenPlanModal:noop,theme:'light',onToggleTheme:noop,isCollapsed:false,onToggleCollapse:noop,mobileOpen:false,onCloseMobile:noop,memoriesCount:0,upcomingEventsCount:0,pendingRemindersCount:0,onOpenSettingsTab:noop};
const markup=props=>renderToStaticMarkup(React.createElement(ConnectionsSettingsView,{...settings,...props}));
const labels=['Connected accounts','My plan','Appearance','Profile','Assistant preferences'];
test('both workspace pages render the same five settings tabs in order',()=>{
 function Design(){const model=useDemoWorkspace();return React.createElement(WorkspaceView,{model:{...model,activeSection:'connections'}});}
 const design=renderToStaticMarkup(React.createElement(Design));
 function Live(){const model=useDemoWorkspace('empty');return React.createElement(WorkspaceView,{model:{...model,account,activeSection:'connections',runtime:{pending:false,loading:false,busy:false,error:null,onRetry:noop,chatAvailable:true,memoryAvailable:true,calendarAvailable:false,remindersAvailable:false,memoriesTotal:0,hasOlder:false,onOlder:noop,hasMoreMemories:false,onMoreMemories:noop,truncated:false,notice:null,onCloseNotice:noop,onUnavailable:noop,onLogout:noop,preferenceSave:{status:'saved',error:null,onRetry:noop},onSaveNickname:noop,onClearNickname:noop}}});}
 const live=renderToStaticMarkup(React.createElement(Live));
 for(const html of [design,live]){let previous=-1;for(const label of labels){const index=html.indexOf('>'+label+'</button>');assert.ok(index>previous,label);previous=index;}assert.match(html,/Connections &amp; Account/);}
 assert.match(fs.readFileSync('src/pages/WorkspaceView.tsx','utf8'),/<ConnectionsSettingsView\b/);
 assert.ok(!fs.existsSync('src/pages/LiveWorkspace.tsx'));
});
test('sidebar has no standalone Settings in expanded, collapsed, mobile, live or guest navigation',()=>{
 for(const live of [true,false])for(const isCollapsed of [true,false])for(const mobileOpen of [true,false])for(const guest of [true,false]){
 const html=renderToStaticMarkup(React.createElement(Sidebar,{...sidebar,live,isCollapsed,mobileOpen,...(guest?{onSignIn:noop}:{})}));
 for(const nav of html.matchAll(/<nav\b[\s\S]*?<\/nav>/g))assert.doesNotMatch(nav[0],/Settings/);
 }
});
test('actual account-menu handlers route Profile, Connected accounts, Settings and My plan; Appearance toggles existing theme',()=>{
 const s=fs.readFileSync('src/components/Sidebar.tsx','utf8');
 for(const [label,target] of [['Profile','profile'],['Connected accounts','connections'],['Settings','settings'],['My plan','plan'],['Appearance','toggle']]){
  const end=s.indexOf('<span>'+label+'</span>');assert.ok(end>=0);
  const start=s.lastIndexOf('onClick={() => {',end)+ 'onClick={() => {'.length;
  const finish=s.indexOf('}}',start);let selected=null,closed=0;
  new Function('setAccountMenuOpen','onOpenSettingsTab','onCloseMobile','onToggleTheme',s.slice(start,finish))(noop,tab=>{selected=tab;},()=>closed++,()=>{selected='toggle';});
  assert.equal(selected,target,label);if(target!=='toggle')assert.equal(closed,1,label);
 }
 assert.equal((s.match(/if \(item.id === 'connections'\) onOpenSettingsTab\('connections'\)/g)||[]).length,2);
 const provider=fs.readFileSync('src/providers/LiveExperience.tsx','utf8');
 assert.equal((provider.match(/on(?:Sidebar|ChatWorkspace)OpenSettingsTab:openSettings/g)||[]).length,2);
 assert.match(provider,/select\('connections'\);setSettingsTab\(tab\)/);
});
test('live shows unavailable services/plan/memory controls without fake successes or demo accounts',()=>{
 const connections=markup({live:true});
 assert.equal((connections.match(/>Coming soon<\/button>/g)||[]).length,2);
 assert.match(connections,/Checking Telegram connection/);
 assert.doesNotMatch(connections,/Connected \(|Disconnect preview|alex@|lindqvist|Saved<|Enabled</);
 assert.equal((connections.match(/disabled=""/g)||[]).length,6);
 assert.match(connections,/<input[^>]*aria-label="Telegram notifications"[^>]*disabled=""/);
 assert.match(connections,/<button[^>]*title="Refresh status"[^>]*disabled=""/);
 assert.match(connections,/<button[^>]*disabled=""[^>]*>Send test notification<\/button>/);
 const plan=markup({live:true,activeTab:'plan'});assert.equal((plan.match(/>Coming soon<\/button>/g)||[]).length,2);assert.doesNotMatch(plan,/Current active preview/);
 const memory=markup({live:true,activeTab:'settings'});assert.match(memory,/Coming soon/);assert.doesNotMatch(memory,/>Enabled</);
});
test('live and Studio share nickname editor; timezone editing is enabled with the live preferences adapter',()=>{
 const live=markup({live:true,activeTab:'profile'}),design=markup({activeTab:'profile'});
 assert.match(live,/Real account/);assert.match(live,/Europe\/Moscow/);assert.match(live,/<select[^>]*disabled=""/);
 assert.match(live,/mroya-profile-nickname/);
 const ready=markup({live:true,activeTab:'profile',timezoneSettings:{timezone:'Europe/Moscow',draft:'Europe/Moscow',status:'saved',error:null,apiReady:true,onChange:noop,onRetry:noop}});
 assert.match(ready,/<select[^>]*id="mroya-timezone-select"(?![^>]*disabled)/);
 assert.match(ready,/Saved/);
 const editor=html=>html.slice(html.indexOf('<label htmlFor="mroya-profile-nickname"')>=0?html.indexOf('<label htmlFor="mroya-profile-nickname"'):html.indexOf('<label for="mroya-profile-nickname"'),html.indexOf('How Mroya addresses you'));
 assert.equal(editor(live),editor(design));
 assert.doesNotMatch(live,/maxlength=/);
 assert.match(design,/mroya-profile-nickname/);assert.doesNotMatch(design,/<select[^>]*disabled=""/);
});
test('save failures render unsaved/error/retry, not Coming soon; pending is explicit',()=>{
 const html=markup({live:true,activeTab:'appearance',preferenceSave:{status:'unsaved',error:'CSRF expired',onRetry:noop}});
 for(const value of ['These changes are not saved','CSRF expired','Retry saving','System theme','Light theme','Dark theme'])assert.ok(html.includes(value),value);
 assert.doesNotMatch(html,/Coming soon|>Saved</);
 assert.match(markup({live:true,activeTab:'appearance',preferenceSave:{status:'saving',error:null,onRetry:noop}}),/Saving account settings/);
});
test('offline Design settings need no network and preserve all tabs',()=>{
 const fetch=globalThis.fetch;globalThis.fetch=()=>assert.fail('Design must not fetch');
 try{for(const activeTab of ['connections','plan','appearance','profile','settings'])assert.ok(markup({activeTab}).length>100);}finally{globalThis.fetch=fetch;}
});

test('all five Design tabs preserve latest Studio Settings markup exactly',async()=>{
 fs.mkdirSync('.review-baseline/settings-main',{recursive:true});
 const archive=execFileSync('git',['archive','67774cf71abff44c2de651d7ca3b0ebd0745c6d2','src'],{maxBuffer:32*1024*1024});
 execFileSync('tar',['-xf','-','-C','.review-baseline/settings-main'],{input:archive});
 const {ConnectionsSettingsView:Studio}=await vite.ssrLoadModule('/.review-baseline/settings-main/src/components/ConnectionsSettingsView.tsx');
 for(const activeTab of ['connections','plan','appearance','profile','settings']){
  const props={...settings,activeTab};
  // HTML maxlength counts UTF-16 units; remove only that old attribute for Unicode validation.
  assert.equal(markup(props),renderToStaticMarkup(React.createElement(Studio,props)).replace(' maxLength="80"','').replace(' maxlength="80"',''),activeTab);
 }
});

const initialUser={id:7,username:'fallback',first_name:'Jane',last_name:'Doe',email:'real@example.test',timezone:'UTC',nickname:'Original',preferences:{theme:'system'}};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
// Exercise real component handlers/effects with deterministic hook slots; no new test framework.
function editorHarness(getProps){
 const slots=[],deps=[];let index=0,effects=[],tree;
 function render(){
  index=0;effects=[];
  const original={useState:React.useState,useRef:React.useRef,useEffect:React.useEffect,useMemo:React.useMemo};
  React.useState=initial=>{const i=index++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],next=>{slots[i]=typeof next==='function'?next(slots[i]):next;}];};
  React.useRef=initial=>{const i=index++;return slots[i]??(slots[i]={current:initial});};
  React.useEffect=(fn,next)=>{const i=index++;if(!deps[i]||next.some((v,j)=>!Object.is(v,deps[i][j]))){deps[i]=next;effects.push(fn);}};
  React.useMemo=fn=>{index++;return fn();};
  try{tree=ConnectionsSettingsView({...settings,activeTab:'profile',...getProps()});}
  finally{Object.assign(React,original);}
  effects.forEach(fn=>fn());
  return tree;
 }
 function find(predicate,node){
  if(arguments.length===1)node=tree;
  if(Array.isArray(node)){for(const child of node){const found=find(predicate,child);if(found)return found;}}
  else if(React.isValidElement(node)){if(predicate(node))return node;return node.props.children===undefined ? undefined : find(predicate,node.props.children);}
 }
 const input=()=>find(e=>e.type==='input'&&e.props.id==='mroya-profile-nickname');
 return {render,input,edit:value=>{input().props.onChange({target:{value}});render();},click:label=>{find(e=>e.type==='button'&&e.props.children===label).props.onClick();render();},
 html:()=>renderToStaticMarkup(tree)};
}
function liveEditor(savePreferences,overrides={}){
 let server=initialUser;
 const source={kind:'live',savePreferences:async patch=>{const result=await savePreferences(patch,server);server=result;return result;},session:async()=>({status:'authenticated',user:server}),...overrides};
 const store=new UserPreferenceStore(source,7,initialUser,()=>assert.fail('Unexpected expiry'));
 const ui=editorHarness(()=>{const view=store.snapshot();return {live:true,account:accountPresentation({...initialUser,nickname:view.nickname}),theme:view.theme,onSelectTheme:store.setTheme,onSaveNickname:store.setNickname,onClearNickname:()=>store.setNickname(''),preferenceSave:{status:view.status,error:view.error,onRetry:store.retry}};});
 ui.render();return {ui,store};
}
const updated=(user,patch)=>({...user,nickname:patch.nickname??user.nickname,preferences:{theme:patch.theme??user.preferences.theme}});
test('nickname Save/Clear wait for backend confirmation and preserve fallback identity',async()=>{
 const writes=[];let finish;
 const {ui,store}=liveEditor((patch,user)=>{writes.push(patch);return new Promise(resolve=>{finish=()=>resolve(updated(user,patch));});});
 ui.edit(' New name ');ui.click('Save');
 assert.deepEqual(writes,[{nickname:'New name'}]);assert.match(ui.html(),/Saving/);assert.doesNotMatch(ui.html(),/>Saved</);
 finish();await tick();ui.render();assert.match(ui.html(),/>Saved</);
 ui.click('Clear');assert.deepEqual(writes[1],{nickname:''});assert.equal(ui.input().props.value,'');assert.doesNotMatch(ui.html(),/>Saved</);
 finish();await tick();ui.render();assert.equal(accountPresentation({...initialUser,nickname:store.snapshot().nickname}).displayName,'Jane Doe');
 assert.match(ui.html(),/>Saved</);store.dispose();
});
test('nickname failure shows unsaved/retry and no false Saved',async()=>{
 let calls=0;const {ui,store}=liveEditor(async(patch,user)=>{calls++;if(calls===1)throw new ApiError(400,'invalid_preferences','Rejected nickname');return updated(user,patch);});
 ui.edit('Name');ui.click('Save');await tick();ui.render();
 assert.match(ui.html(),/Not saved|not saved/);assert.match(ui.html(),/Rejected nickname/);assert.match(ui.html(),/Retry saving/);assert.doesNotMatch(ui.html(),/>Saved</);
 ui.click('Retry saving');await tick();ui.render();assert.equal(calls,2);assert.match(ui.html(),/>Saved</);store.dispose();
});
test('late nickname response cannot overwrite a newer unsaved draft or quick theme choice',async()=>{
 const writes=[];let finish;
 const {ui,store}=liveEditor((patch,user)=>{writes.push(patch);return new Promise(resolve=>{finish=()=>resolve(updated(user,patch));});});
 ui.edit('Submitted');ui.click('Save');
 ui.edit('New draft');store.setTheme('dark');store.setTheme('light');ui.render();
 assert.equal(writes.length,1);finish();await tick();ui.render();ui.render();
 assert.equal(ui.input().props.value,'New draft');assert.deepEqual(writes[1],{theme:'light'});
 assert.doesNotMatch(ui.html(),/>Saved</);finish();await tick();ui.render();assert.equal(store.snapshot().theme,'light');
 assert.equal(ui.input().props.value,'New draft');store.dispose();
});
test('editor accepts 80 Unicode symbols but rejects 81 through existing preference validation',async()=>{
 const writes=[];const {ui,store}=liveEditor(async(patch,user)=>{writes.push(patch);return updated(user,patch);});
 ui.edit('😀'.repeat(80));ui.click('Save');await tick();ui.render();assert.equal(writes.length,1);assert.equal(writes[0].nickname.length,160);
 ui.edit('😀'.repeat(81));ui.click('Save');await tick();ui.render();assert.equal(writes.length,1);
 assert.match(ui.html(),/at most 80 characters/);assert.doesNotMatch(ui.html(),/>Saved</);assert.equal(ui.input().props.value,'😀'.repeat(81));store.dispose();
});
test('Design nickname Save/Clear remains local without a backend transport',()=>{
 const fetch=globalThis.fetch;globalThis.fetch=()=>assert.fail('Design editor must not fetch');
 const ui=editorHarness(()=>({live:false}));
 try{ui.render();ui.edit('Demo nickname');ui.click('Save');assert.match(ui.html(),/>Saved</);
 ui.edit('Another draft');assert.doesNotMatch(ui.html(),/>Saved</);ui.click('Clear');assert.equal(ui.input().props.value,'');assert.match(ui.html(),/>Cleared</);}
 finally{globalThis.fetch=fetch;}
});
test('Production editor routes through existing nickname preference actions',()=>{
 const source=fs.readFileSync('src/providers/LiveExperience.tsx','utf8');
 assert.match(source,/onSaveNickname:preferences.saveNickname/);
 assert.match(source,/onClearNickname:\(\)=>preferences.saveNickname\(''\)/);
});
