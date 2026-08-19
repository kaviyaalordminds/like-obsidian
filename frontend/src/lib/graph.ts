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
