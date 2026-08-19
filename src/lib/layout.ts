import type { DiagramEdge, DiagramNode } from '../types'

interface LayoutOpts {
  direction: 'LR' | 'TB'
  gapMain: number
  gapCross: number
}

interface Link {
  from: string
  to: string
}

/**
 * Layered graph layout (Sugiyama-lite): longest-path layering, barycentre
 * ordering, then packing. Disconnected pieces are laid out on their own and
 * stacked across the cross axis, so two unrelated flows never interleave.
 */
export function layeredLayout(
  nodes: DiagramNode[],
  edges: DiagramEdge[],
  opts: LayoutOpts,
): Map<string, { x: number; y: number }> {
  const ids = new Set(nodes.map((n) => n.id))
  const byId = new Map(nodes.map((n) => [n.id, n]))

  const links: Link[] = []
  const seen = new Set<string>()
  for (const e of edges) {
    const from = 'node' in e.from ? e.from.node : null
    const to = 'node' in e.to ? e.to.node : null
    if (!from || !to || from === to || !ids.has(from) || !ids.has(to)) continue
    const key = from + '>' + to
    if (seen.has(key)) continue
    seen.add(key)
    links.push({ from, to })
  }

  const horizontal = opts.direction === 'LR'
  const crossOf = (id: string) => (horizontal ? byId.get(id)!.h : byId.get(id)!.w)

  const result = new Map<string, { x: number; y: number }>()
  let crossCursor = 0

  for (const group of components([...ids], links)) {
    const inside = new Set(group)
    const sub = links.filter((l) => inside.has(l.from))
    const placed = layoutComponent(group, sub, byId, opts, horizontal)

    let lo = Infinity
    let hi = -Infinity
    for (const [id, p] of placed) {
      const c = horizontal ? p.y : p.x
      lo = Math.min(lo, c)
      hi = Math.max(hi, c + crossOf(id))
    }

    for (const [id, p] of placed) {
      result.set(
        id,
        horizontal
          ? { x: p.x, y: p.y - lo + crossCursor }
          : { x: p.x - lo + crossCursor, y: p.y },
      )
    }
    crossCursor += hi - lo + opts.gapCross * 2
  }

  return result
}

/** Weakly-connected components, preserving input order for stability. */
function components(ids: string[], links: Link[]): string[][] {
  const adj = new Map<string, string[]>()
  for (const id of ids) adj.set(id, [])
  for (const l of links) {
    adj.get(l.from)!.push(l.to)
    adj.get(l.to)!.push(l.from)
  }
  const seen = new Set<string>()
  const groups: string[][] = []
  for (const id of ids) {
    if (seen.has(id)) continue
    const group: string[] = []
    const stack = [id]
    seen.add(id)
    while (stack.length) {
      const cur = stack.pop()!
      group.push(cur)
      for (const next of adj.get(cur)!) {
        if (seen.has(next)) continue
        seen.add(next)
        stack.push(next)
      }
    }
    // Keep members in original document order so ties resolve predictably.
    group.sort((a, b) => ids.indexOf(a) - ids.indexOf(b))
    groups.push(group)
  }
  return groups
}

function layoutComponent(
  ids: string[],
  links: Link[],
  byId: Map<string, DiagramNode>,
  opts: LayoutOpts,
  horizontal: boolean,
): Map<string, { x: number; y: number }> {
  const out = new Map<string, string[]>()
  const inDeg = new Map<string, number>()
  for (const id of ids) {
    out.set(id, [])
    inDeg.set(id, 0)
  }
  for (const l of links) {
    out.get(l.from)!.push(l.to)
    inDeg.set(l.to, (inDeg.get(l.to) ?? 0) + 1)
  }

  // Longest-path layering with cycle tolerance.
  const layer = new Map<string, number>()
  const queue = ids.filter((id) => (inDeg.get(id) ?? 0) === 0)
  for (const id of queue) layer.set(id, 0)
  const deg = new Map(inDeg)
  let head = 0
  while (head < queue.length) {
    const id = queue[head++]
    for (const next of out.get(id)!) {
      layer.set(next, Math.max(layer.get(next) ?? 0, (layer.get(id) ?? 0) + 1))
      deg.set(next, (deg.get(next) ?? 1) - 1)
      if ((deg.get(next) ?? 0) === 0) queue.push(next)
    }
  }
  // Anything left inside a cycle lands on layer 0.
  for (const id of ids) if (!layer.has(id)) layer.set(id, 0)

  const layers: string[][] = []
  for (const id of ids) (layers[layer.get(id)!] ??= []).push(id)
  for (let i = 0; i < layers.length; i++) layers[i] ??= []

  // Order each layer by the mean position of its predecessors.
  const order = new Map<string, number>()
  layers.forEach((ln) => ln.forEach((id, i) => order.set(id, i)))
  const preds = new Map<string, string[]>()
  for (const id of ids) preds.set(id, [])
  for (const l of links) preds.get(l.to)!.push(l.from)
  const bary = (id: string) => {
    const p = preds.get(id)!.filter((x) => (layer.get(x) ?? 0) < (layer.get(id) ?? 0))
    if (!p.length) return order.get(id) ?? 0
    return p.reduce((s, x) => s + (order.get(x) ?? 0), 0) / p.length
  }
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 1; i < layers.length; i++) {
      layers[i].sort((a, b) => bary(a) - bary(b))
      layers[i].forEach((id, idx) => order.set(id, idx))
    }
  }

  const result = new Map<string, { x: number; y: number }>()

  // Main-axis offsets per layer, sized to the widest node in that layer.
  const mainOffsets: number[] = []
  let cursor = 0
  for (const ln of layers) {
    mainOffsets.push(cursor)
    const extent = Math.max(0, ...ln.map((id) => (horizontal ? byId.get(id)!.w : byId.get(id)!.h)))
    cursor += extent + opts.gapMain
  }

  // Cross-axis packing, centred per layer.
  const crossSpans = layers.map((ln) =>
    ln.reduce(
      (s, id) => s + (horizontal ? byId.get(id)!.h : byId.get(id)!.w) + opts.gapCross,
      -opts.gapCross,
    ),
  )
  const maxSpan = Math.max(0, ...crossSpans)

  layers.forEach((ln, li) => {
    let cross = (maxSpan - crossSpans[li]) / 2
    const layerExtent = Math.max(0, ...ln.map((id) => (horizontal ? byId.get(id)!.w : byId.get(id)!.h)))
    for (const id of ln) {
      const n = byId.get(id)!
      const mainSize = horizontal ? n.w : n.h
      const crossSize = horizontal ? n.h : n.w
      const main = mainOffsets[li] + (layerExtent - mainSize) / 2
      result.set(id, horizontal ? { x: main, y: cross } : { x: cross, y: main })
      cross += crossSize + opts.gapCross
    }
  })

  return result
}
