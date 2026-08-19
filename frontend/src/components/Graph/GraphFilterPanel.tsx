import { X } from 'lucide-react'
import { useGraphStore } from '@/store/graphStore'

interface Props {
  onClose: () => void
  matchCount: number
}

/** Multiple filters combine with AND — Folder=AI AND Tag=Research AND
 * Backlinks>5 all narrow the same result set (Section 12). */
export function GraphFilterPanel({ onClose, matchCount }: Props) {
  const filters = useGraphStore((s) => s.filters)
  const setFilters = useGraphStore((s) => s.setFilters)
  const clearFilters = useGraphStore((s) => s.clearFilters)

  return (
    <div
      className="glass-panel rounded-lg p-4 w-72 pointer-events-auto text-sm"
      style={{ boxShadow: 'var(--shadow-glow)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase text-[var(--color-text-faint)]">Graph Filters</span>
        <button onClick={onClose} className="p-1 rounded hover:bg-[var(--color-bg-inset)]">
          <X size={13} />
        </button>
      </div>

      <div className="space-y-3">
        <label className="block">
          <span className="text-xs text-[var(--color-text-muted)]">Folder</span>
          <input
            value={filters.folder ?? ''}
            onChange={(e) => setFilters({ folder: e.target.value || undefined })}
            placeholder="e.g. AI"
            className="settings-input w-full mt-1"
          />
        </label>

        <label className="block">
          <span className="text-xs text-[var(--color-text-muted)]">Tags (comma-separated, all required)</span>
          <input
            value={(filters.tags ?? []).join(', ')}
            onChange={(e) =>
              setFilters({
                tags: e.target.value
                  .split(',')
                  .map((t) => t.trim())
                  .filter(Boolean),
              })
            }
            placeholder="AI, Research"
            className="settings-input w-full mt-1"
          />
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-xs text-[var(--color-text-muted)]">Min links</span>
            <input
              type="number"
              min={0}
              value={filters.min_links ?? ''}
              onChange={(e) => setFilters({ min_links: e.target.value ? Number(e.target.value) : undefined })}
              className="settings-input w-full mt-1"
            />
          </label>
          <label className="block">
            <span className="text-xs text-[var(--color-text-muted)]">Min backlinks</span>
            <input
              type="number"
              min={0}
              value={filters.min_backlinks ?? ''}
              onChange={(e) => setFilters({ min_backlinks: e.target.value ? Number(e.target.value) : undefined })}
              className="settings-input w-full mt-1"
            />
          </label>
        </div>

        <Toggle
          label="Orphan nodes only"
          checked={!!filters.orphans_only}
          onChange={(v) => setFilters({ orphans_only: v || undefined })}
        />
        <Toggle
          label="Unresolved links only"
          checked={!!filters.has_unresolved_only}
          onChange={(v) => setFilters({ has_unresolved_only: v || undefined })}
        />
        <Toggle
          label="Daily notes only"
          checked={!!filters.daily_notes_only}
          onChange={(v) => setFilters({ daily_notes_only: v || undefined })}
        />
      </div>

      <div className="flex items-center justify-between mt-4 pt-3 border-t text-xs" style={{ borderColor: 'var(--color-border)' }}>
        <span className="text-[var(--color-text-faint)]">{matchCount} match{matchCount === 1 ? '' : 'es'}</span>
        <button onClick={clearFilters} className="text-[var(--color-accent)] hover:underline">
          Clear all
        </button>
      </div>
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between">
      <span className="text-xs text-[var(--color-text-muted)]">{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  )
}
