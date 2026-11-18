import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {observeMobileWorkspace,sidebarSwipe} from '../src/utils/mobileWorkspace.ts';

const original=Object.fromEntries(['window','document','Element'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
after(()=>{for(const [k,v] of Object.entries(original)){if(v)Object.defineProperty(globalThis,k,v);else delete globalThis[k];}});
class Surface {
  listeners=new Map();style={values:new Map(),setProperty(k,v){this.values.set(k,v);},removeProperty(k){this.values.delete(k);}};
  parentElement=null;clientWidth=390;scrollWidth=390;overflowX='visible';blocked=false;
  addEventListener(k,cb){this.listeners.set(k,cb);}removeEventListener(k){this.listeners.delete(k);}
  closest(selector){return this.blocked?this:this.calendar&&selector.includes('="calendar"')?this:null;}
  fire(k,points){this.listeners.get(k)?.({target:this,touches:points,changedTouches:points});}
}
function harness(mobile=true){
  const root=new Surface(),target=new Surface(),viewport=new Surface(),media=new Surface();
  target.parentElement=root;Object.assign(viewport,{height:500,offsetTop:0,scale:1});media.matches=mobile;
  let open=false,opens=0,closes=0,blurs=0,selection='';
  const input={value:'Unsent draft',blur(){blurs++;}};
  globalThis.Element=Surface;globalThis.document={activeElement:input};
  globalThis.window={innerWidth:390,visualViewport:viewport,matchMedia:()=>media,getSelection:()=>({toString:()=>selection}),getComputedStyle:el=>({overflowX:el.overflowX})};
  const cleanup=observeMobileWorkspace(root,()=>({mobileOpen:open,onOpenMobile(){open=true;opens++;},onCloseMobile(){open=false;closes++;}}));
  const event=(kind,x,y,extra={})=>root.listeners.get(kind)?.({target,touches:[{clientX:x,clientY:y}],changedTouches:[{clientX:x,clientY:y}],...extra});
  const swipe=(x,y,endX,endY)=>{event('touchstart',x,y);event('touchmove',endX,endY);event('touchend',endX,endY);};
  return {root,target,viewport,media,cleanup,event,swipe,input,get open(){return open;},get opens(){return opens;},get closes(){return closes;},get blurs(){return blurs;},select(value){selection=value;}};
}
test('right swipe opens once, left closes; opening blurs but preserves draft',()=>{
  const h=harness();h.swipe(24,120,120,125);assert.equal(h.open,true);assert.equal(h.blurs,1);assert.equal(h.input.value,'Unsent draft');
  h.swipe(40,120,130,125);assert.equal(h.opens,1);h.swipe(230,120,100,125);assert.equal(h.open,false);assert.equal(h.closes,1);h.cleanup();
});
test('vertical, short, diagonal, multitouch, cancelled and browser-edge gestures are ignored',()=>{
  const h=harness();for(const coords of [[40,100,60,240],[40,100,80,102],[40,100,120,155],[5,100,120,102]])h.swipe(...coords);
  h.event('touchstart',30,100,{touches:[{},{}]});h.event('touchend',140,100);
  h.event('touchstart',30,100);h.root.listeners.get('touchcancel')();h.event('touchend',140,100);
  assert.equal(h.opens,0);assert.equal(sidebarSwipe({x:0,y:0},{x:64,y:0},false),'open');h.cleanup();
});
test('editable/interactive/calendar/canvas targets, selections and horizontal scrollers retain gestures',()=>{
  const h=harness();h.target.blocked=true;h.swipe(40,100,160,100);h.target.blocked=false;
  h.target.calendar=true;h.swipe(90,100,220,100);assert.equal(h.opens,0);h.swipe(24,100,160,100);assert.equal(h.opens,1);h.swipe(230,100,100,100);h.target.calendar=false;
  h.select('selected text');h.swipe(40,100,160,100);h.select('');
  h.target.overflowX='auto';h.target.scrollWidth=900;h.swipe(40,100,160,100);assert.equal(h.opens,1);h.cleanup();
  const source=readFileSync('src/components/CalendarView.tsx','utf8');assert.match(source,/data-workspace-swipe="calendar"[\s\S]*onTouchStart=\{handleTouchStart\}[\s\S]*onTouchEnd=\{handleTouchEnd\}/);
});
test('desktop gestures do not change persistent sidebar; listeners and viewport styles clean up',()=>{
  const h=harness(false);h.swipe(24,100,180,100);assert.equal(h.opens,0);assert.equal(h.root.style.values.size,0);h.cleanup();assert.equal(h.root.listeners.size,0);assert.equal(h.viewport.listeners.size,0);assert.equal(h.media.listeners.size,0);
});
test('visual viewport keyboard resize updates surface height without changing draft or width; pinch remains allowed',()=>{
  const h=harness();assert.equal(h.root.style.values.get('--workspace-height'),'500px');h.viewport.height=300;h.viewport.offsetTop=20;h.viewport.fire('resize',[]);
  assert.equal(h.root.style.values.get('--workspace-height'),'300px');assert.equal(h.root.style.values.get('--workspace-top'),'20px');assert.equal(h.input.value,'Unsent draft');
  h.viewport.scale=2;h.viewport.fire('resize',[]);assert.equal(h.root.style.values.size,0);h.cleanup();
  const html=readFileSync('index.html','utf8');assert.match(html,/width=device-width, initial-scale=1.0/);assert.doesNotMatch(html,/user-scalable|maximum-scale/);
});
test('mobile font floor, intrinsic chat widths and contained Markdown scrolling preserve desktop typography',()=>{
  const css=readFileSync('src/index.css','utf8'),chat=readFileSync('src/components/ChatWorkspace.tsx','utf8');
  assert.match(css,/@media \(max-width: 1023px\)[\s\S]*textarea, select,[^}]+font-size: 16px !important/);
  assert.match(chat,/text-\[15px\]/);assert.match(chat,/flex-1 min-h-0 min-w-0 overflow-y-auto/);assert.match(chat,/min-w-0 max-w-\[88%\]/);assert.match(chat,/truncate min-w-0">\{attachedFile\}/);
  assert.match(css,/\.mroya-markdown pre \{[^}]*overflow-x: auto/);assert.match(css,/\.mroya-markdown-scroll \{[^}]*overflow-x: auto/);
});
test('single shared drawer remains mounted for exit, is inert closed, and backdrop keeps close action',()=>{
  const source=readFileSync('src/components/Sidebar.tsx','utf8');assert.doesNotMatch(source,/\{mobileOpen &&/);assert.match(source,/data-open=\{mobileOpen\} inert=\{!mobileOpen\}/);assert.match(source,/mroya-mobile-backdrop[^]*?onClick=\{onCloseMobile\}/);
  for(const page of ['WorkspaceView','GuestWorkspace'])assert.match(readFileSync(`src/pages/${page}.tsx`,'utf8'),/<WorkspaceSurface mobileOpen=/);
});
