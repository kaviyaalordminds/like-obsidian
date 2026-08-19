declare module 'react-cytoscapejs' {
  import type { Core, ElementDefinition, LayoutOptions, Stylesheet } from 'cytoscape'
  import type { CSSProperties } from 'react'

  export interface CytoscapeComponentProps {
    elements: ElementDefinition[]
    style?: CSSProperties
    stylesheet?: Stylesheet[]
    layout?: LayoutOptions
    cy?: (cy: Core) => void
    className?: string
    userZoomingEnabled?: boolean
    userPanningEnabled?: boolean
    boxSelectionEnabled?: boolean
    minZoom?: number
    maxZoom?: number
  }

  export default function CytoscapeComponent(props: CytoscapeComponentProps): JSX.Element
}
