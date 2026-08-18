import type { TreeNode } from '@/types'

export function flattenFiles(node: TreeNode | null): TreeNode[] {
  if (!node) return []
  const out: TreeNode[] = []
  const walk = (n: TreeNode) => {
    if (n.type === 'file') out.push(n)
    n.children?.forEach(walk)
  }
  walk(node)
  return out
}

function stem(path: string): string {
  const base = path.split('/').pop() ?? path
  return base.replace(/\.md$/i, '')
}

/** Mirrors the backend's IndexService.resolve_link: exact relative-path
 * match first, then a unique basename match anywhere in the vault. */
export function resolveLinkTarget(files: TreeNode[], target: string): string | null {
  const clean = target.trim().replace(/\\/g, '/').replace(/\.md$/i, '')
  const mdFiles = files.filter((f) => f.is_markdown)

  const exact = mdFiles.find((f) => f.path.replace(/\.md$/i, '').toLowerCase() === clean.toLowerCase())
  if (exact) return exact.path

  const basename = clean.split('/').pop()!.toLowerCase()
  const matches = mdFiles.filter((f) => stem(f.path).toLowerCase() === basename)
  if (matches.length > 0) {
    matches.sort((a, b) => a.path.length - b.path.length)
    return matches[0].path
  }
  return null
}
