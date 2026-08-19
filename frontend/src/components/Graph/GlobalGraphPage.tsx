import { useEffect, useMemo, useState } from 'react'
import type { Core } from 'cytoscape'
import {
  Search,
  Crosshair,
  RotateCcw,
  SlidersHorizontal,
  Camera,
  Route,
  Radar,
  Maximize2,
  Minimize2,
  Download,
  ChevronLeft,
  ChevronRight,
  ScanLine,
  Eye,
  Palette,
  Layers,
} from 'lucide-react'
import { api } from '@/api/client'
import { useVaultStore } from '@/store/vaultStore'
import { useSettingsStore } from '@/store/settingsStore'
import { useWorkspaceStore } from '@/store/workspaceStore'
import { useUIStore } from '@/store/uiStore'
import { useGraphStore, type ColorStrategy, type GraphMode, type RelationKind } from '@/store/graphStore'
import { useEventStore } from '@/store/eventStore'
import { GraphView } from './GraphView'
import { GraphHUD } from './GraphHUD'
import { GraphMinimap } from './GraphMinimap'
import { GraphFilterPanel } from './GraphFilterPanel'
import { GraphThemePanel } from './GraphThemePanel'
import { KnowledgeCorePanel } from './KnowledgeCorePanel'
import { KnowledgeInspector } from './KnowledgeInspector'
import { KnowledgePathPanel } from './KnowledgePathPanel'
import { SnapshotPanel } from './SnapshotPanel'
import { ContextMenu, type MenuItem } from '@/components/FileExplorer/ContextMenu'
import { computeIsolatedFilteredData, resolvePerformanceMode } from '@/lib/graph'
import type { GraphPerformanceMode } from '@/store/settingsStore'
import { exportGraphCsv, exportGraphJson, exportGraphPng, exportGraphSvg } from '@/lib/graphExport'
import { getGraphTheme } from '@/lib/graphThemes'
import type { GraphData, GraphNode } from '@/types'

const MODES: { id: GraphMode; label: string }[] = [
  { id: 'classic', label: 'Classic' },
  { id: 'neural', label: 'Neural' },
  { id: 'radial', label: 'Radial' },
  { id: 'cinematic', label: 'Cinematic' },
  { id: 'tree', label: 'Tree' },
  { id: 'hierarchical', label: 'Hierarchical' },
  { id: 'cluster', label: 'Cluster' },
  { id: 'constellation', label: 'Constellation' },
  { id: 'circular', label: 'Circular' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'dag', label: 'DAG' },
]

const COLOR_STRATEGIES: { id: ColorStrategy; label: string }[] = [
  { id: 'default', label: 'Default' },
  { id: 'folder', label: 'Folder' },
  { id: 'tag', label: 'Tag' },
  { id: 'cluster', label: 'Cluster' },
  { id: 'linkCount', label: 'Link count' },
  { id: 'backlinkCount', label: 'Backlink count' },
  { id: 'created', label: 'Created date' },
  { id: 'modified', label: 'Modified date' },
  { id: 'fileType', label: 'File type' },
  { id: 'status', label: 'Status' },
]

export function GlobalGraphPage() {
  const vault = useVaultStore((s) => s.currentVault)
  const graphSettings = useSettingsStore((s) => s.graph)
  const updateGraph = useSettingsStore((s) => s.updateGraph)
  const effects = useSettingsStore((s) => s.effects)
  const openNote = useWorkspaceStore((s) => s.openNote)
  const setMainView = useUIStore((s) => s.setMainView)
  const activePane = useWorkspaceStore((s) => s.panes.find((p) => p.id === s.activePaneId))

  const gs = useGraphStore()
  const customThemes = useSettingsStore((s) => s.customGraphThemes)
  const theme = getGraphTheme(gs.themeId, customThemes)

  const [raw, setRaw] = useState<GraphData>({ nodes: [], edges: [] })
  const [filteredPaths, setFilteredPaths] = useState<Set<string> | null>(null)
  const [hideIsolated, setHideIsolated] = useState(false)
  const [focusCurrent, setFocusCurrent] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [pathOverride, setPathOverride] = useState<GraphData | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: GraphNode } | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [cy, setCy] = useState<Core | null>(null)
  const [clusterOf, setClusterOf] = useState<Map<string, string> | null>(null)
  const graphVersion = useEventStore((s) => s.graphVersion)

  useEffect(() => {
    if (!vault) return
    api
      .globalGraph(vault.id, {
        includeUnresolved: graphSettings.showUnresolved,
        includeOrphans: graphSettings.showOrphans,
        relations: [...gs.relationKinds],
      })
      .then(setRaw)
  }, [vault, graphSettings.showUnresolved, graphSettings.showOrphans, gs.relationKinds, reloadKey, graphVersion])

  useEffect(() => {
    if (!vault || gs.mode !== 'cluster') {
      setClusterOf(null)
      return
    }
    api.graphClusters(vault.id, gs.clusterStrategy).then((clusters) => {
      const map = new Map<string, string>()
      clusters.forEach((c) => c.node_ids.forEach((id) => map.set(id, c.id)))
      setClusterOf(map)
    })
  }, [vault, gs.mode, gs.clusterStrategy, reloadKey])

  // Re-evaluate the filter panel's criteria against the live vault whenever
  // it changes, rather than filtering client-side against stale fields the
  // graph payload doesn't carry (e.g. backlink counts).
  useEffect(() => {
    if (!vault) return
    const hasActiveFilter = Object.values(gs.filters).some((v) => (Array.isArray(v) ? v.length > 0 : v !== undefined))
    if (!hasActiveFilter) {
      setFilteredPaths(null)
      return
    }
    api.previewCollection(vault.id, gs.filters).then((notes) => setFilteredPaths(new Set(notes.map((n) => n.path))))
  }, [vault, gs.filters])

  const filtered = useMemo(() => {
    if (pathOverride) return pathOverride
    let data = computeIsolatedFilteredData(raw, hideIsolated)
    if (filteredPaths) {
      data = {
        nodes: data.nodes.filter((n) => filteredPaths.has(n.id) || n.type === 'unresolved'),
        edges: data.edges,
      }
      const ids = new Set(data.nodes.map((n) => n.id))
      data = { nodes: data.nodes, edges: data.edges.filter((e) => ids.has(e.source) && ids.has(e.target)) }
    }
    if (gs.query.trim() && gs.mode !== 'classic') {
      // In classic mode the search bar just dims via GraphView's own query
      // prop; other modes keep the full set so radial/neural focus effects
      // still have context, and GraphView handles the dim/highlight.
    }
    return data
  }, [raw, hideIsolated, filteredPaths, pathOverride, gs.query, gs.mode])

  const focusPath = focusCurrent ? activePane?.activePath ?? null : null

  const openAndNavigate = (path: string) => {
    openNote(path)
    setMainView('editor')
  }

  const buildMenu = (node: GraphNode): MenuItem[] => {
    const items: MenuItem[] = []
    if (node.path) {
      items.push(
        { label: 'Open note', onClick: () => openAndNavigate(node.path!) },
        { label: 'Open in new pane', onClick: () => { openNote(node.path!, { newPane: true }); setMainView('editor') } },
        { label: '', onClick: () => {}, separator: true },
        { label: 'Focus node', onClick: () => gs.selectNode(node.id) },
        { label: gs.pinnedNodeIds.has(node.id) ? 'Unpin node' : 'Pin node', onClick: () => gs.togglePin(node.id) },
        { label: 'Hide node', onClick: () => gs.toggleHidden(node.id) },
        { label: '', onClick: () => {}, separator: true },
        { label: 'Show backlinks', onClick: () => { openAndNavigate(node.path!); useUIStore.getState().setRightPanelTab('backlinks') } },
        { label: 'Show local graph', onClick: () => { openAndNavigate(node.path!); useUIStore.getState().setRightPanelTab('local-graph') } },
      )
    } else {
      items.push({ label: `Create "${node.title}"`, onClick: async () => {
        if (!vault) return
        const note = await api.createNote(vault.id, `${node.title}.md`, `# ${node.title}\n\n`)
        await useVaultStore.getState().refreshTree()
        openAndNavigate(note.path)
      } })
    }
    return items
  }

  const scanNetwork = () => {
    if (!cy || scanning) return
    setScanning(true)
    const nodes = cy.nodes().toArray()
    if (!effects.enabled || effects.reducedMotion) {
      // Reduced-motion alternative: no staggered reveal, just confirm the
      // scan ran by briefly flashing the HUD instead of animating nodes.
      setTimeout(() => setScanning(false), 400)
      return
    }
    nodes.forEach((n) => n.style('opacity', 0))
    let i = 0
    const reveal = () => {
      if (i >= nodes.length) {
        setScanning(false)
        return
      }
      const batch = nodes.slice(i, i + 3)
      batch.forEach((n) => n.animate({ style: { opacity: 1 } }, { duration: 220 }))
      i += 3
      setTimeout(reveal, 35)
    }
    reveal()
  }

  const selectedNode = gs.selectedNodeId ? filtered.nodes.find((n) => n.id === gs.selectedNodeId) : null

  if (!vault) return null

  return (
    <div className={`flex h-full ${gs.presentationMode ? 'fixed inset-0 z-40' : ''}`} style={gs.presentationMode ? { background: 'var(--color-bg)' } : undefined}>
      <div className="flex-1 relative">
        <GraphView
          data={filtered}
          mode={gs.mode}
          theme={theme}
          colorStrategy={gs.colorStrategy}
          clusterOf={clusterOf ?? undefined}
          collapsedClusters={gs.collapsedClusters}
          onToggleCluster={gs.toggleClusterCollapsed}
          focusPath={focusPath}
          selectedNodeId={gs.selectedNodeId}
          pinnedIds={gs.pinnedNodeIds}
          hiddenIds={gs.hiddenNodeIds}
          query={gs.mode === 'classic' ? '' : gs.query}
          showLabels={graphSettings.showLabels}
          showArrows={graphSettings.showArrows}
          onReady={setCy}
          onNodeClick={(id) => gs.selectNode(id)}
          onNodeDoubleClick={(_id, node) => node.path && openAndNavigate(node.path)}
          onNodeContextMenu={(_id, node, x, y) => setContextMenu({ x, y, node })}
          onBackgroundClick={() => {
            gs.selectNode(null, { pushHistory: false })
            setContextMenu(null)
          }}
        />

        {/* Top-left: search, focus, history, reset, scan */}
        {!gs.presentationMode && (
          <div className="absolute top-3 left-3 flex items-center gap-2 flex-wrap max-w-[70%]">
            <div
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg glass-panel"
              style={{ boxShadow: 'var(--shadow-glow)' }}
            >
              <Search size={13} className="text-[var(--color-text-faint)]" />
              <input
                value={gs.query}
                onChange={(e) => gs.setQuery(e.target.value)}
                placeholder="Search within graph…"
                className="bg-transparent outline-none text-sm w-40"
              />
            </div>

            <ToolButton title="Back" onClick={gs.back} disabled={!gs.canGoBack()}>
              <ChevronLeft size={14} />
            </ToolButton>
            <ToolButton title="Forward" onClick={gs.forward} disabled={!gs.canGoForward()}>
              <ChevronRight size={14} />
            </ToolButton>
            <ToolButton title="Focus current note" active={focusCurrent} onClick={() => setFocusCurrent((v) => !v)}>
              <Crosshair size={14} />
            </ToolButton>
            <ToolButton title="Reset view" onClick={() => { setReloadKey((k) => k + 1); gs.resetView() }}>
              <RotateCcw size={14} />
            </ToolButton>
            <ToolButton title="Scan network" onClick={scanNetwork} disabled={scanning}>
              <ScanLine size={14} className={scanning ? 'animate-pulse' : ''} />
            </ToolButton>
            {gs.hiddenNodeIds.size > 0 && (
              <ToolButton title={`Show ${gs.hiddenNodeIds.size} hidden node(s)`} onClick={gs.showHiddenNodes}>
                <Eye size={14} />
              </ToolButton>
            )}
          </div>
        )}

        {/* Top-center, second row: mode switcher (own row so it can never
            overlap the left toolbar regardless of how many buttons are
            visible there). */}
        <div
          className="absolute top-16 left-1/2 -translate-x-1/2 flex flex-wrap items-center justify-center gap-0.5 rounded-lg glass-panel p-1 max-w-[92vw]"
          style={{ boxShadow: 'var(--shadow-glow)' }}
        >
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => gs.setMode(m.id)}
              className="px-3 py-1.5 rounded text-xs font-medium"
              style={{
                background: gs.mode === m.id ? 'var(--color-accent-soft)' : 'transparent',
                color: gs.mode === m.id ? 'var(--color-accent)' : 'var(--color-text-muted)',
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Top-right: panel toggles */}
        <div className="absolute top-3 right-3 flex items-center gap-2">
          <ToolButton title="Graph theme" active={gs.openPanel === 'theme'} onClick={() => gs.setOpenPanel('theme')}>
            <Palette size={14} />
          </ToolButton>
          <ToolButton title="Knowledge core" active={gs.openPanel === 'core'} onClick={() => gs.setOpenPanel('core')}>
            <Layers size={14} />
          </ToolButton>
          <ToolButton title="Filters" active={gs.showFilterPanel} onClick={gs.toggleFilterPanel}>
            <SlidersHorizontal size={14} />
          </ToolButton>
          <ToolButton title="Knowledge path" active={gs.openPanel === 'path'} onClick={() => gs.setOpenPanel('path')}>
            <Route size={14} />
          </ToolButton>
          <ToolButton title="Snapshots" active={gs.openPanel === 'snapshot'} onClick={() => gs.setOpenPanel('snapshot')}>
            <Camera size={14} />
          </ToolButton>
          <div className="relative">
            <ToolButton title="Export" active={exportOpen} onClick={() => setExportOpen((v) => !v)}>
              <Download size={14} />
            </ToolButton>
            {exportOpen && (
              <div className="absolute right-0 mt-1 glass-panel rounded-lg overflow-hidden text-xs w-32" style={{ boxShadow: 'var(--shadow-glow)' }}>
                {(['PNG', 'SVG', 'JSON', 'CSV'] as const).map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => {
                      if (!cy) return
                      if (fmt === 'PNG') exportGraphPng(cy, `${vault.slug}-graph.png`)
                      if (fmt === 'SVG') exportGraphSvg(cy, `${vault.slug}-graph.svg`)
                      if (fmt === 'JSON') exportGraphJson(filtered, `${vault.slug}-graph.json`)
                      if (fmt === 'CSV') exportGraphCsv(filtered, `${vault.slug}-graph.csv`)
                      setExportOpen(false)
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-[var(--color-bg-inset)]"
                  >
                    Export as {fmt}
                  </button>
                ))}
              </div>
            )}
          </div>
          <ToolButton title={gs.presentationMode ? 'Exit presentation' : 'Presentation mode'} active={gs.presentationMode} onClick={gs.togglePresentation}>
            {gs.presentationMode ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </ToolButton>
        </div>

        {/* Floating side panels */}
        <div className="absolute top-16 right-3 flex flex-col items-end gap-2 max-w-[85vw]">
          {gs.showFilterPanel && <GraphFilterPanel onClose={gs.toggleFilterPanel} matchCount={filtered.nodes.length} />}
          {gs.openPanel === 'path' && (
            <KnowledgePathPanel vaultId={vault.id} onClose={() => gs.setOpenPanel(null)} onPathFound={setPathOverride} />
          )}
          {gs.openPanel === 'snapshot' && <SnapshotPanel vaultId={vault.id} onClose={() => gs.setOpenPanel(null)} />}
          {gs.openPanel === 'theme' && <GraphThemePanel onClose={() => gs.setOpenPanel(null)} />}
          {gs.openPanel === 'core' && (
            <KnowledgeCorePanel
              vaultId={vault.id}
              clusterStrategy={gs.clusterStrategy}
              onClose={() => gs.setOpenPanel(null)}
              onSelectNote={(id) => gs.selectNode(id)}
            />
          )}
        </div>

        {selectedNode && gs.showInspector && !gs.presentationMode && (
          <div className="absolute bottom-3 right-3">
            <KnowledgeInspector
              vaultId={vault.id}
              path={selectedNode.id}
              pinned={gs.pinnedNodeIds.has(selectedNode.id)}
              onClose={() => gs.selectNode(null, { pushHistory: false })}
              onOpen={() => openAndNavigate(selectedNode.id)}
              onFocus={() => gs.selectNode(selectedNode.id)}
              onTogglePin={() => gs.togglePin(selectedNode.id)}
              onHide={() => {
                gs.toggleHidden(selectedNode.id)
                gs.selectNode(null, { pushHistory: false })
              }}
            />
          </div>
        )}

        {gs.showHud && effects.showHud && !gs.presentationMode && (
          <div className="absolute bottom-3 left-3">
            <GraphHUD
              vaultId={vault.id}
              clusterStrategy={gs.clusterStrategy}
              refreshKey={reloadKey}
              onSelectMostConnected={(id) => gs.selectNode(id)}
            />
          </div>
        )}

        {gs.showMinimap && !gs.presentationMode && (
          <div className="absolute bottom-3" style={{ left: gs.showHud && effects.showHud ? 232 : 12 }}>
            <GraphMinimap cy={cy} />
          </div>
        )}

        {pathOverride && (
          <button
            onClick={() => setPathOverride(null)}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg glass-panel text-xs"
            style={{ boxShadow: 'var(--shadow-glow)' }}
          >
            Showing knowledge path — click to clear
          </button>
        )}

        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            items={buildMenu(contextMenu.node)}
            onClose={() => setContextMenu(null)}
          />
        )}
      </div>

      {!gs.presentationMode && (
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
            <label className="flex items-center justify-between py-1 text-sm">
              <span>Performance</span>
              <select
                value={graphSettings.performanceMode}
                onChange={(e) => updateGraph({ performanceMode: e.target.value as GraphPerformanceMode })}
                className="settings-select text-xs"
              >
                <option value="auto">Auto ({resolvePerformanceMode('auto', filtered.nodes.length)})</option>
                <option value="low">Low</option>
                <option value="balanced">Balanced</option>
                <option value="high">High</option>
                <option value="quality">Quality</option>
              </select>
            </label>
            <label className="flex items-center justify-between py-1 text-sm">
              <span>Color by</span>
              <select
                value={gs.colorStrategy}
                onChange={(e) => gs.setColorStrategy(e.target.value as ColorStrategy)}
                className="settings-select text-xs"
              >
                {COLOR_STRATEGIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center justify-between py-1 text-sm">
              <span>Tag relations</span>
              <input
                type="checkbox"
                checked={gs.relationKinds.has('tag-relation')}
                onChange={() => gs.toggleRelationKind('tag-relation' as RelationKind)}
              />
            </label>
            <label className="flex items-center justify-between py-1 text-sm">
              <span>Folder relations</span>
              <input
                type="checkbox"
                checked={gs.relationKinds.has('folder-relation')}
                onChange={() => gs.toggleRelationKind('folder-relation' as RelationKind)}
              />
            </label>
            <label className="flex items-center justify-between py-1 text-sm">
              <span>Cluster by</span>
              <select
                value={gs.clusterStrategy}
                onChange={(e) => gs.setClusterStrategy(e.target.value as 'folder' | 'connected')}
                className="settings-select text-xs"
              >
                <option value="folder">Folder</option>
                <option value="connected">Connectivity</option>
              </select>
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

          <div className="text-xs text-[var(--color-text-faint)] pt-2 border-t flex items-center gap-1.5" style={{ borderColor: 'var(--color-border)' }}>
            <Radar size={11} />
            {filtered.nodes.length} notes · {filtered.edges.length} links
          </div>
        </div>
      )}
    </div>
  )
}

function ToolButton({
  children,
  onClick,
  title,
  active,
  disabled,
}: {
  children: React.ReactNode
  onClick: () => void
  title: string
  active?: boolean
  disabled?: boolean
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="p-2 rounded-lg glass-panel disabled:opacity-30"
      style={{
        boxShadow: 'var(--shadow-glow)',
        color: active ? 'var(--color-accent)' : 'var(--color-text-muted)',
      }}
    >
      {children}
    </button>
  )
}
