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
const {LiveWorkspace}=await vite.ssrLoadModule('/src/pages/LiveWorkspace.tsx');
const {WorkspaceView}=await vite.ssrLoadModule('/src/pages/WorkspaceView.tsx');
const {useDemoWorkspace}=await vite.ssrLoadModule('/src/demo/useDemoWorkspace.ts');
const noop=()=>{};
const account={displayName:'Real account',initials:'RA',email:'real@example.test',description:'',timezone:'Europe/Moscow',spaceDescription:'Personal space',nickname:'Real account'};
const settings={account,connections:[],plan:'free',onSelectPlan:noop,theme:'system',onSelectTheme:noop,activeTab:'connections',onChangeTab:noop,isSidebarCollapsed:false,onExpandSidebar:noop,onOpenMobileMenu:noop,onToggleConnection:noop};
const sidebar={account,activeSection:'connections',onSelectSection:noop,conversations:[],activeConversationId:null,onSelectConversation:noop,onNewChat:noop,plan:'free',onTogglePlan:noop,onOpenPlanModal:noop,theme:'light',onToggleTheme:noop,isCollapsed:false,onToggleCollapse:noop,mobileOpen:false,onCloseMobile:noop,memoriesCount:0,upcomingEventsCount:0,pendingRemindersCount:0,onOpenSettingsTab:noop};
const markup=props=>renderToStaticMarkup(React.createElement(ConnectionsSettingsView,{...settings,...props}));
const labels=['Connected accounts','My plan','Appearance','Profile','Memory preferences'];
test('both workspace pages render the same five settings tabs in order',()=>{
 function Design(){const model=useDemoWorkspace();return React.createElement(WorkspaceView,{model:{...model,activeSection:'connections'}});}
 const design=renderToStaticMarkup(React.createElement(Design));
 const live=renderToStaticMarkup(React.createElement(LiveWorkspace,{sidebar:{...sidebar,live:true},chat:{},memory:{},map:{},section:'connections',settings:{...settings,live:true},notice:null,error:null,loading:false,busy:false}));
 for(const html of [design,live]){let previous=-1;for(const label of labels){const index=html.indexOf('>'+label+'</button>');assert.ok(index>previous,label);previous=index;}assert.match(html,/Connections &amp; Account/);}
 for(const path of ['src/pages/WorkspaceView.tsx','src/pages/LiveWorkspace.tsx'])assert.match(fs.readFileSync(path,'utf8'),/<ConnectionsSettingsView\b/);
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
 assert.equal((provider.match(/onOpenSettingsTab:openSettings/g)||[]).length,2);
 assert.match(provider,/select\('connections'\);setSettingsTab\(tab\)/);
});
test('live shows unavailable services/plan/memory controls without fake successes or demo accounts',()=>{
 const connections=markup({live:true});
 assert.equal((connections.match(/>Coming soon<\/button>/g)||[]).length,3);
 assert.doesNotMatch(connections,/Connected \(|Disconnect preview|alex@|lindqvist|Saved<|Enabled</);
 assert.equal((connections.match(/disabled=""/g)||[]).length,3);
 const plan=markup({live:true,activeTab:'plan'});assert.equal((plan.match(/>Coming soon<\/button>/g)||[]).length,2);assert.doesNotMatch(plan,/Current active preview/);
 const memory=markup({live:true,activeTab:'settings'});assert.match(memory,/Coming soon/);assert.doesNotMatch(memory,/>Enabled</);
});
test('live profile has server identity/read-only timezone and no editor; Studio profile remains unchanged',()=>{
 const live=markup({live:true,activeTab:'profile'}),design=markup({activeTab:'profile'});
 assert.match(live,/Real account/);assert.match(live,/Europe\/Moscow/);assert.match(live,/<select[^>]*disabled=""/);
 assert.doesNotMatch(live,/mroya-profile-nickname|Enter your nickname/);
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
  assert.equal(markup(props),renderToStaticMarkup(React.createElement(Studio,props)),activeTab);
 }
});
