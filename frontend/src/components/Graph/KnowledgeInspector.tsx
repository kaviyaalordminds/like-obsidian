import { useEffect, useState } from 'react'
import { X, ExternalLink, Pin, PinOff, EyeOff, Crosshair } from 'lucide-react'
import { api } from '@/api/client'
import type { BacklinksResponse, Note } from '@/types'

interface Props {
  vaultId: string
  path: string
  pinned: boolean
  onClose: () => void
  onOpen: () => void
  onFocus: () => void
  onTogglePin: () => void
  onHide: () => void
}

function wordCount(text: string) {
  const trimmed = text.trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
}

export function KnowledgeInspector({ vaultId, path, pinned, onClose, onOpen, onFocus, onTogglePin, onHide }: Props) {
  const [note, setNote] = useState<Note | null>(null)
  const [backlinks, setBacklinks] = useState<BacklinksResponse | null>(null)

  useEffect(() => {
    setNote(null)
    setBacklinks(null)
    api.getNote(vaultId, path).then(setNote).catch(() => {})
    api.backlinks(vaultId, path).then(setBacklinks).catch(() => {})
  }, [vaultId, path])

  return (
    <div
      className="glass-panel rounded-lg p-4 w-72 pointer-events-auto text-sm max-h-[70vh] overflow-auto"
      style={{ boxShadow: 'var(--shadow-glow)' }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase text-[var(--color-text-faint)]">Inspector</span>
        <button onClick={onClose} className="p-1 rounded hover:bg-[var(--color-bg-inset)]">
          <X size={13} />
        </button>
      </div>

      {!note ? (
        <div className="text-xs text-[var(--color-text-faint)]">Loading…</div>
      ) : (
        <>
          <h3 className="font-semibold text-sm truncate mb-0.5">{note.title}</h3>
          <div className="text-xs text-[var(--color-text-faint)] truncate mb-3">{note.path}</div>

          {note.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {note.tags.map((t) => (
                <span key={t} className="tag-pill">
                  #{t}
                </span>
              ))}
            </div>
          )}

          <dl className="space-y-1 text-xs text-[var(--color-text-muted)] mb-3">
            <Row label="Modified" value={note.modified_at ? new Date(note.modified_at * 1000).toLocaleString() : '—'} />
            <Row label="Words" value={wordCount(note.content).toLocaleString()} />
            <Row label="Size" value={`${new Blob([note.content]).size.toLocaleString()} B`} />
            <Row label="Outgoing links" value={String(note.links.length)} />
            <Row label="Backlinks" value={String(backlinks?.backlinks.length ?? 0)} />
          </dl>

          <div className="flex items-center gap-1.5 mb-3">
            <IconButton onClick={onOpen} title="Open note">
              <ExternalLink size={13} />
            </IconButton>
            <IconButton onClick={onFocus} title="Focus this node">
              <Crosshair size={13} />
            </IconButton>
            <IconButton onClick={onTogglePin} title={pinned ? 'Unpin' : 'Pin'}>
              {pinned ? <PinOff size={13} /> : <Pin size={13} />}
            </IconButton>
            <IconButton onClick={onHide} title="Hide node">
              <EyeOff size={13} />
            </IconButton>
          </div>

          {backlinks && backlinks.backlinks.length > 0 && (
            <div>
              <div className="text-[10px] uppercase text-[var(--color-text-faint)] mb-1">Related</div>
              <div className="space-y-0.5">
                {backlinks.backlinks.slice(0, 6).map((b) => (
                  <div key={b.path} className="truncate text-xs text-[var(--color-text-muted)]">
                    {b.title}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt>{label}</dt>
      <dd className="text-[var(--color-text)]">{value}</dd>
    </div>
  )
}

function IconButton({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="p-1.5 rounded border text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:border-[var(--color-accent)]"
      style={{ borderColor: 'var(--color-border)' }}
    >
      {children}
    </button>
  )
}
