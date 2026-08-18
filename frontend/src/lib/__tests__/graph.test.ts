import { describe, expect, it } from 'vitest'
import { computeIsolatedFilteredData } from '@/lib/graph'
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
