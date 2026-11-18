import test from 'node:test';
import assert from 'node:assert/strict';
import {initializeMapApplication,MapInitializationError} from '../src/components/memory-map/initialization.js';

function environment(t) {
 const gl={getExtension:()=>({loseContext(){gl.released=true;}})};
 const native=function(type){if(type==='webgl2')return gl;return null;};
 const canvas=Object.assign(new EventTarget(),{getContext:native,remove(){this.removed=true;}});
 for(const [name,value] of Object.entries({document:{createElement:()=>canvas},window:{devicePixelRatio:1}})){
  const previous=Object.getOwnPropertyDescriptor(globalThis,name);
  Object.defineProperty(globalThis,name,{value,configurable:true,writable:true});
  t.after(()=>{if(previous)Object.defineProperty(globalThis,name,previous);else delete globalThis[name];});
 }
 return {gl,canvas,native};
}

test('failed init before renderer assignment destroys stage and releases acquired context, retaining cause',async t=>{
 const {gl,canvas,native}=environment(t),cause=new Error('synthetic application error');
 const app={stage:{destroy(){this.destroyed=true;}},async init(options){assert.deepEqual(options.preference,['webgl']);options.canvas.getContext('webgl2');throw cause;}};
 await assert.rejects(initializeMapApplication(app,{clientWidth:800,clientHeight:600}),error=>{
  assert.ok(error instanceof MapInitializationError);assert.equal(error.cause,cause);assert.equal(error.kind,'renderer-init');return true;
 });
 assert.equal(app.stage.destroyed,true);assert.equal(gl.released,true);assert.equal(canvas.removed,true);assert.equal(canvas.getContext,native);
});

test('WebGL failure has creation status/dimensions and original cause, not an application-error guess',async t=>{
 const {canvas}=environment(t),cause=new Error('context creation failed');
 const app={stage:{destroy(){}},async init(options){options.canvas.dispatchEvent(Object.assign(new Event('webglcontextcreationerror'),{statusMessage:'EGL_NO_CONFIG'}));throw cause;}};
 await assert.rejects(initializeMapApplication(app,{clientWidth:0,clientHeight:0}),error=>{
  assert.equal(error.kind,'webgl-unavailable');assert.equal(error.cause,cause);assert.deepEqual(error.details,{width:1,height:1,creationStatus:'EGL_NO_CONFIG'});return true;
 });
 assert.equal(canvas.removed,true);
});

test('cancelled init destroys late successful renderer and returns AbortError without wrapping',async t=>{
 const {canvas}=environment(t),abort=new AbortController();
 const app={renderer:{},async init(){abort.abort();},destroy(){this.destroyed=true;}};
 await assert.rejects(initializeMapApplication(app,{clientWidth:390,clientHeight:844},abort.signal),{name:'AbortError'});
 assert.equal(app.destroyed,true);assert.equal(canvas.removed,true);
});
