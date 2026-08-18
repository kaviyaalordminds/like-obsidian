import { FileText, Sparkles } from 'lucide-react'
import { useWorkspaceStore } from '@/store/workspaceStore'
import { useVaultStore } from '@/store/vaultStore'
import { TabBar } from '@/components/Tabs/TabBar'
import { NotePane } from '@/components/Editor/NotePane'
import { api } from '@/api/client'

export function WorkspaceArea() {
  const panes = useWorkspaceStore((s) => s.panes)
  const activePaneId = useWorkspaceStore((s) => s.activePaneId)
  const openNote = useWorkspaceStore((s) => s.openNote)
  const vault = useVaultStore((s) => s.currentVault)
  const refreshTree = useVaultStore((s) => s.refreshTree)

  const createNoteFromLink = async (title: string) => {
    if (!vault) return
    const note = await api.createNote(vault.id, `${title}.md`, `# ${title}\n\n`)
    await refreshTree()
    openNote(note.path)
  }

  return (
    <div className="flex h-full min-w-0">
      {panes.map((pane, i) => (
        <div key={pane.id} className="flex flex-col h-full min-w-0" style={{ width: `${100 / panes.length}%`, borderLeft: i > 0 ? '1px solid var(--color-border)' : undefined }}>
          <TabBar pane={pane} isActivePane={pane.id === activePaneId} showSplitButton={panes.length === 1 && i === 0} showClosePaneButton={panes.length > 1} />
          {pane.activePath ? (
            <NotePane path={pane.activePath} onOpenNote={(p) => openNote(p, { paneId: pane.id })} onCreateNote={createNoteFromLink} />
          ) : (
            <EmptyState />
          )}
        </div>
      ))}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[var(--color-text-faint)]">
      <Sparkles size={28} className="opacity-40" />
      <div className="flex items-center gap-1.5 text-sm">
        <FileText size={14} />
        Open a note or create one to get started
      </div>
    </div>
  )
}
