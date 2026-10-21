import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
const vite=await createServer({mode:'design',server:{middlewareMode:true},appType:'custom'});
after(async()=>{await vite.close();});
{
 const {useDemoWorkspace}=await vite.ssrLoadModule('/src/demo/useDemoWorkspace.ts');
 const {WorkspaceView}=await vite.ssrLoadModule('/src/pages/WorkspaceView.tsx');
 function render(seed='filled',section){function App(){const model=useDemoWorkspace(seed);return React.createElement(WorkspaceView,{model:section?{...model,activeSection:section}:model});}return renderToStaticMarkup(React.createElement(App));}
 test('initial workspace renders the shared shell with unique DOM ids',()=>{
  const html=render();
  assert.equal((html.match(/aria-label="Primary Sidebar Navigation"/g)||[]).length,1);
  assert.equal((html.match(/<main\b/g)||[]).length,1);
  assert.match(html,/aria-label="Primary Sidebar Navigation"/);
  const ids=[...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);
 });
 test('every seed and section renders inside the shared shell',()=>{
  for(const seed of ['filled','empty'])for(const section of ['chat','calendar','reminders','memory','memory-map','connections']){
   const html=render(seed,section);
   assert.ok(html.length>100,seed+':'+section);
   assert.equal((html.match(/aria-label="Primary Sidebar Navigation"/g)||[]).length,1,seed+':'+section);
   assert.equal((html.match(/<main\b/g)||[]).length,1,seed+':'+section);
   assert.match(html,/aria-label="Primary Sidebar Navigation"/,seed+':'+section);
   assert.match(html,/aria-label="Main sections"/,seed+':'+section);
  }
 });

 test('welcome, invitation and Studio login render without a transport',async()=>{
  const {GuestWelcome}=await vite.ssrLoadModule('/src/components/GuestWelcome.tsx');
  const {LoginScreen}=await vite.ssrLoadModule('/src/components/LoginScreen.tsx');
  const typing=renderToStaticMarkup(React.createElement(GuestWelcome,{phase:'typing',onSignIn:()=>{}}));assert.equal((typing.match(/class="guest-dot"/g)||[]).length,3);assert.ok(typing.includes('Mroya is typing'));
  const ready=renderToStaticMarkup(React.createElement(GuestWelcome,{phase:'ready',onSignIn:()=>{}}));assert.ok(ready.includes('Get started'));
  const login=renderToStaticMarkup(React.createElement(LoginScreen,{pending:false,error:null,onSubmit:async()=>{}}));assert.match(login,/aria-label="Sign in with Google"/);assert.match(login,/Google sign-in — coming soon/);assert.match(login,/disabled=""/);
 });
 test('all preserved sections render in filled and empty scenarios',()=>{
  for(const seed of ['filled','empty'])for(const section of ['chat','memory','memory-map','calendar','reminders','connections'])assert.ok(render(seed,section).length>100);
  assert.ok(render('empty','memory-map').includes('class="map-state"'));
 });
}
