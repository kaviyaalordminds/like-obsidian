import type { Core } from 'cytoscape'
import type { GraphData } from '@/types'

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function exportGraphPng(cy: Core, filename = 'graph.png') {
  const dataUrl = cy.png({ full: true, scale: 2, bg: getComputedStyle(document.documentElement).getPropertyValue('--color-bg') || '#0a0c10' })
  fetch(dataUrl)
    .then((r) => r.blob())
    .then((blob) => download(blob, filename))
}

export function exportGraphJson(data: GraphData, filename = 'graph.json') {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  download(blob, filename)
}

/** Best-effort SVG export: serializes current node positions/edges from the
 * live Cytoscape model into plain SVG circles/lines. Cytoscape core has no
 * native SVG renderer without an extra plugin, so this reimplements just
 * enough of it to produce a usable vector export. */
export function exportGraphSvg(cy: Core, filename = 'graph.svg') {
  const nodes = cy.nodes()
  const bb = nodes.boundingBox()
  const pad = 40
  const width = bb.x2 - bb.x1 + pad * 2
  const height = bb.y2 - bb.y1 + pad * 2
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim() || '#34d1c9'
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim() || '#0a0c10'
  const border = getComputedStyle(document.documentElement).getPropertyValue('--color-border').trim() || '#333'
  const text = getComputedStyle(document.documentElement).getPropertyValue('--color-text-muted').trim() || '#999'

  const tx = (x: number) => x - bb.x1 + pad
  const ty = (y: number) => y - bb.y1 + pad

  const edgeLines = cy
    .edges()
    .map((e) => {
      const s = e.source().position()
      const t = e.target().position()
      return `<line x1="${tx(s.x)}" y1="${ty(s.y)}" x2="${tx(t.x)}" y2="${ty(t.y)}" stroke="${border}" stroke-width="1" />`
    })
    .join('\n')

  const nodeCircles = nodes
    .map((n) => {
      const p = n.position()
      const r = n.outerWidth() / 2
      const label = String(n.data('label') ?? '').replace(/[<>&]/g, '')
      return (
        `<circle cx="${tx(p.x)}" cy="${ty(p.y)}" r="${r}" fill="${accent}" />` +
        `<text x="${tx(p.x)}" y="${ty(p.y) + r + 12}" font-size="10" font-family="monospace" fill="${text}" text-anchor="middle">${label}</text>`
      )
    })
    .join('\n')

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="${bg}" />
  ${edgeLines}
  ${nodeCircles}
</svg>`

  download(new Blob([svg], { type: 'image/svg+xml' }), filename)
}
