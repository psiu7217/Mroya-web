import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';

// Exercise the actual component's effects and handlers, without a DOM/WebGL dependency.
const key='__mroyaMapSelectionTest';
const vite=await createServer({mode:'design',server:{middlewareMode:true},appType:'custom',plugins:[{
 name:'map-selection-test-adapters',enforce:'pre',
 transform(code,id){if(id.replaceAll('\\','/').endsWith('/src/components/MemoryMapView.tsx'))return code
  .replace("from 'react';","from 'virtual:map-selection-hooks';")
  .replace("await import('./memory-map/renderer.js')",`await globalThis.${key}.loadModule()`);},
 resolveId(id){if(id.startsWith('virtual:map-selection-'))return '\0'+id;},
 load(id){
  if(id==='\0virtual:map-selection-hooks')return `import React from 'react';export default React;
   ${['useState','useRef','useMemo','useEffect'].map(name=>`export const ${name}=(...args)=>globalThis.${key}.${name}(...args);`).join('\n')}`;

 },
}]});
after(async()=>{delete globalThis[key];await vite.close();});
const {MemoryMapView}=await vite.ssrLoadModule('/src/components/MemoryMapView.tsx');
const {accountPresentation}=await vite.ssrLoadModule('/src/hooks/liveAdapters.ts');
const {MapInitializationError}=await vite.ssrLoadModule('/src/components/memory-map/initialization.js');
const node=id=>({id,label:id,type:'entity',kind:'person',category:'person',subtitle:'',summary:'',source:'',dateRecorded:'',connectionsCount:0});
const same=(a,b)=>a&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
function mount(initial,behavior={}){
 const slots=[],changes=[];let cursor=0,effects=[],dirty=false,tree,callbacks;
 let props={edges:[],nodes:[],selectedNodeId:null,isSidebarCollapsed:false,onOpenMemory(){},onAskAboutNode(){},onExpandSidebar(){},onOpenMobileMenu(){},...initial};
 props.onSelectNode=id=>{changes.push(id);props={...props,selectedNodeId:id};dirty=true;};
 const renderer={selected:null,selections:[],creations:0,graphs:0,presentations:[],destroyed:0,
  setGraph(){this.graphs++;callbacks.onSelect(null);},setOptions(){},
  setPresentation(value){this.presentations.push(value);},
  select(id){this.selected=id;this.selections.push(id);},setForce(){},destroy(){this.destroyed++;}};
 const harness={
  useState(initial){const i=cursor++;slots[i]??={value:typeof initial==='function'?initial():initial};return [slots[i].value,value=>{
   const next=typeof value==='function'?value(slots[i].value):value;if(!Object.is(next,slots[i].value)){slots[i].value=next;dirty=true;}
  }];},
  useRef(value){const i=cursor++;slots[i]??={current:value};return slots[i];},
  useMemo(factory,deps){const i=cursor++;if(!same(slots[i]?.deps,deps))slots[i]={deps,value:factory()};return slots[i].value;},
  useEffect(effect,deps){const i=cursor++;if(!same(slots[i]?.deps,deps)){const previous=slots[i];slots[i]={deps};effects.push(()=>{previous?.cleanup?.();slots[i].cleanup=effect();});}},
  async loadModule(){if(behavior.moduleGate)await behavior.moduleGate;if(behavior.moduleError)throw behavior.moduleError;return {createMemoryMapRenderer:async(_host,value,signal)=>{callbacks=value;renderer.creations++;behavior.signal=signal;if(behavior.initGate)await behavior.initGate;if(behavior.initError)throw behavior.initError;return renderer;}};},
 };
 function flush(){globalThis[key]=harness;let passes=0;do{assert.ok(++passes<15,'effects settle');dirty=false;cursor=0;tree=MemoryMapView(props);const pending=effects;effects=[];pending.forEach(f=>f());}while(dirty);}
 return {changes,renderer,get props(){return props;},get tree(){return tree;},flush,
  // The renderer is behind a dynamic import, so wait (bounded) for its module to load.
  async start(){flush();const deadline=Date.now()+2000;while(renderer.creations===0&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,5));flush();},
  update(next){props={...props,...next};flush();},
  userSelect(id){callbacks.onSelect(id);flush();},
  unmount(){slots.forEach(slot=>slot.cleanup?.());},
 };
}
function find(tree,predicate){
 if(!tree||typeof tree!=='object')return null;
 if(predicate(tree))return tree;
 for(const child of [tree.props?.children].flat(Infinity)){const result=find(child,predicate);if(result)return result;}
 return null;
}

test('Memory navigation preserves pending selection and applies it when graph arrives, including replacement data',async()=>{
 const view=mount({selectedNodeId:'memory-target',loading:true});await view.start();
 assert.equal(view.props.selectedNodeId,'memory-target');assert.deepEqual(view.changes,[]);
 view.update({nodes:[node('memory-target')],loading:false});
 assert.equal(view.renderer.selected,'memory-target');assert.ok(find(view.tree,e=>e.type==='aside'));assert.deepEqual(view.changes,[]);
 view.update({selectedNodeId:'next-target',loading:true});
 view.update({nodes:[node('next-target')],loading:false});
 assert.equal(view.props.selectedNodeId,'next-target');assert.equal(view.renderer.selected,'next-target');assert.deepEqual(view.changes,[]);
 view.unmount();
});

test('panel close and canvas deselection clear parent selection; returning to map does not restore it',async()=>{
 const view=mount({selectedNodeId:'target',nodes:[node('target')]});await view.start();
 find(view.tree,e=>e.props?.['aria-label']==='Close detail').props.onClick();view.flush();
 assert.equal(view.props.selectedNodeId,null);assert.equal(view.renderer.selected,null);
 assert.equal(find(view.tree,e=>e.type==='aside'),null);assert.deepEqual(view.changes,[null]);
 const parent={...view.props};view.unmount();
 const returned=mount(parent);await returned.start();
 assert.equal(returned.renderer.selected,null);assert.equal(find(returned.tree,e=>e.type==='aside'),null);
 returned.userSelect('target');assert.equal(returned.props.selectedNodeId,'target');assert.equal(returned.renderer.selected,'target');
 returned.userSelect(null);assert.equal(returned.props.selectedNodeId,null);assert.equal(returned.renderer.selected,null);
 assert.deepEqual(returned.changes,['target',null]);returned.unmount();
});

test('theme and profile nickname update existing graph; only is_self labels change in UI/search',async()=>{
 const user={nickname:'Aurora',first_name:'Ada',last_name:'Lovelace',username:'ada',email:'',timezone:'UTC'};
 const own={...node('own'),is_self:true,label:'Self'},other={...node('other'),label:'Self'};
 const view=mount({nodes:[own,other],selectedNodeId:'own',theme:'dark',displayName:accountPresentation(user).displayName});await view.start();
 assert.equal(find(view.tree,e=>e.type==='h2').props.children,'Aurora');
 assert.ok(find(view.tree,e=>e.type==='li'&&e.props.children==='Self'),'other literal Self untouched');
 const graphs=view.renderer.graphs;
 view.update({theme:'light',displayName:accountPresentation({...user,nickname:'New name'}).displayName});
 assert.equal(view.renderer.creations,1);assert.equal(view.renderer.graphs,graphs);
 assert.deepEqual(view.renderer.presentations.at(-1),{theme:'light',displayName:'New name'});
 assert.equal(find(view.tree,e=>e.type==='h2').props.children,'New name');
 find(view.tree,e=>e.type==='input'&&e.props['aria-label']==='Search map nodes').props.onChange({target:{value:'New name'}});view.flush();
 assert.ok(find(view.tree,e=>e.type==='button'&&find(e,c=>c.type==='span'&&c.props.children==='New name')));
 view.update({theme:'dark',displayName:accountPresentation({...user,nickname:''}).displayName});
 assert.equal(find(view.tree,e=>e.type==='h2').props.children,'Ada Lovelace');
 view.update({displayName:accountPresentation({...user,nickname:'',first_name:'',last_name:''}).displayName});
 assert.equal(find(view.tree,e=>e.type==='h2').props.children,'ada');
 assert.equal(view.renderer.creations,1);assert.equal(view.renderer.graphs,graphs);assert.equal(view.renderer.selected,'own');
 assert.equal(own.label,'Self');view.unmount();
});

const pause=()=>new Promise(resolve=>setTimeout(resolve,5));
async function settle(view,predicate){const deadline=Date.now()+1000;while(!predicate()&&Date.now()<deadline){await pause();view.flush();}assert.ok(predicate(),'bounded async initialization settles');}
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
test('unmount before module load skips creation; unmount during init destroys late instance and fences callbacks',async t=>{
 const diagnostics=t.mock.method(console,'error',()=>{});
 const module=deferred(),early=mount({}, {moduleGate:module.promise});early.flush();early.unmount();module.resolve();await pause();assert.equal(early.renderer.creations,0);
 const init=deferred(),behavior={initGate:init.promise},old=mount({},behavior);await old.start();old.unmount();assert.equal(behavior.signal.aborted,true);
 const current=mount({nodes:[node('current')]});await current.start();init.resolve();await pause();old.userSelect('obsolete');assert.equal(old.renderer.destroyed,1);assert.deepEqual(old.changes,[]);assert.equal(current.renderer.destroyed,0);current.unmount();assert.equal(current.renderer.destroyed,1);
 assert.equal(diagnostics.mock.calls.length,0,'normal cancellation is silent');
});
test('chunk, WebGL and application failures retain original diagnostics and distinct localized UI',async t=>{
 const diagnostics=t.mock.method(console,'error',()=>{});
 const gpu=new MapInitializationError(new Error('driver failure'),'webgl-unavailable',{width:390,height:844,creationStatus:'EGL_NO_CONFIG'});
 for(const [behavior,expected,absent,kind] of [[{moduleError:Error('synthetic chunk')},'could not be loaded','WebGL','chunk-load'],[{initError:Error('synthetic application failure')},'could not be initialized','WebGL','renderer-init'],[{initError:gpu},'WebGL is unavailable','could not be loaded','webgl-unavailable']]){
  const view=mount({nodes:[node('n')]},behavior);view.flush();await settle(view,()=>JSON.stringify(view.tree).includes(expected));assert.ok(!JSON.stringify(view.tree).includes(absent));view.unmount();
  const args=diagnostics.mock.calls.at(-1).arguments;
  assert.equal(args[1].kind,kind);assert.equal(args[2],behavior.moduleError??behavior.initError);
  assert.ok(!JSON.stringify(view.tree).includes('EGL_NO_CONFIG'),'technical cause stays out of UI');
 }
});

test('empty payload and API failure keep their own states even if renderer initialization also fails',async t=>{
 t.mock.method(console,'error',()=>{});
 for(const error of [null,'Synthetic API failure']){
  const view=mount({nodes:[],error},{initError:Error('synthetic render failure')});
  await view.start();await pause();view.flush();
  const tree=JSON.stringify(view.tree);
  assert.ok(!tree.includes('WebGL'));
  if(error)assert.ok(tree.includes(error));else assert.ok(tree.includes('Your map will grow'));
  view.unmount();
 }
});
