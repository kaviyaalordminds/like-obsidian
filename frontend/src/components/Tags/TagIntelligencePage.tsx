import { useEffect, useState } from 'react'
import { Hash, Pencil, Merge, Trash2 } from 'lucide-react'
import { api } from '@/api/client'
import { useVaultStore } from '@/store/vaultStore'
import { useWorkspaceStore } from '@/store/workspaceStore'
import { useUIStore } from '@/store/uiStore'
import type { RelatedTag, TaggedNote } from '@/types'

export function TagIntelligencePage() {
  const vault = useVaultStore((s) => s.currentVault)
  const openNote = useWorkspaceStore((s) => s.openNote)
  const setMainView = useUIStore((s) => s.setMainView)

  const [tags, setTags] = useState<Record<string, number>>({})
  const [selected, setSelected] = useState<string | null>(null)
  const [notes, setNotes] = useState<TaggedNote[]>([])
  const [related, setRelated] = useState<RelatedTag[]>([])
  const [renaming, setRenaming] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [mergeMode, setMergeMode] = useState(false)
  const [mergeTargets, setMergeTargets] = useState<Set<string>>(new Set())

  const loadTags = () => {
    if (!vault) return
    api.listTags(vault.id).then(setTags)
  }

  useEffect(loadTags, [vault])

  useEffect(() => {
    if (!vault || !selected) return
    api.notesForTag(vault.id, selected).then(setNotes)
    api.relatedTags(vault.id, selected).then(setRelated)
    setDraftName(selected)
  }, [vault, selected])

  const open = (path: string) => {
    openNote(path)
    setMainView('editor')
  }

  const commitRename = async () => {
    if (!vault || !selected || !draftName.trim() || draftName === selected) {
      setRenaming(false)
      return
    }
    await api.renameTag(vault.id, selected, draftName.trim())
    setRenaming(false)
    setSelected(draftName.trim())
    loadTags()
  }

  const doMerge = async () => {
    if (!vault || !selected || mergeTargets.size === 0) return
    await api.mergeTags(vault.id, [...mergeTargets], selected)
    setMergeMode(false)
    setMergeTargets(new Set())
    loadTags()
  }

  const doDelete = async (tag: string) => {
    if (!vault) return
    if (!confirm(`Delete #${tag} from every note? This cannot be undone.`)) return
    await api.deleteTag(vault.id, tag)
    if (selected === tag) setSelected(null)
    loadTags()
  }

  const sorted = Object.entries(tags).sort((a, b) => b[1] - a[1])

  return (
    <div className="h-full flex">
      <div className="w-72 border-r overflow-auto p-3 shrink-0" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase text-[var(--color-text-faint)] px-1 mb-2">
          <Hash size={12} /> All tags ({sorted.length})
        </div>
        {sorted.map(([tag, count]) => (
          <div key={tag} className="flex items-center group">
            {mergeMode && selected && selected !== tag && (
              <input
                type="checkbox"
                className="ml-1"
                checked={mergeTargets.has(tag)}
                onChange={(e) => {
                  const next = new Set(mergeTargets)
                  if (e.target.checked) next.add(tag)
                  else next.delete(tag)
                  setMergeTargets(next)
                }}
              />
            )}
            <button
              onClick={() => setSelected(tag)}
              className="flex-1 flex items-center justify-between px-2 py-1.5 rounded text-sm"
              style={{
                background: selected === tag ? 'var(--color-accent-soft)' : 'transparent',
                color: selected === tag ? 'var(--color-accent)' : 'var(--color-text)',
              }}
            >
              <span className="truncate">#{tag}</span>
              <span className="text-xs text-[var(--color-text-faint)]">{count}</span>
            </button>
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-6">
        {!selected ? (
          <div className="text-sm text-[var(--color-text-faint)]">Select a tag to inspect it.</div>
        ) : (
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-1">
              {renaming ? (
                <input
                  autoFocus
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && commitRename()}
                  onBlur={commitRename}
                  className="settings-input text-lg font-semibold"
                />
              ) : (
                <h1 className="text-lg font-semibold">#{selected}</h1>
              )}
              <IconButton title="Rename" onClick={() => setRenaming(true)}>
                <Pencil size={13} />
              </IconButton>
              <IconButton title="Merge other tags into this one" onClick={() => setMergeMode((v) => !v)} active={mergeMode}>
                <Merge size={13} />
              </IconButton>
              <IconButton title="Delete tag" onClick={() => doDelete(selected)}>
                <Trash2 size={13} />
              </IconButton>
            </div>
            <p className="text-sm text-[var(--color-text-faint)] mb-5">
              {notes.length} note{notes.length === 1 ? '' : 's'}
            </p>

            {mergeMode && (
              <div className="mb-5 p-3 rounded-md border text-sm" style={{ borderColor: 'var(--color-border)' }}>
                <p className="text-xs text-[var(--color-text-muted)] mb-2">
                  Check tags in the list to merge into <strong>#{selected}</strong>, then confirm.
                </p>
                <button
                  onClick={doMerge}
                  disabled={mergeTargets.size === 0}
                  className="px-3 py-1.5 rounded-md text-xs text-white disabled:opacity-40"
                  style={{ background: 'var(--color-accent)' }}
                >
                  Merge {mergeTargets.size} tag{mergeTargets.size === 1 ? '' : 's'}
                </button>
              </div>
            )}

            {related.length > 0 && (
              <div className="mb-5">
                <div className="text-xs font-semibold uppercase text-[var(--color-text-faint)] mb-2">Related tags</div>
                <div className="flex flex-wrap gap-1.5">
                  {related.map((r) => (
                    <button key={r.tag} onClick={() => setSelected(r.tag)} className="tag-pill hover:opacity-80">
                      #{r.tag} · {r.co_occurrences}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="text-xs font-semibold uppercase text-[var(--color-text-faint)] mb-2">Notes</div>
              <div className="space-y-1">
                {notes.map((n) => (
                  <button
                    key={n.path}
                    onClick={() => open(n.path)}
                    className="w-full text-left px-3 py-2 rounded-md hover:bg-[var(--color-bg-inset)] text-sm flex items-center justify-between"
                  >
                    <span>{n.title}</span>
                    <span className="text-xs text-[var(--color-text-faint)]">
                      {new Date(n.modified_at * 1000).toLocaleDateString()}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function IconButton({
  children,
  onClick,
  title,
  active,
}: {
  children: React.ReactNode
  onClick: () => void
  title: string
  active?: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="p-1.5 rounded border"
      style={{
        borderColor: 'var(--color-border)',
        color: active ? 'var(--color-accent)' : 'var(--color-text-muted)',
        background: active ? 'var(--color-accent-soft)' : 'transparent',
      }}
    >
      {children}
    </button>
  )
}
