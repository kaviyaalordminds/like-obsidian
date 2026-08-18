import { api } from '@/api/client'
import { flattenFiles } from '@/lib/tree'
import type { TreeNode } from '@/types'

export function uniquePath(existing: Set<string>, folder: string, base: string, ext: string): string {
  let name = `${base}${ext}`
  let i = 1
  while (existing.has(folder ? `${folder}/${name}` : name)) {
    i += 1
    name = `${base} ${i}${ext}`
  }
  return folder ? `${folder}/${name}` : name
}

/** Creates an "Untitled.md" (or "Untitled 2.md", ...) note without blocking
 * on a native prompt(), matching Obsidian's Ctrl+N behavior. */
export async function createUntitledNote(vaultId: string, tree: TreeNode | null, folder = '') {
  const existing = new Set(flattenFiles(tree).map((f) => f.path))
  const path = uniquePath(existing, folder, 'Untitled', '.md')
  return api.createNote(vaultId, path, '')
}
