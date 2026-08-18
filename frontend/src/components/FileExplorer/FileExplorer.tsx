import { useMemo, useState } from 'react'
import { FilePlus, FolderPlus, RefreshCw } from 'lucide-react'
import { useVaultStore } from '@/store/vaultStore'
import { useWorkspaceStore } from '@/store/workspaceStore'
import { useNoteStore } from '@/store/noteStore'
import { api } from '@/api/client'
import type { TreeNode } from '@/types'
import { FileTreeNode } from './FileTreeNode'
import type { MenuItem } from './ContextMenu'
import { flattenFiles } from '@/lib/tree'
import { uniquePath, createUntitledNote } from '@/lib/noteCreation'

export function FileExplorer() {
  const vault = useVaultStore((s) => s.currentVault)
  const tree = useVaultStore((s) => s.tree)
  const refreshTree = useVaultStore((s) => s.refreshTree)
  const openNote = useWorkspaceStore((s) => s.openNote)
  const activePane = useWorkspaceStore((s) => s.panes.find((p) => p.id === s.activePaneId))
  const renamePathInWorkspace = useWorkspaceStore((s) => s.renamePath)
  const evictNote = useNoteStore((s) => s.evict)
  const renameNoteInStore = useNoteStore((s) => s.renamePath)

  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [renamingPath, setRenamingPath] = useState<string | null>(null)

  const allPaths = useMemo(() => new Set(flattenFiles(tree).map((f) => f.path)), [tree])

  if (!vault || !tree) return null

  const toggleExpanded = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const createNoteIn = async (folder: string) => {
    const note = await createUntitledNote(vault.id, tree, folder)
    await refreshTree()
    if (folder) setExpanded((prev) => new Set(prev).add(folder))
    openNote(note.path)
    setRenamingPath(note.path)
  }

  const createFolderIn = async (folder: string) => {
    const path = uniquePath(allPaths, folder, 'New Folder', '')
    await api.createFolder(vault.id, path)
    await refreshTree()
    setExpanded((prev) => new Set(prev).add(folder).add(path))
    setRenamingPath(path)
  }

  const handleRename = async (node: TreeNode, newName: string) => {
    setRenamingPath(null)
    const trimmed = newName.trim()
    if (!trimmed || trimmed === node.name) return
    try {
      if (node.type === 'folder') {
        const res = await api.renameFolder(vault.id, node.path, trimmed)
        renamePathInWorkspace(node.path, res.path)
      } else {
        const res = await api.renameNote(vault.id, node.path, trimmed)
        renamePathInWorkspace(node.path, res.path)
        renameNoteInStore(node.path, res.path, res)
      }
      await refreshTree()
    } catch (e) {
      alert((e as Error).message)
    }
  }

  const handleDelete = async (node: TreeNode) => {
    const kind = node.type === 'folder' ? 'folder and everything inside it' : 'note'
    if (!confirm(`Delete "${node.name}" ${kind === 'note' ? '' : '(' + kind + ')'}? This cannot be undone.`)) return
    if (node.type === 'folder') await api.deleteFolder(vault.id, node.path)
    else await api.deleteNote(vault.id, node.path)
    evictNote(node.path)
    await refreshTree()
  }

  const handleDrop = async (sourcePath: string, targetFolder: string) => {
    if (sourcePath === targetFolder || targetFolder.startsWith(sourcePath + '/')) return
    const name = sourcePath.split('/').pop()!
    const destination = targetFolder ? `${targetFolder}/${name}` : name
    if (destination === sourcePath) return
    const isFolder = !sourcePath.toLowerCase().endsWith('.md')
    try {
      if (isFolder) {
        const res = await api.moveFolder(vault.id, sourcePath, destination)
        renamePathInWorkspace(sourcePath, res.path)
      } else {
        const res = await api.moveNote(vault.id, sourcePath, destination)
        renamePathInWorkspace(sourcePath, res.path)
        renameNoteInStore(sourcePath, res.path, res)
      }
      await refreshTree()
    } catch (e) {
      alert((e as Error).message)
    }
  }

  const buildMenu = (node: TreeNode): MenuItem[] => {
    const items: MenuItem[] = []
    if (node.type === 'folder') {
      items.push(
        { label: 'New note', onClick: () => createNoteIn(node.path) },
        { label: 'New folder', onClick: () => createFolderIn(node.path) },
        { label: '', onClick: () => {}, separator: true },
      )
    }
    items.push(
      { label: 'Rename', onClick: () => setRenamingPath(node.path) },
      { label: 'Delete', onClick: () => handleDelete(node), danger: true },
    )
    return items
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-faint)]">
          {vault.icon} {vault.name}
        </span>
        <div className="flex items-center gap-0.5">
          <button title="New note" className="p-1 rounded hover:bg-[var(--color-bg-inset)]" onClick={() => createNoteIn('')}>
            <FilePlus size={14} />
          </button>
          <button title="New folder" className="p-1 rounded hover:bg-[var(--color-bg-inset)]" onClick={() => createFolderIn('')}>
            <FolderPlus size={14} />
          </button>
          <button title="Refresh" className="p-1 rounded hover:bg-[var(--color-bg-inset)]" onClick={() => refreshTree()}>
            <RefreshCw size={13} />
          </button>
        </div>
      </div>
      <div
        className="flex-1 overflow-auto py-1"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          const src = e.dataTransfer.getData('text/plain')
          if (src) handleDrop(src, '')
        }}
      >
        <FileTreeNode
          node={tree}
          depth={0}
          expanded={expanded}
          toggleExpanded={toggleExpanded}
          activePath={activePane?.activePath ?? null}
          onOpenFile={(path) => openNote(path)}
          renamingPath={renamingPath}
          onStartRename={setRenamingPath}
          onCommitRename={handleRename}
          onCancelRename={() => setRenamingPath(null)}
          buildMenu={buildMenu}
          onDrop={handleDrop}
        />
      </div>
    </div>
  )
}
