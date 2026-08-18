import { useEffect, useMemo, useRef } from 'react'
import CytoscapeComponent from 'react-cytoscapejs'
import type { Core } from 'cytoscape'
import type { GraphData } from '@/types'
import { useSettingsStore } from '@/store/settingsStore'

interface Props {
  data: GraphData
  focusPath?: string | null
  onNodeClick: (nodeId: string, node: GraphData['nodes'][number]) => void
  onNodeDoubleClick?: (nodeId: string, node: GraphData['nodes'][number]) => void
  showLabels?: boolean
  showArrows?: boolean
}

function accent() {
  return getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim() || '#4f7cff'
}
function textColor() {
  return getComputedStyle(document.documentElement).getPropertyValue('--color-text-muted').trim() || '#888'
}
function unresolvedColor() {
  return getComputedStyle(document.documentElement).getPropertyValue('--color-unresolved').trim() || '#b98900'
}
function borderColor() {
  return getComputedStyle(document.documentElement).getPropertyValue('--color-border').trim() || '#ddd'
}

export function GraphView({ data, focusPath, onNodeClick, onNodeDoubleClick, showLabels = true, showArrows = false }: Props) {
  const cyRef = useRef<Core | null>(null)
  const graphSettings = useSettingsStore((s) => s.graph)

  const elements = useMemo(() => {
    const nodes = data.nodes.map((n) => ({
      data: { id: n.id, label: n.title, type: n.type, tags: n.tags.join(',') },
    }))
    const edges = data.edges.map((e, i) => ({
      data: { id: `e${i}`, source: e.source, target: e.target },
    }))
    return [...nodes, ...edges]
  }, [data])

  const stylesheet = useMemo(
    () => [
      {
        selector: 'node',
        style: {
          'background-color': accent(),
          width: graphSettings.nodeSize * 2,
          height: graphSettings.nodeSize * 2,
          label: showLabels ? 'data(label)' : '',
          'font-size': 10,
          color: textColor(),
          'text-valign': 'bottom' as const,
          'text-margin-y': 4,
          'text-wrap': 'ellipsis' as const,
          'text-max-width': '100px',
          'border-width': 0,
        },
      },
      {
        selector: 'node[type = "unresolved"]',
        style: {
          'background-color': 'transparent',
          'border-width': 1.5,
          'border-style': 'dashed' as const,
          'border-color': unresolvedColor(),
        },
      },
      {
        selector: 'node.focused',
        style: {
          'border-width': 3,
          'border-color': accent(),
          'border-style': 'solid' as const,
        },
      },
      {
        selector: 'edge',
        style: {
          width: 1,
          'line-color': borderColor(),
          'curve-style': 'bezier' as const,
          'target-arrow-shape': showArrows ? ('triangle' as const) : ('none' as const),
          'target-arrow-color': borderColor(),
        },
      },
    ],
    [graphSettings.nodeSize, showLabels, showArrows],
  )

  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    cy.nodes().removeClass('focused')
    if (focusPath) cy.getElementById(focusPath).addClass('focused')
  }, [focusPath, elements])

  return (
    <CytoscapeComponent
      elements={elements}
      style={{ width: '100%', height: '100%' }}
      stylesheet={stylesheet}
      layout={{
        name: 'cose',
        animate: graphSettings.animate,
        idealEdgeLength: () => graphSettings.linkDistance,
        nodeRepulsion: () => 6000,
      }}
      cy={(cy) => {
        cyRef.current = cy
        cy.off('tap', 'node')
        cy.off('dbltap', 'node')
        cy.on('tap', 'node', (evt) => {
          const id = evt.target.id()
          const node = data.nodes.find((n) => n.id === id)
          if (node) onNodeClick(id, node)
        })
        if (onNodeDoubleClick) {
          cy.on('dbltap', 'node', (evt) => {
            const id = evt.target.id()
            const node = data.nodes.find((n) => n.id === id)
            if (node) onNodeDoubleClick(id, node)
          })
        }
      }}
    />
  )
}

