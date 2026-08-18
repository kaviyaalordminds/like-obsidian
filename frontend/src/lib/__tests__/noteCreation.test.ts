import { describe, expect, it } from 'vitest'
import { uniquePath } from '@/lib/noteCreation'

describe('uniquePath', () => {
  it('returns the base name when nothing collides', () => {
    expect(uniquePath(new Set(), '', 'Untitled', '.md')).toBe('Untitled.md')
  })

  it('appends an incrementing suffix on collision', () => {
    const existing = new Set(['Untitled.md', 'Untitled 2.md'])
    expect(uniquePath(existing, '', 'Untitled', '.md')).toBe('Untitled 3.md')
  })

  it('scopes collisions to the given folder', () => {
    const existing = new Set(['Notes/Untitled.md'])
    expect(uniquePath(existing, 'Notes', 'Untitled', '.md')).toBe('Notes/Untitled 2.md')
    expect(uniquePath(existing, 'Other', 'Untitled', '.md')).toBe('Other/Untitled.md')
  })

  it('works for extension-less names (folders)', () => {
    const existing = new Set<string>()
    expect(uniquePath(existing, '', 'New Folder', '')).toBe('New Folder')
  })
})
