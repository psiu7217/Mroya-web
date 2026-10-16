import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';

// Exercise the actual component's effects and handlers, without a DOM/WebGL dependency.
const key='__mroyaMapSelectionTest';
const vite=await createServer({mode:'design',server:{middlewareMode:true},appType:'custom',plugins:[{
 name:'map-selection-test-adapters',enforce:'pre',
 transform(code,id){if(id.replaceAll('\\','/').endsWith('/src/components/MemoryMapView.tsx'))return code
  .replace("from 'react';","from 'virtual:map-selection-hooks';")
  .replace("'./memory-map/renderer.js'","'virtual:map-selection-renderer'");},
 resolveId(id){if(id.startsWith('virtual:map-selection-'))return '\0'+id;},
 load(id){
  if(id==='\0virtual:map-selection-hooks')return `import React from 'react';export default React;
   ${['useState','useRef','useMemo','useEffect'].map(name=>`export const ${name}=(...args)=>globalThis.${key}.${name}(...args);`).join('\n')}`;
  if(id==='\0virtual:map-selection-renderer')return `export const defaults={repulsion:235,linkDistance:126,center:28};
   export const createMemoryMapRenderer=async(host,callbacks)=>globalThis.${key}.createRenderer(callbacks);`;
 },
}]});
after(async()=>{delete globalThis[key];await vite.close();});
const {MemoryMapView}=await vite.ssrLoadModule('/src/components/MemoryMapView.tsx');
const node=id=>({id,label:id,type:'entity',kind:'person',category:'person',subtitle:'',summary:'',source:'',dateRecorded:'',connectionsCount:0});
const same=(a,b)=>a&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
function mount(initial){
 const slots=[],changes=[];let cursor=0,effects=[],dirty=false,tree,callbacks;
 let props={edges:[],nodes:[],selectedNodeId:null,isSidebarCollapsed:false,onOpenMemory(){},onAskAboutNode(){},onExpandSidebar(){},onOpenMobileMenu(){},...initial};
 props.onSelectNode=id=>{changes.push(id);props={...props,selectedNodeId:id};dirty=true;};
 const renderer={selected:null,selections:[],setGraph(){callbacks.onSelect(null);},setOptions(){},
  select(id){this.selected=id;this.selections.push(id);},setForce(){},destroy(){}};
 const harness={
  useState(initial){const i=cursor++;slots[i]??={value:typeof initial==='function'?initial():initial};return [slots[i].value,value=>{
   const next=typeof value==='function'?value(slots[i].value):value;if(!Object.is(next,slots[i].value)){slots[i].value=next;dirty=true;}
  }];},
  useRef(value){const i=cursor++;slots[i]??={current:value};return slots[i];},
  useMemo(factory,deps){const i=cursor++;if(!same(slots[i]?.deps,deps))slots[i]={deps,value:factory()};return slots[i].value;},
  useEffect(effect,deps){const i=cursor++;if(!same(slots[i]?.deps,deps)){const previous=slots[i];slots[i]={deps};effects.push(()=>{previous?.cleanup?.();slots[i].cleanup=effect();});}},
  createRenderer(value){callbacks=value;return renderer;},
 };
 function flush(){globalThis[key]=harness;let passes=0;do{assert.ok(++passes<15,'effects settle');dirty=false;cursor=0;tree=MemoryMapView(props);const pending=effects;effects=[];pending.forEach(f=>f());}while(dirty);}
 return {changes,renderer,get props(){return props;},get tree(){return tree;},flush,
  async start(){flush();await Promise.resolve();await Promise.resolve();flush();},
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
