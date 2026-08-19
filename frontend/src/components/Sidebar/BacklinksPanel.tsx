import { useEffect, useState } from 'react'
import { Link2, Sparkles, Hash, Check, X, Waypoints } from 'lucide-react'
import { api } from '@/api/client'
import { useVaultStore } from '@/store/vaultStore'
import { useNoteStore } from '@/store/noteStore'
import { useEventStore } from '@/store/eventStore'
import type { BacklinksResponse, GraphNode, LinkSuggestion, TagSuggestion } from '@/types'

interface Props {
  path: string
  onOpenNote: (path: string) => void
}

function insertLink(content: string, s: LinkSuggestion): string {
  const wikilink = s.mention.toLowerCase() === s.title.toLowerCase() ? `[[${s.title}]]` : `[[${s.title}|${s.mention}]]`
  const idx = content.toLowerCase().indexOf(s.mention.toLowerCase())
  if (idx === -1) return content
  return content.slice(0, idx) + wikilink + content.slice(idx + s.mention.length)
}

function appendTag(content: string, tag: string): string {
  const trimmed = content.replace(/\s+$/, '')
  return `${trimmed}\n\n#${tag}`
}

export function BacklinksPanel({ path, onOpenNote }: Props) {
  const vault = useVaultStore((s) => s.currentVault)
  // Re-run when the saved note itself changes (not just path/vault) so that
  // backlinks and suggestions refresh once a debounced autosave completes,
  // instead of staying pinned to whatever the note looked like when this
  // panel first mounted.
  const savedAt = useNoteStore((s) => s.entries[path]?.note?.modified_at)
  // Structural changes elsewhere (another tab, the AI agent) publish
  // GRAPH_UPDATED over SSE and bump this — without it, a note that just
  // gained a backlink from a change made outside this panel would only
  // catch up the next time the user re-opened it.
  const graphVersion = useEventStore((s) => s.graphVersion)
  const [data, setData] = useState<BacklinksResponse | null>(null)
  const [linkSuggestions, setLinkSuggestions] = useState<LinkSuggestion[]>([])
  const [tagSuggestions, setTagSuggestions] = useState<TagSuggestion[]>([])
  const [related, setRelated] = useState<GraphNode[]>([])

  useEffect(() => {
    if (!vault) return
    setData(null)
    api.backlinks(vault.id, path).then(setData)
    api.noteSuggestions(vault.id, path).then((s) => {
      setLinkSuggestions(s.links)
      setTagSuggestions(s.tags)
    })
    api.localGraph(vault.id, path, 2).then((g) => {
      setRelated(g.nodes.filter((n) => n.type === 'note' && n.path && n.path !== path))
    })
  }, [vault, path, savedAt, graphVersion])

  const applyEdit = (fn: (content: string) => string) => {
    if (!vault) return
    const entry = useNoteStore.getState().entries[path]
    if (!entry) return
    useNoteStore.getState().updateContent(vault.id, path, fn(entry.content))
  }

  const acceptLink = (s: LinkSuggestion) => {
    applyEdit((content) => insertLink(content, s))
    setLinkSuggestions((prev) => prev.filter((x) => x.target_path !== s.target_path))
  }

  const acceptTag = (s: TagSuggestion) => {
    applyEdit((content) => appendTag(content, s.tag))
    setTagSuggestions((prev) => prev.filter((x) => x.tag !== s.tag))
  }

  if (!data) return <div className="p-3 text-xs text-[var(--color-text-faint)]">Loading…</div>

  return (
    <div className="p-3 space-y-4 overflow-auto">
      {(linkSuggestions.length > 0 || tagSuggestions.length > 0) && (
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase text-[var(--color-text-faint)] mb-2">
            <Sparkles size={11} /> Suggestions
          </div>
          <div className="space-y-1.5">
            {linkSuggestions.map((s) => (
              <SuggestionRow key={`link-${s.target_path}`} icon={<Link2 size={12} className="text-[var(--color-accent)]" />}>
                <span className="text-sm">
                  Link "<span className="text-[var(--color-accent)]">{s.mention}</span>" to [[{s.title}]]
                </span>
                <SuggestionActions onAccept={() => acceptLink(s)} onIgnore={() => setLinkSuggestions((prev) => prev.filter((x) => x !== s))} />
              </SuggestionRow>
            ))}
            {tagSuggestions.map((s) => (
              <SuggestionRow key={`tag-${s.tag}`} icon={<Hash size={12} className="text-[var(--color-accent)]" />}>
                <span className="text-sm">
                  Add tag <span className="text-[var(--color-accent)]">#{s.tag}</span>
                </span>
                <SuggestionActions onAccept={() => acceptTag(s)} onIgnore={() => setTagSuggestions((prev) => prev.filter((x) => x !== s))} />
              </SuggestionRow>
            ))}
          </div>
        </div>
      )}

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

      {(() => {
        const backlinkPaths = new Set(data.backlinks.map((b) => b.path))
        const relatedOnly = related.filter((n) => n.path && !backlinkPaths.has(n.path))
        if (relatedOnly.length === 0) return null
        return (
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase text-[var(--color-text-faint)] mb-2">
              <Waypoints size={11} /> Related notes ({relatedOnly.length})
            </div>
            <div className="space-y-1">
              {relatedOnly.map((n) => (
                <button
                  key={n.id}
                  onClick={() => onOpenNote(n.path as string)}
                  className="w-full text-left px-2 py-1.5 rounded text-sm hover:bg-[var(--color-bg-inset)]"
                >
                  {n.title}
                </button>
              ))}
            </div>
          </div>
        )
      })()}
    </div>
  )
}

function SuggestionRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="px-2 py-1.5 rounded border text-xs" style={{ borderColor: 'var(--color-border)' }}>
      <div className="flex items-center gap-1.5">
        {icon}
        {children}
      </div>
    </div>
  )
}

function SuggestionActions({ onAccept, onIgnore }: { onAccept: () => void; onIgnore: () => void }) {
  return (
    <div className="flex items-center gap-1 ml-auto shrink-0">
      <button onClick={onAccept} className="p-1 rounded hover:bg-[var(--color-bg-inset)] text-[var(--color-accent)]" title="Accept">
        <Check size={12} />
      </button>
      <button onClick={onIgnore} className="p-1 rounded hover:bg-[var(--color-bg-inset)] text-[var(--color-text-faint)]" title="Ignore">
        <X size={12} />
      </button>
    </div>
  )
}
