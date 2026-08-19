import type { Point } from '../types'

/**
 * Ambient bits the command layer needs but that don't belong in the scene:
 * the live canvas element, its size, and the last known pointer position.
 */
export const env: {
  svg: SVGSVGElement | null
  size: { w: number; h: number }
  pointer: Point
} = {
  svg: null,
  size: { w: 1200, h: 800 },
  pointer: { x: 0, y: 0 },
}

export const isMac =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
