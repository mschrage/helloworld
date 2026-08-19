import type { Rect } from '../types'

export interface Guide {
  axis: 'x' | 'y'
  at: number
  from: number
  to: number
}

interface SnapResult {
  dx: number
  dy: number
  guides: Guide[]
}

const edgesOf = (r: Rect) => ({
  x: [r.x, r.x + r.w / 2, r.x + r.w],
  y: [r.y, r.y + r.h / 2, r.y + r.h],
})

/**
 * Snap a moving bounding box against static peers. Returns the delta to apply
 * plus the guide lines to draw. Grid snapping is the fallback when nothing
 * else is in range.
 */
export function snapRect(
  moving: Rect,
  peers: Rect[],
  tolerance: number,
  grid: number | null,
): SnapResult {
  const m = edgesOf(moving)
  let best: { d: number; at: number; from: number; to: number } | null = null
  let bestY: { d: number; at: number; from: number; to: number } | null = null

  for (const p of peers) {
    const e = edgesOf(p)
    for (const mv of m.x) {
      for (const pv of e.x) {
        const d = pv - mv
        if (Math.abs(d) <= tolerance && (!best || Math.abs(d) < Math.abs(best.d))) {
          best = {
            d,
            at: pv,
            from: Math.min(p.y, moving.y),
            to: Math.max(p.y + p.h, moving.y + moving.h),
          }
        }
      }
    }
    for (const mv of m.y) {
      for (const pv of e.y) {
        const d = pv - mv
        if (Math.abs(d) <= tolerance && (!bestY || Math.abs(d) < Math.abs(bestY.d))) {
          bestY = {
            d,
            at: pv,
            from: Math.min(p.x, moving.x),
            to: Math.max(p.x + p.w, moving.x + moving.w),
          }
        }
      }
    }
  }

  const guides: Guide[] = []
  let dx = 0
  let dy = 0

  if (best) {
    dx = best.d
    guides.push({ axis: 'x', at: best.at, from: best.from - 20, to: best.to + 20 })
  } else if (grid) {
    dx = Math.round(moving.x / grid) * grid - moving.x
  }
  if (bestY) {
    dy = bestY.d
    guides.push({ axis: 'y', at: bestY.at, from: bestY.from - 20, to: bestY.to + 20 })
  } else if (grid) {
    dy = Math.round(moving.y / grid) * grid - moving.y
  }

  return { dx, dy, guides }
}
