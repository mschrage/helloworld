import { nanoid } from 'nanoid'
import { create } from 'zustand'
import { layeredLayout } from '../lib/layout'
import { centerOf, inkBounds, rectOf, unionRects } from '../lib/geometry'
import { makeStyle, padOf, SHAPES } from '../lib/theme'
import { lineHeight, textBlockHeight } from '../lib/text'
import type {
  DiagramEdge,
  DiagramNode,
  EdgeRouting,
  EdgeStyle,
  InkStroke,
  NodeStyle,
  Point,
  Rect,
  Scene,
  ShapeKind,
  Tool,
  Viewport,
} from '../types'
import { starterScene } from './starter'

const STORAGE_KEY = 'vellum.scene.v1'
const MAX_HISTORY = 120

export type Direction = 'up' | 'down' | 'left' | 'right'

export interface Selection {
  nodes: string[]
  edges: string[]
  ink: string[]
}

const emptySelection = (): Selection => ({ nodes: [], edges: [], ink: [] })

export const selectionSize = (s: Selection) => s.nodes.length + s.edges.length + s.ink.length

export interface EditorState {
  scene: Scene
  viewport: Viewport
  tool: Tool
  stickyTool: boolean
  selection: Selection
  editing: string | null
  past: Scene[]
  future: Scene[]
  showGrid: boolean
  snapToGrid: boolean
  showInspector: boolean
  gridSize: number
  clipboard: { nodes: DiagramNode[]; edges: DiagramEdge[]; ink: InkStroke[] } | null
  lastNodeStyle: NodeStyle
  lastShape: ShapeKind
  edgeDefaults: { routing: EdgeRouting; style: EdgeStyle; endCap: DiagramEdge['endCap'] }
  toast: { id: string; text: string } | null
}

export interface EditorActions {
  setTool(t: Tool, sticky?: boolean): void
  setViewport(v: Partial<Viewport>): void
  panBy(dx: number, dy: number): void
  zoomAt(factor: number, screen: Point, size: { w: number; h: number }): void
  zoomTo(k: number, size: { w: number; h: number }): void
  fit(size: { w: number; h: number }, onlySelection?: boolean): void

  select(sel: Partial<Selection>, additive?: boolean): void
  selectAll(): void
  clearSelection(): void
  toggleSelect(kind: keyof Selection, id: string): void
  selectConnected(): void
  cycleSelection(dir: 1 | -1): void

  begin(): void
  commit(): void
  undo(): void
  redo(): void

  addNode(kind: ShapeKind, at: Point, opts?: { text?: string; center?: boolean }): DiagramNode
  patchNodes(ids: string[], patch: (n: DiagramNode) => Partial<DiagramNode>): void
  patchEdges(ids: string[], patch: (e: DiagramEdge) => Partial<DiagramEdge>): void
  patchInk(ids: string[], patch: (s: InkStroke) => Partial<InkStroke>): void
  addEdge(edge: Omit<DiagramEdge, 'id'>): DiagramEdge
  addInk(stroke: Omit<InkStroke, 'id'>): InkStroke
  setNodes(nodes: DiagramNode[]): void

  setText(id: string, text: string): void
  setEditing(id: string | null): void
  fitNodeHeight(id: string): void

  remove(sel?: Selection): void
  erase(target: { nodes?: string[]; edges?: string[]; ink?: string[] }): void
  duplicate(offset?: Point): void
  copy(): void
  cut(): void
  paste(at?: Point): void

  nudge(dx: number, dy: number): void
  align(mode: 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom'): void
  distribute(axis: 'h' | 'v'): void
  matchSize(axis: 'w' | 'h' | 'both'): void
  order(mode: 'front' | 'back' | 'forward' | 'backward'): void

  styleNodes(patch: Partial<NodeStyle>): void
  styleEdges(patch: Partial<EdgeStyle> | Partial<Pick<DiagramEdge, 'routing' | 'startCap' | 'endCap'>>): void
  cycleFill(dir: 1 | -1): void

  connectSelection(): void
  spawn(dir: Direction): void
  reverseEdges(): void

  autoLayout(direction: 'LR' | 'TB'): void

  toggleGrid(): void
  toggleSnap(): void
  toggleInspector(): void
  setTitle(t: string): void

  loadScene(s: Scene): void
  newScene(): void
  notify(text: string): void
}

export type Store = EditorState & EditorActions

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T

/** Kinds that decorate a diagram instead of participating in its flow. */
const ANNOTATION = new Set<ShapeKind>(['frame', 'text', 'note'])
const FRAME_PAD = 26

const rectsContain = (outer: Rect, inner: Rect) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.w <= outer.x + outer.w &&
  inner.y + inner.h <= outer.y + outer.h

const normalizeScene = (s: Partial<Scene>): Scene => ({
  title: s.title ?? 'Untitled',
  nodes: s.nodes ?? [],
  edges: s.edges ?? [],
  ink: s.ink ?? [],
})

function loadInitial(): Scene {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Scene>
      if (parsed && Array.isArray(parsed.nodes)) return normalizeScene(parsed)
    }
  } catch {
    /* fall through to the starter scene */
  }
  return starterScene()
}

let saveTimer: number | undefined
function persist(scene: Scene) {
  window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(scene))
    } catch {
      /* quota — ignore */
    }
  }, 400)
}

export const nodeRects = (scene: Scene, ids: string[]): Rect[] =>
  scene.nodes.filter((n) => ids.includes(n.id)).map(rectOf)

export function selectionBounds(scene: Scene, sel: Selection): Rect | null {
  const rects: Rect[] = []
  for (const n of scene.nodes) if (sel.nodes.includes(n.id)) rects.push(rectOf(n))
  for (const s of scene.ink) if (sel.ink.includes(s.id)) rects.push(inkBounds(s.points))
  return unionRects(rects)
}

export function sceneBounds(scene: Scene): Rect | null {
  const rects: Rect[] = scene.nodes.map(rectOf)
  for (const s of scene.ink) rects.push(inkBounds(s.points))
  for (const e of scene.edges) {
    if (!('node' in e.from)) rects.push({ x: e.from.x, y: e.from.y, w: 0, h: 0 })
    if (!('node' in e.to)) rects.push({ x: e.to.x, y: e.to.y, w: 0, h: 0 })
  }
  return unionRects(rects)
}

export const useStore = create<Store>((set, get) => {
  /** Apply a scene mutation without touching history. */
  const patchScene = (fn: (s: Scene) => void) =>
    set((state) => {
      const scene = clone(state.scene)
      fn(scene)
      persist(scene)
      return { scene }
    })

  /** Push a history checkpoint, then mutate. */
  const withHistory = (fn: (s: Scene) => void) => {
    get().begin()
    patchScene(fn)
  }

  return {
    scene: loadInitial(),
    viewport: { x: 0, y: 0, k: 1 },
    tool: 'select',
    stickyTool: false,
    selection: emptySelection(),
    editing: null,
    past: [],
    future: [],
    showGrid: true,
    snapToGrid: true,
    showInspector: true,
    gridSize: 8,
    clipboard: null,
    lastNodeStyle: makeStyle('round'),
    lastShape: 'round',
    edgeDefaults: {
      routing: 'orthogonal',
      endCap: 'arrow',
      style: { stroke: 'solid', weight: 1, fontSize: 11 },
    },
    toast: null,

    /* ---------------------------------------------------------- view */

    setTool: (tool, sticky = false) =>
      set((s) => ({
        tool,
        stickyTool: sticky || s.stickyTool === true ? sticky : false,
        editing: null,
        ...(typeof tool === 'object' ? { lastShape: tool.shape } : {}),
      })),

    setViewport: (v) => set((s) => ({ viewport: { ...s.viewport, ...v } })),

    panBy: (dx, dy) =>
      set((s) => ({ viewport: { ...s.viewport, x: s.viewport.x + dx, y: s.viewport.y + dy } })),

    zoomAt: (factor, screen, _size) =>
      set((s) => {
        const k = Math.min(6, Math.max(0.08, s.viewport.k * factor))
        const wx = (screen.x - s.viewport.x) / s.viewport.k
        const wy = (screen.y - s.viewport.y) / s.viewport.k
        return { viewport: { k, x: screen.x - wx * k, y: screen.y - wy * k } }
      }),

    zoomTo: (k, size) => {
      const s = get()
      const kk = Math.min(6, Math.max(0.08, k))
      const cx = size.w / 2
      const cy = size.h / 2
      const wx = (cx - s.viewport.x) / s.viewport.k
      const wy = (cy - s.viewport.y) / s.viewport.k
      set({ viewport: { k: kk, x: cx - wx * kk, y: cy - wy * kk } })
    },

    fit: (size, onlySelection = false) => {
      const s = get()
      const b =
        onlySelection && selectionSize(s.selection) > 0
          ? selectionBounds(s.scene, s.selection)
          : sceneBounds(s.scene)
      if (!b || b.w + b.h === 0) {
        set({ viewport: { x: size.w / 2, y: size.h / 2, k: 1 } })
        return
      }
      // Keep the content clear of the floating rail, inspector and status bar.
      const inset = { left: 82, right: s.showInspector ? 280 : 32, top: 32, bottom: 78 }
      const availW = Math.max(120, size.w - inset.left - inset.right)
      const availH = Math.max(120, size.h - inset.top - inset.bottom)
      const k = Math.min(2, Math.max(0.08, Math.min(availW / b.w, availH / b.h)))
      const c = centerOf(b)
      set({
        viewport: {
          k,
          x: inset.left + availW / 2 - c.x * k,
          y: inset.top + availH / 2 - c.y * k,
        },
      })
    },

    /* ----------------------------------------------------- selection */

    select: (sel, additive = false) =>
      set((s) => {
        const base = additive ? s.selection : emptySelection()
        const merge = (a: string[], b?: string[]) =>
          b === undefined ? a : Array.from(new Set([...a, ...b]))
        return {
          selection: additive
            ? { nodes: merge(base.nodes, sel.nodes), edges: merge(base.edges, sel.edges), ink: merge(base.ink, sel.ink) }
            : { nodes: sel.nodes ?? [], edges: sel.edges ?? [], ink: sel.ink ?? [] },
        }
      }),

    selectAll: () =>
      set((s) => ({
        selection: {
          nodes: s.scene.nodes.map((n) => n.id),
          edges: s.scene.edges.map((e) => e.id),
          ink: s.scene.ink.map((i) => i.id),
        },
      })),

    clearSelection: () => set({ selection: emptySelection(), editing: null }),

    toggleSelect: (kind, id) =>
      set((s) => {
        const cur = s.selection[kind]
        const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
        return { selection: { ...s.selection, [kind]: next } }
      }),

    selectConnected: () => {
      const { scene, selection } = get()
      if (!selection.nodes.length) return
      const nodes = new Set(selection.nodes)
      const edges = new Set<string>()
      let changed = true
      while (changed) {
        changed = false
        for (const e of scene.edges) {
          const a = 'node' in e.from ? e.from.node : null
          const b = 'node' in e.to ? e.to.node : null
          if ((a && nodes.has(a)) || (b && nodes.has(b))) {
            if (!edges.has(e.id)) {
              edges.add(e.id)
              changed = true
            }
            if (a && !nodes.has(a)) {
              nodes.add(a)
              changed = true
            }
            if (b && !nodes.has(b)) {
              nodes.add(b)
              changed = true
            }
          }
        }
      }
      set({ selection: { nodes: [...nodes], edges: [...edges], ink: [] } })
    },

    cycleSelection: (dir) => {
      const { scene, selection } = get()
      const ids = scene.nodes.map((n) => n.id)
      if (!ids.length) return
      const cur = selection.nodes[selection.nodes.length - 1]
      const idx = cur ? ids.indexOf(cur) : -1
      const next = ids[(idx + dir + ids.length * 2) % ids.length]
      set({ selection: { nodes: [next], edges: [], ink: [] } })
    },

    /* ------------------------------------------------------- history */

    begin: () =>
      set((s) => ({
        past: [...s.past.slice(-MAX_HISTORY), clone(s.scene)],
        future: [],
      })),

    commit: () => {
      /* history checkpoints are pushed at gesture start; nothing to do */
    },

    undo: () =>
      set((s) => {
        if (!s.past.length) return {}
        const past = s.past.slice()
        const scene = past.pop()!
        persist(scene)
        return { scene, past, future: [...s.future, clone(s.scene)], editing: null }
      }),

    redo: () =>
      set((s) => {
        if (!s.future.length) return {}
        const future = s.future.slice()
        const scene = future.pop()!
        persist(scene)
        return { scene, future, past: [...s.past, clone(s.scene)], editing: null }
      }),

    /* --------------------------------------------------------- model */

    addNode: (kind, at, opts) => {
      const spec = SHAPES[kind]
      const state = get()
      const style = { ...makeStyle(kind) }
      if (kind !== 'frame' && kind !== 'text' && kind !== 'note') {
        style.fill = state.lastNodeStyle.fill === 'none' ? style.fill : state.lastNodeStyle.fill
        style.weight = state.lastNodeStyle.weight
        style.stroke = state.lastNodeStyle.stroke
        style.fontSize = state.lastNodeStyle.fontSize
        style.mono = state.lastNodeStyle.mono
      }
      const node: DiagramNode = {
        id: nanoid(8),
        kind,
        x: opts?.center === false ? at.x : Math.round(at.x - spec.w / 2),
        y: opts?.center === false ? at.y : Math.round(at.y - spec.h / 2),
        w: spec.w,
        h: spec.h,
        text: opts?.text ?? '',
        style,
      }
      withHistory((s) => {
        s.nodes.push(node)
      })
      set({ lastShape: kind, lastNodeStyle: style })
      return node
    },

    setNodes: (nodes) => patchScene((s) => void (s.nodes = nodes)),

    patchNodes: (ids, patch) =>
      patchScene((s) => {
        for (const n of s.nodes) if (ids.includes(n.id)) Object.assign(n, patch(n))
      }),

    patchEdges: (ids, patch) =>
      patchScene((s) => {
        for (const e of s.edges) if (ids.includes(e.id)) Object.assign(e, patch(e))
      }),

    patchInk: (ids, patch) =>
      patchScene((s) => {
        for (const i of s.ink) if (ids.includes(i.id)) Object.assign(i, patch(i))
      }),

    addEdge: (edge) => {
      const full: DiagramEdge = { ...edge, id: nanoid(8) }
      withHistory((s) => {
        // Don't stack duplicate connections between the same pair.
        const key = (e: DiagramEdge) =>
          `${'node' in e.from ? e.from.node : 'p'}>${'node' in e.to ? e.to.node : 'p'}`
        if ('node' in full.from && 'node' in full.to && s.edges.some((e) => key(e) === key(full))) {
          return
        }
        s.edges.push(full)
      })
      return full
    },

    addInk: (stroke) => {
      const full: InkStroke = { ...stroke, id: nanoid(8) }
      withHistory((s) => {
        s.ink.push(full)
      })
      return full
    },

    setText: (id, text) =>
      patchScene((s) => {
        const n = s.nodes.find((x) => x.id === id)
        if (n) n.text = text
        const e = s.edges.find((x) => x.id === id)
        if (e) e.label = text
      }),

    setEditing: (id) => set({ editing: id }),

    fitNodeHeight: (id) =>
      patchScene((s) => {
        const n = s.nodes.find((x) => x.id === id)
        if (!n || n.kind === 'frame') return
        const pad = padOf(n.kind)
        const inner = Math.max(20, n.w - pad.x * 2)
        const tagH = n.tag ? lineHeight(9) + 2 : 0
        const needed =
          textBlockHeight(n.text || ' ', inner, n.style.fontSize, n.style.bold, n.style.mono) +
          pad.y * 2 +
          tagH +
          (n.kind === 'actor' ? 44 : 0)
        if (needed > n.h) n.h = Math.ceil(needed / 2) * 2
        if (n.kind === 'text') n.h = Math.max(24, Math.ceil(needed))
      }),

    remove: (sel) =>
      withHistory((s) => {
        const target = sel ?? get().selection
        const nodeSet = new Set(target.nodes)
        s.nodes = s.nodes.filter((n) => !nodeSet.has(n.id))
        s.edges = s.edges.filter(
          (e) =>
            !target.edges.includes(e.id) &&
            !('node' in e.from && nodeSet.has(e.from.node)) &&
            !('node' in e.to && nodeSet.has(e.to.node)),
        )
        s.ink = s.ink.filter((i) => !target.ink.includes(i.id))
        set({ selection: emptySelection(), editing: null })
      }),

    // Erasing happens stroke-by-stroke inside one gesture, so the history
    // checkpoint is pushed by the gesture rather than by each hit.
    erase: (target) =>
      patchScene((s) => {
        const nodeSet = new Set(target.nodes ?? [])
        const edgeSet = new Set(target.edges ?? [])
        const inkSet = new Set(target.ink ?? [])
        s.nodes = s.nodes.filter((n) => !nodeSet.has(n.id))
        s.edges = s.edges.filter(
          (e) =>
            !edgeSet.has(e.id) &&
            !('node' in e.from && nodeSet.has(e.from.node)) &&
            !('node' in e.to && nodeSet.has(e.to.node)),
        )
        s.ink = s.ink.filter((i) => !inkSet.has(i.id))
      }),

    duplicate: (offset = { x: 24, y: 24 }) => {
      const { scene, selection } = get()
      if (!selectionSize(selection)) return
      const idMap = new Map<string, string>()
      const nodes = scene.nodes
        .filter((n) => selection.nodes.includes(n.id))
        .map((n) => {
          const id = nanoid(8)
          idMap.set(n.id, id)
          return { ...clone(n), id, x: n.x + offset.x, y: n.y + offset.y }
        })
      const edges = scene.edges
        .filter((e) => {
          const a = 'node' in e.from ? e.from.node : null
          const b = 'node' in e.to ? e.to.node : null
          return (
            selection.edges.includes(e.id) ||
            (a !== null && b !== null && idMap.has(a) && idMap.has(b))
          )
        })
        .map((e) => remapEdge(clone(e), idMap, offset))
      const ink = scene.ink
        .filter((i) => selection.ink.includes(i.id))
        .map((i) => ({
          ...clone(i),
          id: nanoid(8),
          points: i.points.map((v, idx) => v + (idx % 2 === 0 ? offset.x : offset.y)),
        }))

      withHistory((s) => {
        s.nodes.push(...nodes)
        s.edges.push(...edges)
        s.ink.push(...ink)
      })
      set({
        selection: {
          nodes: nodes.map((n) => n.id),
          edges: edges.map((e) => e.id),
          ink: ink.map((i) => i.id),
        },
      })
    },

    copy: () => {
      const { scene, selection } = get()
      if (!selectionSize(selection)) return
      const payload = {
        nodes: scene.nodes.filter((n) => selection.nodes.includes(n.id)).map(clone),
        edges: scene.edges
          .filter((e) => {
            const a = 'node' in e.from ? e.from.node : null
            const b = 'node' in e.to ? e.to.node : null
            return (
              selection.edges.includes(e.id) ||
              (a !== null && b !== null && selection.nodes.includes(a) && selection.nodes.includes(b))
            )
          })
          .map(clone),
        ink: scene.ink.filter((i) => selection.ink.includes(i.id)).map(clone),
      }
      set({ clipboard: payload })
      try {
        void navigator.clipboard?.writeText(JSON.stringify({ vellum: 1, ...payload }))
      } catch {
        /* clipboard unavailable */
      }
      get().notify(`Copied ${selectionSize(selection)} item${selectionSize(selection) > 1 ? 's' : ''}`)
    },

    cut: () => {
      get().copy()
      get().remove()
    },

    paste: (at) => {
      const cb = get().clipboard
      if (!cb || (!cb.nodes.length && !cb.ink.length && !cb.edges.length)) return
      const b = unionRects([
        ...cb.nodes.map(rectOf),
        ...cb.ink.map((i) => inkBounds(i.points)),
      ])
      const offset =
        at && b ? { x: Math.round(at.x - b.x - b.w / 2), y: Math.round(at.y - b.y - b.h / 2) } : { x: 28, y: 28 }
      const idMap = new Map<string, string>()
      const nodes = cb.nodes.map((n) => {
        const id = nanoid(8)
        idMap.set(n.id, id)
        return { ...clone(n), id, x: n.x + offset.x, y: n.y + offset.y }
      })
      const edges = cb.edges.map((e) => remapEdge(clone(e), idMap, offset))
      const ink = cb.ink.map((i) => ({
        ...clone(i),
        id: nanoid(8),
        points: i.points.map((v, idx) => v + (idx % 2 === 0 ? offset.x : offset.y)),
      }))
      withHistory((s) => {
        s.nodes.push(...nodes)
        s.edges.push(...edges)
        s.ink.push(...ink)
      })
      set({
        selection: { nodes: nodes.map((n) => n.id), edges: edges.map((e) => e.id), ink: ink.map((i) => i.id) },
      })
    },

    /* ------------------------------------------------------ transforms */

    nudge: (dx, dy) => {
      const { selection } = get()
      if (!selectionSize(selection)) return
      patchScene((s) => {
        for (const n of s.nodes)
          if (selection.nodes.includes(n.id)) {
            n.x += dx
            n.y += dy
          }
        for (const i of s.ink)
          if (selection.ink.includes(i.id))
            i.points = i.points.map((v, idx) => v + (idx % 2 === 0 ? dx : dy))
        for (const e of s.edges)
          if (selection.edges.includes(e.id)) {
            if (!('node' in e.from)) {
              e.from.x += dx
              e.from.y += dy
            }
            if (!('node' in e.to)) {
              e.to.x += dx
              e.to.y += dy
            }
          }
      })
    },

    align: (mode) => {
      const { scene, selection } = get()
      const targets = scene.nodes.filter((n) => selection.nodes.includes(n.id))
      if (targets.length < 2) return
      const b = unionRects(targets.map(rectOf))!
      withHistory((s) => {
        for (const n of s.nodes) {
          if (!selection.nodes.includes(n.id)) continue
          switch (mode) {
            case 'left':
              n.x = b.x
              break
            case 'right':
              n.x = b.x + b.w - n.w
              break
            case 'hcenter':
              n.x = Math.round(b.x + (b.w - n.w) / 2)
              break
            case 'top':
              n.y = b.y
              break
            case 'bottom':
              n.y = b.y + b.h - n.h
              break
            case 'vcenter':
              n.y = Math.round(b.y + (b.h - n.h) / 2)
              break
          }
        }
      })
    },

    distribute: (axis) => {
      const { scene, selection } = get()
      const targets = scene.nodes.filter((n) => selection.nodes.includes(n.id))
      if (targets.length < 3) return
      const sorted = [...targets].sort((a, b) => (axis === 'h' ? a.x - b.x : a.y - b.y))
      const first = sorted[0]
      const last = sorted[sorted.length - 1]
      const total =
        axis === 'h' ? last.x + last.w - first.x : last.y + last.h - first.y
      const used = sorted.reduce((sum, n) => sum + (axis === 'h' ? n.w : n.h), 0)
      const gap = (total - used) / (sorted.length - 1)
      let cursor = axis === 'h' ? first.x : first.y
      const pos = new Map<string, number>()
      for (const n of sorted) {
        pos.set(n.id, Math.round(cursor))
        cursor += (axis === 'h' ? n.w : n.h) + gap
      }
      withHistory((s) => {
        for (const n of s.nodes) {
          const p = pos.get(n.id)
          if (p === undefined) continue
          if (axis === 'h') n.x = p
          else n.y = p
        }
      })
    },

    matchSize: (axis) => {
      const { scene, selection } = get()
      const targets = scene.nodes.filter((n) => selection.nodes.includes(n.id))
      if (targets.length < 2) return
      const ref = targets[targets.length - 1]
      withHistory((s) => {
        for (const n of s.nodes) {
          if (!selection.nodes.includes(n.id)) continue
          if (axis === 'w' || axis === 'both') n.w = ref.w
          if (axis === 'h' || axis === 'both') n.h = ref.h
        }
      })
    },

    order: (mode) => {
      const { selection } = get()
      if (!selection.nodes.length) return
      withHistory((s) => {
        const picked = s.nodes.filter((n) => selection.nodes.includes(n.id))
        const rest = s.nodes.filter((n) => !selection.nodes.includes(n.id))
        if (mode === 'front') s.nodes = [...rest, ...picked]
        else if (mode === 'back') s.nodes = [...picked, ...rest]
        else {
          const dir = mode === 'forward' ? 1 : -1
          const arr = s.nodes.slice()
          const idxs = arr
            .map((n, i) => (selection.nodes.includes(n.id) ? i : -1))
            .filter((i) => i >= 0)
          if (dir === 1) idxs.reverse()
          for (const i of idxs) {
            const j = i + dir
            if (j < 0 || j >= arr.length || selection.nodes.includes(arr[j].id)) continue
            ;[arr[i], arr[j]] = [arr[j], arr[i]]
          }
          s.nodes = arr
        }
      })
    },

    /* ---------------------------------------------------------- style */

    styleNodes: (patch) => {
      const { selection } = get()
      set((s) => ({ lastNodeStyle: { ...s.lastNodeStyle, ...patch } }))
      if (!selection.nodes.length) return
      withHistory((s) => {
        for (const n of s.nodes)
          if (selection.nodes.includes(n.id)) n.style = { ...n.style, ...patch }
      })
    },

    styleEdges: (patch) => {
      const { selection } = get()
      const isTopLevel = (k: string) => k === 'routing' || k === 'startCap' || k === 'endCap'
      set((s) => {
        const d = { ...s.edgeDefaults, style: { ...s.edgeDefaults.style } }
        for (const [k, v] of Object.entries(patch)) {
          if (isTopLevel(k)) (d as Record<string, unknown>)[k] = v
          else (d.style as Record<string, unknown>)[k] = v
        }
        return { edgeDefaults: d }
      })
      if (!selection.edges.length) return
      withHistory((s) => {
        for (const e of s.edges) {
          if (!selection.edges.includes(e.id)) continue
          for (const [k, v] of Object.entries(patch)) {
            if (isTopLevel(k)) (e as unknown as Record<string, unknown>)[k] = v
            else (e.style as unknown as Record<string, unknown>)[k] = v
          }
        }
      })
    },

    cycleFill: (dir) => {
      const order: NodeStyle['fill'][] = ['none', 'paper', 'g1', 'g2', 'g3', 'g4', 'ink']
      const { scene, selection } = get()
      const first = scene.nodes.find((n) => selection.nodes.includes(n.id))
      const cur = first ? order.indexOf(first.style.fill) : order.indexOf(get().lastNodeStyle.fill)
      const next = order[(cur + dir + order.length) % order.length]
      get().styleNodes({ fill: next })
    },

    /* ----------------------------------------------------- connecting */

    connectSelection: () => {
      const { selection, edgeDefaults } = get()
      if (selection.nodes.length < 2) return
      const ids = selection.nodes
      const made: DiagramEdge[] = []
      withHistory((s) => {
        for (let i = 0; i < ids.length - 1; i++) {
          const edge: DiagramEdge = {
            id: nanoid(8),
            from: { node: ids[i], side: 'auto' },
            to: { node: ids[i + 1], side: 'auto' },
            routing: edgeDefaults.routing,
            startCap: 'none',
            endCap: edgeDefaults.endCap,
            label: '',
            style: { ...edgeDefaults.style },
          }
          s.edges.push(edge)
          made.push(edge)
        }
      })
      set({ selection: { nodes: [], edges: made.map((e) => e.id), ink: [] } })
    },

    spawn: (dir) => {
      const { scene, selection, edgeDefaults } = get()
      const source = scene.nodes.find((n) => n.id === selection.nodes[selection.nodes.length - 1])
      if (!source) return
      const gapX = 96
      const gapY = 72
      const kind = source.kind === 'frame' || source.kind === 'text' ? 'round' : source.kind
      const spec = SHAPES[kind]
      const w = source.kind === 'diamond' ? SHAPES.round.w : source.w
      const h = source.kind === 'diamond' ? SHAPES.round.h : source.h
      const size = { w: kind === 'diamond' ? spec.w : w, h: kind === 'diamond' ? spec.h : h }

      let x = source.x
      let y = source.y
      if (dir === 'right') x = source.x + source.w + gapX
      if (dir === 'left') x = source.x - gapX - size.w
      if (dir === 'down') y = source.y + source.h + gapY
      if (dir === 'up') y = source.y - gapY - size.h
      if (dir === 'left' || dir === 'right') y = Math.round(source.y + (source.h - size.h) / 2)
      if (dir === 'up' || dir === 'down') x = Math.round(source.x + (source.w - size.w) / 2)

      // Slide along the cross axis until the slot is free.
      const collides = (rx: number, ry: number) =>
        scene.nodes.some(
          (n) =>
            n.kind !== 'frame' &&
            !(rx + size.w + 16 < n.x || n.x + n.w + 16 < rx || ry + size.h + 16 < n.y || n.y + n.h + 16 < ry),
        )
      let guard = 0
      while (collides(x, y) && guard++ < 40) {
        if (dir === 'left' || dir === 'right') y += size.h + 32
        else x += size.w + 40
      }

      const node: DiagramNode = {
        id: nanoid(8),
        kind: kind === 'diamond' ? 'round' : kind,
        x: Math.round(x),
        y: Math.round(y),
        w: size.w,
        h: size.h,
        text: '',
        style: { ...source.style },
      }
      const sideMap: Record<Direction, [DiagramEdge['from'], DiagramEdge['to']]> = {
        right: [{ node: source.id, side: 'e' }, { node: node.id, side: 'w' }],
        left: [{ node: source.id, side: 'w' }, { node: node.id, side: 'e' }],
        up: [{ node: source.id, side: 'n' }, { node: node.id, side: 's' }],
        down: [{ node: source.id, side: 's' }, { node: node.id, side: 'n' }],
      }
      const [from, to] = sideMap[dir]
      const edge: DiagramEdge = {
        id: nanoid(8),
        from,
        to,
        routing: edgeDefaults.routing,
        startCap: 'none',
        endCap: edgeDefaults.endCap,
        label: '',
        style: { ...edgeDefaults.style },
      }
      withHistory((s) => {
        s.nodes.push(node)
        s.edges.push(edge)
      })
      set({ selection: { nodes: [node.id], edges: [], ink: [] }, editing: node.id })
    },

    reverseEdges: () => {
      const { selection } = get()
      if (!selection.edges.length) return
      withHistory((s) => {
        for (const e of s.edges) {
          if (!selection.edges.includes(e.id)) continue
          const from = e.from
          e.from = e.to
          e.to = from
        }
      })
    },

    /* --------------------------------------------------------- layout */

    autoLayout: (direction) => {
      const { scene, selection } = get()
      // Frames, notes and free text annotate a diagram rather than take part in
      // its flow, so they are never fed to the layout — frames instead re-wrap
      // whatever they were holding once the flow has moved.
      const subset =
        selection.nodes.length > 1
          ? scene.nodes.filter((n) => selection.nodes.includes(n.id) && !ANNOTATION.has(n.kind))
          : scene.nodes.filter((n) => !ANNOTATION.has(n.kind))
      if (subset.length < 2) return

      const moving = new Set(subset.map((n) => n.id))
      const frames = scene.nodes
        .filter((n) => n.kind === 'frame')
        .map((f) => {
          const r = rectOf(f)
          return {
            id: f.id,
            held: subset.filter((n) => rectsContain(r, rectOf(n))).map((n) => n.id),
          }
        })
        .filter((f) => f.held.length > 0)

      const before = unionRects(subset.map(rectOf))!
      const positions = layeredLayout(subset, scene.edges, {
        direction,
        gapMain: direction === 'LR' ? 96 : 76,
        gapCross: 34,
      })
      const laid = subset.map((n) => {
        const p = positions.get(n.id) ?? { x: 0, y: 0 }
        return { ...rectOf(n), x: p.x, y: p.y }
      })
      const after = unionRects(laid)!
      const dx = before.x + before.w / 2 - (after.x + after.w / 2)
      const dy = before.y + before.h / 2 - (after.y + after.h / 2)

      withHistory((s) => {
        for (const n of s.nodes) {
          if (!moving.has(n.id)) continue
          const p = positions.get(n.id)
          if (!p) continue
          n.x = Math.round(p.x + dx)
          n.y = Math.round(p.y + dy)
        }
        const byId = new Map(s.nodes.map((n) => [n.id, n]))
        for (const f of frames) {
          const box = unionRects(f.held.map((id) => rectOf(byId.get(id)!)))
          const frame = byId.get(f.id)
          if (!box || !frame) continue
          frame.x = Math.round(box.x - FRAME_PAD)
          frame.y = Math.round(box.y - FRAME_PAD)
          frame.w = Math.round(box.w + FRAME_PAD * 2)
          frame.h = Math.round(box.h + FRAME_PAD * 2)
        }
      })
      get().notify(direction === 'LR' ? 'Tidied left → right' : 'Tidied top → bottom')
    },

    /* --------------------------------------------------------- chrome */

    toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
    toggleSnap: () => {
      const next = !get().snapToGrid
      set({ snapToGrid: next })
      get().notify(next ? 'Snap on' : 'Snap off')
    },
    toggleInspector: () => set((s) => ({ showInspector: !s.showInspector })),
    setTitle: (t) => patchScene((s) => void (s.title = t)),

    loadScene: (s) => {
      get().begin()
      const scene = normalizeScene(s)
      persist(scene)
      set({ scene, selection: emptySelection(), editing: null })
    },

    newScene: () => {
      get().begin()
      const scene: Scene = { title: 'Untitled', nodes: [], edges: [], ink: [] }
      persist(scene)
      set({ scene, selection: emptySelection(), editing: null })
    },

    notify: (text) => {
      const id = nanoid(6)
      set({ toast: { id, text } })
      window.setTimeout(() => {
        if (get().toast?.id === id) set({ toast: null })
      }, 1900)
    },
  }
})

function remapEdge(e: DiagramEdge, idMap: Map<string, string>, offset: Point): DiagramEdge {
  const map = (end: DiagramEdge['from']): DiagramEdge['from'] => {
    if ('node' in end) {
      const mapped = idMap.get(end.node)
      return mapped ? { node: mapped, side: end.side } : { ...end }
    }
    return { x: end.x + offset.x, y: end.y + offset.y }
  }
  return { ...e, id: nanoid(8), from: map(e.from), to: map(e.to) }
}

export { STORAGE_KEY }
