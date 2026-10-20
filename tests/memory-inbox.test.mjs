import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createServer} from 'vite';
import {renderToStaticMarkup} from 'react-dom/server';
const key='__memoryInboxHooks';
const vite=await createServer({mode:'design',server:{middlewareMode:true,hmr:false},appType:'custom',plugins:[{
 name:'inbox-hooks',enforce:'pre',
 transform(code,id){if(/\/(MemoryView|useDemoMemoryInbox|useDemoWorkspace|useDemoDiagnostics)\.(tsx|ts)$/.test(id.replaceAll('\\','/')))return code.replace(/from 'react';/g,"from 'virtual:inbox-hooks';");},
 resolveId(id){if(id==='virtual:inbox-hooks')return '\0'+id;},
 load(id){if(id==='\0virtual:inbox-hooks')return `import React from 'react';
 ${['useState','useRef','useEffect','useMemo','useSyncExternalStore'].map(name=>`export const ${name}=(...args)=>globalThis.${key}.${name}(...args);`).join('\n')}
 export default {...React,useState,useRef,useEffect,useMemo};`;},
}]});
const {MemoryView}=await vite.ssrLoadModule('/src/components/MemoryView.tsx');
const {WorkspaceView}=await vite.ssrLoadModule('/src/pages/WorkspaceView.tsx');
const {useDemoWorkspace}=await vite.ssrLoadModule('/src/demo/useDemoWorkspace.ts');
const {useDemoMemoryInbox}=await vite.ssrLoadModule('/src/demo/useDemoMemoryInbox.ts');
const originalFetch=globalThis.fetch,originalWindow=globalThis.window,originalDocument=globalThis.document;let requests=0;
globalThis.window={matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}})};
globalThis.document={documentElement:{setAttribute(){},removeAttribute(){}},addEventListener(){},removeEventListener(){}};
globalThis.fetch=()=>{requests++;throw Error('Design cannot request Backend');};
after(async()=>{globalThis.fetch=originalFetch;globalThis.window=originalWindow;globalThis.document=originalDocument;delete globalThis[key];await vite.close();});
function mount(render){
 const slots=[];let cursor=0,dirty=false,effects=[],value;
 const hooks={
  useSyncExternalStore(subscribe,snapshot){return snapshot();},
  useState(initial){const i=cursor++;slots[i]??={value:typeof initial==='function'?initial():initial};return [slots[i].value,next=>{const value=typeof next==='function'?next(slots[i].value):next;if(!Object.is(value,slots[i].value)){slots[i].value=value;dirty=true;}}];},
  useRef(initial){const i=cursor++;slots[i]??={current:initial};return slots[i];},
  useEffect(effect,deps){const i=cursor++,previous=slots[i];if(!previous||!deps||deps.some((v,index)=>!Object.is(v,previous.deps[index]))){slots[i]={deps};effects.push(()=>{previous?.cleanup?.();slots[i].cleanup=effect();});}},
  useMemo(factory,deps){const i=cursor++,previous=slots[i];if(!previous||deps.some((v,index)=>!Object.is(v,previous.deps[index])))slots[i]={deps,value:factory()};return slots[i].value;},
 };
 function flush(){globalThis[key]=hooks;let passes=0;do{assert.ok(++passes<20,'render settles');dirty=false;cursor=0;value=render();const queue=effects;effects=[];queue.forEach(effect=>effect());}while(dirty);return value;}
 return {flush,get value(){return value;},unmount(){slots.forEach(slot=>slot.cleanup?.());}};
}
function all(node,predicate){if(!node||typeof node!=='object')return [];return [...(predicate(node)?[node]:[]),...[node.props?.children].flat(Infinity).flatMap(child=>all(child,predicate))];}
function find(tree,predicate){const node=all(tree,predicate)[0];assert.ok(node,'expected element');return node;}
function text(node){if(node===null||node===undefined||typeof node==='boolean')return '';if(typeof node!=='object')return String(node);return [node.props?.children].flat(Infinity).map(text).join(' ');}
const button=(tree,label)=>find(tree,node=>node.type==='button'&&text(node).trim()===label);

function workspace(){const model=mount(()=>useDemoWorkspace('filled'));model.flush();return model;}
function memoryProps(model){return find(WorkspaceView({model:{...model,activeSection:'memory'}}),node=>node.type===MemoryView).props;}
function openInbox(page){find(page.value,node=>node.type==='button'&&text(node).trim().startsWith('Предложения')).props.onClick();page.flush();}
function card(page,title){return find(page.value,node=>node.type==='div'&&node.props.className?.startsWith('p-5 sm:p-6 rounded-[12px]')&&all(node,item=>item.type==='h3'&&text(item).trim()===title).length>0);}
const sample={id:'p',title:'Synthetic proposal',source:'Calendar',sourceResourceTitle:'Synthetic source',sourceDate:'2026-10-19',actionProposed:'Synthetic action',explanation:'Synthetic explanation',memoryMatches:[],status:'new'};

test('live Workspace hides Inbox independently of readOnly and does not create requests when API is absent',()=>{
 const model=workspace();
 const runtime={loading:false,error:null,pending:false,busy:false,chatAvailable:true,memoryAvailable:true,calendarAvailable:false,remindersAvailable:false};
 let props=memoryProps({...model.value,runtime});assert.equal(props.inbox,undefined);
 const page=mount(()=>MemoryView({...props,readOnly:false}));page.flush();
 assert.doesNotMatch(text(page.value),/Предложения|Успешно сохранено|Марк день рождения|Сброс демо|Применить в память/);
 assert.match(text(page.value),/Сохранённая память/);
 assert.equal(all(page.value,node=>node.props?.role==='alert').length,0);
 page.unmount();model.unmount();assert.equal(requests,0);
});

test('Design keeps all Studio source scenarios, Yes confirms in one action, No rejects and reset is local',()=>{
 const model=workspace();const page=mount(()=>MemoryView(memoryProps(model.value)));page.flush();openInbox(page);
 for(const name of ['Марк','Вадя','Мурашки','Сашки','Gmail','Google Drive'])assert.ok(text(page.value).includes(name),name);
 const before=model.value.memories;
 button(card(page,'Марк день рождения — 14 января'),'Да').props.onClick();model.flush();page.flush();
 assert.match(text(card(page,'Марк день рождения — 14 января')),/Успешно сохранено/);
 assert.doesNotMatch(text(page.value),/Применить в память/);assert.equal(model.value.memories,before,'Preview must not mutate saved memory');
 button(card(page,'Вадя день омона'),'Нет').props.onClick();model.flush();page.flush();
 assert.match(text(card(page,'Вадя день омона')),/Предложение отклонено/);
 button(page.value,'Сброс демо').props.onClick();model.flush();page.flush();
 assert.equal(model.value.memoryInbox.proposals[0].status,'new');
 page.unmount();model.unmount();assert.equal(requests,0);
});

test('comments and retry update the same demo proposal; empty/loading previews remain available offline',async()=>{
 const model=workspace();const page=mount(()=>MemoryView(memoryProps(model.value)));page.flush();openInbox(page);
 const title='Марк день рождения — 14 января';
 button(card(page,title),'Комментарий').props.onClick();page.flush();
 find(card(page,title),node=>node.type==='textarea').props.onChange({target:{value:'Synthetic clarification'}});page.flush();
 button(card(page,title),'Отправить на повторный анализ').props.onClick();await Promise.resolve();model.flush();page.flush();
 assert.equal(model.value.memoryInbox.proposals.length,8);assert.equal(model.value.memoryInbox.proposals[0].comment,'Synthetic clarification');
 assert.equal(model.value.memoryInbox.proposals[0].status,'reanalyzing');assert.equal(all(card(page,title),node=>node.type==='textarea').length,0);
 button(card(page,'Проектная спецификация Alpha'),'Повторить запрос').props.onClick();model.flush();page.flush();assert.equal(model.value.memoryInbox.proposals[7].status,'reanalyzing');
 button(page.value,'Пустой Inbox').props.onClick();model.flush();page.flush();assert.match(text(page.value),/Все предложения обработаны/);
 button(page.value,'Загрузка').props.onClick();model.flush();page.flush();assert.ok(all(page.value,node=>node.props.className?.includes('animate-pulse')).length);
 page.unmount();model.unmount();assert.equal(requests,0);
});

test('presentation reports only source-confirmed results and supports loading, error/Retry and empty states without demo controls',async()=>{
 const model=workspace();let accepts=0,retries=0;
 let inbox={available:true,scopeKey:'synthetic-account-a',proposals:[sample],loading:false,error:null,onAcceptProposal:()=>{accepts++;},onRetryProposal:()=>{retries++;}};
 const page=mount(()=>MemoryView({...memoryProps(model.value),inbox}));page.flush();openInbox(page);
 button(card(page,sample.title),'Да').props.onClick();page.flush();assert.equal(accepts,1);assert.doesNotMatch(text(page.value),/Успешно сохранено|Сброс демо|Визуальные состояния/);
 inbox={...inbox,loading:true,proposals:[]};page.flush();assert.ok(all(page.value,node=>node.props.className?.includes('animate-pulse')).length);
 inbox={...inbox,loading:false,error:'Synthetic source failure'};page.flush();assert.match(text(page.value),/Synthetic source failure/);assert.doesNotMatch(text(page.value),/Все предложения обработаны/);button(page.value,'Retry').props.onClick();assert.equal(retries,1);
 inbox={...inbox,error:null};page.flush();assert.match(text(page.value),/Все предложения обработаны/);assert.doesNotMatch(text(page.value),/Показать примеры/);
 page.unmount();model.unmount();assert.equal(requests,0);
});

test('account scope changes cannot reveal another account comment and demo hooks have no shared mutable state',()=>{
 const first=mount(()=>useDemoMemoryInbox()),second=mount(()=>useDemoMemoryInbox());first.flush();second.flush();first.value.onAcceptProposal('prop-1');first.flush();assert.equal(second.value.proposals[0].status,'new');
 const model=workspace();let inbox={available:true,scopeKey:'a',proposals:[sample],loading:false,error:null,onCommentProposal:()=>{}};
 const page=mount(()=>MemoryView({...memoryProps(model.value),inbox}));page.flush();openInbox(page);button(card(page,sample.title),'Комментарий').props.onClick();page.flush();
 find(page.value,node=>node.type==='textarea').props.onChange({target:{value:'Account A private draft'}});page.flush();
 inbox={...inbox,scopeKey:'b',proposals:[{...sample,title:'Account B proposal'}]};page.flush();assert.doesNotMatch(text(page.value),/Account A private draft/);assert.equal(all(page.value,node=>node.type==='textarea').length,0);
 inbox={...inbox,available:false};page.flush();assert.doesNotMatch(text(page.value),/Account B proposal|Предложения|Да/);
 page.unmount();model.unmount();first.unmount();second.unmount();assert.equal(requests,0);
});

test('saved memory search, category filter, selection, details, map/chat callbacks, readOnly and empty state remain intact',()=>{
 const model=workspace();const selected=[],mapped=[],asked=[];
 let props={...memoryProps(model.value),inbox:undefined,readOnly:true,onSelectMemory:id=>selected.push(id),onExploreInMap:id=>mapped.push(id),onAskMroyaAbout:value=>asked.push(value)};
 const page=mount(()=>MemoryView(props));page.flush();
 assert.equal(button(page.value,'Add memory').props.disabled,true);
 const first=props.memories[0];
 find(page.value,node=>node.type==='button'&&node.key===first.id).props.onClick();assert.equal(selected[0],first.id);
 button(page.value,'Explore in Memory Map').props.onClick();assert.equal(mapped[0],first.relatedNodeId);
 button(page.value,'Ask Mroya about this memory').props.onClick();assert.equal(asked[0].id,first.id);
 find(page.value,node=>node.type==='input'&&node.props['aria-label']==='Search memories').props.onChange({target:{value:'no matching synthetic memory'}});page.flush();assert.match(text(page.value),/No matching memories found/);
 find(page.value,node=>node.type==='button'&&node.props['aria-label']==='Clear search').props.onClick();page.flush();button(page.value,first.category).props.onClick();page.flush();assert.ok(text(page.value).includes(first.title));
 props={...props,memories:[],selectedMemoryId:null};page.flush();assert.equal(all(page.value,node=>node.type==='button'&&text(node).trim()==='Explore in Memory Map').length,0);
 page.unmount();model.unmount();
});

test('Studio saved-memory and initial Inbox markup are preserved against the full AI Studio commit',async()=>{
 mkdirSync('.review-baseline/inbox',{recursive:true});
 writeFileSync('.review-baseline/inbox/MemoryView.tsx',execFileSync('git',['show','bc549c36182f5df35d0b41f8be33ac421404562e:src/components/MemoryView.tsx']));
 const {MemoryView:Original}=await vite.ssrLoadModule('/.review-baseline/inbox/MemoryView.tsx');
 const model=workspace(),props=memoryProps(model.value);
 const old=mount(()=>Original(props)),current=mount(()=>MemoryView(props));old.flush();current.flush();
 assert.equal(renderToStaticMarkup(current.value),renderToStaticMarkup(old.value),'Saved Memory layout is unchanged');
 openInbox(old);openInbox(current);
 assert.equal(renderToStaticMarkup(current.value),renderToStaticMarkup(old.value),'Initial Studio Inbox cards/layout are unchanged');
 old.unmount();current.unmount();model.unmount();
});

test('shared UI and live modules do not import demo fixtures; production guard rejects new fixture markers',()=>{
 const component=readFileSync('src/components/MemoryView.tsx','utf8');
 assert.doesNotMatch(component,/INITIAL_PROPOSALS|setProposals|from ['"][^'"]*\/demo\//);
 assert.doesNotMatch(readFileSync('src/providers/LiveExperience.tsx','utf8'),/\/demo\//);
 const guard=readFileSync('scripts/check-production.mjs','utf8');
 for(const marker of ['INITIAL_PROPOSALS','Марк день рождения','Alpha_Spec_v2.gdoc'])assert.ok(guard.includes(marker));
});

test('live presentation renders real statuses and receipts in the shared Studio cards without demo controls',async()=>{
 const {proposal,capabilities,runtime,operation}=await vite.ssrLoadModule('/tests/intelligence-fixture.ts');
 const {proposalPresentation}=await vite.ssrLoadModule('/src/hooks/inboxAdapters.ts');
 const {INBOX_STATUSES}=await vite.ssrLoadModule('/src/types/intelligenceApi.ts');
 const model=workspace();
 for(const status of INBOX_STATUSES){
  const row=proposal({status}),item=proposalPresentation(row,capabilities,runtime);
  if(status==='pending')item.errorMessage='Synthetic request error';
  const inbox={available:true,scopeKey:'live-synthetic',proposals:[item],loading:false,error:null,onAcceptProposal:()=>{},onRejectProposal:()=>{},onCommentProposal:()=>false};
  const props=memoryProps({...model.value,runtime:{memoryInboxAvailable:true},memoryInbox:inbox});
  const page=mount(()=>MemoryView(props));page.flush();openInbox(page);
  assert.ok(text(page.value).includes(item.statusLabel),status);assert.doesNotMatch(text(page.value),/Сброс демо|Визуальные состояния|Марк день рождения|совпадение|Применить в память/);
  if(status==='pending_apply')assert.doesNotMatch(text(page.value),/Успешно сохранено/);
  if(status==='pending'){
   assert.equal(all(page.value,node=>node.type==='span'&&node.props.children===item.statusLabel).length,1,'Transport error must not duplicate the Backend status badge');
   button(page.value,'Комментарий').props.onClick();page.flush();find(page.value,node=>node.type==='textarea').props.onChange({target:{value:'Keep draft after failed request'}});page.flush();
   await button(page.value,'Отправить на повторный анализ').props.onClick();page.flush();assert.equal(find(page.value,node=>node.type==='textarea').props.value,'Keep draft after failed request');
  }
  page.unmount();
 }
 const item=proposalPresentation(proposal({status:'applied',apply:operation({links_saved:true})}),capabilities,runtime);
 let opened=0;
 const page=mount(()=>MemoryView({...memoryProps(model.value),inbox:{available:true,scopeKey:'receipt',proposals:[{...item,history:{loading:false,error:null,hasMore:false,entries:[{version:2,kind:'accept',comment:'Confirmed comment',createdAt:'2026-10-20',summary:'Backend decision'}]}}],loading:false,error:null,onOpenProposal:id=>{assert.equal(id,item.id);opened++;}}}));page.flush();openInbox(page);
 assert.match(text(page.value),/Событие связано с памятью/);assert.doesNotMatch(text(page.value),/Успешно сохранено в долговременную память/);
 find(page.value,node=>node.type==='details').props.onToggle({currentTarget:{open:true}});assert.equal(opened,1);assert.match(text(page.value),/Confirmed comment/);
 page.unmount();model.unmount();assert.equal(requests,0);
});
