import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {mapPalettes,mapNodeLabel,paletteForTheme} from '../src/components/memory-map/palette.js';

// Run the real renderer/controller and d3 layout with recording Pixi/Canvas surfaces.
const key='__mroyaMapPresentationTest';
const vite=await createServer({mode:'design',server:{middlewareMode:true},appType:'custom',plugins:[{
 name:'record-map-surfaces',enforce:'pre',
 transform(code,id){if(id.replaceAll('\\','/').endsWith('/memory-map/renderer.js'))return code.replace('from "pixi.js"','from "virtual:map-surface-pixi.js"').replace('from "d3-force"','from "virtual:map-surface-d3-force"');},
 // Explicit virtual imports prevent Vite SSR's normal package externalization.
 resolveId(id){if(id.startsWith('virtual:map-surface-'))return '\0map-surface:'+id.slice('virtual:map-surface-'.length);},
 load(id){
  if(id==='\0map-surface:pixi.js')return `const env=globalThis.${key};export const {Application,Circle,Container,Graphics,Text}=env.pixi;`;
  if(id==='\0map-surface:d3-force')return `import * as d3 from 'd3-force';
   export const {forceLink,forceManyBody,forceCollide,forceX,forceY}=d3;
   export function forceSimulation(nodes){globalThis.${key}.simulations++;return d3.forceSimulation(nodes);}`;
 },
}]});
after(async()=>{delete globalThis[key];await vite.close();});

class Point {constructor(x=0,y=x){this.set(x,y);}set(x,y=x){this.x=x;this.y=y;}}
class Container {
 children=[];position=new Point();scale=new Point(1);
 get x(){return this.position.x;}set x(v){this.position.x=v;}
 get y(){return this.position.y;}set y(v){this.position.y=v;}
 addChild(...children){this.children.push(...children);}
 destroy(){this.destroyed=true;}
 toLocal(p){return {x:(p.x-this.x)/this.scale.x,y:(p.y-this.y)/this.scale.y};}
}
class Graphics extends Container {
 ops=[];clear(){this.ops=[];return this;}
 circle(...args){this.ops.push(['circle',...args]);return this;}
 fill(style){this.ops.push(['fill',style]);return this;}
 stroke(style){this.ops.push(['stroke',style]);return this;}
 moveTo(){return this;}lineTo(){return this;}
}
class Text extends Container {
 constructor({text,style}){super();this.text=text;this.style={...style};this.anchor=new Point();}
 get width(){return this.text.length*7;}get height(){return 14;}
}
const environment={simulations:0,apps:[],exports:[]};
class Application {
 stage=new Container();screen={width:1000,height:700};canvas={};
 renderer={resize:(width,height)=>{this.screen={width,height};}};
 constructor(){environment.apps.push(this);}
 async init(){await environment.initGate;}destroy(){this.destroyed=true;}
}
environment.pixi={Application,Circle:class {},Container,Graphics,Text};
globalThis[key]=environment;
const {createMemoryMapRenderer}=await vite.ssrLoadModule('/src/components/memory-map/renderer.js');
const globals=['window','ResizeObserver','requestAnimationFrame','cancelAnimationFrame','getComputedStyle','document'];
const previous=Object.fromEntries(globals.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
after(()=>{for(const name of globals){if(previous[name])Object.defineProperty(globalThis,name,previous[name]);else delete globalThis[name];}});
globalThis.window={devicePixelRatio:1,matchMedia:()=>Object.assign(new EventTarget(),{matches:true})};
globalThis.ResizeObserver=class {observe(){}disconnect(){}};
globalThis.requestAnimationFrame=()=>{throw new Error('reduced motion must not animate');};
globalThis.cancelAnimationFrame=()=>{};
globalThis.getComputedStyle=()=>({getPropertyValue:()=>''});
const snapshots=[];
globalThis.document={createElement:()=>{
 const ctx={texts:[],background:null,createRadialGradient:()=>({stops:[],addColorStop(offset,color){this.stops.push([offset,color]);}}),
  fillRect(){this.background=this.fillStyle;},fillText(text){this.texts.push({text,color:this.fillStyle});},
  beginPath(){},moveTo(){},lineTo(){},stroke(){},arc(){},fill(){}};
 const canvas={width:0,height:0,getContext:()=>ctx,toBlob(callback){const header=new Uint8Array(24);header.set([137,80,78,71,13,10,26,10]);const view=new DataView(header.buffer);view.setUint32(16,this.width);view.setUint32(20,this.height);snapshots.push(ctx);callback(new Blob([header]));}};
 return canvas;
}};
const graph={nodes:[{id:'own',type:'entity',is_self:true,label:'Self',kind:'person',degree:1,memory_count:1},
 {id:'other',type:'entity',is_self:false,label:'Self',kind:'organization',degree:1,memory_count:1}],
 edges:[{id:'edge',source:'own',target:'other',type:'relation',predicate:'knows'}],stats:{entities:2,memories:1,connections:1,truncated:false}};

test('theme/name redraw preserves Pixi instance, simulation, positions, zoom, pan and selection; PNG uses active presentation',async()=>{
 const host=Object.assign(new EventTarget(),{clientWidth:1000,clientHeight:700,style:{removeProperty(){}},append(){},getBoundingClientRect:()=>({left:0,top:0}),setPointerCapture(){}});
 const original=JSON.stringify(graph);let resolveExport,tooltip;
 const api=await createMemoryMapRenderer(host,{onSelect(){},onCount(){},onHint(){},onTooltip:value=>{tooltip=value;},onExport:value=>{if(value){environment.exports.push(value);resolveExport?.();}}});
 try {
  api.setGraph(graph);api.select('own');api.zoom(1.6,350,290);
  const app=environment.apps[0],layer=app.stage.children[0],labels=app.stage.children[1];
  for(const [type,clientX,clientY] of [['pointerdown',5,690],['pointermove',70,680],['pointerup',70,680]])host.dispatchEvent(Object.assign(new Event(type),{button:0,pointerId:1,clientX,clientY}));
  const ownPosition=layer.children[1].position;
  host.dispatchEvent(Object.assign(new Event('pointermove'),{pointerId:2,clientX:layer.x+ownPosition.x*layer.scale.x,clientY:layer.y+ownPosition.y*layer.scale.y}));
  const snapshot=()=>({camera:{x:layer.x,y:layer.y,zoom:layer.scale.x},positions:layer.children.map(n=>({...n.position})),selectedRing:layer.children[1].ops.filter(o=>o[0]==='stroke').at(-1)[1].alpha});
  const before=snapshot();
  api.setPresentation({theme:'dark',displayName:'Aurora'});
  assert.equal(labels.children.find(l=>l.text==='Aurora').style.fill,mapPalettes.dark.label);
  await new Promise(resolve=>{resolveExport=resolve;api.exportImage(1920,1080);});
  assert.deepEqual(snapshots.at(-1).background.stops.map(s=>s[1]),mapPalettes.dark.background);
  for(const [theme,displayName] of [['light','New nickname'],['dark','Ada Lovelace'],['light','ada']]){
   api.setPresentation({theme,displayName});
   assert.deepEqual(snapshot(),before);assert.equal(environment.apps.length,1);assert.equal(environment.simulations,1);assert.equal(app.destroyed,undefined);
   const ownLabel=labels.children.find(l=>l.text===displayName);assert.ok(ownLabel);assert.equal(ownLabel.style.fill,mapPalettes[theme].label);
   assert.equal(tooltip.text,displayName);
   assert.ok(labels.children.some(l=>l.text==='Self'),'other node label retained');
  }
  await new Promise(resolve=>{resolveExport=resolve;api.exportImage(1920,1080);});
  assert.deepEqual(snapshots.at(-1).background.stops.map(s=>s[1]),mapPalettes.light.background);
  assert.ok(snapshots.at(-1).texts.some(t=>t.text==='ada'&&t.color==='#252019'));
  assert.equal(JSON.stringify(graph),original);
 } finally {api.destroy();}
 assert.equal(environment.apps[0].destroyed,true);
});

test('self labels require is_self=true; light palette consumes shared CSS tokens without altering dark',()=>{
 assert.equal(mapNodeLabel({is_self:true,label:'Self'},'Nickname'),'Nickname');
 assert.equal(mapNodeLabel({label:'Self'},'Nickname'),'Self');
 assert.equal(mapNodeLabel({is_self:true,label:'Stored label'},''),'Stored label');
 const palette=paletteForTheme('light',token=>token==='--mroya-text'?'#123456':'');
 assert.equal(palette.label,0x123456);assert.equal(paletteForTheme('dark'),mapPalettes.dark);
});

test('aborted asynchronous Pixi initialization destroys the app before canvas/listeners/observer are attached',async()=>{
 let release;environment.initGate=new Promise(resolve=>{release=resolve;});let appended=0;
 const host=Object.assign(new EventTarget(),{clientWidth:1000,clientHeight:700,append(){appended++;}});
 const abort=new AbortController(),pending=createMemoryMapRenderer(host,{},abort.signal);const app=environment.apps.at(-1);abort.abort();release();
 await assert.rejects(pending,{name:'AbortError'});assert.equal(app.destroyed,true);assert.equal(appended,0);delete environment.initGate;
});
