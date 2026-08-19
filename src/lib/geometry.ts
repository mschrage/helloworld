import type {
  DiagramEdge,
  DiagramNode,
  EdgeEnd,
  PortSide,
  Point,
  Rect,
  ShapeKind,
} from '../types'

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)

export function rectOf(n: DiagramNode): Rect {
  return { x: n.x, y: n.y, w: n.w, h: n.h }
}

export function centerOf(r: Rect): Point {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 }
}

export function rectContains(r: Rect, p: Point) {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h
}

export function rectsIntersect(a: Rect, b: Rect) {
  return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y)
}

export function normalizeRect(a: Point, b: Point): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(a.x - b.x),
    h: Math.abs(a.y - b.y),
  }
}

export function expandRect(r: Rect, by: number): Rect {
  return { x: r.x - by, y: r.y - by, w: r.w + by * 2, h: r.h + by * 2 }
}

export function unionRects(rects: Rect[]): Rect | null {
  if (!rects.length) return null
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const r of rects) {
    x0 = Math.min(x0, r.x)
    y0 = Math.min(y0, r.y)
    x1 = Math.max(x1, r.x + r.w)
    y1 = Math.max(y1, r.y + r.h)
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

/* ------------------------------------------------------------------ *
 * Shape outlines
 * ------------------------------------------------------------------ */

/** Shapes whose silhouette is a polygon — used for hit testing and edge clipping. */
export function shapePolygon(kind: ShapeKind, r: Rect): Point[] | null {
  const { x, y, w, h } = r
  switch (kind) {
    case 'diamond':
      return [
        { x: x + w / 2, y },
        { x: x + w, y: y + h / 2 },
        { x: x + w / 2, y: y + h },
        { x, y: y + h / 2 },
      ]
    case 'hexagon': {
      const c = Math.min(w * 0.22, h * 0.5)
      return [
        { x: x + c, y },
        { x: x + w - c, y },
        { x: x + w, y: y + h / 2 },
        { x: x + w - c, y: y + h },
        { x: x + c, y: y + h },
        { x, y: y + h / 2 },
      ]
    }
    case 'parallelogram': {
      const c = Math.min(w * 0.2, h * 0.6)
      return [
        { x: x + c, y },
        { x: x + w, y },
        { x: x + w - c, y: y + h },
        { x, y: y + h },
      ]
    }
    default:
      return null
  }
}

const ellipseKinds = new Set<ShapeKind>(['ellipse', 'cloud'])

/** SVG path data for a node silhouette. */
export function shapePath(n: DiagramNode): string {
  const { x, y, w, h } = n
  const k = n.kind
  const poly = shapePolygon(k, n)
  if (poly) return polyPath(poly)

  switch (k) {
    case 'ellipse':
      return ellipsePath(x + w / 2, y + h / 2, w / 2, h / 2)
    case 'pill': {
      const r = Math.min(h / 2, w / 2)
      return roundRectPath(x, y, w, h, r)
    }
    case 'cylinder': {
      const ry = Math.min(h * 0.16, 16)
      return [
        `M${x} ${y + ry}`,
        `A${w / 2} ${ry} 0 0 1 ${x + w} ${y + ry}`,
        `L${x + w} ${y + h - ry}`,
        `A${w / 2} ${ry} 0 0 1 ${x} ${y + h - ry}`,
        'Z',
      ].join(' ')
    }
    case 'queue': {
      const rx = Math.min(w * 0.1, 14)
      return [
        `M${x + rx} ${y}`,
        `L${x + w - rx} ${y}`,
        `A${rx} ${h / 2} 0 0 1 ${x + w - rx} ${y + h}`,
        `L${x + rx} ${y + h}`,
        `A${rx} ${h / 2} 0 0 1 ${x + rx} ${y}`,
        'Z',
      ].join(' ')
    }
    case 'document': {
      const wave = Math.min(h * 0.16, 18)
      return [
        `M${x} ${y}`,
        `L${x + w} ${y}`,
        `L${x + w} ${y + h - wave}`,
        `C${x + w * 0.72} ${y + h - wave * 2.1} ${x + w * 0.3} ${y + h + wave * 0.9} ${x} ${y + h - wave}`,
        'Z',
      ].join(' ')
    }
    case 'note': {
      const f = Math.min(w * 0.18, h * 0.34, 22)
      return [
        `M${x} ${y}`,
        `L${x + w - f} ${y}`,
        `L${x + w} ${y + f}`,
        `L${x + w} ${y + h}`,
        `L${x} ${y + h}`,
        'Z',
      ].join(' ')
    }
    case 'cloud': {
      // A soft, hand-drawn-ish cloud built from four arcs.
      const cx = x + w / 2
      const cy = y + h / 2
      return [
        `M${x + w * 0.24} ${y + h * 0.82}`,
        `C${x - w * 0.04} ${y + h * 0.82} ${x - w * 0.02} ${y + h * 0.4} ${x + w * 0.22} ${y + h * 0.38}`,
        `C${x + w * 0.24} ${y + h * 0.04} ${cx + w * 0.16} ${y - h * 0.06} ${x + w * 0.62} ${y + h * 0.22}`,
        `C${x + w * 0.88} ${y + h * 0.1} ${x + w * 1.06} ${y + h * 0.44} ${x + w * 0.82} ${y + h * 0.56}`,
        `C${x + w * 1.02} ${y + h * 0.7} ${x + w * 0.94} ${cy + h * 0.36} ${x + w * 0.74} ${y + h * 0.82}`,
        'Z',
      ].join(' ')
    }
    case 'actor':
      return roundRectPath(x, y, w, h, 4)
    case 'frame':
      return roundRectPath(x, y, w, h, 3)
    case 'text':
      return roundRectPath(x, y, w, h, 0)
    case 'round':
      return roundRectPath(x, y, w, h, Math.min(n.style.radius, w / 2, h / 2))
    default:
      return roundRectPath(x, y, w, h, 0)
  }
}

export function roundRectPath(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2))
  if (rr <= 0.01) return `M${x} ${y}H${x + w}V${y + h}H${x}Z`
  return [
    `M${x + rr} ${y}`,
    `H${x + w - rr}`,
    `A${rr} ${rr} 0 0 1 ${x + w} ${y + rr}`,
    `V${y + h - rr}`,
    `A${rr} ${rr} 0 0 1 ${x + w - rr} ${y + h}`,
    `H${x + rr}`,
    `A${rr} ${rr} 0 0 1 ${x} ${y + h - rr}`,
    `V${y + rr}`,
    `A${rr} ${rr} 0 0 1 ${x + rr} ${y}`,
    'Z',
  ].join(' ')
}

export function ellipsePath(cx: number, cy: number, rx: number, ry: number) {
  return [
    `M${cx - rx} ${cy}`,
    `A${rx} ${ry} 0 0 1 ${cx + rx} ${cy}`,
    `A${rx} ${ry} 0 0 1 ${cx - rx} ${cy}`,
    'Z',
  ].join(' ')
}

function polyPath(pts: Point[]) {
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ') + ' Z'
}

/** Point-in-shape test that respects the silhouette, not just the bounding box. */
export function hitShape(n: DiagramNode, p: Point, slop = 0): boolean {
  const r = expandRect(rectOf(n), slop)
  if (!rectContains(r, p)) return false
  if (n.kind === 'frame') {
    // Frames are only grabbable by their border / title bar so you can work inside them.
    const inner = expandRect(rectOf(n), -10)
    return !rectContains(inner, p) || p.y < n.y + 4
  }
  if (ellipseKinds.has(n.kind)) {
    const cx = n.x + n.w / 2
    const cy = n.y + n.h / 2
    const rx = n.w / 2 + slop
    const ry = n.h / 2 + slop
    return ((p.x - cx) / rx) ** 2 + ((p.y - cy) / ry) ** 2 <= 1
  }
  const poly = shapePolygon(n.kind, r)
  if (poly) return pointInPolygon(p, poly)
  return true
}

export function pointInPolygon(p: Point, poly: Point[]) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]
    const b = poly[j]
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside
    }
  }
  return inside
}

/* ------------------------------------------------------------------ *
 * Edge anchoring & routing
 * ------------------------------------------------------------------ */

const NORMALS: Record<Exclude<PortSide, 'auto'>, Point> = {
  n: { x: 0, y: -1 },
  e: { x: 1, y: 0 },
  s: { x: 0, y: 1 },
  w: { x: -1, y: 0 },
}

export function sideAnchor(r: Rect, side: Exclude<PortSide, 'auto'>): Point {
  switch (side) {
    case 'n':
      return { x: r.x + r.w / 2, y: r.y }
    case 's':
      return { x: r.x + r.w / 2, y: r.y + r.h }
    case 'w':
      return { x: r.x, y: r.y + r.h / 2 }
    case 'e':
      return { x: r.x + r.w, y: r.y + r.h / 2 }
  }
}

/** Pick the side of `r` that faces `target` most directly. */
export function autoSide(r: Rect, target: Point): Exclude<PortSide, 'auto'> {
  const c = centerOf(r)
  const dx = target.x - c.x
  const dy = target.y - c.y
  const nx = dx / Math.max(r.w / 2, 1)
  const ny = dy / Math.max(r.h / 2, 1)
  if (Math.abs(nx) >= Math.abs(ny)) return dx >= 0 ? 'e' : 'w'
  return dy >= 0 ? 's' : 'n'
}

function segIntersect(a: Point, b: Point, c: Point, d: Point): Point | null {
  const r = { x: b.x - a.x, y: b.y - a.y }
  const s = { x: d.x - c.x, y: d.y - c.y }
  const denom = r.x * s.y - r.y * s.x
  if (Math.abs(denom) < 1e-9) return null
  const t = ((c.x - a.x) * s.y - (c.y - a.y) * s.x) / denom
  const u = ((c.x - a.x) * r.y - (c.y - a.y) * r.x) / denom
  if (t < 0 || t > 1 || u < 0 || u > 1) return null
  return { x: a.x + t * r.x, y: a.y + t * r.y }
}

/** Where the ray center→outside leaves the node silhouette. */
export function boundaryPoint(n: DiagramNode, toward: Point): Point {
  const r = rectOf(n)
  const c = centerOf(r)
  const dx = toward.x - c.x
  const dy = toward.y - c.y
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return c

  if (ellipseKinds.has(n.kind)) {
    const rx = r.w / 2
    const ry = r.h / 2
    const t = 1 / Math.hypot(dx / rx, dy / ry)
    return { x: c.x + dx * t, y: c.y + dy * t }
  }

  const poly = shapePolygon(n.kind, r)
  if (poly) {
    const far = { x: c.x + dx * 1e4, y: c.y + dy * 1e4 }
    for (let i = 0; i < poly.length; i++) {
      const hit = segIntersect(c, far, poly[i], poly[(i + 1) % poly.length])
      if (hit) return hit
    }
    return c
  }

  // Rectangle slab clip.
  const tx = dx === 0 ? Infinity : r.w / 2 / Math.abs(dx)
  const ty = dy === 0 ? Infinity : r.h / 2 / Math.abs(dy)
  const t = Math.min(tx, ty)
  return { x: c.x + dx * t, y: c.y + dy * t }
}

export interface Endpoint {
  p: Point
  n: Point
  side: Exclude<PortSide, 'auto'> | null
}

export function resolveEnd(
  end: EdgeEnd,
  nodes: Map<string, DiagramNode>,
  other: Point,
  orthogonal: boolean,
): Endpoint | null {
  if (!('node' in end)) return { p: { x: end.x, y: end.y }, n: { x: 0, y: 0 }, side: null }
  const node = nodes.get(end.node)
  if (!node) return null
  const r = rectOf(node)
  if (end.side === 'auto' && !orthogonal) {
    const p = boundaryPoint(node, other)
    const side = autoSide(r, other)
    return { p, n: NORMALS[side], side }
  }
  const side = end.side === 'auto' ? autoSide(r, other) : end.side
  return { p: sideAnchor(r, side), n: NORMALS[side], side }
}

function endRefPoint(end: EdgeEnd, nodes: Map<string, DiagramNode>): Point {
  if (!('node' in end)) return { x: end.x, y: end.y }
  const n = nodes.get(end.node)
  return n ? centerOf(rectOf(n)) : { x: 0, y: 0 }
}

export interface RoutedEdge {
  d: string
  points: Point[]
  start: Point
  end: Point
  startDir: Point
  endDir: Point
  mid: Point
}

const dedupe = (pts: Point[]) => {
  const out: Point[] = []
  for (const p of pts) {
    const last = out[out.length - 1]
    if (!last || Math.abs(last.x - p.x) > 0.01 || Math.abs(last.y - p.y) > 0.01) out.push(p)
  }
  return out
}

const dropCollinear = (pts: Point[]) => {
  if (pts.length < 3) return pts
  const out = [pts[0]]
  for (let i = 1; i < pts.length - 1; i++) {
    const a = out[out.length - 1]
    const b = pts[i]
    const c = pts[i + 1]
    const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
    if (Math.abs(cross) > 0.01) out.push(b)
  }
  out.push(pts[pts.length - 1])
  return out
}

/** Orthogonal waypoints between two directed endpoints. */
function elbow(a: Endpoint, b: Endpoint, pad: number): Point[] {
  const a1 = { x: a.p.x + a.n.x * pad, y: a.p.y + a.n.y * pad }
  const b1 = { x: b.p.x + b.n.x * pad, y: b.p.y + b.n.y * pad }
  const aH = Math.abs(a.n.x) > 0.5
  const bH = Math.abs(b.n.x) > 0.5

  if (a.side === null || b.side === null) {
    // Free endpoint: single elbow, favouring the anchored side's axis.
    const anchored = a.side !== null ? a : b
    const horiz = Math.abs(anchored.n.x) > 0.5
    const corner = horiz ? { x: b.p.x, y: a.p.y } : { x: a.p.x, y: b.p.y }
    return a.side !== null
      ? [a.p, a1, horiz ? { x: b.p.x, y: a1.y } : { x: a1.x, y: b.p.y }, b.p]
      : [a.p, corner, b.p]
  }

  if (aH && bH) {
    const mx = (a1.x + b1.x) / 2
    return [a.p, a1, { x: mx, y: a1.y }, { x: mx, y: b1.y }, b1, b.p]
  }
  if (!aH && !bH) {
    const my = (a1.y + b1.y) / 2
    return [a.p, a1, { x: a1.x, y: my }, { x: b1.x, y: my }, b1, b.p]
  }
  if (aH) return [a.p, a1, { x: b1.x, y: a1.y }, b1, b.p]
  return [a.p, a1, { x: a1.x, y: b1.y }, b1, b.p]
}

export function roundedPolyline(pts: Point[], radius: number) {
  if (pts.length < 2) return ''
  if (pts.length === 2) return `M${pts[0].x} ${pts[0].y} L${pts[1].x} ${pts[1].y}`
  let d = `M${pts[0].x} ${pts[0].y}`
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i]
    const prev = pts[i - 1]
    const next = pts[i + 1]
    const d0 = Math.hypot(p.x - prev.x, p.y - prev.y)
    const d1 = Math.hypot(next.x - p.x, next.y - p.y)
    const r = Math.min(radius, d0 / 2, d1 / 2)
    const a = { x: p.x + ((prev.x - p.x) / (d0 || 1)) * r, y: p.y + ((prev.y - p.y) / (d0 || 1)) * r }
    const b = { x: p.x + ((next.x - p.x) / (d1 || 1)) * r, y: p.y + ((next.y - p.y) / (d1 || 1)) * r }
    d += ` L${a.x} ${a.y} Q${p.x} ${p.y} ${b.x} ${b.y}`
  }
  const last = pts[pts.length - 1]
  d += ` L${last.x} ${last.y}`
  return d
}

export function pointAtLength(pts: Point[], frac: number): Point {
  if (pts.length === 0) return { x: 0, y: 0 }
  if (pts.length === 1) return pts[0]
  let total = 0
  const segs: number[] = []
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
    segs.push(l)
    total += l
  }
  let target = total * frac
  for (let i = 0; i < segs.length; i++) {
    if (target <= segs[i] || i === segs.length - 1) {
      const t = segs[i] === 0 ? 0 : target / segs[i]
      return {
        x: pts[i].x + (pts[i + 1].x - pts[i].x) * t,
        y: pts[i].y + (pts[i + 1].y - pts[i].y) * t,
      }
    }
    target -= segs[i]
  }
  return pts[pts.length - 1]
}

export function routeEdge(edge: DiagramEdge, nodes: Map<string, DiagramNode>): RoutedEdge | null {
  const orth = edge.routing === 'orthogonal'
  const fromRef = endRefPoint(edge.from, nodes)
  const toRef = endRefPoint(edge.to, nodes)
  const a = resolveEnd(edge.from, nodes, toRef, orth)
  const b = resolveEnd(edge.to, nodes, fromRef, orth)
  if (!a || !b) return null

  if (edge.routing === 'straight') {
    const pts = [a.p, b.p]
    return {
      d: `M${a.p.x} ${a.p.y} L${b.p.x} ${b.p.y}`,
      points: pts,
      start: a.p,
      end: b.p,
      startDir: unit({ x: a.p.x - b.p.x, y: a.p.y - b.p.y }),
      endDir: unit({ x: b.p.x - a.p.x, y: b.p.y - a.p.y }),
      mid: { x: (a.p.x + b.p.x) / 2, y: (a.p.y + b.p.y) / 2 },
    }
  }

  if (edge.routing === 'curve') {
    const span = Math.max(40, dist(a.p, b.p) * 0.42)
    const c1 = { x: a.p.x + a.n.x * span, y: a.p.y + a.n.y * span }
    const c2 = { x: b.p.x + b.n.x * span, y: b.p.y + b.n.y * span }
    const mid = cubicAt(a.p, c1, c2, b.p, 0.5)
    return {
      d: `M${a.p.x} ${a.p.y} C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${b.p.x} ${b.p.y}`,
      points: [a.p, c1, c2, b.p],
      start: a.p,
      end: b.p,
      startDir: a.side ? { x: a.n.x, y: a.n.y } : unit({ x: a.p.x - c1.x, y: a.p.y - c1.y }),
      endDir: b.side ? { x: b.n.x, y: b.n.y } : unit({ x: b.p.x - c2.x, y: b.p.y - c2.y }),
      mid,
    }
  }

  const pad = 22
  const pts = dropCollinear(dedupe(elbow(a, b, pad)))
  const startDir = pts.length > 1 ? unit({ x: pts[0].x - pts[1].x, y: pts[0].y - pts[1].y }) : a.n
  const endDir =
    pts.length > 1
      ? unit({
          x: pts[pts.length - 1].x - pts[pts.length - 2].x,
          y: pts[pts.length - 1].y - pts[pts.length - 2].y,
        })
      : b.n
  return {
    d: roundedPolyline(pts, 8),
    points: pts,
    start: pts[0],
    end: pts[pts.length - 1],
    startDir,
    endDir,
    mid: pointAtLength(pts, 0.5),
  }
}

function cubicAt(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const mt = 1 - t
  return {
    x: mt ** 3 * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t ** 3 * p3.x,
    y: mt ** 3 * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t ** 3 * p3.y,
  }
}

export function unit(p: Point): Point {
  const l = Math.hypot(p.x, p.y) || 1
  return { x: p.x / l, y: p.y / l }
}

export function distToPolyline(pts: Point[], p: Point): number {
  let best = Infinity
  for (let i = 1; i < pts.length; i++) best = Math.min(best, distToSegment(p, pts[i - 1], pts[i]))
  return best
}

export function distToSegment(p: Point, a: Point, b: Point) {
  const vx = b.x - a.x
  const vy = b.y - a.y
  const len = vx * vx + vy * vy
  const t = len === 0 ? 0 : clamp(((p.x - a.x) * vx + (p.y - a.y) * vy) / len, 0, 1)
  return Math.hypot(p.x - (a.x + t * vx), p.y - (a.y + t * vy))
}

/** Catmull-Rom → cubic bezier, for freehand ink. */
export function smoothPath(points: number[]): string {
  const n = points.length / 2
  if (n === 0) return ''
  if (n === 1) return `M${points[0]} ${points[1]} l0.01 0`
  const pt = (i: number): Point => {
    const j = clamp(i, 0, n - 1)
    return { x: points[j * 2], y: points[j * 2 + 1] }
  }
  let d = `M${pt(0).x} ${pt(0).y}`
  for (let i = 0; i < n - 1; i++) {
    const p0 = pt(i - 1)
    const p1 = pt(i)
    const p2 = pt(i + 1)
    const p3 = pt(i + 2)
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 }
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 }
    d += ` C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${p2.x} ${p2.y}`
  }
  return d
}

export function inkBounds(points: number[]): Rect {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (let i = 0; i < points.length; i += 2) {
    x0 = Math.min(x0, points[i])
    x1 = Math.max(x1, points[i])
    y0 = Math.min(y0, points[i + 1])
    y1 = Math.max(y1, points[i + 1])
  }
  if (!isFinite(x0)) return { x: 0, y: 0, w: 0, h: 0 }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}
