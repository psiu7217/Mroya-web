import test from "node:test";
import assert from "node:assert/strict";
import { localIds, nodeRadius, pngDimensions, presentationGraph } from "../src/components/memory-map/graph.js";

const map = {
  nodes: [
    { id: "entity:self", type: "entity", label: "Me", is_self: true, degree: 3, memory_count: 3 },
    { id: "entity:other", type: "entity", label: "Self", is_self: false, degree: 2, memory_count: 2 },
    { id: "entity:friend", type: "entity", label: "Friend", degree: 1, memory_count: 1 },
    { id: "memory:self", type: "memory", subject: "entity:self" },
    { id: "memory:other", type: "memory", subject: "entity:other" },
  ],
  edges: [
    { id: "relation:self", type: "relation", source: "entity:self", target: "entity:other" },
    { id: "relation:friend", type: "relation", source: "entity:other", target: "entity:friend" },
    { id: "memory-link:self", type: "memory", source: "entity:self", target: "memory:self" },
    { id: "memory-link:other", type: "memory", source: "entity:other", target: "memory:other" },
  ],
  stats: { entities: 3, memories: 4, connections: 2, truncated: false },
};

test("Hide Self filters structurally, preserves other facts, and restores without mutation", () => {
  const before = JSON.stringify(map);
  assert.equal(presentationGraph(map).nodes.length, 5);
  const filtered = presentationGraph(map, true);
  assert.deepEqual(filtered.nodes.map((node) => node.id),
    ["entity:other", "entity:friend", "memory:other"]);
  assert.deepEqual(filtered.edges.map((edge) => edge.id), ["relation:friend", "memory-link:other"]);
  assert.deepEqual(filtered.stats, { entities: 2, memories: 2, connections: 1, truncated: false });
  assert.equal(filtered.nodes[0].degree, 2);
  assert.deepEqual([...localIds(filtered.nodes, filtered.edges, "entity:other", 1)].sort(),
    ["entity:friend", "entity:other", "memory:other"]);
  assert.deepEqual([...localIds(filtered.nodes, filtered.edges, "entity:self", 2)], []);
  assert.equal(presentationGraph(map, false), map);
  assert.equal(JSON.stringify(map), before);
});

test("local graph stays in the already authorized bounded payload", () => {
  const nodes = ["self", "spouse", "tea", "other"].map((id) => ({ id }));
  const edges = [{ source: "self", target: "spouse" }, { source: "spouse", target: "tea" },
    { source: "tea", target: "foreign" }];
  assert.deepEqual([...localIds(nodes, edges, "self", 1)].sort(), ["self", "spouse"]);
  assert.deepEqual([...localIds(nodes, edges, "self", 2)].sort(), ["self", "spouse", "tea"]);
  assert.deepEqual([...localIds(nodes, edges, "foreign", 2)], []);
  assert.ok(!localIds(nodes, edges, "self", 2).has("foreign"));
});

test("visual weight is bounded and depends on density rather than kind", () => {
  assert.equal(nodeRadius({ type: "entity", kind: "unregistered", degree: 0, memory_count: 0 }), 5.5);
  assert.ok(nodeRadius({ type: "entity", kind: "unregistered", degree: 8, memory_count: 20 }) > 5.5);
  assert.equal(nodeRadius({ type: "entity", degree: 10000, memory_count: 10000 }), 22);
  assert.equal(nodeRadius({ type: "memory" }), 3.1);
});

test("encoded PNG dimensions are checked from the file header", () => {
  const header = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13,
    73, 72, 68, 82, 0, 0, 15, 0, 0, 0, 8, 112]);
  assert.deepEqual(pngDimensions(header), { width: 3840, height: 2160 });
  header[0] = 0;
  assert.equal(pngDimensions(header), null);
});
