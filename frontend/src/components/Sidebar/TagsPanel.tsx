import { useEffect, useState } from 'react'
import { Hash } from 'lucide-react'
import { api } from '@/api/client'
import { useVaultStore } from '@/store/vaultStore'

interface Props {
  onOpenNote: (path: string) => void
}

export function TagsPanel({ onOpenNote }: Props) {
  const vault = useVaultStore((s) => s.currentVault)
  const [tags, setTags] = useState<Record<string, number>>({})
  const [expanded, setExpanded] = useState<string | null>(null)
  const [notes, setNotes] = useState<{ path: string; title: string }[]>([])

  useEffect(() => {
    if (!vault) return
    api.listTags(vault.id).then(setTags)
  }, [vault])

  const toggle = async (tag: string) => {
    if (expanded === tag) {
      setExpanded(null)
      return
    }
    setExpanded(tag)
    if (vault) setNotes(await api.notesForTag(vault.id, tag))
  }

  const sorted = Object.entries(tags).sort((a, b) => b[1] - a[1])

  if (sorted.length === 0) return <div className="p-3 text-xs text-[var(--color-text-faint)]">No tags yet.</div>

  return (
    <div className="p-2 overflow-auto">
      {sorted.map(([tag, count]) => (
        <div key={tag}>
          <button
            onClick={() => toggle(tag)}
            className="w-full flex items-center justify-between px-2 py-1.5 rounded text-sm hover:bg-[var(--color-bg-inset)]"
          >
            <span className="flex items-center gap-1.5 truncate">
              <Hash size={12} className="text-[var(--color-accent)]" />
              {tag}
            </span>
            <span className="text-xs text-[var(--color-text-faint)]">{count}</span>
          </button>
          {expanded === tag && (
            <div className="pl-6 pb-1">
              {notes.map((n) => (
                <button
                  key={n.path}
                  onClick={() => onOpenNote(n.path)}
                  className="block w-full text-left px-2 py-1 text-xs rounded hover:bg-[var(--color-bg-inset)] text-[var(--color-text-muted)]"
                >
                  {n.title}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
