import { useState } from 'react'
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileText } from 'lucide-react'
import type { TreeNode } from '@/types'
import { ContextMenu, type MenuItem } from './ContextMenu'

interface Props {
  node: TreeNode
  depth: number
  expanded: Set<string>
  toggleExpanded: (path: string) => void
  activePath: string | null
  onOpenFile: (path: string) => void
  renamingPath: string | null
  onStartRename: (path: string) => void
  onCommitRename: (node: TreeNode, newName: string) => void
  onCancelRename: () => void
  buildMenu: (node: TreeNode) => MenuItem[]
  onDrop: (sourcePath: string, targetFolder: string) => void
}

export function FileTreeNode(props: Props) {
  const { node, depth, expanded, toggleExpanded, activePath, onOpenFile, renamingPath, onCommitRename, onCancelRename, buildMenu, onDrop } = props
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const isRenaming = renamingPath === node.path
  const [draftName, setDraftName] = useState(node.name)

  const isFolder = node.type === 'folder'
  const isOpen = expanded.has(node.path)
  const isRoot = node.path === ''

  if (isRoot) {
    return (
      <div>
        {[...node.children]
          .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'folder' ? -1 : 1))
          .map((child) => (
            <FileTreeNode key={child.path} {...props} node={child} depth={0} />
          ))}
      </div>
    )
  }

  return (
    <div>
      <div
        draggable
        onDragStart={(e) => e.dataTransfer.setData('text/plain', node.path)}
        onDragOver={(e) => {
          if (isFolder) {
            e.preventDefault()
            setDragOver(true)
          }
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          const src = e.dataTransfer.getData('text/plain')
          if (src && isFolder) onDrop(src, node.path)
        }}
        onClick={() => (isFolder ? toggleExpanded(node.path) : onOpenFile(node.path))}
        onContextMenu={(e) => {
          e.preventDefault()
          setMenu({ x: e.clientX, y: e.clientY })
        }}
        className="flex items-center gap-1 px-2 py-1 rounded cursor-pointer text-sm select-none group"
        style={{
          paddingLeft: 8 + depth * 14,
          background: activePath === node.path ? 'var(--color-accent-soft)' : dragOver ? 'var(--color-bg-inset)' : 'transparent',
          color: activePath === node.path ? 'var(--color-accent)' : 'var(--color-text)',
        }}
      >
        {isFolder ? (
          isOpen ? <ChevronDown size={13} className="shrink-0 opacity-60" /> : <ChevronRight size={13} className="shrink-0 opacity-60" />
        ) : (
          <span className="w-[13px] shrink-0" />
        )}
        {isFolder ? (
          isOpen ? <FolderOpen size={14} className="shrink-0 opacity-70" /> : <Folder size={14} className="shrink-0 opacity-70" />
        ) : (
          <FileText size={14} className="shrink-0 opacity-70" />
        )}
        {isRenaming ? (
          <input
            autoFocus
            value={draftName}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onCommitRename(node, draftName)
              if (e.key === 'Escape') onCancelRename()
            }}
            onBlur={() => onCommitRename(node, draftName)}
            className="flex-1 bg-transparent border rounded px-1 text-sm"
            style={{ borderColor: 'var(--color-accent)' }}
          />
        ) : (
          <span className="truncate">{isFolder ? node.name : node.name.replace(/\.md$/i, '')}</span>
        )}
      </div>
      {isFolder && isOpen && (
        <div>
          {[...node.children]
            .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'folder' ? -1 : 1))
            .map((child) => (
              <FileTreeNode key={child.path} {...props} node={child} depth={depth + 1} />
            ))}
        </div>
      )}
      {menu && <ContextMenu x={menu.x} y={menu.y} items={buildMenu(node)} onClose={() => setMenu(null)} />}
    </div>
  )
}
