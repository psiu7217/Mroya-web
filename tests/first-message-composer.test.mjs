import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
const key='__firstMessageHooks';
const vite=await createServer({mode:'design',server:{middlewareMode:true},appType:'custom',plugins:[{
 name:'first-message-hooks',enforce:'pre',
 transform(code,id){if(id.replaceAll('\\','/').endsWith('/ChatWorkspace.tsx'))return code.replace("from 'react';","from 'virtual:first-message-hooks';");},
 resolveId(id){if(id==='virtual:first-message-hooks')return '\0'+id;},
 load(id){if(id==='\0virtual:first-message-hooks')return `import React from 'react';export default React;
 ${['useState','useRef','useEffect'].map(name=>`export const ${name}=(...args)=>globalThis.${key}.${name}(...args);`).join('\n')}`;},
}]});
const {ChatWorkspace}=await vite.ssrLoadModule('/src/components/ChatWorkspace.tsx');
const original=Object.getOwnPropertyDescriptor(globalThis,'document');
globalThis.document={addEventListener(){},removeEventListener(){}};
after(async()=>{if(original)Object.defineProperty(globalThis,'document',original);else delete globalThis.document;delete globalThis[key];await vite.close();});
const noop=()=>{},gate=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const chat=id=>({id,title:'New chat',messages:[],group:'Today',updatedAt:'',relatedMemoryIds:[]});
const tick=async()=>{await Promise.resolve();await Promise.resolve();};
function mount(onSendMessage){
 const slots=[];let cursor=0,effects=[],dirty=false,tree;
 let props={account:{displayName:'Tester',initials:'T',email:'',description:'',timezone:'UTC',spaceDescription:''},conversation:null,live:true,pending:false,memoriesCount:0,onSendMessage,
  onCitationClick:noop,onActionClick:noop,addedActionIds:[],isSidebarCollapsed:false,onExpandSidebar:noop,onOpenMobileMenu:noop,isContextPanelOpen:false,onToggleContextPanel:noop,plan:'free',onTogglePlan:noop,onOpenPlanModal:noop,theme:'light',onToggleTheme:noop,onNewChat:noop};
 const hooks={
  useState(initial){const i=cursor++;slots[i]??={value:typeof initial==='function'?initial():initial};return [slots[i].value,next=>{const value=typeof next==='function'?next(slots[i].value):next;if(!Object.is(value,slots[i].value)){slots[i].value=value;dirty=true;}}];},
  useRef(value){const i=cursor++;slots[i]??={current:value};return slots[i];},
  useEffect(effect,deps){const i=cursor++,previous=slots[i];if(!previous||deps.some((value,index)=>!Object.is(value,previous.deps[index]))){slots[i]={deps};effects.push(()=>{previous?.cleanup?.();slots[i].cleanup=effect();});}},
 };
 function find(predicate,node){if(arguments.length===1)node=tree;if(!node||typeof node!=='object')return; if(predicate(node))return node;for(const child of [node.props?.children].flat(Infinity)){const found=find(predicate,child);if(found)return found;}}
 function flush(){globalThis[key]=hooks;let passes=0;do{assert.ok(++passes<10);dirty=false;cursor=0;tree=ChatWorkspace(props);const queue=effects;effects=[];queue.forEach(effect=>effect());}while(dirty);}
 return {flush,find,update(next){props={...props,...next};flush();},
  input(value){find(node=>node.type==='textarea').props.onChange({target:{value}});flush();},
  enter(){find(node=>node.type==='textarea').props.onKeyDown({key:'Enter',shiftKey:false,preventDefault(){}});},
  get draft(){return find(node=>node.type==='textarea').props.value;},
  stateValues(){return slots.filter(slot=>Object.hasOwn(slot,'value')).map(slot=>slot.value);},
  unmount(){slots.forEach(slot=>slot.cleanup?.());},
 };
}
test('empty-workspace composer accepts Enter once and retains its draft after failed creation',async()=>{
 const pending=gate(),sent=[];const view=mount(text=>{sent.push(text);return pending.promise;});view.flush();view.input('Первое сообщение\n\nС абзацем');
 view.enter();view.enter();view.flush();assert.equal(sent.length,1);assert.equal(view.draft,sent[0]);
 pending.resolve(false);await tick();view.flush();assert.equal(view.draft,'Первое сообщение\n\nС абзацем');view.unmount();
});
test('confirmed first-chat ID preserves the draft until acceptance, then clears only the submitted text',async()=>{
 const pending=gate(),view=mount(()=>pending.promise);view.flush();view.input('First message');view.enter();
 view.update({conversation:chat('confirmed')});assert.equal(view.draft,'First message');
 pending.resolve(true);await tick();view.flush();assert.equal(view.draft,'');
 view.input('Draft for A');view.update({conversation:chat('other')});assert.equal(view.draft,'');view.unmount();
});
test('Send button shares the submission guard; new edits survive a late acceptance and rejected callbacks retain text',async()=>{
 const pending=gate();let calls=0;const view=mount(()=>{calls++;return pending.promise;});view.flush();view.input('Original');
 const send=view.find(node=>node.type==='button'&&node.props['aria-label']==='Send message');
 assert.ok(send);assert.equal(send.props.disabled,false);view.find(node=>node.type==='form').props.onSubmit({preventDefault(){}});view.enter();assert.equal(calls,1);
 view.input('New draft while creating');view.update({conversation:chat('confirmed')});
 pending.resolve(true);await tick();view.flush();assert.equal(view.draft,'New draft while creating');
 view.update({onSendMessage:async()=>{throw new Error('Rejected');}});view.enter();await tick();view.flush();assert.equal(view.draft,'New draft while creating');view.unmount();
});

test('Design chat switch cancels voice resources, resets recording state and ignores late recognition results',()=>{
 const savedWindow=Object.getOwnPropertyDescriptor(globalThis,'window'),interval=globalThis.setInterval,clear=globalThis.clearInterval;
 const timers=new Map(),recognitions=[];let sequence=0;
 class Recognition {
  constructor(){recognitions.push(this);this.stops=0;}
  start(){}stop(){this.stops++;}
 }
 globalThis.window={SpeechRecognition:Recognition};
 globalThis.setInterval=callback=>{const id=++sequence;timers.set(id,callback);return id;};
 globalThis.clearInterval=id=>timers.delete(id);
 const view=mount(noop);
 const microphone=()=>view.find(node=>node.type==='button'&&node.props['aria-label']==='Record a voice message');
 try{
  view.update({live:false,conversation:chat('A')});microphone().props.onClick();view.flush();
  const first=recognitions[0],late=first.onresult;
  late({results:[[{transcript:'Only chat A voice'}]]});[...timers.values()][0]();[...timers.values()][0]();view.flush();
  assert.ok(view.stateValues().includes('Only chat A voice'));assert.ok(view.stateValues().includes(2));
  view.update({conversation:chat('B')});
  assert.ok(microphone());assert.equal(timers.size,0);assert.equal(first.stops,1);assert.equal(first.onresult,null);assert.equal(first.onerror,null);
  assert.ok(!view.stateValues().includes('Only chat A voice'));assert.ok(!view.stateValues().includes(2));
  // A new recording uses fresh resources; queued callbacks from A cannot change B.
  microphone().props.onClick();view.flush();assert.equal(recognitions.length,2);assert.equal(timers.size,1);
  late({results:[[{transcript:'Late chat A voice'}]]});view.flush();assert.ok(!view.stateValues().includes('Late chat A voice'));
  view.update({conversation:chat('C')});assert.equal(recognitions[1].stops,1);assert.equal(timers.size,0);
 }finally{
  view.unmount();globalThis.setInterval=interval;globalThis.clearInterval=clear;
  if(savedWindow)Object.defineProperty(globalThis,'window',savedWindow);else delete globalThis.window;
 }
});
