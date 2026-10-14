import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import fs from 'node:fs';
const vite=await createServer({mode:'design',server:{middlewareMode:true},appType:'custom'});
after(()=>vite.close());
const {WorkspaceView}=await vite.ssrLoadModule('/src/pages/WorkspaceView.tsx');
const {LiveExperience}=await vite.ssrLoadModule('/src/providers/LiveExperience.tsx');
const {useDemoWorkspace}=await vite.ssrLoadModule('/src/demo/useDemoWorkspace.ts');
const {memoryPresentation,graphPresentation}=await vite.ssrLoadModule('/src/hooks/liveAdapters.ts');
const components={};
for(const name of ['Sidebar','ChatWorkspace','MemoryContextPanel','CalendarView','RemindersView','MemoryView','MemoryMapView','ConnectionsSettingsView','ReminderEditorModal'])components[name]=(await vite.ssrLoadModule('/src/components/'+name+'.tsx'))[name];
const noop=()=>{};
let empty;
function Seed(){empty=useDemoWorkspace('empty');return null;}
renderToStaticMarkup(React.createElement(Seed));
const account={displayName:'Test account',initials:'TA',email:'test@example.test',description:'',timezone:'UTC',spaceDescription:'Personal space',nickname:''};
const base={...empty,account,composerSamples:undefined,calendarSamples:undefined};
const runtime={pending:false,loading:false,busy:false,error:null,onRetry:noop,chatAvailable:true,memoryAvailable:true,calendarAvailable:false,remindersAvailable:false,memoriesTotal:0,hasOlder:false,onOlder:noop,hasMoreMemories:false,onMoreMemories:noop,truncated:false,notice:null,onCloseNotice:noop,onUnavailable:noop,onLogout:noop,preferenceSave:{status:'saved',error:null,onRetry:noop},onSaveNickname:noop,onClearNickname:noop};
function elements(node,result=[]){
 if(Array.isArray(node))node.forEach(child=>elements(child,result));
 else if(React.isValidElement(node)){result.push(node);elements(node.props.children,result);}
 return result;
}
test('every section uses identical page component composition for equivalent empty inputs',()=>{
 for(const [section,page] of Object.entries({chat:'ChatWorkspace',calendar:'CalendarView',reminders:'RemindersView',memory:'MemoryView','memory-map':'MemoryMapView',connections:'ConnectionsSettingsView'})){
  const design=elements(WorkspaceView({model:{...base,activeSection:section}}));
  const live=elements(WorkspaceView({model:{...base,activeSection:section,runtime}}));
  const types=nodes=>nodes.filter(e=>typeof e.type==='function').map(e=>e.type);
  assert.deepEqual(types(design),types(live),section);
  assert.ok(types(live).includes(components[page]),section);
  assert.ok(types(live).includes(components.Sidebar));
  assert.ok(types(live).includes(components.ReminderEditorModal));
 }
});
test('production entry has only shared WorkspaceView; no alternate page tree',()=>{
 assert.ok(!fs.existsSync('src/pages/LiveWorkspace.tsx'));
 const provider=fs.readFileSync('src/providers/LiveExperience.tsx','utf8');
 assert.match(provider,/return <WorkspaceView model={model}\/>/);
 assert.doesNotMatch(provider,/from ['"][^'"]*\/components\//);
 assert.doesNotMatch(provider,/\/demo\/|INITIAL_/);
});
test('live unavailable pages stay visible with disabled creation and no demo identity/events',()=>{
 for(const section of ['calendar','reminders']){
  const html=renderToStaticMarkup(React.createElement(WorkspaceView,{model:{...base,activeSection:section,runtime}}));
  assert.match(html,/Not available yet/);assert.match(html,/disabled=""/);
  if(section==='reminders')assert.ok((html.match(/disabled=""/g)||[]).length>=4,'Creation and sync simulations must be disabled');
  assert.doesNotMatch(html,/alex@|Sarah Chen|Harbor Labs|protected for deep work|You are all caught up/);
 }
 const tree=elements(WorkspaceView({model:{...base,activeSection:'memory',runtime}}));
 assert.equal(tree.find(e=>e.type===components.MemoryView).props.readOnly,true);
 assert.equal(elements(WorkspaceView({model:{...base,activeSection:'chat',runtime:{...runtime,pending:true}}})).find(e=>e.type===components.ChatWorkspace).props.pending,true);
});
test('network error/loading never becomes Coming soon; retry retains loaded server records',()=>{
 const conversation={id:'server',title:'Server history',group:'Today',updatedAt:'',relatedMemoryIds:[],messages:[{id:'a',sender:'assistant',content:'**Server answer**',timestamp:'12:00',status:'completed'}]};
 for(const patch of [{loading:true},{error:'Server unavailable',chatAvailable:false}]){
  const html=renderToStaticMarkup(React.createElement(WorkspaceView,{model:{...base,activeConversation:conversation,conversations:[conversation],activeSection:'chat',runtime:{...runtime,...patch}}}));
  assert.match(html,/<strong>Server answer<\/strong>/);assert.doesNotMatch(html,/Not available yet/);
  if(patch.error){assert.match(html,/Server unavailable/);assert.match(html,/Check server status/);}
 }
});
test('canonical memory/map/context and pagination use the same shared components',()=>{
 const map={nodes:[{id:'memory:real',type:'memory',label:'Canonical value',statement_id:'real',learned_at:'2026-10-14'}],edges:[]};
 const memory=memoryPresentation({uuid:'real',subject:'Subject',predicate:'prefers',literal_value:'Canonical value',learned_at:'2026-10-14',state:'active'},map);
 const graph=graphPresentation(map);
 const model={...base,memories:[memory],focusedMemory:memory,selectedMemoryViewId:'real',nodes:graph.nodes,edges:graph.edges,isContextPanelOpen:true,runtime:{...runtime,memoriesTotal:200,hasMoreMemories:true,truncated:true}};
 const memoryHTML=renderToStaticMarkup(React.createElement(WorkspaceView,{model:{...model,activeSection:'memory'}}));assert.match(memoryHTML,/Canonical value/);assert.match(memoryHTML,/Load more memories/);
 const chatHTML=renderToStaticMarkup(React.createElement(WorkspaceView,{model:{...model,activeSection:'chat'}}));assert.match(chatHTML,/Contextual memory details/);assert.match(chatHTML,/Canonical value/);
 const graphHTML=renderToStaticMarkup(React.createElement(WorkspaceView,{model:{...model,activeSection:'memory-map'}}));assert.match(graphHTML,/Canonical value/);assert.match(graphHTML,/limited by the server/);
});
test('shared scaffolding retains mobile minimum widths and all sidebar sections',()=>{
 for(const mobileMenuOpen of [true,false])for(const isSidebarCollapsed of [true,false]){
  const model={...base,mobileMenuOpen,isSidebarCollapsed,runtime,activeSection:'connections'};
  const html=renderToStaticMarkup(React.createElement(WorkspaceView,{model}));
  assert.match(html,/h-dvh w-full/);assert.match(html,/flex flex-1 min-w-0 min-h-0/);
  for(const label of ['Chat','Calendar','Reminders','Memory','Memory Map','Connections'])assert.ok(html.includes(label),label);
 }
});
test('Design actions remain offline and both mode schemas use the same modal props',()=>{
 const fetch=globalThis.fetch;globalThis.fetch=()=>assert.fail('No transport in Design');
 try{for(const activeSection of ['chat','calendar','reminders','memory','memory-map','connections'])renderToStaticMarkup(React.createElement(WorkspaceView,{model:{...base,activeSection}}));}
 finally{globalThis.fetch=fetch;}
 const tree=elements(WorkspaceView({model:{...base,reminderModalOpen:true}}));
 assert.equal(tree.find(e=>e.type===components.ReminderEditorModal).props.isOpen,true);
});
test('actual live entry boots without fictional records and retains server loading state',()=>{
 const user={id:7,username:'test',first_name:'',last_name:'',email:'test@example.test',timezone:'UTC',nickname:'',preferences:{theme:'system'}};
 const source={kind:'live',capabilities:()=>assert.fail('SSR must not fetch'),session:()=>assert.fail('SSR must not fetch')};
 const html=renderToStaticMarkup(React.createElement(LiveExperience,{source,user,onExpired:noop,onLogout:noop}));
 assert.match(html,/Loading your workspace/);assert.doesNotMatch(html,/Sarah Chen|alex@|Harbor Labs|Not available yet/);
 assert.match(html,/Primary Sidebar Navigation/);
});

test('Design and live feedback use the same status/retry markup',()=>{
 const feedback={loading:false,busy:false,error:'Equivalent error',onRetry:noop};
 const status=model=>elements(WorkspaceView({model})).find(e=>e.props.role==='alert');
 const design=status({...base,feedback}),live=status({...base,runtime:{...runtime,...feedback}});
 assert.equal(renderToStaticMarkup(design),renderToStaticMarkup(live));
 assert.match(renderToStaticMarkup(design),/Check server status/);
});
