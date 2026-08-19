import { describe, expect, it } from 'vitest'
import { computeDegrees, computeDistances, computeIsolatedFilteredData, degreeToRadius } from '@/lib/graph'
import type { GraphData } from '@/types'

const node = (id: string) => ({ id, path: `${id}.md`, title: id, type: 'note' as const, tags: [], folder: '', updated_at: null })

const data: GraphData = {
  nodes: [node('A'), node('B'), node('Orphan')],
  edges: [{ source: 'A', target: 'B', type: 'internal-link' }],
}

describe('computeIsolatedFilteredData', () => {
  it('returns the data unchanged when not hiding isolated nodes', () => {
    expect(computeIsolatedFilteredData(data, false)).toEqual(data)
  })

  it('drops nodes with no edges when hiding isolated nodes', () => {
    const filtered = computeIsolatedFilteredData(data, true)
    expect(filtered.nodes.map((n) => n.id).sort()).toEqual(['A', 'B'])
    expect(filtered.edges).toEqual(data.edges)
  })
})

describe('computeDegrees', () => {
  it('counts in/out/total degree per node from the current edge list', () => {
    const degrees = computeDegrees(data)
    expect(degrees.get('A')).toEqual({ in: 0, out: 1, total: 1 })
    expect(degrees.get('B')).toEqual({ in: 1, out: 0, total: 1 })
    expect(degrees.get('Orphan')).toEqual({ in: 0, out: 0, total: 0 })
  })
})

describe('degreeToRadius', () => {
  it('grows monotonically with degree but never explodes at high degree (sqrt scaling)', () => {
    const r0 = degreeToRadius(0, 10)
    const r1 = degreeToRadius(1, 10)
    const r10 = degreeToRadius(10, 10)
    const rAtCap = degreeToRadius(12, 10) // default maxDegreeForScale
    const rBeyondCap = degreeToRadius(100, 10) // clamped to the same cap
    expect(r0).toBeLessThan(r1)
    expect(r1).toBeLessThan(r10)
    expect(r10).toBeLessThan(rAtCap)
    expect(rAtCap).toBe(rBeyondCap) // both clamp to the same max scale
  })
})

describe('computeDistances', () => {
  const chain: GraphData = {
    nodes: [node('A'), node('B'), node('C'), node('Island')],
    edges: [
      { source: 'A', target: 'B', type: 'internal-link' },
      { source: 'B', target: 'C', type: 'internal-link' },
    ],
  }

  it('computes BFS hop distance from the root, undirected', () => {
    const distances = computeDistances(chain, 'A')
    expect(distances.get('A')).toBe(0)
    expect(distances.get('B')).toBe(1)
    expect(distances.get('C')).toBe(2)
  })

  it('returns Infinity for unreachable nodes', () => {
    const distances = computeDistances(chain, 'A')
    expect(distances.get('Island')).toBe(Infinity)
  })
})
