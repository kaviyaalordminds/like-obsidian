import { X, Pin, Columns2, PanelRightClose } from 'lucide-react'
import type { Pane } from '@/store/workspaceStore'
import { useWorkspaceStore } from '@/store/workspaceStore'
import { useNoteStore } from '@/store/noteStore'

interface Props {
  pane: Pane
  isActivePane: boolean
  showSplitButton: boolean
  showClosePaneButton: boolean
}

function titleFor(path: string) {
  return path.split('/').pop()!.replace(/\.md$/i, '')
}

export function TabBar({ pane, isActivePane, showSplitButton, showClosePaneButton }: Props) {
  const activateTab = useWorkspaceStore((s) => s.activateTab)
  const closeTab = useWorkspaceStore((s) => s.closeTab)
  const togglePin = useWorkspaceStore((s) => s.togglePin)
  const setActivePane = useWorkspaceStore((s) => s.setActivePane)
  const splitPane = useWorkspaceStore((s) => s.splitPane)
  const closePane = useWorkspaceStore((s) => s.closePane)
  const entries = useNoteStore((s) => s.entries)

  const ordered = [...pane.pinned, ...pane.tabs.filter((t) => !pane.pinned.includes(t))]

  return (
    <div
      className="flex items-center border-b overflow-x-auto"
      style={{ borderColor: 'var(--color-border)', background: isActivePane ? 'transparent' : 'var(--color-bg-inset)' }}
      onMouseDown={() => setActivePane(pane.id)}
    >
      <div className="flex flex-1 min-w-0">
        {ordered.map((path) => {
          const dirty = entries[path]?.dirty
          const isPinned = pane.pinned.includes(path)
          const isActive = pane.activePath === path
          return (
            <div
              key={path}
              onClick={() => activateTab(pane.id, path)}
              onDoubleClick={() => togglePin(pane.id, path)}
              className="group flex items-center gap-1.5 px-3 py-1.5 text-xs border-r cursor-pointer max-w-[180px] shrink-0"
              style={{
                borderColor: 'var(--color-border)',
                background: isActive ? 'var(--color-bg-elevated)' : 'transparent',
                color: isActive ? 'var(--color-text)' : 'var(--color-text-muted)',
              }}
              title={path}
            >
              {isPinned && <Pin size={10} className="shrink-0 opacity-60" />}
              <span className="truncate">{titleFor(path)}</span>
              {dirty && <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] shrink-0" />}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  closeTab(pane.id, path)
                }}
                className="opacity-0 group-hover:opacity-100 hover:bg-[var(--color-bg-inset)] rounded shrink-0"
              >
                <X size={12} />
              </button>
            </div>
          )
        })}
      </div>
      <div className="flex items-center gap-0.5 px-1 shrink-0">
        {showSplitButton && (
          <button title="Split editor" className="p-1 rounded hover:bg-[var(--color-bg-inset)]" onClick={() => splitPane()}>
            <Columns2 size={13} />
          </button>
        )}
        {showClosePaneButton && (
          <button title="Close pane" className="p-1 rounded hover:bg-[var(--color-bg-inset)]" onClick={() => closePane(pane.id)}>
            <PanelRightClose size={13} />
          </button>
        )}
      </div>
    </div>
  )
}
