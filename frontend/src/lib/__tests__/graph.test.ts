import { describe, expect, it } from 'vitest'
import {
  computeDegrees,
  computeDistances,
  computeIsolatedFilteredData,
  degreeToRadius,
  hashColor,
  lerpColor,
  resolvePerformanceMode,
} from '@/lib/graph'
import type { GraphData } from '@/types'

const node = (id: string) => ({
  id,
  path: `${id}.md`,
  title: id,
  type: 'note' as const,
  tags: [],
  folder: '',
  created_at: null,
  updated_at: null,
  word_count: 0,
  status: null,
})

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

describe('hashColor', () => {
  it('is deterministic for the same key', () => {
    expect(hashColor('Research')).toBe(hashColor('Research'))
  })

  it('picks from the given palette', () => {
    const palette = ['#111111', '#222222']
    expect(palette).toContain(hashColor('anything', palette))
  })
})

describe('lerpColor', () => {
  it('returns the start color at t=0 and end color at t=1', () => {
    expect(lerpColor('#000000', '#ffffff', 0)).toBe('#000000')
    expect(lerpColor('#000000', '#ffffff', 1)).toBe('#ffffff')
  })

  it('clamps out-of-range t', () => {
    expect(lerpColor('#000000', '#ffffff', -5)).toBe('#000000')
    expect(lerpColor('#000000', '#ffffff', 5)).toBe('#ffffff')
  })
})

describe('resolvePerformanceMode', () => {
  it('passes through an explicit (non-auto) tier regardless of size', () => {
    expect(resolvePerformanceMode('quality', 5000)).toBe('quality')
  })

  it('auto recommends lower tiers as node count grows', () => {
    expect(resolvePerformanceMode('auto', 10)).toBe('quality')
    expect(resolvePerformanceMode('auto', 500)).toBe('balanced')
    expect(resolvePerformanceMode('auto', 5000)).toBe('low')
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
