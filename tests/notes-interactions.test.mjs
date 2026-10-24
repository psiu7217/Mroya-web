import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
const key='__notesInteractionHooks';
const vite=await createServer({mode:'design',server:{middlewareMode:true,hmr:false},appType:'custom',plugins:[{
 name:'notes-interaction-hooks',enforce:'pre',transform(code,id){if(id.replaceAll('\\','/').endsWith('/NotesView.tsx'))return code.replace("from 'react';","from 'virtual:notes-hooks';").replace("from 'react-markdown';","from 'virtual:notes-markdown';");},
 resolveId(id){if(id.startsWith('virtual:notes-'))return '\0'+id;},
 load(id){if(id==='\0virtual:notes-hooks')return `import React from 'react';export default React;${['useState','useRef','useMemo','useEffect','useLayoutEffect'].map(n=>`export const ${n}=(...args)=>globalThis.${key}.${n}(...args);`).join('\n')}`;
 if(id==='\0virtual:notes-markdown')return `import React from 'react';import Markdown from 'react-markdown';export default function CapturedMarkdown(props){return React.createElement(Markdown,{...props,components:{...props.components,li:args=>{const item=props.components.li(args);globalThis.${key}.capture(item);return item;}}});}`;},
}]});
const {NotesView}=await vite.ssrLoadModule('/src/components/NotesView.tsx');
const {WorkspaceView}=await vite.ssrLoadModule('/src/pages/WorkspaceView.tsx');
const {Sidebar}=await vite.ssrLoadModule('/src/components/Sidebar.tsx');
const {useDemoWorkspace}=await vite.ssrLoadModule('/src/demo/useDemoWorkspace.ts');
const originals=Object.fromEntries(['window','navigator','fetch'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
let requests=0,clipboard=async()=>{};
globalThis.window={getSelection:()=>({toString:()=>''}),matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}})};Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:text=>clipboard(text)}}});globalThis.fetch=()=>{requests++;throw Error('Notes must stay offline');};
after(async()=>{for(const[k,v]of Object.entries(originals)){if(v)Object.defineProperty(globalThis,k,v);else delete globalThis[k];}delete globalThis[key];await vite.close();});
function all(node,predicate){if(!node||typeof node!=='object')return [];return [...(predicate(node)?[node]:[]),...[node.props?.children].flat(Infinity).flatMap(n=>all(n,predicate))];}
function text(node){if(node==null||typeof node==='boolean')return '';if(typeof node!=='object')return String(node);return [node.props?.children].flat(Infinity).map(text).join(' ');}
function find(tree,predicate){const result=all(tree,predicate)[0];assert.ok(result,'expected element');return result;}
const button=(view,label)=>find(view.tree,n=>n.type==='button'&&(n.props['aria-label']===label||text(n).trim()===label));
function mount(initial){
 let props={notes:[],designPreview:true,...initial},tree,html='',tasks=[],cursor=0,dirty=false,effects=[];const slots=[];
 const hooks={
  capture(item){if(item.props.role==='checkbox')tasks.push(item);},
  useState(initial){const i=cursor++;slots[i]??={value:typeof initial==='function'?initial():initial};return [slots[i].value,value=>{const next=typeof value==='function'?value(slots[i].value):value;if(!Object.is(next,slots[i].value)){slots[i].value=next;dirty=true;}}];},
  useRef(initial){const i=cursor++;slots[i]??={current:initial};return slots[i];},
  useMemo(factory,deps){const i=cursor++,old=slots[i];if(!old||deps.some((v,n)=>!Object.is(v,old.deps[n])))slots[i]={deps,value:factory()};return slots[i].value;},
  useEffect(effect,deps){const i=cursor++,old=slots[i];if(!old||deps.some((v,n)=>!Object.is(v,old.deps[n]))){slots[i]={deps};effects.push(()=>{old?.cleanup?.();slots[i].cleanup=effect();});}},
  useLayoutEffect(...args){return this.useEffect(...args);},
 };
 function flush(){globalThis[key]=hooks;let passes=0;do{assert.ok(++passes<15);dirty=false;cursor=0;tasks=[];tree=NotesView(props);html=renderToStaticMarkup(tree);
  const wrapper=all(tree,n=>n.props?.className?.startsWith?.('mroya-markdown '))[0];if(wrapper)wrapper.props.ref.current={querySelectorAll:()=>tasks.map(task=>({getAttribute:k=>String(task.props[k])}))};
  const queue=effects;effects=[];queue.forEach(effect=>effect());
 }while(dirty);return tree;}
 flush();return {get tree(){return tree;},get html(){return html;},get tasks(){return tasks;},flush,update(next){props={...props,...next};flush();},open(title){const target=all(tree,n=>n.type==='article'&&all(n,c=>c.type==='h3'&&text(c).trim()===title).length)[0]??button(this,title);target.props.onClick();flush();},unmount(){slots.forEach(s=>s.cleanup?.());}};
}
const note=(id,content,title=id)=>Object.freeze({id,title,content,summary:'Synthetic summary',tags:['Synthetic'],category:'Checklist',noteType:'checklist',updatedAt:'2026-10-22'});
const click=task=>{const target={closest:()=>null};task.props.onClick({target,currentTarget:target,preventDefault(){},stopPropagation(){}});};
test('real GFM tasks toggle by click/Enter/Space, Reset clears them, source and copied Markdown remain unchanged',async()=>{
 const source='- [x] First\n- [ ] Second',notes=[note('one',source)],view=mount({notes});view.open('one');assert.deepEqual(view.tasks.map(t=>t.props['aria-checked']),[true,false]);assert.match(view.html,/1 of 2 completed/);
 click(view.tasks[1]);view.flush();assert.deepEqual(view.tasks.map(t=>t.props['aria-checked']),[true,true]);assert.match(view.html,/2 of 2 completed/);
 for(const keyName of ['Enter',' ']){const task=view.tasks[0],target={};task.props.onKeyDown({key:keyName,target,currentTarget:target,preventDefault(){},stopPropagation(){}});view.flush();}
 assert.equal(view.tasks[0].props['aria-checked'],true);
 button(view,'Reset checklist').props.onClick();view.flush();assert.deepEqual(view.tasks.map(t=>t.props['aria-checked']),[false,false]);assert.match(view.html,/0 of 2 completed/);
 let copied;clipboard=async value=>{copied=value;};await button(view,'Copy note text').props.onClick();view.flush();assert.equal(copied,'one\n\n'+source);assert.equal(notes[0].content,source);
 view.unmount();assert.equal(requests,0);
});
test('ordered, nested, quoted and loose tasks use parsed source positions; fenced/escaped markers are not tasks',()=>{
 const source='```md\n- [ ] Code only\n```\n\n1. [x] Ordered\n   - [ ] Nested\n\n> - [x] Quoted\n\n- [x] Loose\n\n  Extra paragraph\n\n\\- [ ] Escaped';
 const view=mount({notes:[note('complex',source)]});view.open('complex');assert.equal(view.tasks.length,4);assert.deepEqual(view.tasks.map(t=>t.props['aria-checked']),[true,false,true,true]);assert.match(view.html,/3 of 4 completed/);
 click(view.tasks[1]);view.flush();assert.match(view.html,/4 of 4 completed/);assert.equal(view.tasks[0].props['aria-checked'],true);view.unmount();
});
test('checks are note/source-scoped, retained on back navigation, discarded on unmount or changed canonical content',()=>{
 const a=note('a','- [ ] A'),b=note('b','- [ ] B'),view=mount({notes:[a,b]});view.open('a');click(view.tasks[0]);view.flush();view.open('Back to Notes');view.open('b');assert.equal(view.tasks[0].props['aria-checked'],false);view.open('Back to Notes');view.open('a');assert.equal(view.tasks[0].props['aria-checked'],true);
 view.update({notes:[note('a','- [ ] New source'),b]});assert.equal(view.tasks[0].props['aria-checked'],false);view.unmount();const reopened=mount({notes:[a]});reopened.open('a');assert.equal(reopened.tasks[0].props['aria-checked'],false);reopened.unmount();
});
test('search/category/Empty preview work offline; read-only mode has no demo state switch or editor',()=>{
 const view=mount({notes:[note('a','alpha'),{...note('b','beta'),category:'Other'}]});find(view.tree,n=>n.type==='input').props.onChange({target:{value:'beta'}});view.flush();assert.doesNotMatch(view.html,/>a<\/h3>/);assert.match(view.html,/>b<\/h3>/);
 find(view.tree,n=>n.type==='input').props.onChange({target:{value:''}});view.flush();view.open('Other');assert.doesNotMatch(view.html,/>a<\/h3>/);view.open('Empty state');assert.match(view.html,/No notes yet/);
 view.update({designPreview:false});assert.doesNotMatch(view.html,/Empty state|No notes yet/);assert.doesNotMatch(view.html,/<textarea|contenteditable|Create note|New note/);view.unmount();assert.equal(requests,0);
});
test('safe Markdown blocks raw HTML, dangerous links/images and keeps tables/code internally scrollable',()=>{
 const view=mount({notes:[note('unsafe','<script>alert(1)</script>\n\n[bad](javascript:alert%281%29) ![remote](https://example.test/pixel.png)\n\n| A | B |\n|---|---|\n| x | y |\n\n```html\n<img src=x onerror=alert(1)>\n```')]});view.open('unsafe');assert.doesNotMatch(view.html,/<script|href="javascript:|src="https:\/\/example.test\/pixel|onerror="/);assert.match(view.html,/Note table/);assert.match(view.html,/mroya-markdown-scroll/);assert.match(view.html,/&lt;img/);view.unmount();
});
test('late or rejected clipboard writes never show Copied on another note',async()=>{
 let resolve;clipboard=()=>new Promise(r=>resolve=r);const view=mount({notes:[note('a','A'),note('b','B')]});view.open('a');const pending=button(view,'Copy note text').props.onClick();view.open('Back to Notes');view.open('b');resolve();await pending;view.flush();assert.doesNotMatch(view.html,/>Copied</);
 clipboard=async()=>{throw Error('denied');};await button(view,'Copy note text').props.onClick();view.flush();assert.doesNotMatch(view.html,/>Copied</);view.unmount();
});
test('Production and Guest hide unconfigured Notes; stale selection falls back to Chat without demo or fake empty success',()=>{
 let model;function Seed(){model=useDemoWorkspace('filled');return null;}renderToStaticMarkup(React.createElement(Seed));
 const design=WorkspaceView({model:{...model,activeSection:'notes'}});assert.ok(all(design,n=>n.type===NotesView).length===1);
 const live=WorkspaceView({model:{...model,notesAvailable:false,runtime:{},activeSection:'notes'}});assert.equal(all(live,n=>n.type===NotesView).length,0);assert.equal(find(live,n=>n.type===Sidebar).props.notesAvailable,false);
 const guest=renderToStaticMarkup(React.createElement(Sidebar,{...find(design,n=>n.type===Sidebar).props,notesAvailable:undefined,onSignIn(){}}));assert.doesNotMatch(guest,/>Notes<|title="Notes/);
 const configured=WorkspaceView({model:{...model,runtime:{},notesAvailable:true,activeSection:'notes'}});assert.equal(find(configured,n=>n.type===NotesView).props.designPreview,false);
});


test('live Notes distinguish pending/error/confirmed empty; retry/pagination call controllers without synthetic success',()=>{
 let retries=0,more=0;
 const runtime={scopeKey:'synthetic-scope',loaded:false,loading:true,loadingMore:false,error:null,hasMore:false,selectedId:null,detail:null,detailLoading:false,detailError:null,onSelect(){},onRetry(){retries++;},onMore(){more++;},onRetryDetail(){}};
 const view=mount({notes:[],designPreview:false,runtime});assert.match(view.html,/Loading notes/);assert.doesNotMatch(view.html,/No notes yet|Empty state/);
 runtime.loading=false;runtime.error='Synthetic load error';view.update({runtime:{...runtime}});assert.match(view.html,/Could not load this information/);assert.doesNotMatch(view.html,/No notes yet/);view.open('Try again');assert.equal(retries,1);
 runtime.loaded=true;runtime.error=null;view.update({runtime:{...runtime}});assert.match(view.html,/No notes yet/);
 runtime.hasMore=true;view.update({notes:[{...note('a','not searched content'),category:undefined,noteType:undefined}],runtime:{...runtime}});view.open('Load more notes');assert.equal(more,1);assert.match(view.html,/loaded note metadata only/);assert.doesNotMatch(view.html,/Empty state/);view.unmount();assert.equal(requests,0);
});

test('live selected note shows only confirmed detail, preserves local checklists and Copy, closes via controller; search excludes body',async()=>{
 const original='- [ ] Canonical task',brief={...note('remote',''),category:undefined,noteType:undefined};
 let selected,detailRetries=0;
 const runtime={scopeKey:'live-scope',loaded:true,loading:false,loadingMore:false,error:null,hasMore:false,selectedId:null,detail:null,detailLoading:false,detailError:null,onSelect(id){selected=id;},onRetry(){},onMore(){},onRetryDetail(){detailRetries++;}};
 const view=mount({notes:[brief],designPreview:false,runtime});view.open('remote');assert.equal(selected,'remote');
 runtime.selectedId='remote';runtime.detailLoading=true;view.update({runtime:{...runtime}});assert.match(view.html,/Loading note/);assert.equal(button(view,'Copy note text').props.disabled,true);assert.equal(view.tasks.length,0);
 runtime.detailLoading=false;runtime.detailError='Note unavailable';view.update({runtime:{...runtime}});assert.match(view.html,/Could not load this information/);view.open('Try again');assert.equal(detailRetries,1);
 runtime.detailError=null;runtime.detail={...brief,content:original};view.update({runtime:{...runtime}});assert.equal(view.tasks.length,1);click(view.tasks[0]);view.flush();assert.equal(view.tasks[0].props['aria-checked'],true);
 let copied;clipboard=async v=>{copied=v;};await button(view,'Copy note text').props.onClick();assert.equal(copied,'remote\n\n'+original);assert.equal(runtime.detail.content,original);view.open('Back to Notes');assert.equal(selected,null);
 runtime.selectedId=null;runtime.detail=null;view.update({notes:[{...brief,content:'Secret body-only term'}],runtime:{...runtime}});
 find(view.tree,n=>n.type==='input').props.onChange({target:{value:'body-only'}});view.flush();assert.doesNotMatch(view.html,/Open note: remote/);view.unmount();assert.equal(requests,0);
});
