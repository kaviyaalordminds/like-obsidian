import { useEffect, useState } from 'react'
import { Camera, Trash2, X } from 'lucide-react'
import { api } from '@/api/client'
import { useGraphStore } from '@/store/graphStore'
import type { GraphSnapshot } from '@/types'

interface Props {
  vaultId: string
  onClose: () => void
}

/** Saves the current filters/query/mode/selection/pin-hide state (Section
 * 20). Reopening a snapshot re-applies that state and re-queries the live
 * graph — it's a saved lens, not a frozen picture. */
export function SnapshotPanel({ vaultId, onClose }: Props) {
  const [snapshots, setSnapshots] = useState<GraphSnapshot[]>([])
  const [name, setName] = useState('')
  const toSnapshotState = useGraphStore((s) => s.toSnapshotState)
  const loadSnapshotState = useGraphStore((s) => s.loadSnapshotState)

  const load = () => api.listSnapshots(vaultId).then(setSnapshots)

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vaultId])

  const save = async () => {
    if (!name.trim()) return
    await api.createSnapshot(vaultId, name.trim(), toSnapshotState() as unknown as Record<string, unknown>)
    setName('')
    load()
  }

  const remove = async (id: string) => {
    await api.deleteSnapshot(vaultId, id)
    load()
  }

  return (
    <div className="glass-panel rounded-lg p-4 w-72 pointer-events-auto text-sm" style={{ boxShadow: 'var(--shadow-glow)' }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase text-[var(--color-text-faint)] flex items-center gap-1.5">
          <Camera size={13} /> Graph Snapshots
        </span>
        <button onClick={onClose} className="p-1 rounded hover:bg-[var(--color-bg-inset)]">
          <X size={13} />
        </button>
      </div>

      <div className="space-y-1 max-h-48 overflow-auto mb-3">
        {snapshots.map((s) => (
          <div key={s.id} className="flex items-center gap-1.5 group">
            <button
              onClick={() => loadSnapshotState(s.state)}
              className="flex-1 text-left px-2 py-1.5 rounded hover:bg-[var(--color-bg-inset)] truncate"
            >
              {s.name}
            </button>
            <button
              onClick={() => remove(s.id)}
              className="p-1 opacity-0 group-hover:opacity-100 text-[var(--color-danger)]"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
        {snapshots.length === 0 && <div className="text-xs text-[var(--color-text-faint)] px-2">No saved views yet.</div>}
      </div>

      <div className="flex items-center gap-2 pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          placeholder="e.g. AI Research Map"
          className="settings-input flex-1"
        />
        <button onClick={save} className="px-3 py-1.5 rounded-md text-sm text-white" style={{ background: 'var(--color-accent)' }}>
          Save
        </button>
      </div>
    </div>
  )
}
