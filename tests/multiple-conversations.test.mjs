import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import fs from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const hookKey='__multiChatHooks';
const vite = await createServer({ mode: 'design', server: { middlewareMode: true }, appType: 'custom',plugins:[{
 name:'multi-chat-local-hooks',enforce:'pre',
 transform(code,id){if(/(?:Sidebar\.tsx|useDemoWorkspace\.ts|useDemoDiagnostics\.ts)$/.test(id))return code.replace(/from 'react';/g,"from 'virtual:multi-chat-hooks';");},
 resolveId(id){if(id==='virtual:multi-chat-hooks')return '\0'+id;},
 load(id){if(id==='\0virtual:multi-chat-hooks')return `import React from 'react';export default React;
 ${['useState','useRef','useEffect'].map(name=>`export const ${name}=(...args)=>(globalThis.${hookKey}?.${name}??React.${name})(...args);`).join('\n')}`;},
}] });
const { Sidebar } = await vite.ssrLoadModule('/src/components/Sidebar.tsx');
const { ChatWorkspace } = await vite.ssrLoadModule('/src/components/ChatWorkspace.tsx');
const { useDemoWorkspace } = await vite.ssrLoadModule('/src/demo/useDemoWorkspace.ts');

const noop = () => {};
const account = {
  displayName: 'Alex Lindqvist',
  initials: 'AL',
  email: 'alex@example.com',
  description: 'Design Director',
  timezone: 'Europe/Stockholm',
  spaceDescription: 'Personal space',
  nickname: '',
};

test('Sidebar renders multiple conversations with subtle three-dot action menus', () => {
  const conversations = [
    { id: 'c1', title: 'Website redesign agreement with Sarah', group: 'Today', updatedAt: 'Just now', relatedMemoryIds: [], messages: [] },
    { id: 'c2', title: 'Q4 retainer scope for Nordic Studio', group: 'Previous 7 Days', updatedAt: 'Oct 9', relatedMemoryIds: [], messages: [] },
  ];

  const html = renderToStaticMarkup(
    React.createElement(Sidebar, {
      account,
      activeSection: 'chat',
      onSelectSection: noop,
      conversations,
      activeConversationId: 'c1',
      onSelectConversation: noop,
      onNewChat: noop,
      plan: 'free',
      onTogglePlan: noop,
      onOpenPlanModal: noop,
      theme: 'light',
      onToggleTheme: noop,
      isCollapsed: false,
      onToggleCollapse: noop,
      mobileOpen: false,
      onCloseMobile: noop,
      memoriesCount: 5,
      upcomingEventsCount: 2,
      pendingRemindersCount: 1,
      onOpenSettingsTab: noop,
    })
  );

  assert.match(html, /Website redesign agreement with Sarah/);
  assert.match(html, /Q4 retainer scope for Nordic Studio/);
  assert.match(html, /aria-label="Options for Website redesign agreement with Sarah"/);
  assert.match(html, /aria-label="Options for Q4 retainer scope for Nordic Studio"/);
  assert.match(html, /New chat/);
});

test('useDemoWorkspace supports creating, selecting, renaming and permanently deleting conversations', () => {
  let model;
  function Harness() {
    model = useDemoWorkspace('filled');
    return null;
  }
  renderToStaticMarkup(React.createElement(Harness));

  assert.ok(model.conversations.length >= 2, 'Initial conversations should have multiple items');
  assert.equal(typeof model.onSidebarRenameConversation, 'function');
  assert.equal(typeof model.onSidebarDeleteConversation, 'function');
  assert.equal(typeof model.onSidebarSelectConversation, 'function');
  assert.equal(typeof model.handleNewChat, 'function');
});

test('Sidebar includes exact delete confirmation dialog text and destructive button', () => {
  const sidebarSource = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');
  assert.match(
    sidebarSource,
    /Permanently delete this chat and all its messages\? This cannot be undone\. Your saved memories will not be affected\./
  );
  assert.match(sidebarSource, /saving \? 'Deleting…' : 'Delete'/);
  assert.match(sidebarSource, />\s*Cancel\s*<\/button>/);
});

test('ChatWorkspace renders empty state when active conversation is null or has no messages', () => {
  const html = renderToStaticMarkup(
    React.createElement(ChatWorkspace, {
      account,
      conversation: null,
      onSendMessage: noop,
      onCitationClick: noop,
      onActionClick: noop,
      addedActionIds: [],
      isSidebarCollapsed: false,
      onExpandSidebar: noop,
      onOpenMobileMenu: noop,
      isContextPanelOpen: false,
      onToggleContextPanel: noop,
      plan: 'free',
      onTogglePlan: noop,
      onOpenPlanModal: noop,
      theme: 'light',
      onToggleTheme: noop,
      onNewChat: noop,
      memoriesCount: 0,
    })
  );

  assert.match(html, /Good afternoon\. What(?:&#x27;|&apos;|')s on your mind\?/);
  assert.match(html, /What do you remember about me\?/);
});


function harness(render){
 const slots=[];let cursor=0,value;
 const hooks={
  useState(initial){const i=cursor++;slots[i]??={value:typeof initial==='function'?initial():initial};return [slots[i].value,next=>{slots[i].value=typeof next==='function'?next(slots[i].value):next;}];},
  useRef(initial){const i=cursor++;slots[i]??={current:initial};return slots[i];},useEffect(){cursor++;},
 };
 return {render(){cursor=0;globalThis[hookKey]=hooks;try{return value=render();}finally{delete globalThis[hookKey];}},get value(){return value;}};
}
function findAll(tree,predicate){if(!tree||typeof tree!=='object')return [];return [...(predicate(tree)?[tree]:[]),...[tree.props?.children].flat(Infinity).flatMap(child=>findAll(child,predicate))];}
const fakeEvent={preventDefault(){},stopPropagation(){}};
const text=tree=>typeof tree==='string'?tree:!tree||typeof tree!=='object'?'':[tree.props?.children].flat(Infinity).map(text).join('');
const button=(tree,label)=>findAll(tree,e=>e.type==='button'&&text(e)===label)[0];
test('Design creates empty chats, renames, switches and deletes last locally without HTTP',()=>{
 const original=globalThis.fetch;globalThis.fetch=()=>assert.fail('Design must not request HTTP');
 try{
  const view=harness(()=>useDemoWorkspace('empty'));view.render();assert.equal(view.value.activeConversation,null);
  view.value.handleNewChat();view.render();const first=view.value.activeConversationId;assert.ok(first);assert.deepEqual(view.value.activeConversation.messages,[]);
  view.value.onSidebarRenameConversation(first,'Local title');view.render();assert.equal(view.value.activeConversation.title,'Local title');
  view.value.handleNewChat();view.render();const second=view.value.activeConversationId;assert.notEqual(first,second);
  view.value.onSidebarSelectConversation(first);view.render();assert.equal(view.value.activeConversation.title,'Local title');
  view.value.onSidebarDeleteConversation(first);view.render();assert.equal(view.value.activeConversationId,second);
  view.value.onSidebarDeleteConversation(second);view.render();assert.equal(view.value.activeConversationId,null);assert.deepEqual(view.value.conversations,[]);
  view.value.handleSendMessage('First local message');view.render();
  assert.ok(view.value.activeConversationId);assert.equal(view.value.activeConversation.messages[0].content,'First local message');
 }finally{globalThis.fetch=original;}
});
test('Studio Rename/Delete keep Cancel, confirmed-only close, saving guards, and title-only search',async()=>{
 const calls=[];let resolve;const props={account,conversations:[{id:'c1',title:'Alpha',group:'Today',updatedAt:''}],activeConversationId:'c1',isCollapsed:false,mobileOpen:false,theme:'light',plan:'free',
  onRenameConversation:(...args)=>{calls.push(args);return new Promise(r=>{resolve=r;});},onDeleteConversation:(...args)=>{calls.push(args);return Promise.resolve(false);}};
 const view=harness(()=>Sidebar(props));view.render();
 const options=()=>findAll(view.value,e=>e.props?.['aria-label']==='Options for Alpha')[0];
 options().props.onClick(fakeEvent);view.render();button(view.value,'Rename').props.onClick(fakeEvent);view.render();
 let input=findAll(view.value,e=>e.props?.['aria-label']==='Conversation title')[0];assert.equal(input.props.value,'Alpha');
 input.props.onChange({target:{value:'Changed'}});view.render();input=findAll(view.value,e=>e.props?.['aria-label']==='Conversation title')[0];input.props.onKeyDown({key:'Escape',stopPropagation(){}});view.render();assert.equal(calls.length,0);
 options().props.onClick(fakeEvent);view.render();button(view.value,'Rename').props.onClick(fakeEvent);view.render();
 const saving=findAll(view.value,e=>e.type==='form')[0].props.onSubmit(fakeEvent);view.render();assert.equal(calls.length,1);assert.ok(button(view.value,'Saving…').props.disabled);
 resolve(false);await Promise.resolve();await Promise.resolve();view.render();assert.ok(findAll(view.value,e=>e.props?.['aria-label']==='Conversation title').length);
 const retry=findAll(view.value,e=>e.type==='form')[0].props.onSubmit(fakeEvent);resolve(true);await Promise.resolve();await Promise.resolve();view.render();assert.equal(findAll(view.value,e=>e.props?.['aria-label']==='Conversation title').length,0);
 options().props.onClick(fakeEvent);view.render();button(view.value,'Delete').props.onClick(fakeEvent);view.render();assert.ok(findAll(view.value,e=>e.props?.role==='dialog').length);
 const before=calls.length;button(view.value,'Cancel').props.onClick();view.render();assert.equal(calls.length,before);
 options().props.onClick(fakeEvent);view.render();button(view.value,'Delete').props.onClick(fakeEvent);view.render();await button(view.value,'Delete').props.onClick();view.render();assert.ok(findAll(view.value,e=>e.props?.role==='dialog').length,'failed DELETE keeps confirmation');
 button(view.value,'Cancel').props.onClick();view.render();findAll(view.value,e=>e.props?.['aria-label']==='Search conversations')[0].props.onChange({target:{value:'missing body content'}});view.render();assert.equal(findAll(view.value,e=>e.props?.['aria-label']==='Options for Alpha').length,0);
});
await vite.close();
