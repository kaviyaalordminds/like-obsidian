import { useEffect, useState } from 'react'
import { Link2 } from 'lucide-react'
import { api } from '@/api/client'
import { useVaultStore } from '@/store/vaultStore'
import type { BacklinksResponse } from '@/types'

interface Props {
  path: string
  onOpenNote: (path: string) => void
}

export function BacklinksPanel({ path, onOpenNote }: Props) {
  const vault = useVaultStore((s) => s.currentVault)
  const [data, setData] = useState<BacklinksResponse | null>(null)

  useEffect(() => {
    if (!vault) return
    setData(null)
    api.backlinks(vault.id, path).then(setData)
  }, [vault, path])

  if (!data) return <div className="p-3 text-xs text-[var(--color-text-faint)]">Loading…</div>

  return (
    <div className="p-3 space-y-4 overflow-auto">
      <div>
        <div className="text-xs font-semibold uppercase text-[var(--color-text-faint)] mb-2">
          {data.backlinks.length} Backlink{data.backlinks.length === 1 ? '' : 's'}
        </div>
        {data.backlinks.length === 0 && <div className="text-xs text-[var(--color-text-faint)]">No backlinks yet.</div>}
        <div className="space-y-2">
          {data.backlinks.map((b) => (
            <button
              key={b.path}
              onClick={() => onOpenNote(b.path)}
              className="w-full text-left p-2 rounded-md border hover:border-[var(--color-accent)] transition-colors"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <Link2 size={12} className="text-[var(--color-accent)]" />
                {b.title}
              </div>
              <div className="text-xs text-[var(--color-text-faint)] mt-0.5 truncate">{b.context}</div>
            </button>
          ))}
        </div>
      </div>

      {data.unlinked_mentions.length > 0 && (
        <div>
          <div className="text-xs font-semibold uppercase text-[var(--color-text-faint)] mb-2">
            Unlinked mentions ({data.unlinked_mentions.length})
          </div>
          <div className="space-y-1">
            {data.unlinked_mentions.map((m) => (
              <button
                key={m.path}
                onClick={() => onOpenNote(m.path)}
                className="w-full text-left px-2 py-1.5 rounded text-sm hover:bg-[var(--color-bg-inset)]"
              >
                {m.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
