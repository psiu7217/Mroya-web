import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';

const key='__memoryTransferHooks';
const vite=await createServer({mode:'design',server:{middlewareMode:true},appType:'custom',plugins:[{
  name:'memory-transfer-hooks',enforce:'pre',
  transform(code,id){if(id.replaceAll('\\','/').endsWith('/useMemoryTransfer.ts'))return code.replace("from 'react';","from 'virtual:memory-transfer-hooks';");},
  resolveId(id){if(id==='virtual:memory-transfer-hooks')return '\0'+id;},
  load(id){if(id==='\0virtual:memory-transfer-hooks')return ['useState','useRef','useEffect','useCallback'].map(name=>`export const ${name}=(...args)=>globalThis.${key}.${name}(...args);`).join('\n');},
}]});
const {useMemoryTransfer}=await vite.ssrLoadModule('/src/hooks/useMemoryTransfer.ts');
const {MemoryTransferSettings}=await vite.ssrLoadModule('/src/components/MemoryTransferSettings.tsx');
const {ApiError}=await vite.ssrLoadModule('/src/api/errors.ts');
after(async()=>{delete globalThis[key];await vite.close();});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const gate=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};

function mount(source){
  const slots=[];let cursor=0,effects=[],dirty=false,value;
  const hooks={
    useState(initial){const i=cursor++;slots[i]??={value:typeof initial==='function'?initial():initial};return [slots[i].value,next=>{const v=typeof next==='function'?next(slots[i].value):next;if(!Object.is(v,slots[i].value)){slots[i].value=v;dirty=true;}}];},
    useRef(initial){const i=cursor++;return slots[i]??(slots[i]={current:initial});},
    useCallback(callback){cursor++;return callback;},
    useEffect(effect,deps){const i=cursor++,previous=slots[i];if(!previous||deps.some((v,j)=>!Object.is(v,previous.deps[j]))){slots[i]={deps};effects.push(()=>{previous?.cleanup?.();slots[i].cleanup=effect();});}},
  };
  const changed=()=>{};
  function flush(){globalThis[key]=hooks;let passes=0;do{assert.ok(++passes<10);cursor=0;dirty=false;value=useMemoryTransfer(source,changed,true);const queue=effects;effects=[];queue.forEach(f=>f());}while(dirty);}
  flush();
  return {flush,get value(){return value;},html(){return renderToStaticMarkup(React.createElement(MemoryTransferSettings,{transfer:value}));},unmount(){slots.forEach(s=>s?.cleanup?.());}};
}

test('rejected file keeps server availability and restore/retry controls, without an unavailable notice',async()=>{
  const status=gate();
  const view=mount({memoryTransferStatus:()=>status.promise,validateMemory:async()=>{throw new ApiError(409,'memory_object_referenced','private');}});
  assert.equal(view.value.importUnavailable,false);
  assert.doesNotMatch(view.html(),/Memory import is not available yet/);
  status.resolve({importAvailable:true,searchPending:false,backupId:'11111111-1111-4111-8111-111111111111'});
  await tick();view.flush();
  assert.equal(await view.value.validateFile(new File(['{}'],'memory.json')),false);view.flush();
  assert.equal(view.value.importAvailable,true);
  assert.equal(view.value.canImportFile,false);
  assert.equal(view.value.importUnavailable,false);
  assert.equal(view.value.retryAvailable,true);
  assert.equal(view.value.canRestore,true);
  assert.match(view.html(),/omitted object is linked to a note or calendar event/);
  assert.doesNotMatch(view.html(),/Memory import is not available yet/);
  view.unmount();
});

test('successful validation permits one import and pending recovery keeps the feature available',async()=>{
  const pending=gate(),sent=[];
  const view=mount({memoryTransferStatus:async()=>({importAvailable:true,searchPending:false,backupId:null}),
    validateMemory:async()=>({importAvailable:true}),importMemory:text=>{sent.push(text);return pending.promise;}});
  await tick();view.flush();
  assert.equal(await view.value.validateFile(new File(['{"object_merges":[]}'],'memory.json')),true);view.flush();
  assert.equal(view.value.canImportFile,true);
  view.value.importValidatedFile();view.value.importValidatedFile();view.flush();
  assert.equal(sent.length,1);assert.equal(view.value.canImportFile,false);
  assert.equal(view.value.importUnavailable,false);
  pending.resolve({searchReady:false,backupId:'11111111-1111-4111-8111-111111111111'});
  await tick();view.flush();
  assert.equal(view.value.searchPending,true);assert.equal(view.value.canRestore,true);
  assert.equal(view.value.importAvailable,true);view.unmount();
});

test('late validation of an older file cannot re-enable import after the selected file failed',async()=>{
  const earlier=gate();let calls=0;
  const view=mount({memoryTransferStatus:async()=>({importAvailable:true,searchPending:false,backupId:null}),
    validateMemory:async text=>{if(text==='older')return earlier.promise;throw new ApiError(400,'invalid_memory_document','private');},
    importMemory:async()=>{calls++;}});
  await tick();view.flush();
  const first=view.value.validateFile(new File(['older'],'older.json'));
  await tick();
  assert.equal(await view.value.validateFile(new File(['invalid'],'selected.json')),false);view.flush();
  earlier.resolve({importAvailable:true});assert.equal(await first,false);view.flush();
  assert.equal(view.value.canImportFile,false);view.value.importValidatedFile();assert.equal(calls,0);
  view.unmount();
});

test('an explicit server feature restriction still displays the unavailable notice',async()=>{
  const view=mount({memoryTransferStatus:async()=>({importAvailable:false,searchPending:false,backupId:null})});
  await tick();view.flush();assert.equal(view.value.importUnavailable,true);
  assert.match(view.html(),/Memory import is not available yet/);view.unmount();
});
