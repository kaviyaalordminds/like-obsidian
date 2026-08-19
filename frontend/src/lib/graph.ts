import type { GraphData } from '@/types'

export function computeIsolatedFilteredData(data: GraphData, hideIsolated: boolean): GraphData {
  if (!hideIsolated) return data
  const connected = new Set<string>()
  data.edges.forEach((e) => {
    connected.add(e.source)
    connected.add(e.target)
  })
  return { nodes: data.nodes.filter((n) => connected.has(n.id)), edges: data.edges }
}

export interface Degree {
  in: number
  out: number
  total: number
}

/** Node importance signal for dynamic sizing (Section 7) — never a
 * hard-coded size, always derived from the actual edge list currently
 * rendered. */
export function computeDegrees(data: GraphData): Map<string, Degree> {
  const degrees = new Map<string, Degree>()
  const get = (id: string) => {
    let d = degrees.get(id)
    if (!d) {
      d = { in: 0, out: 0, total: 0 }
      degrees.set(id, d)
    }
    return d
  }
  data.nodes.forEach((n) => get(n.id))
  data.edges.forEach((e) => {
    get(e.source).out += 1
    get(e.target).in += 1
  })
  degrees.forEach((d) => (d.total = d.in + d.out))
  return degrees
}

/** sqrt scaling keeps a handful of hub nodes from dwarfing everything else
 * at high degree, while still giving a clear size gradient from orphan (0
 * connections) through normal to highly-connected. */
export function degreeToRadius(degree: number, baseRadius: number, maxDegreeForScale = 12): number {
  const clamped = Math.min(degree, maxDegreeForScale)
  const scale = 1 + Math.sqrt(clamped) * 0.55
  return Math.round(baseRadius * scale)
}

const CATEGORICAL_PALETTE = [
  '#e08a3e', '#34d1c9', '#c94f6d', '#7fae3f', '#3e7fc9',
  '#c9973e', '#9d6bff', '#3ecf7d', '#ff6b9d', '#5cc9f0',
]

/** Deterministic (same key -> same color, every render) categorical color —
 * used for "color by folder/tag/cluster/file-type/status" strategies where
 * there's no natural ordering, only identity. */
export function hashColor(key: string, palette: string[] = CATEGORICAL_PALETTE): string {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return palette[h % palette.length]
}

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace('#', '')
  const n = parseInt(m.length === 3 ? m.split('').map((c) => c + c).join('') : m, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Linear color interpolation for continuous strategies (link/backlink
 * count, created/modified recency) — `t` is clamped to [0, 1]. */
export function lerpColor(from: string, to: string, t: number): string {
  const clamped = Math.max(0, Math.min(1, t))
  const [r1, g1, b1] = hexToRgb(from)
  const [r2, g2, b2] = hexToRgb(to)
  const r = Math.round(r1 + (r2 - r1) * clamped)
  const g = Math.round(g1 + (g2 - g1) * clamped)
  const b = Math.round(b1 + (b2 - b1) * clamped)
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

/** Resolves the effective rendering quality tier for the graph's current
 * size. "auto" recommends a lower tier as the visible node count grows —
 * real thresholds against the actual node count, not a fixed setting the
 * user has to remember to change themselves as their vault grows. */
export function resolvePerformanceMode(
  mode: 'auto' | 'low' | 'balanced' | 'high' | 'quality',
  nodeCount: number,
): 'low' | 'balanced' | 'high' | 'quality' {
  if (mode !== 'auto') return mode
  if (nodeCount > 800) return 'low'
  if (nodeCount > 300) return 'balanced'
  return 'quality'
}

/** BFS distance (undirected) from a root node, for radial/focus layouts and
 * for dimming nodes unrelated to the current focus. Unreachable nodes get
 * Infinity. */
export function computeDistances(data: GraphData, rootId: string): Map<string, number> {
  const adjacency = new Map<string, Set<string>>()
  const ensure = (id: string) => {
    let s = adjacency.get(id)
    if (!s) {
      s = new Set()
      adjacency.set(id, s)
    }
    return s
  }
  data.nodes.forEach((n) => ensure(n.id))
  data.edges.forEach((e) => {
    ensure(e.source).add(e.target)
    ensure(e.target).add(e.source)
  })

  const distances = new Map<string, number>()
  data.nodes.forEach((n) => distances.set(n.id, Infinity))
  if (!adjacency.has(rootId)) return distances

  distances.set(rootId, 0)
  const queue: string[] = [rootId]
  while (queue.length) {
    const current = queue.shift()!
    const d = distances.get(current)!
    for (const neighbor of adjacency.get(current) ?? []) {
      if (distances.get(neighbor)! > d + 1) {
        distances.set(neighbor, d + 1)
        queue.push(neighbor)
      }
    }
  }
  return distances
}
