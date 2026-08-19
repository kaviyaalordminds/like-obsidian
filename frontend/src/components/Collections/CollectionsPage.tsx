import { useEffect, useState } from 'react'
import { Layers, Plus, Trash2 } from 'lucide-react'
import { api } from '@/api/client'
import { useVaultStore } from '@/store/vaultStore'
import { useWorkspaceStore } from '@/store/workspaceStore'
import { useUIStore } from '@/store/uiStore'
import type { Collection, FilteredNote, NoteFilterCriteria } from '@/types'

const emptyFilter: NoteFilterCriteria = {}

export function CollectionsPage() {
  const vault = useVaultStore((s) => s.currentVault)
  const openNote = useWorkspaceStore((s) => s.openNote)
  const setMainView = useUIStore((s) => s.setMainView)

  const [collections, setCollections] = useState<Collection[]>([])
  const [selected, setSelected] = useState<Collection | null>(null)
  const [notes, setNotes] = useState<FilteredNote[]>([])
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [draftFilter, setDraftFilter] = useState<NoteFilterCriteria>(emptyFilter)
  const [preview, setPreview] = useState<FilteredNote[]>([])

  const load = () => {
    if (!vault) return
    api.listCollections(vault.id).then(setCollections)
  }

  useEffect(load, [vault])

  useEffect(() => {
    if (!vault || !selected) return
    api.collectionNotes(vault.id, selected.id).then(setNotes)
  }, [vault, selected])

  useEffect(() => {
    if (!vault || !creating) return
    const hasFilter = Object.values(draftFilter).some((v) => (Array.isArray(v) ? v.length > 0 : v !== undefined))
    if (!hasFilter) {
      setPreview([])
      return
    }
    const t = setTimeout(() => api.previewCollection(vault.id, draftFilter).then(setPreview), 300)
    return () => clearTimeout(t)
  }, [vault, draftFilter, creating])

  const open = (path: string) => {
    openNote(path)
    setMainView('editor')
  }

  const save = async () => {
    if (!vault || !name.trim()) return
    const c = await api.createCollection(vault.id, name.trim(), draftFilter)
    setCollections((prev) => [c, ...prev])
    setCreating(false)
    setName('')
    setDraftFilter(emptyFilter)
    setSelected(c)
  }

  const remove = async (id: string) => {
    if (!vault) return
    await api.deleteCollection(vault.id, id)
    if (selected?.id === id) setSelected(null)
    load()
  }

  return (
    <div className="h-full flex">
      <div className="w-64 border-r overflow-auto p-3 shrink-0" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase text-[var(--color-text-faint)]">
            <Layers size={12} /> Collections
          </span>
          <button onClick={() => setCreating(true)} className="p-1 rounded hover:bg-[var(--color-bg-inset)]">
            <Plus size={14} />
          </button>
        </div>
        {collections.map((c) => (
          <div key={c.id} className="flex items-center group">
            <button
              onClick={() => {
                setSelected(c)
                setCreating(false)
              }}
              className="flex-1 text-left px-2 py-1.5 rounded text-sm truncate"
              style={{
                background: selected?.id === c.id ? 'var(--color-accent-soft)' : 'transparent',
                color: selected?.id === c.id ? 'var(--color-accent)' : 'var(--color-text)',
              }}
            >
              {c.name}
            </button>
            <button onClick={() => remove(c.id)} className="p-1 opacity-0 group-hover:opacity-100 text-[var(--color-danger)]">
              <Trash2 size={12} />
            </button>
          </div>
        ))}
        {collections.length === 0 && !creating && (
          <div className="text-xs text-[var(--color-text-faint)] px-2 py-4">
            No collections yet. A collection is a saved filter that updates itself automatically.
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto p-6">
        {creating ? (
          <div className="max-w-md">
            <h2 className="text-sm font-semibold mb-3">New collection</h2>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. AI Research"
              className="settings-input w-full mb-3"
            />
            <FilterFields filter={draftFilter} onChange={setDraftFilter} />
            <div className="flex items-center justify-between mt-4">
              <span className="text-xs text-[var(--color-text-faint)]">{preview.length} matching notes</span>
              <div className="flex gap-2">
                <button onClick={() => setCreating(false)} className="px-3 py-1.5 rounded-md text-sm text-[var(--color-text-muted)]">
                  Cancel
                </button>
                <button
                  onClick={save}
                  disabled={!name.trim()}
                  className="px-3 py-1.5 rounded-md text-sm text-white disabled:opacity-40"
                  style={{ background: 'var(--color-accent)' }}
                >
                  Save collection
                </button>
              </div>
            </div>
          </div>
        ) : selected ? (
          <div className="max-w-2xl">
            <h1 className="text-lg font-semibold mb-1">{selected.name}</h1>
            <p className="text-sm text-[var(--color-text-faint)] mb-5">{notes.length} notes · updates automatically</p>
            <div className="space-y-1">
              {notes.map((n) => (
                <button
                  key={n.path}
                  onClick={() => open(n.path)}
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-[var(--color-bg-inset)] text-sm flex items-center justify-between"
                >
                  <span>{n.title}</span>
                  <span className="text-xs text-[var(--color-text-faint)]">{n.folder || '/'}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-sm text-[var(--color-text-faint)]">Select a collection, or create a new one.</div>
        )}
      </div>
    </div>
  )
}

function FilterFields({ filter, onChange }: { filter: NoteFilterCriteria; onChange: (f: NoteFilterCriteria) => void }) {
  return (
    <div className="space-y-3 text-sm">
      <label className="block">
        <span className="text-xs text-[var(--color-text-muted)]">Folder</span>
        <input
          value={filter.folder ?? ''}
          onChange={(e) => onChange({ ...filter, folder: e.target.value || undefined })}
          className="settings-input w-full mt-1"
        />
      </label>
      <label className="block">
        <span className="text-xs text-[var(--color-text-muted)]">Tags (comma-separated, all required)</span>
        <input
          value={(filter.tags ?? []).join(', ')}
          onChange={(e) =>
            onChange({ ...filter, tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })
          }
          className="settings-input w-full mt-1"
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-xs text-[var(--color-text-muted)]">Min links</span>
          <input
            type="number"
            value={filter.min_links ?? ''}
            onChange={(e) => onChange({ ...filter, min_links: e.target.value ? Number(e.target.value) : undefined })}
            className="settings-input w-full mt-1"
          />
        </label>
        <label className="block">
          <span className="text-xs text-[var(--color-text-muted)]">Min backlinks</span>
          <input
            type="number"
            value={filter.min_backlinks ?? ''}
            onChange={(e) => onChange({ ...filter, min_backlinks: e.target.value ? Number(e.target.value) : undefined })}
            className="settings-input w-full mt-1"
          />
        </label>
      </div>
    </div>
  )
}
