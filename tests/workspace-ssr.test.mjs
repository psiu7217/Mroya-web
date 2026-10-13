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
  const archive=execFileSync('git',['archive','d869b42de9c9315a26e3a578c57f37ce1432b5e4','src']);execFileSync('tar',['-xf','-','-C','.review-baseline'],{input:archive});
  const {default:OriginalApp}=await vite.ssrLoadModule('/.review-baseline/src/App.tsx');
  assert.equal(render(),renderToStaticMarkup(React.createElement(OriginalApp)));
 });
 test('all preserved sections render in filled and empty scenarios',()=>{
  for(const seed of ['filled','empty'])for(const section of ['chat','memory','memory-map','calendar','reminders','connections'])assert.ok(render(seed,section).length>100);
  assert.ok(render('empty','memory-map').includes('No memories to map yet.'));
 });
}
