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
