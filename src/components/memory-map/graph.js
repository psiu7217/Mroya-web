// Ported from psiu7217/Personal-Memory-OS @ 38892fa5e25e30c908e0c8ad5c2032d02d248d36.
// Pure presentation-graph operations shared by interactive modes.

/** @param {import('./mapModel').RenderGraph} graph
 * @returns {import('./mapModel').RenderGraph}
 */
export function presentationGraph(graph, hideSelf = false) {
  if (!hideSelf) return graph;
  const selfIds = new Set(graph.nodes.filter((node) => node.type === "entity" && node.is_self === true)
    .map((node) => node.id));
  const nodes = graph.nodes.filter((node) => !selfIds.has(node.id)
    && !(node.type === "memory" && selfIds.has(node.subject)));
  const ids = new Set(nodes.map((node) => node.id));
  const edges = graph.edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target));
  const degree = new Map(nodes.map((node) => [node.id, 0]));
  const memories = new Map(nodes.map((node) => [node.id, 0]));
  for (const edge of edges) {
    degree.set(edge.source, degree.get(edge.source) + 1);
    if (edge.type === "relation") {
      degree.set(edge.target, degree.get(edge.target) + 1);
      memories.set(edge.target, memories.get(edge.target) + 1);
    }
    memories.set(edge.source, memories.get(edge.source) + 1);
  }
  return {
    nodes: nodes.map((node) => node.type === "entity"
      ? { ...node, degree: degree.get(node.id), memory_count: memories.get(node.id) } : node),
    edges,
    stats: { entities: nodes.filter((node) => node.type === "entity").length,
      memories: edges.length, connections: edges.filter((edge) => edge.type === "relation").length,
      truncated: graph.stats.truncated },
  };
}

export function localIds(nodes, edges, root, depth) {
  const known = new Set(nodes.map((node) => node.id));
  if (!known.has(root)) return new Set();
  let selected = new Set([root]);
  for (let hop = 0; hop < Math.min(2, Math.max(1, depth)); hop++) {
    const next = new Set(selected);
    for (const edge of edges) {
      const source = typeof edge.source === "object" ? edge.source.id : edge.source;
      const target = typeof edge.target === "object" ? edge.target.id : edge.target;
      if (selected.has(source) && known.has(target)) next.add(target);
      if (selected.has(target) && known.has(source)) next.add(source);
    }
    selected = next;
  }
  return selected;
}

export function nodeRadius(node) {
  if (node.type === "memory") return 3.1;
  return Math.min(22, 5.5 + 2.8 * Math.sqrt((node.degree || 0) + (node.memory_count || 0) * 0.4));
}

export function pngDimensions(header) {
  const bytes = new Uint8Array(header);
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < 24 || !signature.every((byte, index) => bytes[index] === byte)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}
