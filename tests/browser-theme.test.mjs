import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer} from 'vite';
const vite=await createServer({mode:'design',server:{middlewareMode:true,hmr:false},appType:'custom',plugins:[{
 name:'browser-theme-hooks',enforce:'pre',
 transform(code,id){if(id.replaceAll('\\','/').endsWith('/useWorkspaceLayout.ts'))return code.replace("from 'react'","from 'virtual:browser-theme-hooks'");},
 resolveId(id){if(id==='virtual:browser-theme-hooks')return '\0'+id;},
 load(id){if(id==='\0virtual:browser-theme-hooks')return `export const useState=(...args)=>globalThis.__browserThemeHooks.useState(...args);export const useEffect=(...args)=>globalThis.__browserThemeHooks.useEffect(...args);`;},
}]});
const {useWorkspaceLayout}=await vite.ssrLoadModule('/src/hooks/useWorkspaceLayout.ts');
const originals=Object.fromEntries(['window','document'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
after(async()=>{for(const [k,v] of Object.entries(originals)){if(v)Object.defineProperty(globalThis,k,v);else delete globalThis[k];}delete globalThis.__browserThemeHooks;await vite.close();});
function setup(dark=false,stored='system'){
 const attributes=new Map(),metas=[new Map(),new Map()],listeners=new Set(),storage=new Map([['mroya:guest-theme',stored]]);
 const media={matches:dark,addEventListener:(_,fn)=>listeners.add(fn),removeEventListener:(_,fn)=>listeners.delete(fn)};
 globalThis.document={documentElement:{setAttribute:(k,v)=>attributes.set(k,v)},querySelectorAll:()=>metas.map(meta=>({setAttribute:(k,v)=>meta.set(k,v)}))};
 globalThis.window={matchMedia:()=>media,localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)}};
 return {attributes,metas,listeners,storage,system(value){media.matches=value;for(const fn of [...listeners])fn();}};
}
function mount(options){
 const slots=[];let cursor=0,dirty=false,effects=[],value;
 globalThis.__browserThemeHooks={
  useState(initial){const i=cursor++;slots[i]??={value:typeof initial==='function'?initial():initial};return [slots[i].value,next=>{const v=typeof next==='function'?next(slots[i].value):next;if(!Object.is(v,slots[i].value)){slots[i].value=v;dirty=true;}}];},
  useEffect(fn,deps){const i=cursor++,old=slots[i];if(!old||deps.some((v,n)=>!Object.is(v,old.deps[n]))){slots[i]={deps};effects.push(()=>{old?.cleanup?.();slots[i].cleanup=fn();});}},
 };
 const flush=()=>{let passes=0;do{assert.ok(++passes<10);dirty=false;cursor=0;value=useWorkspaceLayout(options);const queue=effects;effects=[];queue.forEach(fn=>fn());}while(dirty);return value;};
 flush();return {flush,get value(){return value;},unmount(){slots.forEach(slot=>slot.cleanup?.());}};
}
function expectTheme(env,view,theme){assert.equal(view.value.appearance,theme);assert.equal(env.attributes.get('data-theme'),theme);for(const meta of env.metas)assert.equal(meta.get('content'),theme==='dark'?'#171513':'#FBF8F3');}
test('manual Light/Dark overrides OS and updates both browser candidates without remount',()=>{
 const env=setup(true),options={theme:'light'},view=mount(options);expectTheme(env,view,'light');
 options.theme='dark';view.flush();expectTheme(env,view,'dark');env.system(false);view.flush();expectTheme(env,view,'dark');assert.equal(env.listeners.size,1);
 options.theme='light';view.flush();expectTheme(env,view,'light');view.unmount();assert.equal(env.listeners.size,0);
});
test('System follows OS changes; explicit selection stops following OS',()=>{
 const env=setup(false),options={theme:'system'},view=mount(options);expectTheme(env,view,'light');env.system(true);view.flush();expectTheme(env,view,'dark');
 options.theme='light';view.flush();env.system(true);view.flush();expectTheme(env,view,'light');view.unmount();
});
test('guest saved preference restores on reopening and the last applied canvas remains during session loading',()=>{
 const env=setup(false,'dark');let view=mount({guest:true});expectTheme(env,view,'dark');view.value.selectTheme('light');view.flush();expectTheme(env,view,'light');assert.equal(env.storage.get('mroya:guest-theme'),'light');
 view.unmount();assert.equal(env.attributes.get('data-theme'),'light');view=mount({guest:true});expectTheme(env,view,'light');view.unmount();
});
test('reloaded authenticated layout applies the confirmed profile preference, including System',()=>{
 const env=setup(true);let view=mount({theme:'light'});expectTheme(env,view,'light');view.unmount();view=mount({theme:'dark'});expectTheme(env,view,'dark');view.unmount();view=mount({theme:'system'});expectTheme(env,view,'dark');view.unmount();
});
test('first-paint color candidates and CSS schemes/backgrounds agree with PWA metadata while preserving mobile geometry',()=>{
 const html=readFileSync('index.html','utf8'),css=readFileSync('src/index.css','utf8');
 assert.match(html,/name="theme-color" media="\(prefers-color-scheme: light\)" content="#FBF8F3"/);assert.match(html,/name="theme-color" media="\(prefers-color-scheme: dark\)" content="#171513"/);
 assert.match(css,/:root \{\s+color-scheme: light/);assert.match(css,/\[data-theme="dark"\] \{\s+color-scheme: dark/);assert.match(css,/:root:not\(\[data-theme\]\) \{\s+color-scheme: dark/);
 assert.match(css,/html,\s*body,\s*#root \{[^}]*background-color: var\(--mroya-bg\)/);
 assert.doesNotMatch(html,/apple-mobile-web-app-status-bar-style|viewport-fit|user-scalable|maximum-scale/);
 assert.match(readFileSync('src/demo/useDemoWorkspace.ts','utf8'),/applyBrowserTheme\(value\)/);
});
