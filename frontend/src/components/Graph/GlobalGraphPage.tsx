import { useEffect, useMemo, useState } from 'react'
import { Search, Crosshair, RotateCcw } from 'lucide-react'
import { api } from '@/api/client'
import { useVaultStore } from '@/store/vaultStore'
import { useSettingsStore } from '@/store/settingsStore'
import { useWorkspaceStore } from '@/store/workspaceStore'
import { useUIStore } from '@/store/uiStore'
import { GraphView } from './GraphView'
import { computeIsolatedFilteredData } from '@/lib/graph'
import type { GraphData } from '@/types'

export function GlobalGraphPage() {
  const vault = useVaultStore((s) => s.currentVault)
  const graphSettings = useSettingsStore((s) => s.graph)
  const updateGraph = useSettingsStore((s) => s.updateGraph)
  const openNote = useWorkspaceStore((s) => s.openNote)
  const setMainView = useUIStore((s) => s.setMainView)
  const activePane = useWorkspaceStore((s) => s.panes.find((p) => p.id === s.activePaneId))

  const [raw, setRaw] = useState<GraphData>({ nodes: [], edges: [] })
  const [query, setQuery] = useState('')
  const [hideIsolated, setHideIsolated] = useState(false)
  const [focusCurrent, setFocusCurrent] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!vault) return
    api
      .globalGraph(vault.id, { includeUnresolved: graphSettings.showUnresolved, includeOrphans: graphSettings.showOrphans })
      .then(setRaw)
  }, [vault, graphSettings.showUnresolved, graphSettings.showOrphans, reloadKey])

  const filtered = useMemo(() => {
    let data = computeIsolatedFilteredData(raw, hideIsolated)
    if (query.trim()) {
      const q = query.toLowerCase()
      const matchingIds = new Set(data.nodes.filter((n) => n.title.toLowerCase().includes(q)).map((n) => n.id))
      data = { nodes: data.nodes.filter((n) => matchingIds.has(n.id)), edges: data.edges.filter((e) => matchingIds.has(e.source) && matchingIds.has(e.target)) }
    }
    return data
  }, [raw, hideIsolated, query])

  const focusPath = focusCurrent ? activePane?.activePath ?? null : null

  return (
    <div className="flex h-full">
      <div className="flex-1 relative">
        <GraphView
          key={reloadKey}
          data={filtered}
          focusPath={focusPath}
          showLabels={graphSettings.showLabels}
          showArrows={graphSettings.showArrows}
          onNodeClick={() => {}}
          onNodeDoubleClick={(_id, node) => {
            if (node.path) {
              openNote(node.path)
              setMainView('editor')
            }
          }}
        />
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border bg-[var(--color-bg-elevated)]" style={{ borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-glow)' }}>
            <Search size={13} className="text-[var(--color-text-faint)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search graph…"
              className="bg-transparent outline-none text-sm w-40"
            />
          </div>
          <button
            title="Focus current note"
            onClick={() => setFocusCurrent((v) => !v)}
            className="p-2 rounded-lg border bg-[var(--color-bg-elevated)]"
            style={{ borderColor: 'var(--color-border)', color: focusCurrent ? 'var(--color-accent)' : 'var(--color-text-muted)' }}
          >
            <Crosshair size={14} />
          </button>
          <button
            title="Reset view"
            onClick={() => setReloadKey((k) => k + 1)}
            className="p-2 rounded-lg border bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)]"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      <div className="w-64 border-l p-4 space-y-4 overflow-auto shrink-0" style={{ borderColor: 'var(--color-border)' }}>
        <div>
          <div className="text-xs font-semibold uppercase text-[var(--color-text-faint)] mb-2">Filters</div>
          <label className="flex items-center justify-between py-1 text-sm">
            <span>Show orphan notes</span>
            <input type="checkbox" checked={graphSettings.showOrphans} onChange={(e) => updateGraph({ showOrphans: e.target.checked })} />
          </label>
          <label className="flex items-center justify-between py-1 text-sm">
            <span>Show unresolved links</span>
            <input type="checkbox" checked={graphSettings.showUnresolved} onChange={(e) => updateGraph({ showUnresolved: e.target.checked })} />
          </label>
          <label className="flex items-center justify-between py-1 text-sm">
            <span>Hide isolated nodes</span>
            <input type="checkbox" checked={hideIsolated} onChange={(e) => setHideIsolated(e.target.checked)} />
          </label>
        </div>

        <div>
          <div className="text-xs font-semibold uppercase text-[var(--color-text-faint)] mb-2">Display</div>
          <label className="flex items-center justify-between py-1 text-sm">
            <span>Show labels</span>
            <input type="checkbox" checked={graphSettings.showLabels} onChange={(e) => updateGraph({ showLabels: e.target.checked })} />
          </label>
          <label className="flex items-center justify-between py-1 text-sm">
            <span>Show arrows</span>
            <input type="checkbox" checked={graphSettings.showArrows} onChange={(e) => updateGraph({ showArrows: e.target.checked })} />
          </label>
          <label className="flex items-center justify-between py-1 text-sm">
            <span>Animate layout</span>
            <input type="checkbox" checked={graphSettings.animate} onChange={(e) => updateGraph({ animate: e.target.checked })} />
          </label>
        </div>

        <div>
          <div className="text-xs font-semibold uppercase text-[var(--color-text-faint)] mb-2">Forces</div>
          <label className="block text-xs text-[var(--color-text-muted)] mb-1">Node size</label>
          <input
            type="range"
            min={3}
            max={14}
            value={graphSettings.nodeSize}
            onChange={(e) => updateGraph({ nodeSize: Number(e.target.value) })}
            className="w-full mb-2"
          />
          <label className="block text-xs text-[var(--color-text-muted)] mb-1">Link distance</label>
          <input
            type="range"
            min={20}
            max={220}
            value={graphSettings.linkDistance}
            onChange={(e) => updateGraph({ linkDistance: Number(e.target.value) })}
            className="w-full"
          />
        </div>

        <div className="text-xs text-[var(--color-text-faint)] pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
          {filtered.nodes.length} notes · {filtered.edges.length} links
        </div>
      </div>
    </div>
  )
}
