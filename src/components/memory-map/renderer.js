// Ported from psiu7217/Personal-Memory-OS @ 38892fa5e25e30c908e0c8ad5c2032d02d248d36.
import { Application, Circle, Container, Graphics, Text } from "pixi.js";
import { forceSimulation, forceLink, forceManyBody, forceCollide, forceX, forceY } from "d3-force";
import { localIds, nodeRadius, pngDimensions, presentationGraph } from "./graph.js";
import { mapPalettes, mapNodeLabel, colorHex, paletteForTheme } from "./palette.js";
import { defaults } from "./forceDefaults.js";
import { initializeMapApplication } from "./initialization.js";
export { defaults };
/**
 * Instance-local renderer. React owns all controls/details; no transport or global DOM IDs.
 * @param {HTMLElement} host
 * @param {{onSelect:(id:string|null)=>void, onTooltip:(value:{text:string,x:number,y:number}|null)=>void, onCount:(n:number)=>void, onExport:(value:{url:string,name:string}|null)=>void, onHint:(text:string)=>void}} callbacks
 * @param {AbortSignal} [signal]
 */
export async function createMemoryMapRenderer(host, callbacks, signal) {
signal?.throwIfAborted();
let palette = mapPalettes.dark, theme = 'dark', displayName = '';
const labelFor = node => mapNodeLabel(node, displayName);

const state = { graph: null, displayGraph: null, hideSelf: false, nodeById: new Map(), visible: [], links: [], selected: null, hovered: null, mode: "global",
  depth: 2, app: null, layer: null, edges: null, labels: null, simulation: null,
  views: new Map(), labelViews: new Map(), edgeLabels: new Map(), drag: null, pan: null,
  visuals: new Map(), edgeVisuals: new Map(), visualStarted: 0, visualDuration: 0, visualFrame: null,
  labelBand: 0, force: { ...defaults }, positions: new Map(), exportUrl: null, exportRevision: 0 };


let disposed = false, cameraFrame = null, showcase = false;
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
const app = new Application();
await initializeMapApplication(app, host, signal);
// Pixi init is asynchronous: never attach a scene to a host that has unmounted.
if (signal?.aborted) { app.destroy(true,{children:true}); signal.throwIfAborted(); }
state.app=app; host.append(app.canvas);
state.layer=new Container(); state.edges=new Graphics(); state.labels=new Container();
state.layer.addChild(state.edges); app.stage.addChild(state.layer,state.labels);
// Native pointer capture keeps drag/pan working outside the canvas, also for touch.
// Pixi handles drawing only. The original world/screen camera math is unchanged.
app.stage.eventMode="none"; state.labels.eventMode="none";
const observer=new ResizeObserver(()=>{
  if(disposed)return;
  app.renderer.resize(Math.max(1,host.clientWidth),Math.max(1,host.clientHeight)); fit();
}); observer.observe(host);
const events=new AbortController(), pointers=new Map();
let gesture=null, hoverPoint=null;
const point=e=>{const b=host.getBoundingClientRect();return {x:e.clientX-b.left,y:e.clientY-b.top};};
const hit=p=>[...state.visible].reverse().find(n=>Math.hypot(
  p.x-state.layer.x-n.x*state.layer.scale.x,p.y-state.layer.y-n.y*state.layer.scale.y)
  <=(radius(n)+12)*state.layer.scale.x);
function hoverAt(p){
  hoverPoint=p;
  const n=hit(p), id=n?.id??null;
  host.style.cursor=n?'pointer':'grab';
  if(id!==state.hovered){state.hovered=id;setVisualTargets();}
  callbacks.onTooltip(n?{text:n.type==="memory"?`${relationLabel(n)}: ${labelFor(n)}`:labelFor(n),
    x:Math.max(8,Math.min(p.x+16,host.clientWidth-190)),y:Math.max(8,Math.min(p.y+14,host.clientHeight-45))}:null);
}
function release(){
  if(state.drag){state.drag.fx=null;state.drag.fy=null;state.simulation?.alphaTarget(0);}
  state.drag=null;state.pan=null;
  host.style.removeProperty('cursor');
}
host.addEventListener("pointerdown",e=>{
  if(e.button!==0)return; const p=point(e);pointers.set(e.pointerId,p);host.setPointerCapture(e.pointerId);
  callbacks.onTooltip(null); if(cameraFrame!=null)cancelAnimationFrame(cameraFrame);
  if(pointers.size===2){release();const [a,b]=[...pointers.values()];gesture={distance:Math.hypot(a.x-b.x,a.y-b.y),center:{x:(a.x+b.x)/2,y:(a.y+b.y)/2}};return;}
  const n=hit(p);state.drag=n??null;
  host.style.cursor='grabbing';
  state.pan={x:p.x,y:p.y,startX:state.layer.x,startY:state.layer.y,moved:false,id:n?.id??null};
  if(n){n.fx=n.x;n.fy=n.y;if(!reduced.matches)state.simulation.alphaTarget(0.22).restart();}
},{signal:events.signal});
host.addEventListener("pointermove",e=>{
  const p=point(e);if(!pointers.has(e.pointerId)){if(e.pointerType!=="touch")hoverAt(p);return;}
  pointers.set(e.pointerId,p);
  if(pointers.size>=2){const [a,b]=[...pointers.values()],distance=Math.hypot(a.x-b.x,a.y-b.y),center={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
    if(gesture){changeZoom(distance/Math.max(1,gesture.distance),gesture.center.x,gesture.center.y);
      state.layer.x+=center.x-gesture.center.x;state.layer.y+=center.y-gesture.center.y;draw();}
    gesture={distance,center};return;}
  if(!state.pan)return;
  if(Math.hypot(p.x-state.pan.x,p.y-state.pan.y)>4)state.pan.moved=true;
  if(state.drag){const local=state.layer.toLocal(p);state.drag.fx=state.drag.x=local.x;state.drag.fy=state.drag.y=local.y;draw();}
  else{state.layer.position.set(state.pan.startX+p.x-state.pan.x,state.pan.startY+p.y-state.pan.y);draw();}
},{signal:events.signal});
const end=e=>{const tapped=e.type==="pointerup"&&pointers.size===1&&state.pan&&!state.pan.moved;
  const id=state.pan?.id; pointers.delete(e.pointerId);release();gesture=null;
  if(tapped){select(id);callbacks.onSelect(id);}
};
for(const name of ["pointerup","pointercancel","lostpointercapture"])host.addEventListener(name,end,{signal:events.signal});
host.addEventListener("pointerleave",()=>{state.hovered=null;callbacks.onTooltip(null);setVisualTargets();},{signal:events.signal});
host.addEventListener("wheel",e=>{e.preventDefault();const p=point(e);changeZoom(e.deltaY<0?1.12:0.89,p.x,p.y);},{passive:false,signal:events.signal});
reduced.addEventListener("change",()=>{if(reduced.matches){state.simulation?.stop();if(state.visualFrame!=null)cancelAnimationFrame(state.visualFrame);state.visualDuration=0;draw();}},{signal:events.signal});

function select(id,focus=false){
  if(state.selected!==id){state.selected=id;
    if(state.mode==="local")setVisible();else setVisualTargets();}
  if(focus&&id)centerOn(id);
}
function hash(value) {
  let result = 0;
  for (const char of value || "") result = (result * 31 + char.codePointAt(0)) >>> 0;
  return result;
}
function tone(node) { return node.type === "memory" ? palette.memory : palette.nodes[hash(node.kind) % palette.nodes.length]; }
function mixColor(a, b, t) {
  const mix = (shift) => Math.round(((a >> shift) & 255) * (1 - t) + ((b >> shift) & 255) * t);
  return (mix(16) << 16) | (mix(8) << 8) | mix(0);
}
function radius(node) {
  return nodeRadius(node);
}
function edgeEnds(edge) { return [typeof edge.source === "object" ? edge.source.id : edge.source,
  typeof edge.target === "object" ? edge.target.id : edge.target]; }
function relationLabel(item) { return item.polarity === "negative" ? `Not ${item.predicate}` : item.predicate; }

function setVisible() {
  release(); pointers.clear(); gesture=null;
  if (cameraFrame != null) cancelAnimationFrame(cameraFrame);
  if (state.simulation) state.simulation.stop();
  state.exportRevision++;
  if (state.exportUrl) URL.revokeObjectURL(state.exportUrl);
  state.exportUrl = null;
  callbacks.onExport(null);
  callbacks.onHint("Drag to explore · Scroll to zoom · Select to inspect");
  state.hovered = null; callbacks.onTooltip(null);
  if (state.visualFrame != null) cancelAnimationFrame(state.visualFrame);
  state.visualFrame = null;
  for (const view of state.views.values()) view.destroy();
  for (const label of state.labelViews.values()) label.destroy();
  for (const label of state.edgeLabels.values()) label.destroy();
  state.views.clear(); state.labelViews.clear(); state.edgeLabels.clear();
  state.visuals.clear(); state.edgeVisuals.clear();
  state.edges.clear();
  state.displayGraph = presentationGraph(state.graph, state.hideSelf);
  state.nodeById = new Map(state.displayGraph.nodes.map((node) => [node.id, node]));
  if (state.selected && !state.nodeById.has(state.selected)) {
    state.selected = null; state.mode = "global"; callbacks.onSelect(null);
  }
  const all = state.displayGraph.nodes;
  let selectedIds = new Set(all.map((node) => node.id));
  if (state.mode === "local" && state.selected) {
    selectedIds = localIds(all, state.displayGraph.edges, state.selected, state.depth);
  }
  state.visible = all.filter((node) => selectedIds.has(node.id)).map((node, index) => {
    const prior = state.positions.get(node.id);
    const angle = index * 2.399963229728653;
    const distance = 35 * Math.sqrt(index + 1);
    return { ...node, x: prior?.x ?? Math.cos(angle) * distance,
      y: prior?.y ?? Math.sin(angle) * distance };
  });
  state.links = state.displayGraph.edges.filter((edge) => {
    const [source, target] = edgeEnds(edge);
    return selectedIds.has(source) && selectedIds.has(target);
  }).map((edge) => ({ ...edge }));
  for (const node of state.visible) {
    const view = new Graphics(); view.eventMode = "static"; view.cursor = "pointer";
    view.hitArea = new Circle(0, 0, radius(node) + 12);
    state.layer.addChild(view); state.views.set(node.id, view);
    state.visuals.set(node.id, { alpha: 1, emphasis: 0, fromAlpha: 1, fromEmphasis: 0,
      targetAlpha: 1, targetEmphasis: 0 });
    if (node.type === "entity") {
      const label = new Text({ text: labelFor(node), style: { fontFamily: '"Plus Jakarta Sans", "Manrope", -apple-system, sans-serif',
        fontSize: 12, fill: palette.label, fontWeight: "600" } });
      label.anchor.set(0.5, 0); label.eventMode = "none"; state.labels.addChild(label);
      state.labelViews.set(node.id, label);
    }
  }
  for (const edge of state.links) {
    const alpha = edge.type === "memory" ? 0.16 : 0.27;
    state.edgeVisuals.set(edge.id, { alpha, emphasis: 0, fromAlpha: alpha, fromEmphasis: 0,
      targetAlpha: alpha, targetEmphasis: 0 });
  }
  const sim = forceSimulation(state.visible)
    .force("links", forceLink(state.links).id((node) => node.id).distance((edge) => edge.type === "memory" ? state.force.linkDistance * 0.55 : state.force.linkDistance).strength((edge) => edge.type === "memory" ? 0.5 : 0.35))
    .force("charge", forceManyBody().strength((node) => node.type === "memory" ? -state.force.repulsion * 0.33 : -state.force.repulsion))
    .force("collision", forceCollide((node) => radius(node) + (node.type === "entity" ? 13 : 7)).iterations(2))
    .force("x", forceX(0).strength(state.force.center / 1000))
    .force("y", forceY(0).strength(state.force.center / 1000))
    .velocityDecay(0.36).alphaDecay(0.035);
  state.simulation = sim;
  const settleTicks = Math.max(35, Math.min(180, Math.floor(9000 / Math.max(1, state.visible.length))));
  sim.stop(); sim.tick(settleTicks); sim.on("tick", draw);
  if (!reduced.matches) sim.alpha(0.32).restart();
  setVisualTargets(false);
  fit(); draw();
  callbacks.onCount(state.visible.length);
}
function neighborhood() {
  const focus = state.hovered || state.selected;
  if (!focus) return null;
  const ids = new Set([focus]);
  for (const edge of state.links) {
    const [source, target] = edgeEnds(edge);
    if (source === focus) ids.add(target);
    if (target === focus) ids.add(source);
  }
  return ids;
}

function setVisualTargets(animate = true) {
  const neighbors = neighborhood();
  const focus = state.hovered || state.selected;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const now = performance.now();
  advanceVisuals(now);
  state.visualStarted = now;
  state.visualDuration = animate && !reduced ? (state.hovered ? 150 : 190) : 0;
  for (const node of state.visible) {
    const visual = state.visuals.get(node.id);
    visual.fromAlpha = visual.alpha; visual.fromEmphasis = visual.emphasis;
    visual.targetAlpha = neighbors && !neighbors.has(node.id) ? 0.17 : 1;
    visual.targetEmphasis = node.id === focus ? 1 : neighbors?.has(node.id) ? 0.25 : 0;
  }
  for (const edge of state.links) {
    const visual = state.edgeVisuals.get(edge.id);
    const [source, target] = edgeEnds(edge);
    const active = focus && (source === focus || target === focus);
    visual.fromAlpha = visual.alpha; visual.fromEmphasis = visual.emphasis;
    visual.targetAlpha = neighbors ? (active ? 0.88 : 0.055) : edge.type === "memory" ? 0.16 : 0.27;
    visual.targetEmphasis = active ? 1 : 0;
  }
  if (state.visualFrame != null) cancelAnimationFrame(state.visualFrame);
  const frame = (time) => {
    state.visualFrame = null;
    draw();
    if (time - state.visualStarted < state.visualDuration) state.visualFrame = requestAnimationFrame(frame);
  };
  draw();
  if (state.visualDuration) state.visualFrame = requestAnimationFrame(frame);
}

function advanceVisuals(now) {
  const t = state.visualDuration ? Math.min(1, (now - state.visualStarted) / state.visualDuration) : 1;
  const ease = t * t * (3 - 2 * t);
  for (const visual of state.visuals.values()) {
    visual.alpha = visual.fromAlpha + (visual.targetAlpha - visual.fromAlpha) * ease;
    visual.emphasis = visual.fromEmphasis + (visual.targetEmphasis - visual.fromEmphasis) * ease;
  }
  for (const visual of state.edgeVisuals.values()) {
    visual.alpha = visual.fromAlpha + (visual.targetAlpha - visual.fromAlpha) * ease;
    visual.emphasis = visual.fromEmphasis + (visual.targetEmphasis - visual.fromEmphasis) * ease;
  }
}

function labelBand(scale) {
  const thresholds = [0.65, 1.05];
  let band = state.labelBand;
  while (band < thresholds.length && scale > thresholds[band] + 0.07) band++;
  while (band > 0 && scale < thresholds[band - 1] - 0.07) band--;
  state.labelBand = band;
  return band;
}

function screenPoint(x, y) {
  return { x: state.layer.position.x + x * state.layer.scale.x,
    y: state.layer.position.y + y * state.layer.scale.y };
}

function draw() {
  if (!state.app) return;
  advanceVisuals(performance.now());
  const neighbors = neighborhood();
  const focus = state.hovered || state.selected;
  const scale = state.layer.scale.x;
  const band = labelBand(scale);
  state.edges.clear();
  for (const edge of state.links) {
    const source = edge.source, target = edge.target;
    if (!source || !target || typeof source !== "object" || typeof target !== "object") continue;
    const visual = state.edgeVisuals.get(edge.id);
    state.edges.moveTo(source.x, source.y).lineTo(target.x, target.y).stroke({
      color: mixColor(edge.type === "memory" ? palette.memoryEdge : palette.edge, palette.accent, visual.emphasis),
      width: (edge.type === "memory" ? 0.75 : 1) + visual.emphasis * 0.75, alpha: Math.min(1, visual.alpha * palette.edgeAlpha),
    });
  }
  for (const node of state.visible) {
    const view = state.views.get(node.id); if (!view) continue;
    state.positions.set(node.id, { x: node.x, y: node.y });
    const bright = node.id === state.selected || node.id === state.hovered;
    const visual = state.visuals.get(node.id);
    const alpha = visual.alpha, accent = visual.emphasis;
    const r = radius(node), color = tone(node);
    view.clear();
    if (node.type === "entity") {
      view.circle(0, 0, r + 12 + accent * 5).fill({ color, alpha: (0.04 + accent * 0.06) * alpha });
      view.circle(0, 0, r + 4 + accent * 3).fill({ color, alpha: (0.08 + accent * 0.12) * alpha });
      view.circle(0, 0, r).fill({ color, alpha: (0.85 + accent * 0.15) * alpha });
      view.circle(0, 0, r + (node.id === state.selected ? 1.5 * accent : 0)).stroke({
        color: palette.ring, alpha: (0.15 + accent * 0.65) * alpha, width: 0.8 + accent * 1.0 });
    } else {
      view.circle(0, 0, r + accent * 7).fill({ color, alpha: (0.45 - accent * 0.25) * alpha });
      view.circle(0, 0, r + accent * 1.5).fill({ color: mixColor(color, palette.ring, accent),
        alpha: (0.7 + accent * 0.3) * alpha });
    }
    view.position.set(node.x, node.y);
    const label = state.labelViews.get(node.id);
    if (label) {
      label.text = labelFor(node);
      label.style.fill = palette.label;
      const important = (node.degree || 0) >= 3 || (node.memory_count || 0) >= 3;
      const hub = (node.degree || 0) >= 7 || (node.memory_count || 0) >= 9;
      const dim = alpha < 0.5;
      label.visible = bright || (!dim && (band >= 2 || band >= 1 && important || hub));
      label.alpha = bright ? 1 : 0.8 * alpha;
      const point = screenPoint(node.x, node.y + r + 8 / scale);
      label.position.set(point.x, point.y);
    }
  }
  layoutLabels(neighbors);
  drawEdgeLabels(focus);
}

function layoutLabels(neighbors) {
  const candidates = state.visible.filter((node) => state.labelViews.get(node.id)?.visible)
    .sort((a, b) => {
      const priority = (node) => (node.id === state.selected || node.id === state.hovered ? 10000 : 0)
        + (node.id !== state.selected && node.id !== state.hovered && neighbors?.has(node.id) ? 1000 : 0)
        + (node.degree || 0) * 5 + (node.memory_count || 0);
      return priority(b) - priority(a);
    }).slice(0, 90);
  const occupied = [];
  const allowed = new Set();
  for (const node of candidates) {
    const label = state.labelViews.get(node.id);
    const x = label.position.x, y = label.position.y;
    const half = label.width / 2 + 6;
    const rect = { left: x - half, right: x + half, top: y - 3, bottom: y + label.height + 5 };
    const chosen = node.id === state.selected || node.id === state.hovered;
    if (!chosen && occupied.some((other) => rect.left < other.right && rect.right > other.left
      && rect.top < other.bottom && rect.bottom > other.top)) continue;
    occupied.push(rect); allowed.add(node.id);
  }
  for (const [id, label] of state.labelViews) label.visible = allowed.has(id);
}

function drawEdgeLabels(focus) {
  const candidates = state.links.filter((edge) => edge.type === "relation" &&
    (focus ? edge.source.id === focus || edge.target.id === focus : state.mode === "local" && state.links.length < 18));
  const labeled = candidates.slice(0, candidates.length > 8 ? 4 : 8);
  const wanted = new Set(labeled.map((edge) => edge.id));
  for (const [id, label] of state.edgeLabels) {
    if (!wanted.has(id)) { label.destroy(); state.edgeLabels.delete(id); }
  }
  for (const edge of labeled) {
    let label = state.edgeLabels.get(edge.id);
    if (!label) {
      label = new Text({ text: relationLabel(edge), style: { fontFamily: '"Plus Jakarta Sans", "Manrope", -apple-system, sans-serif',
        fontSize: 10, fill: palette.edgeLabel } });
      label.anchor.set(0.5); label.alpha = 0.78; label.eventMode = "none";
      state.labels.addChild(label); state.edgeLabels.set(edge.id, label);
    }
    label.style.fill = palette.edgeLabel;
    const point = screenPoint((edge.source.x + edge.target.x) / 2, (edge.source.y + edge.target.y) / 2);
    label.position.set(point.x, point.y - 11);
  }
}
function fit() {
  if (!state.visible.length || !state.app) return;
  const xs = state.visible.map((node) => node.x), ys = state.visible.map((node) => node.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const width = state.app.screen.width, height = state.app.screen.height;
  const sidebarInset = state.selected && !showcase && width > 900 ? 260 : 0;
  const scale = Math.max(0.12, Math.min(1.45, Math.min((width - (width > 700 ? 340 : 60) - sidebarInset) / Math.max(180, maxX - minX + 120),
    (height - (width > 700 ? 170 : 270)) / Math.max(180, maxY - minY + 120))));
  state.layer.scale.set(scale);
  state.layer.position.set((width - sidebarInset) / 2 - (minX + maxX) / 2 * scale,
    height * (state.selected && width <= 800 ? 0.4 : 0.5) - (minY + maxY) / 2 * scale);
  draw();
}
function centerOn(id) {
  const node = state.visible.find((item) => item.id === id);
  if (!node) { if (state.mode === "local") setVisible(); return; }
  const targetX = state.app.screen.width * (state.app.screen.width > 900 ? 0.43 : 0.5) - node.x * state.layer.scale.x;
  const targetY = state.app.screen.height * (state.app.screen.width <= 800 ? 0.4 : 0.48) - node.y * state.layer.scale.y;
  const fromX = state.layer.position.x, fromY = state.layer.position.y;
  if (cameraFrame != null) cancelAnimationFrame(cameraFrame);
  const started = performance.now();
  const animate = (now) => {
    const t = Math.min(1, (now - started) / 350), ease = 1 - (1 - t) ** 3;
    state.layer.position.set(fromX + (targetX - fromX) * ease, fromY + (targetY - fromY) * ease);
    draw();
    if (t < 1) cameraFrame = requestAnimationFrame(animate);
  };
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    state.layer.position.set(targetX, targetY); draw();
  } else cameraFrame = requestAnimationFrame(animate);
}

function changeZoom(factor, x = state.app.screen.width / 2, y = state.app.screen.height / 2) {
  if (cameraFrame != null) cancelAnimationFrame(cameraFrame);
  const previous = state.layer.scale.x, next = Math.max(0.12, Math.min(3.2, previous * factor));
  const worldX = (x - state.layer.position.x) / previous, worldY = (y - state.layer.position.y) / previous;
  state.layer.scale.set(next);
  state.layer.position.set(x - worldX * next, y - worldY * next);
  draw();
}

function updateForces() {
  state.simulation.force("links").distance((edge) => edge.type === "memory"
    ? state.force.linkDistance * 0.55 : state.force.linkDistance);
  state.simulation.force("charge").strength((node) => node.type === "memory"
    ? -state.force.repulsion * 0.33 : -state.force.repulsion);
  state.simulation.force("x").strength(state.force.center / 1000);
  state.simulation.force("y").strength(state.force.center / 1000);
  if (reduced.matches) { state.simulation.stop().alpha(0.45).tick(60); draw(); }
  else state.simulation.alpha(0.45).restart();
}
function exportImage(width, height) {
  if (!state.visible.length || ![1920, 2160, 2560, 3840].includes(width) || height > 2160) return;
  const exportRevision = state.exportRevision;
  callbacks.onHint(`Rendering ${width} × ${height} PNG locally…`);
  const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d"); if (!ctx) return;
  const unit = width / 1920;
  const background = ctx.createRadialGradient(width * 0.5, height * 0.45, 0, width * 0.5, height * 0.45, width * 0.65);
  background.addColorStop(0, palette.background[0]); background.addColorStop(0.65, palette.background[1]); background.addColorStop(1, palette.background[2]);
  ctx.fillStyle = background; ctx.fillRect(0, 0, width, height);
  const xs = state.visible.map((node) => node.x), ys = state.visible.map((node) => node.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const scale = Math.min((width - 300 * unit) / Math.max(180, maxX - minX + 140),
    (height - 240 * unit) / Math.max(180, maxY - minY + 140));
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const point = (node) => ({ x: width / 2 + (node.x - cx) * scale, y: height / 2 + (node.y - cy) * scale });
  for (const edge of state.links) {
    const a = point(edge.source), b = point(edge.target);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = edge.type === "memory" ? palette.exportMemoryEdge : palette.exportEdge;
    ctx.lineWidth = (edge.type === "memory" ? 0.7 : 1.1) * unit; ctx.stroke();
  }
  const sorted = [...state.visible].sort((a, b) => (a.type === "entity") - (b.type === "entity"));
  for (const node of sorted) {
    const p = point(node), r = radius(node) * unit * (node.type === "memory" ? 0.8 : 1);
    const color = colorHex(tone(node));
    if (node.type === "entity") {
      const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 3.1);
      glow.addColorStop(0, `${color}44`); glow.addColorStop(1, `${color}00`);
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(p.x, p.y, r * 3.1, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = node.type === "entity" ? color : colorHex(palette.memory);
    ctx.globalAlpha = node.type === "entity" ? 0.92 : 0.66;
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    if (node.type === "entity" && ((node.degree || 0) >= 2 || state.visible.length < 45 || node.id === state.selected)) {
      ctx.fillStyle = colorHex(palette.label); ctx.font = `600 ${Math.round(12 * unit)}px "Plus Jakarta Sans", "Manrope", sans-serif`;
      ctx.textAlign = "center"; ctx.fillText(labelFor(node), p.x, p.y + r + 19 * unit, 230 * unit);
    }
  }
  ctx.fillStyle = colorHex(palette.accent); ctx.font = `600 ${Math.round(26 * unit)}px "Plus Jakarta Sans", "Manrope", sans-serif`;
  ctx.textAlign = "left"; ctx.fillText("✦", 44 * unit, height - 51 * unit);
  ctx.fillStyle = colorHex(palette.label); ctx.font = `700 ${Math.round(14 * unit)}px "Plus Jakarta Sans", "Manrope", sans-serif`;
  ctx.fillText("Memory Map", 82 * unit, height - 63 * unit);
  ctx.fillStyle = palette.exportMuted; ctx.font = `500 ${Math.round(10 * unit)}px "Plus Jakarta Sans", "Manrope", sans-serif`;
  ctx.fillText(`${state.displayGraph.stats.memories} MEMORIES  ·  ${state.displayGraph.stats.entities} ENTITIES  ·  ${state.displayGraph.stats.connections} CONNECTIONS`,
    82 * unit, height - 43 * unit);
  ctx.textAlign = "right"; ctx.fillText("MROYA", width - 44 * unit, height - 45 * unit);
  canvas.toBlob(async (blob) => {
    if (exportRevision !== state.exportRevision) return;
    if (!blob) { callbacks.onHint("Image export is unavailable in this browser."); return; }
    const dimensions = pngDimensions(await blob.slice(0, 24).arrayBuffer());
    if (exportRevision !== state.exportRevision) return;
    if (dimensions?.width !== width || dimensions.height !== height) {
      callbacks.onHint("Image export failed dimension verification.");
      return;
    }
    if (state.exportUrl) URL.revokeObjectURL(state.exportUrl);
    state.exportUrl = URL.createObjectURL(blob);
    callbacks.onExport({url:state.exportUrl,name:`mroya-memory-map-${width}x${height}.png`});
    callbacks.onHint(`${width} × ${height} PNG verified · download locally`);
  }, "image/png");
}


return {
  /** Redraw presentation only. No scene rebuild, force restart or camera operation.
   * @param {{theme:'light'|'dark',displayName:string}} next */
  setPresentation(next){
    if(disposed || theme===next.theme && displayName===next.displayName)return;
    theme=next.theme;displayName=next.displayName;
    const styles=getComputedStyle(host);
    palette=paletteForTheme(theme,token=>styles.getPropertyValue(token));
    // A prepared/in-flight PNG belongs to the old theme/name.
    state.exportRevision++;
    if(state.exportUrl)URL.revokeObjectURL(state.exportUrl);
    state.exportUrl=null;callbacks.onExport(null);
    callbacks.onHint("Drag to explore · Scroll to zoom · Select to inspect");
    draw();
    if(state.hovered && hoverPoint){
      const node=state.visible.find(n=>n.id===state.hovered);
      if(node)callbacks.onTooltip({text:node.type==='memory'?`${relationLabel(node)}: ${labelFor(node)}`:labelFor(node),
        x:Math.max(8,Math.min(hoverPoint.x+16,host.clientWidth-190)),y:Math.max(8,Math.min(hoverPoint.y+14,host.clientHeight-45))});
    }
  },
  /** @param {import('./mapModel').RenderGraph} graph */
  setGraph(graph){if(disposed)return;state.graph=graph;setVisible();},
  /** @param {string|null} id */
  select(id,focus=false){if(!disposed)select(id,focus);},
  /** @param {{mode:'global'|'local',depth:number,hideSelf:boolean,showcase:boolean}} options */
  setOptions(options){if(disposed)return;const changed=state.mode!==options.mode||state.depth!==options.depth||state.hideSelf!==options.hideSelf;
    state.mode=options.mode;state.depth=options.depth;state.hideSelf=options.hideSelf;showcase=options.showcase;
    if(changed&&state.graph)setVisible();},
  /** @param {{repulsion:number,linkDistance:number,center:number}} force */
  setForce(force){if(disposed)return;const changed=Object.keys(defaults).some(key=>state.force[key]!==force[key]);
    state.force={...force};if(changed&&state.simulation)updateForces();},
  fit, zoom:changeZoom, exportImage,
  destroy(){if(disposed)return;disposed=true;state.exportRevision++;state.simulation?.stop();
    if(state.visualFrame!=null)cancelAnimationFrame(state.visualFrame);if(cameraFrame!=null)cancelAnimationFrame(cameraFrame);
    events.abort();observer.disconnect();pointers.clear();state.positions.clear();
    host.style.removeProperty('cursor');
    if(state.exportUrl)URL.revokeObjectURL(state.exportUrl);
    app.destroy(true,{children:true});state.app=null;}
};
}
