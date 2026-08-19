import { useEffect, useMemo, useRef, useState } from 'react'
import CytoscapeComponent from 'react-cytoscapejs'
import type { Core, EventObject } from 'cytoscape'
import type { GraphData, GraphNode } from '@/types'
import { useSettingsStore } from '@/store/settingsStore'
import type { ColorStrategy, GraphMode } from '@/store/graphStore'
import { computeDegrees, computeDistances, degreeToRadius, hashColor, lerpColor, resolvePerformanceMode } from '@/lib/graph'
import { BUILTIN_GRAPH_THEMES, type GraphTheme } from '@/lib/graphThemes'

interface Props {
  data: GraphData
  mode?: GraphMode
  theme?: GraphTheme
  colorStrategy?: ColorStrategy
  clusterOf?: Map<string, string>
  collapsedClusters?: Set<string>
  onToggleCluster?: (clusterId: string) => void
  focusPath?: string | null
  selectedNodeId?: string | null
  pinnedIds?: Set<string>
  hiddenIds?: Set<string>
  query?: string
  onNodeClick?: (nodeId: string, node: GraphNode) => void
  onNodeDoubleClick?: (nodeId: string, node: GraphNode) => void
  onNodeContextMenu?: (nodeId: string, node: GraphNode, x: number, y: number) => void
  onBackgroundClick?: () => void
  showLabels?: boolean
  showArrows?: boolean
  interactive?: boolean
  onReady?: (cy: Core) => void
}

export function GraphView({
  data,
  mode = 'classic',
  theme = BUILTIN_GRAPH_THEMES[0],
  colorStrategy = 'default',
  clusterOf,
  collapsedClusters,
  onToggleCluster,
  focusPath,
  selectedNodeId,
  pinnedIds,
  hiddenIds,
  query = '',
  onNodeClick,
  onNodeDoubleClick,
  onNodeContextMenu,
  onBackgroundClick,
  showLabels = true,
  showArrows = false,
  interactive = true,
  onReady,
}: Props) {
  const cyRef = useRef<Core | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const graphSettings = useSettingsStore((s) => s.graph)
  const effects = useSettingsStore((s) => s.effects)
  const perfTier = resolvePerformanceMode(graphSettings.performanceMode, data.nodes.length)
  const motionEnabled = effects.enabled && !effects.reducedMotion && graphSettings.animate && perfTier !== 'low'
  const effectiveShowLabels = showLabels && (perfTier !== 'low' || data.nodes.length < 60)
  const [ringPos, setRingPos] = useState<{ x: number; y: number; r: number } | null>(null)

  const visibleData = useMemo(() => {
    if (!hiddenIds || hiddenIds.size === 0) return data
    return {
      nodes: data.nodes.filter((n) => !hiddenIds.has(n.id)),
      edges: data.edges.filter((e) => !hiddenIds.has(e.source) && !hiddenIds.has(e.target)),
    }
  }, [data, hiddenIds])

  const degrees = useMemo(() => computeDegrees(visibleData), [visibleData])
  const distances = useMemo(
    () => (selectedNodeId ? computeDistances(visibleData, selectedNodeId) : null),
    [visibleData, selectedNodeId],
  )
  const matchedIds = useMemo(() => {
    if (!query.trim()) return null
    const q = query.trim().toLowerCase()
    return new Set(visibleData.nodes.filter((n) => n.title.toLowerCase().includes(q)).map((n) => n.id))
  }, [visibleData, query])

  // Continuous strategies (link/backlink count, created/modified recency)
  // need the min/max of the currently-visible set to normalize against —
  // never a fixed scale, so the gradient always reflects the notes actually
  // on screen.
  const colorRange = useMemo(() => {
    if (colorStrategy === 'linkCount' || colorStrategy === 'backlinkCount') {
      const values = visibleData.nodes.map((n) => {
        const d = degrees.get(n.id)
        return colorStrategy === 'linkCount' ? (d?.out ?? 0) : (d?.in ?? 0)
      })
      return { min: Math.min(0, ...values), max: Math.max(1, ...values) }
    }
    if (colorStrategy === 'created' || colorStrategy === 'modified') {
      const values = visibleData.nodes
        .map((n) => (colorStrategy === 'created' ? n.created_at : n.updated_at))
        .filter((v): v is number => v != null)
      if (values.length === 0) return { min: 0, max: 1 }
      return { min: Math.min(...values), max: Math.max(...values) }
    }
    return null
  }, [visibleData, degrees, colorStrategy])

  const nodeColor = useMemo(() => {
    return (n: GraphNode): string => {
      switch (colorStrategy) {
        case 'folder':
          return n.folder ? hashColor(n.folder) : theme.colors.orphan
        case 'tag':
          return n.tags[0] ? hashColor(n.tags[0]) : theme.colors.orphan
        case 'cluster':
          return clusterOf?.get(n.id) ? hashColor(clusterOf.get(n.id)!) : theme.colors.orphan
        case 'fileType':
          return n.type === 'unresolved' ? theme.colors.unresolved : hashColor('note')
        case 'status':
          return hashColor(n.status ?? 'none')
        case 'linkCount':
        case 'backlinkCount': {
          if (!colorRange) return theme.colors.node
          const raw = (colorStrategy === 'linkCount' ? degrees.get(n.id)?.out : degrees.get(n.id)?.in) ?? 0
          const t = (raw - colorRange.min) / Math.max(1, colorRange.max - colorRange.min)
          return lerpColor(theme.colors.orphan, theme.colors.node, t)
        }
        case 'created':
        case 'modified': {
          if (!colorRange) return theme.colors.node
          const raw = colorStrategy === 'created' ? n.created_at : n.updated_at
          if (raw == null) return theme.colors.orphan
          const t = (raw - colorRange.min) / Math.max(1, colorRange.max - colorRange.min)
          return lerpColor(theme.colors.orphan, theme.colors.node, t)
        }
        default:
          return n.type === 'unresolved' ? 'transparent' : theme.colors.node
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colorStrategy, colorRange, clusterOf, theme, degrees])

  // Timeline mode: real x position from each note's own timestamp,
  // normalized to the container width — never a hardcoded layout.
  const timelinePositions = useMemo(() => {
    if (mode !== 'timeline') return null
    const values = visibleData.nodes.map((n) => n.updated_at ?? n.created_at ?? 0)
    const min = Math.min(...values, 0)
    const max = Math.max(...values, min + 1)
    const positions = new Map<string, { x: number; y: number }>()
    const laneCount = 6
    visibleData.nodes.forEach((n) => {
      const t = n.updated_at ?? n.created_at ?? min
      const x = 60 + ((t - min) / Math.max(1, max - min)) * 2400
      const lane = Math.abs(hashColor(n.folder || 'root').charCodeAt(1)) % laneCount
      positions.set(n.id, { x, y: 60 + lane * 90 })
    })
    return positions
  }, [mode, visibleData])

  const elements = useMemo(() => {
    const isDimmed = (id: string) => {
      if (matchedIds) return !matchedIds.has(id)
      if (distances) return (distances.get(id) ?? Infinity) > 2
      return false
    }

    // Cluster mode: nodes in a collapsed cluster are replaced by a single
    // compound "parent" node sized by real member count; edges between two
    // collapsed clusters (or a collapsed cluster and a loose node) are
    // rewritten to point at the cluster id instead of the hidden member.
    if (mode === 'cluster' && clusterOf) {
      const clusterIds = new Set(clusterOf.values())
      const clusterMembers = new Map<string, GraphNode[]>()
      visibleData.nodes.forEach((n) => {
        const cid = clusterOf.get(n.id)
        if (!cid) return
        if (!clusterMembers.has(cid)) clusterMembers.set(cid, [])
        clusterMembers.get(cid)!.push(n)
      })

      const resolve = (id: string) => {
        const cid = clusterOf.get(id)
        return cid && collapsedClusters?.has(cid) ? `cluster:${cid}` : id
      }

      const parents = [...clusterIds].map((cid) => {
        const members = clusterMembers.get(cid) ?? []
        const collapsed = collapsedClusters?.has(cid) ?? false
        return {
          data: {
            id: `cluster:${cid}`,
            label: `${cid} (${members.length})`,
            isClusterParent: 1,
            clusterId: cid,
            collapsed: collapsed ? 1 : 0,
            // Always populated (never left undefined) so the base node
            // selector's `width: 'data(size)'` mapper always resolves —
            // an expanded compound node still gets overridden to "auto" by
            // the isClusterParent stylesheet rule below, but Cytoscape logs
            // a console warning on every style resolution pass for any
            // element missing a mapped field, so this stays defined either way.
            size: degreeToRadius(members.length, graphSettings.nodeSize * 1.6) * 2,
          },
        }
      })

      const nodes = visibleData.nodes
        .filter((n) => {
          const cid = clusterOf.get(n.id)
          return !cid || !collapsedClusters?.has(cid)
        })
        .map((n) => {
          const degree = degrees.get(n.id)?.total ?? 0
          const diameter = degreeToRadius(degree, graphSettings.nodeSize) * 2
          const cid = clusterOf.get(n.id)
          return {
            data: {
              id: n.id,
              label: n.title,
              type: n.type,
              folder: n.folder,
              degree,
              size: diameter,
              color: nodeColor(n),
              pinned: pinnedIds?.has(n.id) ? 1 : 0,
              dimmed: isDimmed(n.id) ? 1 : 0,
              matched: matchedIds?.has(n.id) ? 1 : 0,
              parent: cid ? `cluster:${cid}` : undefined,
            },
          }
        })

      const seen = new Set<string>()
      const edges = visibleData.edges
        .map((e) => ({ source: resolve(e.source), target: resolve(e.target), type: e.type }))
        .filter((e) => e.source !== e.target)
        .filter((e) => {
          const key = `${e.source}->${e.target}`
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
        .map((e, i) => ({
          data: { id: `e${i}`, source: e.source, target: e.target, relType: e.type, dimmed: 0 },
        }))

      return [...parents, ...nodes, ...edges]
    }

    const nodes = visibleData.nodes.map((n) => {
      const degree = degrees.get(n.id)?.total ?? 0
      const dist = distances?.get(n.id) ?? 0
      const diameter = degreeToRadius(degree, graphSettings.nodeSize) * 2
      const pos = timelinePositions?.get(n.id)
      return {
        data: {
          id: n.id,
          label: n.title,
          type: n.type,
          folder: n.folder,
          degree,
          size: diameter,
          color: nodeColor(n),
          pinned: pinnedIds?.has(n.id) ? 1 : 0,
          dimmed: matchedIds ? (matchedIds.has(n.id) ? 0 : 1) : distances && dist > 2 ? 1 : 0,
          matched: matchedIds?.has(n.id) ? 1 : 0,
        },
        ...(pos ? { position: pos } : {}),
      }
    })
    const edges = visibleData.edges.map((e, i) => ({
      data: {
        id: `e${i}`,
        source: e.source,
        target: e.target,
        relType: e.type,
        dimmed: isDimmed(e.source) || isDimmed(e.target) ? 1 : 0,
      },
    }))
    return [...nodes, ...edges]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    visibleData,
    degrees,
    distances,
    matchedIds,
    pinnedIds,
    graphSettings.nodeSize,
    nodeColor,
    mode,
    clusterOf,
    collapsedClusters,
    timelinePositions,
  ])

  const stylesheet = useMemo(() => {
    const accent = theme.colors.node
    const accent2 = theme.colors.nodeSelected
    const text = theme.colors.text
    const unresolved = theme.colors.unresolved
    const border = theme.colors.edge
    const isCinematic = mode === 'cinematic'
    const isNeural = mode === 'neural'
    const isConstellation = mode === 'constellation'
    const glow = effects.enabled && effects.showGlow && perfTier !== 'low'

    return [
      {
        selector: 'node',
        style: {
          'background-color': 'data(color)',
          width: 'data(size)',
          height: 'data(size)',
          label: effectiveShowLabels ? 'data(label)' : '',
          'font-size': isConstellation ? 9 : 10,
          'font-family': 'JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace',
          color: text,
          'text-valign': 'bottom' as const,
          'text-margin-y': 4,
          'text-wrap': 'ellipsis' as const,
          'text-max-width': '110px',
          'border-width': isCinematic ? 1.5 : 0,
          'border-color': isCinematic ? accent : border,
          'border-opacity': isCinematic ? 0.6 : 1,
          opacity: 1,
          'transition-property': 'opacity, border-width, background-color',
          'transition-duration': motionEnabled ? 180 : 0,
        },
      },
      {
        selector: 'node[?dimmed]',
        style: { opacity: 0.18 },
      },
      {
        selector: 'node[type = "unresolved"]',
        style: {
          'border-width': 1.5,
          'border-style': 'dashed' as const,
          'border-color': unresolved,
        },
      },
      {
        selector: 'node[?isClusterParent]',
        style: {
          shape: 'round-rectangle' as const,
          'background-color': theme.colors.cluster,
          'background-opacity': 0.22,
          'border-width': 1.5,
          'border-color': theme.colors.cluster,
          'border-style': 'solid' as const,
          label: 'data(label)',
          'text-valign': 'top' as const,
          padding: '14px',
        },
      },
      {
        selector: 'node[?pinned]',
        style: {
          'border-width': 2.5,
          'border-color': accent2,
          'border-style': 'double' as const,
        },
      },
      {
        selector: 'node[?matched]',
        style: {
          'border-width': 2.5,
          'border-color': accent2,
          'overlay-color': accent2,
          'overlay-opacity': glow ? 0.18 : 0,
          'overlay-padding': 6,
        },
      },
      {
        selector: 'node.focused, node:selected',
        style: {
          'border-width': 3,
          'border-color': accent,
          'border-style': 'solid' as const,
          'overlay-color': accent,
          'overlay-opacity': glow ? 0.22 : 0,
          'overlay-padding': isCinematic ? 12 : 8,
        },
      },
      {
        selector: 'node.hovered',
        style: {
          'overlay-color': accent,
          'overlay-opacity': glow ? 0.14 : 0,
          'overlay-padding': 5,
        },
      },
      {
        selector: 'edge',
        style: {
          width: isNeural ? 1.4 : isConstellation ? 0.6 : 1,
          'line-color': isNeural || isCinematic ? accent : border,
          'line-opacity': isNeural || isCinematic ? 0.45 : isConstellation ? 0.3 : 1,
          'curve-style': 'bezier' as const,
          'target-arrow-shape': showArrows ? ('triangle' as const) : ('none' as const),
          'target-arrow-color': border,
          opacity: 1,
          'transition-property': 'opacity',
          'transition-duration': motionEnabled ? 180 : 0,
        },
      },
      {
        selector: 'edge[relType = "tag-relation"]',
        style: { 'line-style': 'dashed' as const, 'line-color': theme.colors.tag, 'line-opacity': 0.35, width: 0.75 },
      },
      {
        selector: 'edge[relType = "folder-relation"]',
        style: { 'line-style': 'dotted' as const, 'line-color': theme.colors.folder, 'line-opacity': 0.3, width: 0.75 },
      },
      {
        selector: 'edge[?dimmed]',
        style: { opacity: 0.06 },
      },
    ]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, effectiveShowLabels, showArrows, effects.enabled, effects.showGlow, motionEnabled, theme, perfTier])

  const layout = useMemo(() => {
    if (mode === 'radial' && selectedNodeId) {
      return {
        name: 'concentric',
        animate: motionEnabled,
        concentric: (node: { id: () => string }) => {
          const d = distances?.get(node.id())
          return d === undefined || d === Infinity ? 0 : 100 - d * 10
        },
        levelWidth: (): number => 1,
        minNodeSpacing: graphSettings.linkDistance / 2,
      }
    }
    if (mode === 'hierarchical') {
      return {
        name: 'concentric',
        animate: motionEnabled,
        concentric: (node: { data: (k: string) => unknown }) => {
          const folder = (node.data('folder') as string) ?? ''
          const depth = folder ? folder.split('/').filter(Boolean).length : 0
          return 100 - depth * 20
        },
        levelWidth: (): number => 1,
        minNodeSpacing: graphSettings.linkDistance / 2,
      }
    }
    if (mode === 'tree') {
      return {
        name: 'breadthfirst',
        animate: motionEnabled,
        directed: true,
        spacingFactor: 1.3,
        // Rooted at the selected note when there is one — otherwise
        // Cytoscape picks a root per connected component automatically.
        roots: selectedNodeId ? [selectedNodeId] : undefined,
      }
    }
    if (mode === 'dag') {
      // A real topological layering: roots are notes with no incoming
      // internal-link edge (the "source" notes of the dependency/workflow
      // graph). Cytoscape's breadthfirst layout leaves any node unreachable
      // from the given roots stuck at the origin, so every connected
      // component needs at least one root — a component that's a pure cycle
      // (no zero-indegree node) falls back to its least-connected node so
      // nothing is ever left off the specified-roots list.
      const linkEdges = visibleData.edges.filter((e) => e.type === 'internal-link')
      const inDegree = new Map<string, number>()
      const adjacency = new Map<string, Set<string>>()
      visibleData.nodes.forEach((n) => {
        inDegree.set(n.id, 0)
        adjacency.set(n.id, new Set())
      })
      linkEdges.forEach((e) => {
        inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1)
        adjacency.get(e.source)?.add(e.target)
        adjacency.get(e.target)?.add(e.source)
      })

      const visited = new Set<string>()
      const roots: string[] = []
      visibleData.nodes.forEach((n) => {
        if (visited.has(n.id)) return
        // Walk this connected component (undirected) via BFS.
        const component: string[] = []
        const queue = [n.id]
        visited.add(n.id)
        while (queue.length) {
          const cur = queue.shift()!
          component.push(cur)
          for (const nb of adjacency.get(cur) ?? []) {
            if (!visited.has(nb)) {
              visited.add(nb)
              queue.push(nb)
            }
          }
        }
        const zeroIndegree = component.filter((id) => (inDegree.get(id) ?? 0) === 0)
        if (zeroIndegree.length > 0) {
          roots.push(...zeroIndegree)
        } else {
          // Pure cycle: no real source, so root at the least-referenced node.
          roots.push(component.reduce((a, b) => ((inDegree.get(a) ?? 0) <= (inDegree.get(b) ?? 0) ? a : b)))
        }
      })

      return {
        name: 'breadthfirst',
        animate: motionEnabled,
        directed: true,
        spacingFactor: 1.3,
        roots: roots.length > 0 ? roots : undefined,
      }
    }
    if (mode === 'circular') {
      return { name: 'circle', animate: motionEnabled, spacingFactor: 1.4 }
    }
    if (mode === 'timeline') {
      return { name: 'preset', animate: motionEnabled, fit: true }
    }
    if (mode === 'cluster') {
      return {
        name: 'cose',
        animate: motionEnabled,
        idealEdgeLength: () => graphSettings.linkDistance * 1.2,
        nodeRepulsion: () => 8000,
      }
    }
    if (mode === 'constellation') {
      return {
        name: 'cose',
        animate: motionEnabled,
        idealEdgeLength: () => graphSettings.linkDistance * 2,
        nodeRepulsion: () => 12000,
      }
    }
    return {
      name: 'cose',
      animate: motionEnabled,
      idealEdgeLength: () => graphSettings.linkDistance,
      nodeRepulsion: () => 6000,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, selectedNodeId, distances, graphSettings.linkDistance, motionEnabled, visibleData])

  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    cy.nodes().removeClass('focused')
    if (focusPath) cy.getElementById(focusPath).addClass('focused')
  }, [focusPath, elements])

  // react-cytoscapejs only applies the `layout` prop on specific internal
  // diff conditions, not reliably on every elements/layout change — running
  // it explicitly here is what actually spreads nodes out instead of
  // leaving them stacked at the origin after a data/mode change.
  // A compound (parent/child) cluster node's `parent` is not a regular data
  // field — Cytoscape only lets it change via an explicit `.move({parent})`
  // call, and react-cytoscapejs's prop-diffing does not know to call it: it
  // diffs `data`, sees the incoming element has no `parent` key, and leaves
  // the live node's existing parent linkage untouched. Leaving cluster mode
  // therefore left every ex-child node still compound-parented to a cluster
  // shell id that no longer existed in `elements`, which silently broke
  // every layout afterward (observed: Cluster -> DAG rendered a fully blank
  // canvas, zero console errors — the elements were there, just orphaned
  // under a phantom parent). Reconciling actual parent linkage against what
  // `elements` currently specifies, before the layout runs, is what a real
  // "leave cluster mode" transition requires.
  useEffect(() => {
    const cy = cyRef.current
    if (!cy || elements.length === 0) return

    const wantedIds = new Set<string>()
    const wantedParent = new Map<string, string | null>()
    elements.forEach((el) => {
      const data = el.data as { id?: string; parent?: string }
      if (data.id) {
        wantedIds.add(data.id)
        wantedParent.set(data.id, data.parent ?? null)
      }
    })

    // Removing a stale compound parent node cascades to remove its
    // children too (real Cytoscape behavior, not a bug) — and
    // react-cytoscapejs's own prop-diffing does exactly that when a
    // cluster-parent id disappears from a new `elements` prop, silently
    // wiping every note that had been nested under it. Re-adding whatever
    // `elements` says should exist but currently doesn't is what actually
    // recovers from that (observed: Cluster -> DAG left the live graph at
    // zero nodes despite `elements` correctly holding four).
    const existingIds = new Set([...cy.nodes().map((n) => n.id()), ...cy.edges().map((e) => e.id())])
    const missing = elements.filter((el) => {
      const id = (el.data as { id?: string }).id
      return id !== undefined && !existingIds.has(id)
    })
    if (missing.length > 0) cy.add(missing)

    // A node's `parent` is not a regular data field — Cytoscape only
    // accepts a compound-parent change via an explicit `.move({parent})`
    // call, which react-cytoscapejs's data-diffing doesn't know to make on
    // its own, so any node that lost its cluster parent needs it cleared
    // here explicitly rather than left pointing at a removed id.
    cy.nodes().forEach((n) => {
      const want = wantedParent.get(n.id()) ?? null
      const have = n.data('parent') ?? null
      if (want !== have) n.move({ parent: want })
    })
    cy.nodes().forEach((n) => {
      if (!wantedIds.has(n.id())) n.remove()
    })

    const l = cy.layout(layout)
    l.run()
  }, [elements, layout])

  // Cinematic mode: track the selected node's on-screen position so the
  // rotating-ring overlay (rendered as plain SVG, not a Cytoscape element)
  // stays glued to it across pan/zoom/layout changes.
  useEffect(() => {
    const cy = cyRef.current
    if (!cy || mode !== 'cinematic' || !selectedNodeId) {
      setRingPos(null)
      return
    }
    const update = () => {
      const ele = cy.getElementById(selectedNodeId)
      if (!ele || ele.empty()) {
        setRingPos(null)
        return
      }
      const pos = ele.renderedPosition()
      const r = (ele.renderedOuterWidth() ?? 40) / 2
      setRingPos({ x: pos.x, y: pos.y, r })
    }
    update()
    cy.on('pan zoom position render', update)
    return () => {
      cy.off('pan zoom position render', update)
    }
  }, [mode, selectedNodeId, elements])

  return (
    <div ref={containerRef} className="relative w-full h-full" style={{ background: theme.colors.background }}>
      <CytoscapeComponent
        elements={elements}
        style={{ width: '100%', height: '100%' }}
        stylesheet={stylesheet}
        layout={layout}
        userZoomingEnabled={interactive}
        userPanningEnabled={interactive}
        boxSelectionEnabled={interactive}
        cy={(cy) => {
          const isNewInstance = cyRef.current !== cy
          cyRef.current = cy
          if (isNewInstance) onReady?.(cy)
          cy.off('tap', 'node')
          cy.off('dbltap', 'node')
          cy.off('cxttap', 'node')
          cy.off('mouseover', 'node')
          cy.off('mouseout', 'node')
          cy.off('tap')

          cy.on('tap', 'node', (evt: EventObject) => {
            if (evt.target.data('isClusterParent')) {
              onToggleCluster?.(evt.target.data('clusterId'))
              return
            }
            const id = evt.target.id()
            const node = data.nodes.find((n) => n.id === id)
            if (node) onNodeClick?.(id, node)
          })
          if (onNodeDoubleClick) {
            cy.on('dbltap', 'node', (evt: EventObject) => {
              const id = evt.target.id()
              const node = data.nodes.find((n) => n.id === id)
              if (node) onNodeDoubleClick(id, node)
            })
          }
          if (onNodeContextMenu) {
            cy.on('cxttap', 'node', (evt: EventObject) => {
              const id = evt.target.id()
              const node = data.nodes.find((n) => n.id === id)
              if (node) {
                const rp = evt.renderedPosition ?? evt.target.renderedPosition()
                const rect = containerRef.current?.getBoundingClientRect()
                onNodeContextMenu(id, node, (rect?.left ?? 0) + rp.x, (rect?.top ?? 0) + rp.y)
              }
            })
          }
          cy.on('mouseover', 'node', (evt: EventObject) => evt.target.addClass('hovered'))
          cy.on('mouseout', 'node', (evt: EventObject) => evt.target.removeClass('hovered'))
          if (onBackgroundClick) {
            cy.on('tap', (evt: EventObject) => {
              if (evt.target === cy) onBackgroundClick()
            })
          }
        }}
      />
      {mode === 'cinematic' && ringPos && (
        <svg
          className="absolute inset-0 pointer-events-none"
          width="100%"
          height="100%"
          style={{ overflow: 'visible' }}
        >
          <g style={{ transform: `translate(${ringPos.x}px, ${ringPos.y}px)` }}>
            <circle
              r={ringPos.r + 10}
              fill="none"
              stroke={theme.colors.node}
              strokeWidth={1}
              strokeDasharray="3 6"
              opacity={0.55}
              style={motionEnabled ? { animation: 'rotate-ring 12s linear infinite', transformOrigin: 'center' } : undefined}
            />
            <circle
              r={ringPos.r + 18}
              fill="none"
              stroke={theme.colors.nodeSelected}
              strokeWidth={0.75}
              strokeDasharray="1 5"
              opacity={0.4}
              style={motionEnabled ? { animation: 'rotate-ring 20s linear infinite reverse', transformOrigin: 'center' } : undefined}
            />
          </g>
        </svg>
      )}
    </div>
  )
}
