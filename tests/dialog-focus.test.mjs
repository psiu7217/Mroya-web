import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {trapDialogFocus} from '../src/utils/dialogFocus.ts';
const previous=Object.fromEntries(['HTMLElement','MutationObserver'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
after(()=>{for(const[k,v]of Object.entries(previous)){if(v)Object.defineProperty(globalThis,k,v);else delete globalThis[k];}});
class Item {
 children=[];parentElement=null;inert=false;hidden=false;disabled=false;visibility='visible';tabIndex=-1;isConnected=true;
 constructor(doc,tab=-1){this.ownerDocument=doc;this.tabIndex=tab;}
 add(...items){items.forEach(item=>{item.parentElement=this;this.children.push(item);});return this;}
 contains(el){return this===el||this.children.some(child=>child.contains(el));}
 querySelectorAll(){return this.children.flatMap(child=>[child,...child.querySelectorAll()]);}
 matches(){return this.disabled;}
 closest(){for(let el=this;el;el=el.parentElement)if(el.inert||el.hidden||el.ariaHidden)return el;return null;}
 getClientRects(){return this.hidden?[]:[{}];}
 hasAttribute(){return false;}
 focus(){this.ownerDocument.activeElement=this;this.ownerDocument.emit('focusin',{target:this});}
}
globalThis.HTMLElement=Item;
const observers=[];globalThis.MutationObserver=class {constructor(callback){this.callback=callback;observers.push(this);}observe(){}disconnect(){this.stopped=true;}};
function fixture(){
 const listeners=new Map();
 const doc={activeElement:null,native:null,defaultView:{getComputedStyle:el=>({visibility:el.visibility})},querySelector(){return this.native;},addEventListener(k,fn){listeners.set(k,fn);},removeEventListener(k){listeners.delete(k);},emit(k,event){listeners.get(k)?.(event);},listeners};
 const body=doc.body=new Item(doc),background=new Item(doc),trigger=new Item(doc,0),overlay=new Item(doc),dialog=new Item(doc),a=new Item(doc,0),b=new Item(doc,0);
 body.add(background,overlay);background.add(trigger);overlay.add(dialog);dialog.add(a,b);trigger.focus();
 const key=(key,shiftKey=false)=>{const e={key,shiftKey,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.stopped=true;}};doc.emit('keydown',e);return e;};
 return {doc,body,background,trigger,overlay,dialog,a,b,key};
}
test('focus enters, Tab wraps both ways, outside focus is contained and background inert is restored',()=>{
 const f=fixture(),stop=trapDialogFocus(f.dialog,()=>{});assert.equal(f.doc.activeElement,f.a);assert.equal(f.background.inert,true);
 f.b.focus();assert.equal(f.key('Tab').defaultPrevented,true);assert.equal(f.doc.activeElement,f.a);f.key('Tab',true);assert.equal(f.doc.activeElement,f.b);
 f.trigger.focus();assert.equal(f.doc.activeElement,f.a);stop();assert.equal(f.doc.activeElement,f.trigger);assert.equal(f.background.inert,false);assert.equal(f.doc.listeners.size,0);assert.equal(observers.at(-1).stopped,true);
});
test('disabled, hidden, inert, negative tabindex and visibility-hidden fields are skipped; empty dialog keeps focus',()=>{
 const f=fixture();f.a.disabled=true;f.b.visibility='hidden';const hidden=new Item(f.doc,0),negative=new Item(f.doc,-2),inert=new Item(f.doc,0);hidden.hidden=true;inert.inert=true;f.dialog.add(hidden,negative,inert);
 const stop=trapDialogFocus(f.dialog,()=>{});assert.equal(f.doc.activeElement,f.dialog);f.key('Tab',true);assert.equal(f.doc.activeElement,f.dialog);stop();assert.equal(inert.inert,true);
});
test('Escape affects only the top nested dialog, restores parent focus and preserves existing inert flags',()=>{
 const f=fixture();let outer=0,inner=0;const untouched=new Item(f.doc);untouched.inert=true;f.body.add(untouched);
 const stop=trapDialogFocus(f.dialog,()=>outer++);const nested=new Item(f.doc),child=new Item(f.doc,0);nested.add(child);f.dialog.add(nested);
 const stopNested=trapDialogFocus(nested,()=>inner++);f.key('Escape');assert.equal(inner,1);assert.equal(outer,0);stopNested();assert.equal(f.doc.activeElement,f.a);f.key('Escape');assert.equal(outer,1);stop();assert.equal(untouched.inert,true);
});
test('native LoginDialog owns focus and Escape while open, then the manual trap resumes',()=>{
 const f=fixture();let closed=0;const stop=trapDialogFocus(f.dialog,()=>closed++);const native=new Item(f.doc,0);f.doc.native=native;native.focus();assert.equal(f.doc.activeElement,native);assert.equal(f.key('Escape').defaultPrevented,false);assert.equal(closed,0);
 f.doc.native=null;f.trigger.focus();assert.equal(f.doc.activeElement,f.a);stop();
});
test('removed opener is not focused, dynamic background branches are isolated and no listeners survive out-of-order cleanup',()=>{
 const f=fixture(),stop=trapDialogFocus(f.dialog,()=>{});const portal=new Item(f.doc),button=new Item(f.doc,0);portal.add(button);f.body.add(portal);const stopPortal=trapDialogFocus(portal,()=>{});
 stop();assert.equal(f.doc.activeElement,button);const added=new Item(f.doc);f.body.add(added);observers.at(-1).callback();assert.equal(added.inert,true);f.a.isConnected=false;stopPortal();assert.equal(f.doc.listeners.size,0);assert.equal(added.inert,false);
});
