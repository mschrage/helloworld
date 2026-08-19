import type { DashStyle, FillToken, NodeStyle, ShapeKind } from '../types'

/** Paper palette — warm whites through graphite. No hues, by design. */
export const FILLS: Record<FillToken, string> = {
  none: 'transparent',
  paper: '#ffffff',
  g1: '#f7f7f6',
  g2: '#eeeeec',
  g3: '#e0e0dd',
  g4: '#c9c9c5',
  ink: '#3d3d3a',
}

export const FILL_ORDER: FillToken[] = ['none', 'paper', 'g1', 'g2', 'g3', 'g4', 'ink']

export const INK = '#3d3d3a'
export const INK_SOFT = '#8a8a83'
export const INK_FAINT = '#c4c4bd'
export const ACCENT = '#2f6ff0'

export function dashArray(style: DashStyle, weight: number): string | undefined {
  if (style === 'dashed') return `${Math.max(5, weight * 5)} ${Math.max(4, weight * 3.5)}`
  if (style === 'dotted') return `0.1 ${Math.max(3.5, weight * 3.2)}`
  return undefined
}

/** Text sits on paper by default; on the darkest fill it flips to paper-on-ink. */
export function textColor(fill: FillToken) {
  return fill === 'ink' ? '#faf9f6' : INK
}

export const defaultNodeStyle = (): NodeStyle => ({
  fill: 'paper',
  stroke: 'solid',
  weight: 1,
  radius: 6,
  fontSize: 13,
  align: 'center',
  bold: false,
  mono: false,
  opacity: 1,
})

export interface ShapeSpec {
  kind: ShapeKind
  label: string
  w: number
  h: number
  style?: Partial<NodeStyle>
  /** Inner padding for text, per side. */
  pad?: { x: number; y: number }
  hint?: string
}

export const SHAPES: Record<ShapeKind, ShapeSpec> = {
  rect: { kind: 'rect', label: 'Box', w: 168, h: 72, style: { radius: 0 }, hint: 'component' },
  round: { kind: 'round', label: 'Rounded', w: 168, h: 72, hint: 'service' },
  pill: { kind: 'pill', label: 'Pill', w: 148, h: 46, hint: 'start / end' },
  ellipse: { kind: 'ellipse', label: 'Ellipse', w: 148, h: 96, pad: { x: 26, y: 20 }, hint: 'state' },
  diamond: {
    kind: 'diamond',
    label: 'Decision',
    w: 148,
    h: 104,
    pad: { x: 34, y: 26 },
    hint: 'branch',
  },
  hexagon: { kind: 'hexagon', label: 'Hexagon', w: 168, h: 76, pad: { x: 30, y: 14 }, hint: 'gateway' },
  parallelogram: {
    kind: 'parallelogram',
    label: 'I/O',
    w: 168,
    h: 68,
    pad: { x: 28, y: 12 },
    hint: 'input / output',
  },
  cylinder: {
    kind: 'cylinder',
    label: 'Store',
    w: 132,
    h: 100,
    pad: { x: 16, y: 22 },
    hint: 'database',
  },
  queue: { kind: 'queue', label: 'Queue', w: 168, h: 68, pad: { x: 24, y: 12 }, hint: 'topic / bus' },
  document: {
    kind: 'document',
    label: 'Document',
    w: 152,
    h: 92,
    pad: { x: 16, y: 14 },
    hint: 'artifact',
  },
  note: {
    kind: 'note',
    label: 'Note',
    w: 176,
    h: 96,
    style: { fill: 'g1', align: 'left', fontSize: 12, radius: 0 },
    pad: { x: 14, y: 12 },
    hint: 'annotation',
  },
  actor: {
    kind: 'actor',
    label: 'Actor',
    w: 108,
    h: 96,
    style: { fill: 'none' },
    pad: { x: 6, y: 8 },
    hint: 'person / role',
  },
  cloud: { kind: 'cloud', label: 'Cloud', w: 176, h: 108, pad: { x: 30, y: 26 }, hint: 'external' },
  text: {
    kind: 'text',
    label: 'Text',
    w: 200,
    h: 30,
    style: { fill: 'none', stroke: 'solid', weight: 0, align: 'left', fontSize: 14 },
    pad: { x: 2, y: 4 },
    hint: 'free label',
  },
  frame: {
    kind: 'frame',
    label: 'Frame',
    w: 360,
    h: 260,
    style: { fill: 'none', stroke: 'dashed', weight: 1, align: 'left', fontSize: 11, radius: 3 },
    pad: { x: 12, y: 10 },
    hint: 'boundary / group',
  },
}

export function padOf(kind: ShapeKind) {
  return SHAPES[kind].pad ?? { x: 14, y: 10 }
}

export function makeStyle(kind: ShapeKind): NodeStyle {
  return { ...defaultNodeStyle(), ...(SHAPES[kind].style ?? {}) }
}
