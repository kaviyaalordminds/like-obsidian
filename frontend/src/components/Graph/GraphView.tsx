import { useEffect, useMemo, useRef, useState } from 'react'
import CytoscapeComponent from 'react-cytoscapejs'
import type { Core, EventObject } from 'cytoscape'
import type { GraphData, GraphNode } from '@/types'
import { useSettingsStore } from '@/store/settingsStore'
import type { GraphMode } from '@/store/graphStore'
import { computeDegrees, computeDistances, degreeToRadius } from '@/lib/graph'

interface Props {
  data: GraphData
  mode?: GraphMode
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

function cssVar(name: string, fallback: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}

export function GraphView({
  data,
  mode = 'classic',
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
  const motionEnabled = effects.enabled && !effects.reducedMotion && graphSettings.animate
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

  const elements = useMemo(() => {
    const nodes = visibleData.nodes.map((n) => {
      const degree = degrees.get(n.id)?.total ?? 0
      const dist = distances?.get(n.id) ?? 0
      const diameter = degreeToRadius(degree, graphSettings.nodeSize) * 2
      return {
        data: {
          id: n.id,
          label: n.title,
          type: n.type,
          degree,
          size: diameter,
          pinned: pinnedIds?.has(n.id) ? 1 : 0,
          dimmed: matchedIds ? (matchedIds.has(n.id) ? 0 : 1) : distances && dist > 2 ? 1 : 0,
          matched: matchedIds?.has(n.id) ? 1 : 0,
        },
      }
    })
    const isDimmed = (id: string) => {
      if (matchedIds) return !matchedIds.has(id)
      if (distances) return (distances.get(id) ?? Infinity) > 2
      return false
    }
    const edges = visibleData.edges.map((e, i) => ({
      data: {
        id: `e${i}`,
        source: e.source,
        target: e.target,
        dimmed: isDimmed(e.source) || isDimmed(e.target) ? 1 : 0,
      },
    }))
    return [...nodes, ...edges]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleData, degrees, distances, matchedIds, pinnedIds, graphSettings.nodeSize])

  const stylesheet = useMemo(() => {
    const accent = cssVar('--color-accent', '#34d1c9')
    const accent2 = cssVar('--color-accent-2', '#e08a3e')
    const text = cssVar('--color-text-muted', '#888')
    const unresolved = cssVar('--color-unresolved', '#b98900')
    const border = cssVar('--color-border', '#ddd')
    const isCinematic = mode === 'cinematic'
    const isNeural = mode === 'neural'
    const glow = effects.enabled && effects.showGlow

    return [
      {
        selector: 'node',
        style: {
          'background-color': accent,
          width: 'data(size)',
          height: 'data(size)',
          label: showLabels ? 'data(label)' : '',
          'font-size': 10,
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
          'background-color': 'transparent',
          'border-width': 1.5,
          'border-style': 'dashed' as const,
          'border-color': unresolved,
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
          width: isNeural ? 1.4 : 1,
          'line-color': isNeural || isCinematic ? accent : border,
          'line-opacity': isNeural || isCinematic ? 0.45 : 1,
          'curve-style': 'bezier' as const,
          'target-arrow-shape': showArrows ? ('triangle' as const) : ('none' as const),
          'target-arrow-color': border,
          opacity: 1,
          'transition-property': 'opacity',
          'transition-duration': motionEnabled ? 180 : 0,
        },
      },
      {
        selector: 'edge[?dimmed]',
        style: { opacity: 0.06 },
      },
    ]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, graphSettings.nodeSize, showLabels, showArrows, effects.enabled, effects.showGlow, motionEnabled])

  const layout = useMemo(() => {
    if (mode === 'radial' && selectedNodeId) {
      return {
        name: 'concentric',
        animate: motionEnabled,
        concentric: (node: { id: () => string }) => {
          const d = distances?.get(node.id())
          return d === undefined || d === Infinity ? 0 : 100 - d * 10
        },
        levelWidth: () => 1,
        minNodeSpacing: graphSettings.linkDistance / 2,
      }
    }
    return {
      name: 'cose',
      animate: motionEnabled,
      idealEdgeLength: () => graphSettings.linkDistance,
      nodeRepulsion: () => 6000,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, selectedNodeId, distances, graphSettings.linkDistance, motionEnabled])

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
  useEffect(() => {
    const cy = cyRef.current
    if (!cy || cy.nodes().length === 0) return
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
    <div ref={containerRef} className="relative w-full h-full">
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
              stroke="var(--color-accent)"
              strokeWidth={1}
              strokeDasharray="3 6"
              opacity={0.55}
              style={motionEnabled ? { animation: 'rotate-ring 12s linear infinite', transformOrigin: 'center' } : undefined}
            />
            <circle
              r={ringPos.r + 18}
              fill="none"
              stroke="var(--color-accent-2)"
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
