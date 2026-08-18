import { describe, expect, it } from 'vitest'
import { flattenFiles, resolveLinkTarget } from '@/lib/tree'
import type { TreeNode } from '@/types'

function file(path: string): TreeNode {
  return { name: path.split('/').pop()!, path, type: 'file', is_markdown: true, modified_at: null, size: null, children: [] }
}

function folder(path: string, children: TreeNode[]): TreeNode {
  return { name: path.split('/').pop() ?? path, path, type: 'folder', is_markdown: false, modified_at: null, size: null, children }
}

const tree = folder('', [
  file('Welcome.md'),
  folder('Notes', [file('Notes/Artificial Intelligence.md'), file('Notes/Machine Learning.md')]),
  folder('Archive', [file('Archive/Machine Learning.md')]),
])

describe('flattenFiles', () => {
  it('collects only file nodes, recursively', () => {
    const files = flattenFiles(tree)
    expect(files.map((f) => f.path).sort()).toEqual(
      ['Archive/Machine Learning.md', 'Notes/Artificial Intelligence.md', 'Notes/Machine Learning.md', 'Welcome.md'].sort(),
    )
  })

  it('returns an empty array for null', () => {
    expect(flattenFiles(null)).toEqual([])
  })
})

describe('resolveLinkTarget', () => {
  const files = flattenFiles(tree)

  it('resolves an exact relative-path match first', () => {
    expect(resolveLinkTarget(files, 'Notes/Machine Learning')).toBe('Notes/Machine Learning.md')
    expect(resolveLinkTarget(files, 'Archive/Machine Learning')).toBe('Archive/Machine Learning.md')
  })

  it('resolves a bare basename to the shortest matching path when ambiguous', () => {
    // Two files named "Machine Learning.md" exist; bare "[[Machine Learning]]"
    // should resolve deterministically to the shortest path, mirroring the
    // backend's IndexService.resolve_link. "Notes/..." (26 chars) is shorter
    // than "Archive/..." (28 chars).
    const resolved = resolveLinkTarget(files, 'Machine Learning')
    expect(resolved).toBe('Notes/Machine Learning.md')
  })

  it('resolves a unique basename anywhere in the vault', () => {
    expect(resolveLinkTarget(files, 'Artificial Intelligence')).toBe('Notes/Artificial Intelligence.md')
  })

  it('returns null for a target that does not exist', () => {
    expect(resolveLinkTarget(files, 'Nonexistent Note')).toBeNull()
  })

  it('is case-insensitive', () => {
    expect(resolveLinkTarget(files, 'welcome')).toBe('Welcome.md')
  })
})
