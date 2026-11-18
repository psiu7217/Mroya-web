import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'vite';

test('production static chunk graph excludes Pixi/d3 and the map renderer (PR50 regression)',async()=>{
 const result=await build({mode:'production',logLevel:'silent',build:{write:false}});
 const chunks=result.output.filter(item=>item.type==='chunk');
 const byName=new Map(chunks.map(chunk=>[chunk.fileName,chunk]));
 const entry=chunks.find(chunk=>chunk.isEntry);assert.ok(entry);
 const initial=new Set();
 function visit(chunk){if(!chunk||initial.has(chunk))return;initial.add(chunk);for(const name of chunk.imports)visit(byName.get(name));}
 visit(entry);
 const initialModules=[...initial].flatMap(chunk=>chunk.moduleIds.map(id=>id.replaceAll('\\','/')));
 assert.ok(!initialModules.some(id=>/\/node_modules\/(pixi\.js|d3-force)\//.test(id)),'GPU and layout libraries must not be in initial static dependencies');
 const renderer=chunks.find(chunk=>chunk.moduleIds.some(id=>id.replaceAll('\\','/').endsWith('/memory-map/renderer.js')));
 assert.ok(renderer);assert.ok(!initial.has(renderer));
 assert.ok([...initial].some(chunk=>chunk.dynamicImports.includes(renderer.fileName)),'map mounts through an explicit dynamic import');
});
