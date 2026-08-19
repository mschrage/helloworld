import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import { useStore, selectionSize } from '../state/store'
import type { Selection } from '../state/store'
import {
  centerOf,
  distToPolyline,
  expandRect,
  hitShape,
  inkBounds,
  normalizeRect,
  rectOf,
  rectsIntersect,
  routeEdge,
  sideAnchor,
  smoothPath,
  unionRects,
} from '../lib/geometry'
import { snapRect, type Guide } from '../lib/snap'
import { SHAPES } from '../lib/theme'
import { makeStyle } from '../lib/theme'
import type {
  DiagramEdge,
  DiagramNode,
  EdgeEnd,
  Point,
  PortSide,
  Rect,
  ResizeHandle,
  ShapeKind,
  Viewport,
} from '../types'
import { NodeView } from './NodeView'
import { EdgeView } from './EdgeView'
import { TextEditor } from './TextEditor'

const HANDLES: { id: ResizeHandle; fx: number; fy: number; cursor: string }[] = [
  { id: 'nw', fx: 0, fy: 0, cursor: 'nwse-resize' },
  { id: 'n', fx: 0.5, fy: 0, cursor: 'ns-resize' },
  { id: 'ne', fx: 1, fy: 0, cursor: 'nesw-resize' },
  { id: 'e', fx: 1, fy: 0.5, cursor: 'ew-resize' },
  { id: 'se', fx: 1, fy: 1, cursor: 'nwse-resize' },
  { id: 's', fx: 0.5, fy: 1, cursor: 'ns-resize' },
  { id: 'sw', fx: 0, fy: 1, cursor: 'nesw-resize' },
  { id: 'w', fx: 0, fy: 0.5, cursor: 'ew-resize' },
]

const PORTS: PortSide[] = ['n', 'e', 's', 'w']
/** Grab radius around a port dot, in screen pixels. */
const PORT_TOL = 9

type Gesture =
  | { type: 'none' }
  | { type: 'pan'; start: Point; vp: Viewport }
  | { type: 'marquee'; start: Point; cur: Point; additive: boolean }
  | {
      type: 'move'
      start: Point
      cur: Point
      origin: { nodes: Map<string, Point>; ink: Map<string, number[]>; edges: Map<string, [Point | null, Point | null]> }
      bounds: Rect
      moved: boolean
    }
  | {
      type: 'resize'
      handle: ResizeHandle
      start: Point
      bounds: Rect
      origin: Map<string, Rect>
      moved: boolean
    }
  | { type: 'connect'; from: EdgeEnd; cur: Point; target: { node: string; side: PortSide } | null }
  | { type: 'draw'; kind: ShapeKind; start: Point; cur: Point }
  | { type: 'pen'; points: number[] }
  | { type: 'erase' }

export interface CanvasHandle {
  size: { w: number; h: number }
}

export function Canvas({ onSize }: { onSize?: (s: { w: number; h: number }) => void }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const gesture = useRef<Gesture>({ type: 'none' })
  const [, forceRender] = useState(0)
  const bump = useCallback(() => forceRender((n) => n + 1), [])
  const [guides, setGuides] = useState<Guide[]>([])
  const [hover, setHover] = useState<{ node?: string; edge?: string; ink?: string }>({})
  const [spaceDown, setSpaceDown] = useState(false)
  const [size, setSize] = useState({ w: 1200, h: 800 })

  const scene = useStore((s) => s.scene)
  const viewport = useStore((s) => s.viewport)
  const tool = useStore((s) => s.tool)
  const selection = useStore((s) => s.selection)
  const editing = useStore((s) => s.editing)
  const showGrid = useStore((s) => s.showGrid)
  const snapToGrid = useStore((s) => s.snapToGrid)
  const gridSize = useStore((s) => s.gridSize)

  const nodeMap = useMemo(() => new Map(scene.nodes.map((n) => [n.id, n])), [scene.nodes])
  const routes = useMemo(() => {
    const m = new Map<string, ReturnType<typeof routeEdge>>()
    for (const e of scene.edges) m.set(e.id, routeEdge(e, nodeMap))
    return m
  }, [scene.edges, nodeMap])

  /* ------------------------------------------------------------ sizing */

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect()
      const next = { w: r.width, h: r.height }
      setSize(next)
      onSize?.(next)
    })
    ro.observe(el)
    const r = el.getBoundingClientRect()
    setSize({ w: r.width, h: r.height })
    onSize?.({ w: r.width, h: r.height })
    return () => ro.disconnect()
  }, [onSize])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isTypingTarget(e.target)) setSpaceDown(true)
    }
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceDown(false)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  /* -------------------------------------------------------- coordinates */

  const toWorld = useCallback(
    (e: { clientX: number; clientY: number }): Point => {
      const rect = svgRef.current!.getBoundingClientRect()
      const vp = useStore.getState().viewport
      return {
        x: (e.clientX - rect.left - vp.x) / vp.k,
        y: (e.clientY - rect.top - vp.y) / vp.k,
      }
    },
    [],
  )

  const toScreenLocal = useCallback((e: { clientX: number; clientY: number }): Point => {
    const rect = svgRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }, [])

  /* ------------------------------------------------------------ hit test */

  const pickNode = useCallback(
    (p: Point, opts: { framesLast?: boolean } = {}): DiagramNode | null => {
      const list = scene.nodes
      for (let i = list.length - 1; i >= 0; i--) {
        const n = list[i]
        if (opts.framesLast && n.kind === 'frame') continue
        if (hitShape(n, p, n.kind === 'text' ? 4 : 0)) return n
      }
      if (opts.framesLast) {
        for (let i = list.length - 1; i >= 0; i--) {
          const n = list[i]
          if (n.kind === 'frame' && hitShape(n, p, 6)) return n
        }
      }
      return null
    },
    [scene.nodes],
  )

  const pickEdge = useCallback(
    (p: Point): DiagramEdge | null => {
      const tol = 8 / viewport.k
      for (let i = scene.edges.length - 1; i >= 0; i--) {
        const e = scene.edges[i]
        const r = routes.get(e.id)
        if (!r) continue
        const pts = e.routing === 'curve' ? sampleCubic(r.points) : r.points
        if (distToPolyline(pts, p) < tol) return e
      }
      return null
    },
    [scene.edges, routes, viewport.k],
  )

  const pickInk = useCallback(
    (p: Point): string | null => {
      const tol = 9 / viewport.k
      for (let i = scene.ink.length - 1; i >= 0; i--) {
        const s = scene.ink[i]
        const pts: Point[] = []
        for (let j = 0; j < s.points.length; j += 2) pts.push({ x: s.points[j], y: s.points[j + 1] })
        if (pts.length && distToPolyline(pts, p) < tol) return s.id
      }
      return null
    },
    [scene.ink, viewport.k],
  )

  /* ------------------------------------------------------------ helpers */

  const selBounds = useMemo(() => {
    const rects: Rect[] = []
    for (const n of scene.nodes) if (selection.nodes.includes(n.id)) rects.push(rectOf(n))
    for (const s of scene.ink) if (selection.ink.includes(s.id)) rects.push(inkBounds(s.points))
    return unionRects(rects)
  }, [scene, selection])

  const startMove = (p: Point) => {
    const s = useStore.getState()
    const origin = {
      nodes: new Map<string, Point>(),
      ink: new Map<string, number[]>(),
      edges: new Map<string, [Point | null, Point | null]>(),
    }
    for (const n of s.scene.nodes)
      if (s.selection.nodes.includes(n.id)) origin.nodes.set(n.id, { x: n.x, y: n.y })
    for (const i of s.scene.ink)
      if (s.selection.ink.includes(i.id)) origin.ink.set(i.id, i.points.slice())
    for (const e of s.scene.edges)
      if (s.selection.edges.includes(e.id))
        origin.edges.set(e.id, [
          'node' in e.from ? null : { ...e.from },
          'node' in e.to ? null : { ...e.to },
        ])
    const rects: Rect[] = []
    for (const [id, pt] of origin.nodes) {
      const n = nodeMap.get(id)!
      rects.push({ x: pt.x, y: pt.y, w: n.w, h: n.h })
    }
    for (const [, pts] of origin.ink) rects.push(inkBounds(pts))
    const bounds = unionRects(rects) ?? { x: p.x, y: p.y, w: 0, h: 0 }
    s.begin()
    gesture.current = { type: 'move', start: p, cur: p, origin, bounds, moved: false }
  }

  /* ------------------------------------------------------- pointer down */

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button === 2) return
    const target = e.target as Element
    if (target.closest('[data-ui]')) return
    svgRef.current?.setPointerCapture(e.pointerId)
    const p = toWorld(e)
    const s = useStore.getState()
    const t = s.tool

    // Panning: middle mouse, space, or hand tool.
    if (e.button === 1 || spaceDown || t === 'hand') {
      gesture.current = { type: 'pan', start: toScreenLocal(e), vp: { ...s.viewport } }
      bump()
      return
    }

    if (t === 'pen') {
      gesture.current = { type: 'pen', points: [p.x, p.y] }
      bump()
      return
    }

    if (t === 'eraser') {
      s.begin()
      gesture.current = { type: 'erase' }
      eraseAt(p)
      return
    }

    if (typeof t === 'object') {
      gesture.current = { type: 'draw', kind: t.shape, start: p, cur: p }
      bump()
      return
    }

    if (t === 'edge') {
      const n = pickNode(p, { framesLast: true })
      const from: EdgeEnd = n ? { node: n.id, side: 'auto' } : { x: p.x, y: p.y }
      gesture.current = { type: 'connect', from, cur: p, target: null }
      bump()
      return
    }

    // ---- select tool ----
    const handle = hitHandle(p, selBounds, viewport.k)
    if (handle && selection.nodes.length) {
      const origin = new Map<string, Rect>()
      for (const n of scene.nodes) if (selection.nodes.includes(n.id)) origin.set(n.id, rectOf(n))
      s.begin()
      gesture.current = {
        type: 'resize',
        handle,
        start: p,
        bounds: selBounds!,
        origin,
        moved: false,
      }
      bump()
      return
    }

    const port = hitPort(p, scene.nodes, selection, hover.node, viewport.k)
    if (port) {
      gesture.current = {
        type: 'connect',
        from: { node: port.id, side: port.side },
        cur: p,
        target: null,
      }
      bump()
      return
    }

    const node = pickNode(p, { framesLast: true })
    if (node) {
      const already = selection.nodes.includes(node.id)
      if (e.shiftKey) {
        s.toggleSelect('nodes', node.id)
      } else if (!already) {
        s.select({ nodes: [node.id] })
      }
      if (e.altKey) {
        s.duplicate({ x: 0, y: 0 })
      }
      startMove(p)
      bump()
      return
    }

    const edge = pickEdge(p)
    if (edge) {
      if (e.shiftKey) s.toggleSelect('edges', edge.id)
      else s.select({ edges: [edge.id] })
      startMove(p)
      bump()
      return
    }

    const ink = pickInk(p)
    if (ink) {
      if (e.shiftKey) s.toggleSelect('ink', ink)
      else s.select({ ink: [ink] })
      startMove(p)
      bump()
      return
    }

    if (!e.shiftKey) s.clearSelection()
    gesture.current = { type: 'marquee', start: p, cur: p, additive: e.shiftKey }
    bump()
  }

  /* ------------------------------------------------------- pointer move */

  const onPointerMove = (e: React.PointerEvent) => {
    const p = toWorld(e)
    const g = gesture.current
    const s = useStore.getState()

    if (g.type === 'none') {
      const n = pickNode(p, { framesLast: true }) ?? nodeNearPort(p, scene.nodes, viewport.k)
      const ed = n ? null : pickEdge(p)
      const ik = n || ed ? null : pickInk(p)
      const next = { node: n?.id, edge: ed?.id, ink: ik ?? undefined }
      if (next.node !== hover.node || next.edge !== hover.edge || next.ink !== hover.ink) setHover(next)
      return
    }

    switch (g.type) {
      case 'pan': {
        const cur = toScreenLocal(e)
        s.setViewport({ x: g.vp.x + (cur.x - g.start.x), y: g.vp.y + (cur.y - g.start.y) })
        break
      }
      case 'marquee': {
        g.cur = p
        bump()
        break
      }
      case 'move': {
        g.cur = p
        let dx = p.x - g.start.x
        let dy = p.y - g.start.y
        if (e.shiftKey) {
          if (Math.abs(dx) > Math.abs(dy)) dy = 0
          else dx = 0
        }
        const moving = { ...g.bounds, x: g.bounds.x + dx, y: g.bounds.y + dy }
        let snapped = { dx: 0, dy: 0, guides: [] as Guide[] }
        if (!e.metaKey && !e.ctrlKey) {
          const peers = scene.nodes
            .filter((n) => !s.selection.nodes.includes(n.id))
            .map(rectOf)
          snapped = snapRect(moving, peers, 6 / viewport.k, snapToGrid ? gridSize : null)
        }
        dx += snapped.dx
        dy += snapped.dy
        setGuides(snapped.guides)
        if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) g.moved = true
        applyMove(g, dx, dy)
        break
      }
      case 'resize': {
        g.moved = true
        applyResize(g, p, e.shiftKey, e.altKey)
        break
      }
      case 'connect': {
        g.cur = p
        const n = pickNode(p, { framesLast: true })
        const fromId = 'node' in g.from ? g.from.node : null
        g.target = n && n.id !== fromId ? { node: n.id, side: nearestSide(n, p) } : null
        bump()
        break
      }
      case 'draw': {
        g.cur = p
        bump()
        break
      }
      case 'pen': {
        const last = g.points.length
        const lx = g.points[last - 2]
        const ly = g.points[last - 1]
        if (Math.hypot(p.x - lx, p.y - ly) > 1.6 / viewport.k) {
          g.points.push(p.x, p.y)
          bump()
        }
        break
      }
      case 'erase': {
        eraseAt(p)
        break
      }
    }
  }

  const applyMove = (g: Extract<Gesture, { type: 'move' }>, dx: number, dy: number) => {
    const s = useStore.getState()
    s.setNodes(
      s.scene.nodes.map((n) => {
        const o = g.origin.nodes.get(n.id)
        return o ? { ...n, x: Math.round(o.x + dx), y: Math.round(o.y + dy) } : n
      }),
    )
    if (g.origin.ink.size) {
      for (const [id, pts] of g.origin.ink) {
        s.patchInk([id], () => ({
          points: pts.map((v, i) => (i % 2 === 0 ? v + dx : v + dy)),
        }))
      }
    }
    if (g.origin.edges.size) {
      for (const [id, [from, to]] of g.origin.edges) {
        s.patchEdges([id], (e) => ({
          from: from ? { x: from.x + dx, y: from.y + dy } : e.from,
          to: to ? { x: to.x + dx, y: to.y + dy } : e.to,
        }))
      }
    }
  }

  const applyResize = (
    g: Extract<Gesture, { type: 'resize' }>,
    p: Point,
    keepRatio: boolean,
    fromCenter: boolean,
  ) => {
    const b = g.bounds
    const h = g.handle
    const left = h.includes('w')
    const right = h.includes('e')
    const top = h.startsWith('n')
    const bottom = h.startsWith('s')

    let x0 = b.x
    let y0 = b.y
    let x1 = b.x + b.w
    let y1 = b.y + b.h
    const min = 16

    if (right) x1 = Math.max(x0 + min, p.x)
    if (left) x0 = Math.min(x1 - min, p.x)
    if (bottom) y1 = Math.max(y0 + min, p.y)
    if (top) y0 = Math.min(y1 - min, p.y)

    if (fromCenter) {
      const cx = b.x + b.w / 2
      const cy = b.y + b.h / 2
      if (left || right) {
        const half = Math.max(min / 2, Math.abs(p.x - cx))
        x0 = cx - half
        x1 = cx + half
      }
      if (top || bottom) {
        const half = Math.max(min / 2, Math.abs(p.y - cy))
        y0 = cy - half
        y1 = cy + half
      }
    }

    if (keepRatio && b.w > 0 && b.h > 0) {
      const ratio = b.w / b.h
      const w = x1 - x0
      const hgt = y1 - y0
      if (w / hgt > ratio) {
        const nh = w / ratio
        if (top) y0 = y1 - nh
        else y1 = y0 + nh
      } else {
        const nw = hgt * ratio
        if (left) x0 = x1 - nw
        else x1 = x0 + nw
      }
    }

    const sx = b.w === 0 ? 1 : (x1 - x0) / b.w
    const sy = b.h === 0 ? 1 : (y1 - y0) / b.h
    const s = useStore.getState()
    s.setNodes(
      s.scene.nodes.map((n) => {
        const o = g.origin.get(n.id)
        if (!o) return n
        return {
          ...n,
          x: Math.round(x0 + (o.x - b.x) * sx),
          y: Math.round(y0 + (o.y - b.y) * sy),
          w: Math.max(min, Math.round(o.w * sx)),
          h: Math.max(min, Math.round(o.h * sy)),
        }
      }),
    )
  }

  const eraseAt = (p: Point) => {
    const ik = pickInk(p)
    if (ik) {
      useStore.getState().erase({ ink: [ik] })
      return
    }
    const ed = pickEdge(p)
    if (ed) {
      useStore.getState().erase({ edges: [ed.id] })
      return
    }
    const n = pickNode(p, { framesLast: true })
    if (n) useStore.getState().erase({ nodes: [n.id] })
  }

  /* --------------------------------------------------------- pointer up */

  const onPointerUp = (e: React.PointerEvent) => {
    const g = gesture.current
    const s = useStore.getState()
    const p = toWorld(e)
    gesture.current = { type: 'none' }
    setGuides([])

    switch (g.type) {
      case 'marquee': {
        const r = normalizeRect(g.start, g.cur)
        if (r.w < 2 && r.h < 2) break
        const nodes = scene.nodes.filter((n) => rectsIntersect(r, rectOf(n))).map((n) => n.id)
        const ink = scene.ink.filter((i) => rectsIntersect(r, inkBounds(i.points))).map((i) => i.id)
        const edges = scene.edges
          .filter((ed) => {
            const rt = routes.get(ed.id)
            return rt ? rt.points.every((pt) => pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h) : false
          })
          .map((ed) => ed.id)
        s.select({ nodes, edges, ink }, g.additive)
        break
      }
      case 'move': {
        if (!g.moved) {
          // A click without movement collapses a multi-selection to one item.
          const node = pickNode(p, { framesLast: true })
          if (node && !e.shiftKey && selectionSize(s.selection) > 1) s.select({ nodes: [node.id] })
          s.undo()
          useStore.setState((st) => ({ future: st.future.slice(0, -1) }))
        }
        break
      }
      case 'resize': {
        for (const id of s.selection.nodes) s.fitNodeHeight(id)
        break
      }
      case 'connect': {
        const to: EdgeEnd = g.target ?? { x: p.x, y: p.y }
        const isPoint = !('node' in to)
        const fromId = 'node' in g.from ? g.from.node : null
        const dragged = Math.hypot(p.x - g.cur.x, p.y - g.cur.y) >= 0
        if (isPoint && fromId && dragged) {
          const start = nodeMap.get(fromId)
          if (start && Math.hypot(p.x - centerOf(rectOf(start)).x, p.y - centerOf(rectOf(start)).y) < 30) break
        }
        if (!fromId && isPoint) break
        // Dropping on blank canvas from a node creates the next node inline.
        if (isPoint && fromId) {
          const spec = SHAPES[useStore.getState().lastShape] ?? SHAPES.round
          const kind = spec.kind === 'frame' || spec.kind === 'text' ? 'round' : spec.kind
          const node: DiagramNode = {
            id: nanoid(8),
            kind,
            x: Math.round(p.x - SHAPES[kind].w / 2),
            y: Math.round(p.y - SHAPES[kind].h / 2),
            w: SHAPES[kind].w,
            h: SHAPES[kind].h,
            text: '',
            style: makeStyle(kind),
          }
          s.begin()
          useStore.setState((st) => ({
            scene: {
              ...st.scene,
              nodes: [...st.scene.nodes, node],
              edges: [
                ...st.scene.edges,
                {
                  id: nanoid(8),
                  from: g.from,
                  to: { node: node.id, side: 'auto' as PortSide },
                  routing: st.edgeDefaults.routing,
                  startCap: 'none' as const,
                  endCap: st.edgeDefaults.endCap,
                  label: '',
                  style: { ...st.edgeDefaults.style },
                },
              ],
            },
          }))
          s.select({ nodes: [node.id] })
          s.setEditing(node.id)
          break
        }
        const ed = s.addEdge({
          from: g.from,
          to,
          routing: s.edgeDefaults.routing,
          startCap: 'none',
          endCap: s.edgeDefaults.endCap,
          label: '',
          style: { ...s.edgeDefaults.style },
        })
        s.select({ edges: [ed.id] })
        break
      }
      case 'draw': {
        const spec = SHAPES[g.kind]
        const r = normalizeRect(g.start, g.cur)
        const drawn = r.w > 8 || r.h > 8
        const node = s.addNode(g.kind, drawn ? { x: r.x, y: r.y } : g.start, {
          center: !drawn,
        })
        if (drawn) {
          s.patchNodes([node.id], () => ({
            w: Math.max(spec.kind === 'text' ? 40 : 24, Math.round(r.w)),
            h: Math.max(24, Math.round(r.h)),
          }))
        }
        s.select({ nodes: [node.id] })
        s.setEditing(node.id)
        if (!s.stickyTool) s.setTool('select')
        break
      }
      case 'pen': {
        if (g.points.length >= 4) {
          s.addInk({ points: g.points.map((v) => Math.round(v * 10) / 10), weight: 1.4, opacity: 0.9 })
        }
        break
      }
    }
    bump()
  }

  /* ---------------------------------------------------------- wheel/dbl */

  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const s = useStore.getState()
      const rect = el.getBoundingClientRect()
      const local = { x: e.clientX - rect.left, y: e.clientY - rect.top }
      if (e.ctrlKey || e.metaKey) {
        s.zoomAt(Math.exp(-e.deltaY * 0.0075), local, size)
      } else if (e.shiftKey) {
        s.panBy(-e.deltaY, 0)
      } else {
        s.panBy(-e.deltaX, -e.deltaY)
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [size])

  const onDoubleClick = (e: React.MouseEvent) => {
    const p = toWorld(e)
    const s = useStore.getState()
    const node = pickNode(p, { framesLast: true })
    if (node) {
      s.select({ nodes: [node.id] })
      s.setEditing(node.id)
      return
    }
    const edge = pickEdge(p)
    if (edge) {
      s.select({ edges: [edge.id] })
      s.setEditing(edge.id)
      return
    }
    const kind = s.lastShape === 'frame' ? 'round' : s.lastShape
    const n = s.addNode(kind, p)
    s.select({ nodes: [n.id] })
    s.setEditing(n.id)
  }

  /* ------------------------------------------------------------- render */

  const g = gesture.current
  const frames = scene.nodes.filter((n) => n.kind === 'frame')
  const plain = scene.nodes.filter((n) => n.kind !== 'frame')
  const hoverNode = hover.node ? nodeMap.get(hover.node) : undefined
  const showPorts =
    tool === 'select' &&
    !spaceDown &&
    g.type === 'none' &&
    hoverNode &&
    hoverNode.kind !== 'frame' &&
    hoverNode.kind !== 'text'

  const cursor =
    spaceDown || tool === 'hand'
      ? g.type === 'pan'
        ? 'grabbing'
        : 'grab'
      : tool === 'pen'
        ? 'crosshair'
        : tool === 'eraser'
          ? 'crosshair'
          : tool === 'edge' || typeof tool === 'object'
            ? 'crosshair'
            : 'default'

  return (
    <div ref={wrapRef} className="canvas-wrap" style={{ cursor }}>
      <svg
        ref={svgRef}
        className="canvas"
        width={size.w}
        height={size.h}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
        onContextMenu={(e) => e.preventDefault()}
      >
        <defs>
          <pattern
            id="dots"
            width={gridSize * 3 * viewport.k}
            height={gridSize * 3 * viewport.k}
            patternUnits="userSpaceOnUse"
            x={viewport.x}
            y={viewport.y}
          >
            <circle cx={0.5} cy={0.5} r={viewport.k > 1.4 ? 1 : 0.75} fill="#d9d9d3" />
          </pattern>
        </defs>

        {showGrid && <rect width={size.w} height={size.h} fill="url(#dots)" data-export="false" />}

        <g transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.k})`}>
          {frames.map((n) => (
            <NodeView key={n.id} node={n} hideText={editing === n.id} />
          ))}

          {scene.edges.map((e) => {
            const r = routes.get(e.id)
            return r ? <EdgeView key={e.id} edge={e} route={r} /> : null
          })}

          {plain.map((n) => (
            <NodeView key={n.id} node={n} hideText={editing === n.id} />
          ))}

          {scene.ink.map((s) => (
            <path
              key={s.id}
              d={smoothPath(s.points)}
              fill="none"
              stroke="#3d3d3a"
              strokeWidth={s.weight}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={s.opacity}
            />
          ))}

          {/* ---------------- overlays ---------------- */}
          <g data-export="false">
            {guides.map((gd, i) => (
              <line
                key={i}
                x1={gd.axis === 'x' ? gd.at : gd.from}
                y1={gd.axis === 'x' ? gd.from : gd.at}
                x2={gd.axis === 'x' ? gd.at : gd.to}
                y2={gd.axis === 'x' ? gd.to : gd.at}
                stroke="#2f6ff0"
                strokeWidth={1 / viewport.k}
                strokeDasharray={`${3 / viewport.k} ${3 / viewport.k}`}
              />
            ))}

            {hover.node && !selection.nodes.includes(hover.node) && nodeMap.get(hover.node) && (
              <OutlineRect r={expandRect(rectOf(nodeMap.get(hover.node)!), 3)} k={viewport.k} soft />
            )}

            {scene.nodes
              .filter((n) => selection.nodes.includes(n.id))
              .map((n) => (
                <OutlineRect key={n.id} r={expandRect(rectOf(n), 3)} k={viewport.k} />
              ))}

            {scene.edges
              .filter((e) => selection.edges.includes(e.id))
              .map((e) => {
                const r = routes.get(e.id)
                return r ? (
                  <path
                    key={e.id}
                    d={r.d}
                    fill="none"
                    stroke="#2f6ff0"
                    strokeWidth={3 / viewport.k}
                    opacity={0.28}
                    strokeLinecap="round"
                  />
                ) : null
              })}

            {scene.ink
              .filter((s) => selection.ink.includes(s.id))
              .map((s) => (
                <OutlineRect key={s.id} r={expandRect(inkBounds(s.points), 5)} k={viewport.k} />
              ))}

            {hover.edge && !selection.edges.includes(hover.edge) && routes.get(hover.edge) && (
              <path
                d={routes.get(hover.edge)!.d}
                fill="none"
                stroke="#2f6ff0"
                strokeWidth={3 / viewport.k}
                opacity={0.14}
                strokeLinecap="round"
              />
            )}

            {selBounds && selection.nodes.length > 0 && g.type !== 'move' && (
              <>
                {selection.nodes.length > 1 && (
                  <OutlineRect r={expandRect(selBounds, 8)} k={viewport.k} dashed />
                )}
                {HANDLES.map((hd) => {
                  const r = expandRect(selBounds, 8)
                  const x = r.x + r.w * hd.fx
                  const y = r.y + r.h * hd.fy
                  const s = 3.5 / viewport.k
                  return (
                    <rect
                      key={hd.id}
                      x={x - s}
                      y={y - s}
                      width={s * 2}
                      height={s * 2}
                      fill="#ffffff"
                      stroke="#2f6ff0"
                      strokeWidth={1 / viewport.k}
                      style={{ cursor: hd.cursor }}
                    />
                  )
                })}
              </>
            )}

            {showPorts &&
              hoverNode &&
              PORTS.map((side) => {
                const pt = sideAnchor(rectOf(hoverNode), side as 'n' | 'e' | 's' | 'w')
                return (
                  <circle
                    key={side}
                    cx={pt.x}
                    cy={pt.y}
                    r={4 / viewport.k}
                    fill="#ffffff"
                    stroke="#2f6ff0"
                    strokeWidth={1.1 / viewport.k}
                  />
                )
              })}

            {g.type === 'marquee' && (
              <MarqueeRect r={normalizeRect(g.start, g.cur)} k={viewport.k} />
            )}

            {g.type === 'draw' && (() => {
              const r = normalizeRect(g.start, g.cur)
              if (r.w < 4 && r.h < 4) return null
              return <MarqueeRect r={r} k={viewport.k} />
            })()}

            {g.type === 'connect' && <ConnectPreview g={g} nodeMap={nodeMap} k={viewport.k} />}

            {g.type === 'pen' && (
              <path
                d={smoothPath(g.points)}
                fill="none"
                stroke="#3d3d3a"
                strokeWidth={1.4}
                strokeLinecap="round"
                opacity={0.9}
              />
            )}
          </g>
        </g>
      </svg>

      {editing && <TextEditor key={editing} id={editing} size={size} />}
    </div>
  )
}

/* -------------------------------------------------------------- pieces */

function OutlineRect({
  r,
  k,
  soft,
  dashed,
}: {
  r: Rect
  k: number
  soft?: boolean
  dashed?: boolean
}) {
  return (
    <rect
      x={r.x}
      y={r.y}
      width={r.w}
      height={r.h}
      fill="none"
      stroke="#2f6ff0"
      strokeWidth={(soft ? 1 : 1.2) / k}
      opacity={soft ? 0.35 : 0.9}
      strokeDasharray={dashed ? `${4 / k} ${3 / k}` : undefined}
      rx={2 / k}
    />
  )
}

function MarqueeRect({ r, k }: { r: Rect; k: number }) {
  return (
    <rect
      x={r.x}
      y={r.y}
      width={r.w}
      height={r.h}
      fill="#2f6ff0"
      fillOpacity={0.05}
      stroke="#2f6ff0"
      strokeWidth={1 / k}
      strokeDasharray={`${4 / k} ${3 / k}`}
    />
  )
}

function ConnectPreview({
  g,
  nodeMap,
  k,
}: {
  g: Extract<Gesture, { type: 'connect' }>
  nodeMap: Map<string, DiagramNode>
  k: number
}) {
  const preview: DiagramEdge = {
    id: '__preview',
    from: g.from,
    to: g.target ?? { x: g.cur.x, y: g.cur.y },
    routing: useStore.getState().edgeDefaults.routing,
    startCap: 'none',
    endCap: 'arrow',
    label: '',
    style: { stroke: 'solid', weight: 1, fontSize: 11 },
  }
  const r = routeEdge(preview, nodeMap)
  if (!r) return null
  return (
    <g opacity={0.6}>
      <path d={r.d} fill="none" stroke="#2f6ff0" strokeWidth={1.2 / k} />
      <circle cx={r.end.x} cy={r.end.y} r={3 / k} fill="#2f6ff0" />
      {g.target && nodeMap.get(g.target.node) && (
        <OutlineRect r={expandRect(rectOf(nodeMap.get(g.target.node)!), 4)} k={k} />
      )}
    </g>
  )
}

/* --------------------------------------------------------------- utils */

function hitHandle(p: Point, b: Rect | null, k: number): ResizeHandle | null {
  if (!b) return null
  const r = expandRect(b, 8)
  const tol = 7 / k
  for (const h of HANDLES) {
    const x = r.x + r.w * h.fx
    const y = r.y + r.h * h.fy
    if (Math.abs(p.x - x) <= tol && Math.abs(p.y - y) <= tol) return h.id
  }
  return null
}

function hitPort(
  p: Point,
  nodes: DiagramNode[],
  _selection: Selection,
  hoverId: string | undefined,
  k: number,
): { id: string; side: PortSide } | null {
  if (!hoverId) return null
  const n = nodes.find((x) => x.id === hoverId)
  if (!n || n.kind === 'frame' || n.kind === 'text') return null
  for (const side of PORTS) {
    const pt = sideAnchor(rectOf(n), side as 'n' | 'e' | 's' | 'w')
    if (Math.hypot(p.x - pt.x, p.y - pt.y) <= PORT_TOL / k) return { id: n.id, side }
  }
  return null
}

/**
 * Port dots straddle the silhouette, so half of every dot sits outside the
 * shape. Keep a node "hovered" while the cursor is over one of those dots,
 * otherwise the visible target is only half grabbable.
 */
function nodeNearPort(p: Point, nodes: DiagramNode[], k: number): DiagramNode | null {
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i]
    if (n.kind === 'frame' || n.kind === 'text') continue
    const r = rectOf(n)
    for (const side of PORTS) {
      const pt = sideAnchor(r, side as 'n' | 'e' | 's' | 'w')
      if (Math.hypot(p.x - pt.x, p.y - pt.y) <= PORT_TOL / k) return n
    }
  }
  return null
}

function nearestSide(n: DiagramNode, p: Point): PortSide {
  const r = rectOf(n)
  const d = {
    n: Math.abs(p.y - r.y),
    s: Math.abs(p.y - (r.y + r.h)),
    w: Math.abs(p.x - r.x),
    e: Math.abs(p.x - (r.x + r.w)),
  }
  const min = Math.min(d.n, d.s, d.w, d.e)
  // Only bind to a specific side when the cursor is genuinely near it.
  if (min > Math.min(r.w, r.h) * 0.28) return 'auto'
  return (Object.keys(d) as (keyof typeof d)[]).find((key) => d[key] === min) ?? 'auto'
}

function sampleCubic(pts: Point[]): Point[] {
  if (pts.length !== 4) return pts
  const [p0, p1, p2, p3] = pts
  const out: Point[] = []
  for (let i = 0; i <= 24; i++) {
    const t = i / 24
    const mt = 1 - t
    out.push({
      x: mt ** 3 * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t ** 3 * p3.x,
      y: mt ** 3 * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t ** 3 * p3.y,
    })
  }
  return out
}

export function isTypingTarget(t: EventTarget | null) {
  const el = t as HTMLElement | null
  if (!el || !el.tagName) return false
  const tag = el.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || el.isContentEditable
}
