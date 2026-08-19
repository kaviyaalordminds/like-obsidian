import { useEffect, useState } from 'react'
import { Radio } from 'lucide-react'
import { api } from '@/api/client'
import { useVaultStore } from '@/store/vaultStore'
import { useWorkspaceStore } from '@/store/workspaceStore'
import { useNoteStore } from '@/store/noteStore'
import { flattenFiles } from '@/lib/tree'

function wordCount(text: string) {
  const trimmed = text.trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
}

/** Every number here is read from live app state — noteStore's in-memory
 * content, the current file tree, and a one-shot backlinks fetch on path
 * change — never hard-coded (Section 56). */
export function StatusBar() {
  const vault = useVaultStore((s) => s.currentVault)
  const tree = useVaultStore((s) => s.tree)
  const activePane = useWorkspaceStore((s) => s.panes.find((p) => p.id === s.activePaneId))
  const activePath = activePane?.activePath ?? null
  const entry = useNoteStore((s) => (activePath ? s.entries[activePath] : undefined))
  const [backlinkCount, setBacklinkCount] = useState<number | null>(null)

  const noteCount = flattenFiles(tree).filter((f) => f.is_markdown).length

  useEffect(() => {
    if (!vault || !activePath) {
      setBacklinkCount(null)
      return
    }
    api.backlinks(vault.id, activePath).then((r) => setBacklinkCount(r.backlinks.length))
  }, [vault, activePath])

  if (!vault) return null

  const content = entry?.content ?? ''
  const words = wordCount(content)
  const chars = content.length
  const linkCount = entry?.note?.links.length ?? 0

  return (
    <div
      className="flex items-center justify-between px-3 py-1 border-t text-[11px] font-mono text-[var(--color-text-faint)] shrink-0"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-elevated)' }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="flex items-center gap-1 text-[var(--color-accent)]">
          <Radio size={10} /> INDEXED
        </span>
        <span>{noteCount.toLocaleString()} NOTES</span>
        {activePath && <span className="truncate max-w-[300px]">{activePath}</span>}
      </div>
      {activePath && (
        <div className="flex items-center gap-3 shrink-0">
          <span>{words.toLocaleString()} WORDS</span>
          <span>{chars.toLocaleString()} CHARS</span>
          <span>{linkCount} LINKS</span>
          <span>{backlinkCount ?? 0} BACKLINKS</span>
        </div>
      )}
    </div>
  )
}
