import { useEffect, useRef, useState } from 'react'
import type { Core } from 'cytoscape'

interface Props {
  cy: Core | null
  clusters?: Map<string, string> // nodeId -> cluster color, optional tinting
}

interface Point {
  id: string
  x: number
  y: number
}

const SIZE = 160

/** A real minimap driven by the live Cytoscape model — node positions and
 * the current viewport rectangle both come from the actual `cy` instance,
 * not a static image (Section 19). */
export function GraphMinimap({ cy }: Props) {
  const [points, setPoints] = useState<Point[]>([])
  const [bounds, setBounds] = useState({ x1: 0, y1: 0, x2: 1, y2: 1 })
  const [viewport, setViewport] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)

  useEffect(() => {
    if (!cy) return

    const recomputeNodes = () => {
      const nodes = cy.nodes()
      if (nodes.length === 0) {
        setPoints([])
        return
      }
      const bb = cy.nodes().boundingBox()
      setBounds({ x1: bb.x1, y1: bb.y1, x2: bb.x2 || bb.x1 + 1, y2: bb.y2 || bb.y1 + 1 })
      setPoints(nodes.map((n) => ({ id: n.id(), x: n.position('x'), y: n.position('y') })))
    }

    const recomputeViewport = () => {
      const extent = cy.extent()
      setViewport({ x: extent.x1, y: extent.y1, w: extent.x2 - extent.x1, h: extent.y2 - extent.y1 })
    }

    recomputeNodes()
    recomputeViewport()
    cy.on('layoutstop position add remove', recomputeNodes)
    cy.on('pan zoom resize', recomputeViewport)
    return () => {
      cy.off('layoutstop position add remove', recomputeNodes)
      cy.off('pan zoom resize', recomputeViewport)
    }
  }, [cy])

  const w = Math.max(bounds.x2 - bounds.x1, 1)
  const h = Math.max(bounds.y2 - bounds.y1, 1)
  const scale = Math.min(SIZE / w, SIZE / h)
  const toSvg = (x: number, y: number) => ({
    x: (x - bounds.x1) * scale,
    y: (y - bounds.y1) * scale,
  })

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!cy || !svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const svgX = e.clientX - rect.left
    const svgY = e.clientY - rect.top
    const modelX = svgX / scale + bounds.x1
    const modelY = svgY / scale + bounds.y1
    const zoom = cy.zoom()
    const pan = { x: cy.width() / 2 - modelX * zoom, y: cy.height() / 2 - modelY * zoom }
    cy.animate({ pan }, { duration: 200 })
  }

  if (points.length === 0) return null

  return (
    <div
      className="glass-panel rounded-lg p-2 pointer-events-auto"
      style={{ boxShadow: 'var(--shadow-glow)' }}
    >
      <svg
        ref={svgRef}
        width={SIZE}
        height={SIZE}
        onClick={handleClick}
        className="cursor-crosshair"
        style={{ display: 'block' }}
      >
        {points.map((p) => {
          const { x, y } = toSvg(p.x, p.y)
          return <circle key={p.id} cx={x} cy={y} r={1.4} fill="var(--color-accent)" opacity={0.75} />
        })}
        {viewport && (
          <rect
            x={(viewport.x - bounds.x1) * scale}
            y={(viewport.y - bounds.y1) * scale}
            width={viewport.w * scale}
            height={viewport.h * scale}
            fill="none"
            stroke="var(--color-accent-2)"
            strokeWidth={1}
          />
        )}
      </svg>
    </div>
  )
}
