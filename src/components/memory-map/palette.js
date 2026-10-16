// Dark values match the approved Studio renderer. Light follows Mroya's warm tokens.
export const mapPalettes = {
  dark: {
    nodes: [0xd49b42, 0xd07252, 0xe2b260, 0x8fa37a, 0xc28d58, 0x94879e],
    memory: 0xa89f91, edge: 0x8e8072, memoryEdge: 0x6e6255, accent: 0xecc682,
    label: 0xf4efea, edgeLabel: 0xd9cfc1, ring: 0xfff2dc, edgeAlpha: 1,
    background: ['#23201b', '#1a1714', '#12100e'],
    exportEdge: '#ecc68255', exportMemoryEdge: '#a89f9140', exportMuted: '#a89f91',
  },
  light: {
    nodes: [0xa46b19, 0xad5338, 0x997025, 0x607744, 0x996436, 0x77658b],
    memory: 0x827566, edge: 0x827566, memoryEdge: 0x827566, accent: 0x7e5301,
    label: 0x252019, edgeLabel: 0x655b4b, ring: 0x7e5301, edgeAlpha: 1.5,
    background: ['#ffffff', '#fbf8f3', '#f3efe7'],
    exportEdge: '#7e530170', exportMemoryEdge: '#82756666', exportMuted: '#655b4b',
  },
};

export const colorHex = color => `#${color.toString(16).padStart(6, '0')}`;

/** Read shared CSS tokens for the light canvas; retain approved dark values verbatim. */
export function paletteForTheme(theme, getToken = () => '') {
  const base = mapPalettes[theme];
  if (theme === 'dark') return base;
  const read = (token, fallback) => {
    const value = getToken(token).trim();
    return /^#[\da-f]{6}$/i.test(value) ? parseInt(value.slice(1), 16) : fallback;
  };
  const accent = read('--mroya-primary', base.accent);
  const memory = read('--mroya-input-outline', base.memory);
  return {...base, accent, memory, edge: memory, memoryEdge: memory, ring: accent,
    label: read('--mroya-text', base.label), edgeLabel: read('--mroya-text-muted', base.edgeLabel),
    background: ['--mroya-surface', '--mroya-bg', '--mroya-surface-muted'].map((token, i) => colorHex(read(token, parseInt(base.background[i].slice(1), 16)))),
    exportEdge: `${colorHex(accent)}70`, exportMemoryEdge: `${colorHex(memory)}66`,
    exportMuted: colorHex(read('--mroya-text-muted', base.edgeLabel)),
  };
}

/** Presentation override only: never identify a user by the string "Self". */
export function mapNodeLabel(node, displayName) {
  return node.is_self === true && displayName ? displayName : node.label;
}
