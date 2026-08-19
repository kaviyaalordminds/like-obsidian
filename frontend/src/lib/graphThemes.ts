// Graph theme engine (Part 5/6): each theme is a flat set of colors the
// graph renderer maps directly onto Cytoscape style + the SVG cinematic
// overlay. Built-ins are read-only; custom themes are user-created copies
// stored in settingsStore and persisted per-vault, using the exact same
// shape so the renderer never has to special-case "is this custom".

export interface GraphThemeColors {
  background: string
  node: string
  nodeSelected: string
  nodeHover: string
  edge: string
  edgeSelected: string
  text: string
  cluster: string
  orphan: string
  unresolved: string
  tag: string
  folder: string
  glow: string
  grid: string
}

export interface GraphTheme {
  id: string
  name: string
  builtin: boolean
  colors: GraphThemeColors
  baseId?: string // for custom themes: the built-in theme "Reset" reverts to
}

function theme(id: string, name: string, colors: GraphThemeColors): GraphTheme {
  return { id, name, builtin: true, colors }
}

export const BUILTIN_GRAPH_THEMES: GraphTheme[] = [
  theme('obsidian-classic', 'Obsidian Classic', {
    background: '#0e0e12', node: '#a48fff', nodeSelected: '#c9b8ff', nodeHover: '#b8a4ff',
    edge: '#3a3a44', edgeSelected: '#a48fff', text: '#c9c9d4', cluster: '#6a5acd',
    orphan: '#55505f', unresolved: '#8f7f3a', tag: '#7a6bd6', folder: '#4a4356',
    glow: '#a48fff', grid: '#1a1a20',
  }),
  theme('midnight', 'Midnight', {
    background: '#070a14', node: '#4f7fff', nodeSelected: '#8fb0ff', nodeHover: '#6f97ff',
    edge: '#20263c', edgeSelected: '#4f7fff', text: '#b8c2e0', cluster: '#2f4fb0',
    orphan: '#3a4260', unresolved: '#8f7f3a', tag: '#5c7fe0', folder: '#232a4a',
    glow: '#4f7fff', grid: '#10142a',
  }),
  theme('aurora', 'Aurora', {
    background: '#081410', node: '#3ee6b4', nodeSelected: '#9d6bff', nodeHover: '#5fe0ff',
    edge: '#1e3a30', edgeSelected: '#3ee6b4', text: '#c4f0e2', cluster: '#2fae8a',
    orphan: '#2c4a3e', unresolved: '#c99a3a', tag: '#9d6bff', folder: '#1e3a30',
    glow: '#3ee6b4', grid: '#0f2018',
  }),
  theme('cyber', 'Cyber', {
    background: '#0a0012', node: '#00e5ff', nodeSelected: '#ff2fd8', nodeHover: '#5cf2ff',
    edge: '#2a1a3a', edgeSelected: '#ff2fd8', text: '#e0d4f0', cluster: '#ff2fd8',
    orphan: '#3a2a4a', unresolved: '#e0a800', tag: '#00e5ff', folder: '#2a1a3a',
    glow: '#00e5ff', grid: '#160a24',
  }),
  theme('arc-core', 'Arc Core', {
    background: '#060c10', node: '#3ecbff', nodeSelected: '#8fe6ff', nodeHover: '#63d7ff',
    edge: '#122430', edgeSelected: '#3ecbff', text: '#bfe4f0', cluster: '#1f7fa8',
    orphan: '#1e3038', unresolved: '#d69a3a', tag: '#63d7ff', folder: '#122430',
    glow: '#3ecbff', grid: '#0c1a20',
  }),
  theme('reactor-amber', 'Reactor Amber', {
    background: '#0f0904', node: '#ff9d3e', nodeSelected: '#ffc98f', nodeHover: '#ffb563',
    edge: '#2e1e0e', edgeSelected: '#ff9d3e', text: '#f0dcc4', cluster: '#c9701f',
    orphan: '#3a2c1c', unresolved: '#d64545', tag: '#ffb563', folder: '#2e1e0e',
    glow: '#ff9d3e', grid: '#1a1108',
  }),
  theme('crimson', 'Crimson', {
    background: '#100708', node: '#ff4f5e', nodeSelected: '#ff9aa3', nodeHover: '#ff717d',
    edge: '#2e1418', edgeSelected: '#ff4f5e', text: '#f0c4c8', cluster: '#a8283a',
    orphan: '#3a1e22', unresolved: '#d6a03a', tag: '#ff717d', folder: '#2e1418',
    glow: '#ff4f5e', grid: '#1a0d0f',
  }),
  theme('emerald', 'Emerald', {
    background: '#050f0a', node: '#3ecf7d', nodeSelected: '#8fe6b5', nodeHover: '#63dd9a',
    edge: '#122a1c', edgeSelected: '#3ecf7d', text: '#c4f0d4', cluster: '#1f8a53',
    orphan: '#1e3828', unresolved: '#d6b03a', tag: '#63dd9a', folder: '#122a1c',
    glow: '#3ecf7d', grid: '#0c1c12',
  }),
  theme('violet', 'Violet', {
    background: '#0c0714', node: '#9d6bff', nodeSelected: '#c8aeff', nodeHover: '#b28eff',
    edge: '#241a3a', edgeSelected: '#9d6bff', text: '#dcccf0', cluster: '#6a3fc9',
    orphan: '#2e2440', unresolved: '#d6a03a', tag: '#b28eff', folder: '#241a3a',
    glow: '#9d6bff', grid: '#160e24',
  }),
  theme('solar', 'Solar', {
    background: '#100c04', node: '#ffcf3e', nodeSelected: '#ffe694', nodeHover: '#ffdb63',
    edge: '#2e2610', edgeSelected: '#ffcf3e', text: '#f0e4c4', cluster: '#c99a1f',
    orphan: '#3a3018', unresolved: '#d65a45', tag: '#ffdb63', folder: '#2e2610',
    glow: '#ffcf3e', grid: '#1a1608',
  }),
  theme('ocean', 'Ocean', {
    background: '#040d14', node: '#2fb5e0', nodeSelected: '#8fdcff', nodeHover: '#5cc9f0',
    edge: '#102530', edgeSelected: '#2fb5e0', text: '#bfe4f0', cluster: '#1a6f94',
    orphan: '#1a2e38', unresolved: '#d6a03a', tag: '#5cc9f0', folder: '#102530',
    glow: '#2fb5e0', grid: '#0a1a24',
  }),
  theme('forest', 'Forest', {
    background: '#080f08', node: '#5c9d4a', nodeSelected: '#a3d68f', nodeHover: '#7fbd63',
    edge: '#1c2a18', edgeSelected: '#5c9d4a', text: '#d4e8c4', cluster: '#3f7030',
    orphan: '#243a20', unresolved: '#c9963a', tag: '#7fbd63', folder: '#1c2a18',
    glow: '#5c9d4a', grid: '#101c0e',
  }),
  theme('monochrome', 'Monochrome', {
    background: '#0a0a0a', node: '#d8d8d8', nodeSelected: '#ffffff', nodeHover: '#eaeaea',
    edge: '#333333', edgeSelected: '#d8d8d8', text: '#c0c0c0', cluster: '#888888',
    orphan: '#3a3a3a', unresolved: '#8a8a8a', tag: '#aaaaaa', folder: '#2a2a2a',
    glow: '#d8d8d8', grid: '#161616',
  }),
  theme('paper', 'Paper', {
    background: '#f7f5ef', node: '#3a3a3a', nodeSelected: '#111111', nodeHover: '#5a5a5a',
    edge: '#d4cfc0', edgeSelected: '#3a3a3a', text: '#2a2a2a', cluster: '#8a8272',
    orphan: '#c4bfae', unresolved: '#a8722f', tag: '#5a5a5a', folder: '#d4cfc0',
    glow: '#3a3a3a', grid: '#e8e3d6',
  }),
  theme('glass', 'Glass', {
    background: '#0e1218', node: '#bfe0ff', nodeSelected: '#ffffff', nodeHover: '#e0f0ff',
    edge: '#2a3644', edgeSelected: '#bfe0ff', text: '#dceaf5', cluster: '#7fa8c9',
    orphan: '#2e3a48', unresolved: '#d6b03a', tag: '#e0f0ff', folder: '#2a3644',
    glow: '#bfe0ff', grid: '#141c26',
  }),
  theme('neon', 'Neon', {
    background: '#08000a', node: '#ff00e5', nodeSelected: '#00ffea', nodeHover: '#ff5cf0',
    edge: '#2a0a2e', edgeSelected: '#00ffea', text: '#f0d4ec', cluster: '#00ffea',
    orphan: '#3a1a3e', unresolved: '#ffe500', tag: '#ff5cf0', folder: '#2a0a2e',
    glow: '#ff00e5', grid: '#140416',
  }),
  theme('ice', 'Ice', {
    background: '#f0f8ff', node: '#2f7fc9', nodeSelected: '#0a4a80', nodeHover: '#4f9de0',
    edge: '#c4dcf0', edgeSelected: '#2f7fc9', text: '#1a3a52', cluster: '#5c9dcf',
    orphan: '#b8ccdd', unresolved: '#c98a2f', tag: '#4f9de0', folder: '#c4dcf0',
    glow: '#2f7fc9', grid: '#dcecf7',
  }),
  theme('stealth', 'Stealth', {
    background: '#050505', node: '#4a4a4a', nodeSelected: '#9a9a9a', nodeHover: '#6a6a6a',
    edge: '#181818', edgeSelected: '#4a4a4a', text: '#787878', cluster: '#3a3a3a',
    orphan: '#1e1e1e', unresolved: '#5a5030', tag: '#6a6a6a', folder: '#181818',
    glow: '#4a4a4a', grid: '#0d0d0d',
  }),
  theme('quantum', 'Quantum', {
    background: '#08081a', node: '#7f5cff', nodeSelected: '#5cd6ff', nodeHover: '#a08fff',
    edge: '#1e1e3a', edgeSelected: '#5cd6ff', text: '#d0ccf0', cluster: '#5c3fc9',
    orphan: '#26264a', unresolved: '#d6a03a', tag: '#5cd6ff', folder: '#1e1e3a',
    glow: '#7f5cff', grid: '#12122a',
  }),
  theme('holographic', 'Holographic', {
    background: '#0a0e14', node: '#5cffe0', nodeSelected: '#ff5cd6', nodeHover: '#5c9dff',
    edge: '#1e2a36', edgeSelected: '#ff5cd6', text: '#d4f0ec', cluster: '#5c9dff',
    orphan: '#26343e', unresolved: '#ffd65c', tag: '#ff5cd6', folder: '#1e2a36',
    glow: '#5cffe0', grid: '#121a22',
  }),
]

export function getGraphTheme(id: string, custom: GraphTheme[] = []): GraphTheme {
  return custom.find((t) => t.id === id) ?? BUILTIN_GRAPH_THEMES.find((t) => t.id === id) ?? BUILTIN_GRAPH_THEMES[0]
}

export function duplicateTheme(base: GraphTheme, newName: string): GraphTheme {
  return {
    id: `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: newName,
    builtin: false,
    colors: { ...base.colors },
    baseId: base.builtin ? base.id : base.baseId,
  }
}

const REQUIRED_COLOR_KEYS: (keyof GraphThemeColors)[] = [
  'background', 'node', 'nodeSelected', 'nodeHover', 'edge', 'edgeSelected',
  'text', 'cluster', 'orphan', 'unresolved', 'tag', 'folder', 'glow', 'grid',
]

/** Validates a theme JSON blob from an import — never trust file input to
 * already match the shape, and never silently fall back to defaults for a
 * missing color (that would produce a theme the user didn't actually
 * import). */
export function parseImportedTheme(raw: unknown): GraphTheme | { error: string } {
  if (typeof raw !== 'object' || raw === null) return { error: 'Not a valid theme file' }
  const obj = raw as Record<string, unknown>
  const name = typeof obj.name === 'string' && obj.name.trim() ? obj.name.trim() : 'Imported theme'
  const colors = obj.colors
  if (typeof colors !== 'object' || colors === null) return { error: 'Missing "colors"' }
  const c = colors as Record<string, unknown>
  for (const key of REQUIRED_COLOR_KEYS) {
    if (typeof c[key] !== 'string') return { error: `Missing or invalid color: ${key}` }
  }
  return {
    id: `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    builtin: false,
    colors: c as unknown as GraphThemeColors,
  }
}
