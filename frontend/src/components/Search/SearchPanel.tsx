import { useEffect, useState } from 'react'
import { Search, X } from 'lucide-react'
import { useUIStore } from '@/store/uiStore'
import { useVaultStore } from '@/store/vaultStore'
import { useWorkspaceStore } from '@/store/workspaceStore'
import { api } from '@/api/client'
import type { SearchResult } from '@/types'
import { debounce } from '@/lib/debounce'

function highlight(text: string, query: string) {
  if (!query.trim()) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-[var(--color-accent-soft)] text-[var(--color-accent)] rounded px-0.5">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  )
}

export function SearchPanel() {
  const open = useUIStore((s) => s.searchPanelOpen)
  const setOpen = useUIStore((s) => s.setSearchPanelOpen)
  const vault = useVaultStore((s) => s.currentVault)
  const openNote = useWorkspaceStore((s) => s.openNote)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!vault || !query.trim()) {
      setResults([])
      return
    }
    setLoading(true)
    const run = debounce(async () => {
      const res = await api.search(vault.id, query)
      setResults(res)
      setLoading(false)
    }, 250)
    run()
    return () => run.cancel()
  }, [vault, query])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={() => setOpen(false)}>
      <div className="fixed inset-0 bg-black/20" />
      <div
        className="relative w-96 h-full border-l flex flex-col"
        style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 p-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <Search size={15} className="text-[var(--color-text-faint)]" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search titles, content, tags, folders…"
            className="flex-1 bg-transparent outline-none text-sm"
          />
          <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-[var(--color-bg-inset)]">
            <X size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-2">
          {loading && <div className="p-3 text-xs text-[var(--color-text-faint)]">Searching…</div>}
          {!loading && query && results.length === 0 && (
            <div className="p-3 text-xs text-[var(--color-text-faint)]">No results for "{query}".</div>
          )}
          {results.map((r) => (
            <button
              key={r.path}
              onClick={() => {
                openNote(r.path)
                setOpen(false)
              }}
              className="w-full text-left p-2.5 rounded-md hover:bg-[var(--color-bg-inset)] mb-1"
            >
              <div className="text-sm font-medium">{highlight(r.title, query)}</div>
              <div className="text-xs text-[var(--color-text-faint)] truncate">{r.folder || '/'}</div>
              {r.snippets[0] && (
                <div className="text-xs text-[var(--color-text-muted)] mt-1 line-clamp-2">{highlight(r.snippets[0], query)}</div>
              )}
              {r.matched_tags.length > 0 && (
                <div className="flex gap-1 mt-1">
                  {r.matched_tags.map((t) => (
                    <span key={t} className="tag-pill">#{t}</span>
                  ))}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
