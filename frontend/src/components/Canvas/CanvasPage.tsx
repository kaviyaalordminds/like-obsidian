import { useEffect, useState } from 'react'
import { LayoutDashboard, Plus, Trash2 } from 'lucide-react'
import { api } from '@/api/client'
import { useVaultStore } from '@/store/vaultStore'
import { CanvasEditor } from './CanvasEditor'

export function CanvasPage() {
  const vault = useVaultStore((s) => s.currentVault)
  const [canvases, setCanvases] = useState<string[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')

  const load = () => {
    if (!vault) return
    api.listCanvases(vault.id).then((list) => {
      setCanvases(list)
      if (!selected && list.length > 0) setSelected(list[0])
    })
  }

  useEffect(load, [vault])

  const create = async () => {
    if (!vault || !name.trim()) return
    const res = await api.createCanvas(vault.id, name.trim(), name.trim())
    setCreating(false)
    setName('')
    await load()
    setSelected(res.path)
  }

  const remove = async (path: string) => {
    if (!vault) return
    if (!confirm(`Delete canvas "${path}"?`)) return
    await api.deleteCanvas(vault.id, path)
    if (selected === path) setSelected(null)
    load()
  }

  if (!vault) return null

  return (
    <div className="h-full flex">
      <div className="w-56 border-r overflow-auto p-3 shrink-0" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase text-[var(--color-text-faint)]">
            <LayoutDashboard size={12} /> Canvases
          </span>
          <button
            onClick={() => setCreating(true)}
            title="New canvas"
            aria-label="New canvas"
            className="p-1 rounded hover:bg-[var(--color-bg-inset)]"
          >
            <Plus size={14} />
          </button>
        </div>
        {creating && (
          <div className="flex items-center gap-1 mb-2 px-1">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && create()}
              onBlur={() => !name.trim() && setCreating(false)}
              placeholder="Canvas name"
              className="settings-input flex-1 text-xs"
            />
          </div>
        )}
        {canvases.map((c) => (
          <div key={c} className="flex items-center group">
            <button
              onClick={() => setSelected(c)}
              className="flex-1 text-left px-2 py-1.5 rounded text-sm truncate"
              style={{
                background: selected === c ? 'var(--color-accent-soft)' : 'transparent',
                color: selected === c ? 'var(--color-accent)' : 'var(--color-text)',
              }}
            >
              {c.replace(/\.canvas$/, '')}
            </button>
            <button
              onClick={() => remove(c)}
              title="Delete canvas"
              aria-label="Delete canvas"
              className="p-1 opacity-0 group-hover:opacity-100 text-[var(--color-danger)]"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
        {canvases.length === 0 && !creating && (
          <div className="text-xs text-[var(--color-text-faint)] px-2 py-4">
            No canvases yet. A canvas is a free-form board of note cards, stored as its own file next to your notes.
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        {selected ? (
          <CanvasEditor key={selected} vaultId={vault.id} path={selected} />
        ) : (
          <div className="h-full flex items-center justify-center text-sm text-[var(--color-text-faint)]">
            Select or create a canvas.
          </div>
        )}
      </div>
    </div>
  )
}
