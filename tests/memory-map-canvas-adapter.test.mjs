import test from 'node:test';
import assert from 'node:assert/strict';
import {mapCanvasAdapter} from '../src/components/memory-map/canvasAdapter.js';

test('Pixi-owned canvas normalizes thrown WebGL acquisition without changing 2D or native prototypes',()=>{
 const failure=new Error('context denied'),calls=[],context={};
 const native={getContext(type,...options){calls.push([this,type,...options]);if(type==='2d')return context;throw failure;}};
 const canvas=Object.create(native);
 const base={createCanvas:(...size)=>{assert.deepEqual(size,[640,480]);return canvas;},fetch(){}};
 const adapted=mapCanvasAdapter(base);
 const result=adapted.createCanvas(640,480);
 assert.equal(adapted.fetch,base.fetch);assert.equal(result,canvas);
 for(const type of ['webgl','webgl2','experimental-webgl'])assert.equal(result.getContext(type,{stencil:true}),null);
 assert.equal(result.getContext('2d'),context);assert.throws(()=>result.getContext('bitmaprenderer'),failure);
 assert.ok(calls.every(call=>call[0]===canvas));
 assert.deepEqual(calls[0].slice(1),['webgl',{stencil:true}]);
 assert.throws(()=>native.getContext('webgl'),failure,'original API still throws');
});
