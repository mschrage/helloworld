export type ShapeKind =
  | 'rect'
  | 'round'
  | 'pill'
  | 'ellipse'
  | 'diamond'
  | 'hexagon'
  | 'parallelogram'
  | 'cylinder'
  | 'queue'
  | 'document'
  | 'note'
  | 'actor'
  | 'cloud'
  | 'text'
  | 'frame'

export type PortSide = 'n' | 'e' | 's' | 'w' | 'auto'

export type EdgeRouting = 'orthogonal' | 'straight' | 'curve'
export type EndCap = 'none' | 'arrow' | 'open' | 'dot' | 'diamond' | 'bar'
export type DashStyle = 'solid' | 'dashed' | 'dotted'
export type TextAlign = 'left' | 'center' | 'right'

/** Grayscale fill tokens — index into the paper palette. */
export type FillToken = 'none' | 'paper' | 'g1' | 'g2' | 'g3' | 'g4' | 'ink'

export interface NodeStyle {
  fill: FillToken
  stroke: DashStyle
  weight: number
  radius: number
  fontSize: number
  align: TextAlign
  bold: boolean
  mono: boolean
  opacity: number
}

export interface EdgeStyle {
  stroke: DashStyle
  weight: number
  fontSize: number
}

export interface DiagramNode {
  id: string
  kind: ShapeKind
  x: number
  y: number
  w: number
  h: number
  text: string
  /** Small caps eyebrow rendered above the title — good for «service», «queue», etc. */
  tag?: string
  style: NodeStyle
  locked?: boolean
}

export type EdgeEnd = { node: string; side: PortSide } | { x: number; y: number }

export interface DiagramEdge {
  id: string
  from: EdgeEnd
  to: EdgeEnd
  routing: EdgeRouting
  startCap: EndCap
  endCap: EndCap
  label: string
  style: EdgeStyle
}

export interface InkStroke {
  id: string
  points: number[]
  weight: number
  opacity: number
}

export type Element = DiagramNode | DiagramEdge | InkStroke

export interface Scene {
  nodes: DiagramNode[]
  edges: DiagramEdge[]
  ink: InkStroke[]
  title: string
}

export interface Viewport {
  x: number
  y: number
  k: number
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export type Point = { x: number; y: number }

export type Tool =
  | 'select'
  | 'hand'
  | 'edge'
  | 'pen'
  | 'eraser'
  | { shape: ShapeKind }

export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'
