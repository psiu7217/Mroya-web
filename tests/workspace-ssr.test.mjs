import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
const vite=await createServer({mode:'design',server:{middlewareMode:true},appType:'custom'});
after(async()=>{await vite.close();});
{
 const {useDemoWorkspace}=await vite.ssrLoadModule('/src/demo/useDemoWorkspace.ts');
 const {WorkspaceView}=await vite.ssrLoadModule('/src/pages/WorkspaceView.tsx');
 function render(seed='filled',section){function App(){const model=useDemoWorkspace(seed);return React.createElement(WorkspaceView,{model:section?{...model,activeSection:section}:model});}return renderToStaticMarkup(React.createElement(App));}
 test('extracted workspace preserves original initial markup exactly',async()=>{
  // Materialize read-only upstream source into a disposable ignored directory, never modify production.
  fs.mkdirSync('.review-baseline',{recursive:true});
  const archive=execFileSync('git',['archive','1fe0f3b','src']);execFileSync('tar',['-xf','-','-C','.review-baseline'],{input:archive});
  const {WorkspaceView:OriginalView}=await vite.ssrLoadModule('/.review-baseline/src/pages/WorkspaceView.tsx');
  const {useDemoWorkspace:originalModel}=await vite.ssrLoadModule('/.review-baseline/src/demo/useDemoWorkspace.ts');
  function OriginalApp(){return React.createElement(OriginalView,{model:originalModel()});}
  // Unique SVG paint-server IDs fix invisible mobile logos; normalize only these generated identifiers.
  const stableIds=html=>html.replace(/mroya[^"()\s]*-(gold-grad|star-grad|ambient)/g,'mroya-$1');
  assert.equal(stableIds(render()),stableIds(renderToStaticMarkup(React.createElement(OriginalApp))));
  const ids=[...render().matchAll(/id="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);
 });
 test('unified workspace preserves current Studio initial UI inside shared scaffolding',async()=>{
  fs.mkdirSync('.review-baseline/current-main',{recursive:true});
  const archive=execFileSync('git',['archive','fce3d7e','src'],{maxBuffer:32*1024*1024});
  execFileSync('tar',['-xf','-','-C','.review-baseline/current-main'],{input:archive});
  const {WorkspaceView:BaseView}=await vite.ssrLoadModule('/.review-baseline/current-main/src/pages/WorkspaceView.tsx');
  const {useDemoWorkspace:baseModel}=await vite.ssrLoadModule('/.review-baseline/current-main/src/demo/useDemoWorkspace.ts');
  function BaseApp({seed,section}){const model=baseModel(seed);return React.createElement(BaseView,{model:{...model,activeSection:section}});}
  for(const seed of ['filled','empty'])for(const section of ['chat','calendar','reminders','memory','memory-map','connections']){
  let expected=renderToStaticMarkup(React.createElement(BaseApp,{seed,section}))
   .replace('flex h-screen w-screen overflow-hidden','flex h-dvh w-full overflow-hidden')
   .replace('<main class="flex-1 flex min-w-0 h-full relative overflow-hidden">','<main class="flex-1 flex flex-col min-w-0 h-full relative overflow-hidden"><div class="flex flex-1 min-w-0 min-h-0">')
   .replace('</main>','</div></main>');
  // Only the reviewed Telegram capability copy changes; all markup/styles stay compared.
  if(section==='connections')for(const [before,after] of [["Reminders &amp; Quick Alerts","Personal text chat"],["Receive personal reminders and calendar alerts in Telegram. Forward voice notes, quick client updates, or travel confirmations to Mroya on the go.","Chat privately with Mroya in Telegram using your existing account."],["Delivers personal reminders right on time via @MroyaBot","Personal text chat with Mroya"],["Unified schedule for standalone reminders and Google Calendar events","Shared conversation history between Web and Telegram"],["Forward quick voice or text notes after client meetings to store in memory","Shared personal memory"],["Receive quiet morning briefings of the day’s commitments","Telegram replies only to messages sent in Telegram"]])expected=expected.replace(before,after);
  assert.equal(render(seed,section),expected,seed+':'+section);
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
  assert.ok(render('empty','memory-map').includes('No memories to map yet.'));
 });
}
