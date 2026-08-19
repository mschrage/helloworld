import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../state/store'
import { routeEdge } from '../lib/geometry'
import { padOf } from '../lib/theme'
import { FILLS, textColor } from '../lib/theme'
import { lineHeight, MONO, SANS } from '../lib/text'

const TOP_ALIGNED = new Set(['note', 'frame', 'text', 'actor'])

/**
 * A DOM textarea floated over the shape being edited, matched to the SVG
 * typography so the transition in and out is invisible.
 */
export function TextEditor({ id, size }: { id: string; size: { w: number; h: number } }) {
  const scene = useStore((s) => s.scene)
  const viewport = useStore((s) => s.viewport)
  const setEditing = useStore((s) => s.setEditing)
  const setText = useStore((s) => s.setText)
  const fitNodeHeight = useStore((s) => s.fitNodeHeight)
  const spawn = useStore((s) => s.spawn)
  const begin = useStore((s) => s.begin)

  const node = scene.nodes.find((n) => n.id === id)
  const edge = scene.edges.find((e) => e.id === id)
  const ref = useRef<HTMLTextAreaElement>(null)
  const [value, setValue] = useState(node ? node.text : (edge?.label ?? ''))
  const committed = useRef(false)

  const nodeMap = useMemo(() => new Map(scene.nodes.map((n) => [n.id, n])), [scene.nodes])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.focus()
    el.select()
    begin()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useLayoutEffect(() => {
    if (node) {
      setText(id, value)
      fitNodeHeight(id)
    } else if (edge) {
      setText(id, value)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  if (!node && !edge) return null

  const finish = (then?: () => void) => {
    if (committed.current) return
    committed.current = true
    setEditing(null)
    then?.()
  }

  if (edge && !node) {
    const r = routeEdge(edge, nodeMap)
    if (!r) return null
    const x = viewport.x + r.mid.x * viewport.k
    const y = viewport.y + r.mid.y * viewport.k
    return (
      <input
        data-ui
        ref={ref as unknown as React.RefObject<HTMLInputElement>}
        className="edge-label-input"
        value={value}
        placeholder="label"
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => finish()}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Enter' || e.key === 'Escape') {
            e.preventDefault()
            finish()
          }
        }}
        style={{
          left: x,
          top: y,
          fontSize: Math.max(9, edge.style.fontSize * viewport.k),
          transform: 'translate(-50%, -50%)',
          fontFamily: SANS,
        }}
      />
    )
  }

  if (!node) return null

  const pad = padOf(node.kind)
  const lh = lineHeight(node.style.fontSize)
  const tagH = node.tag && node.kind !== 'frame' ? 13 : 0
  const isFrame = node.kind === 'frame'
  const topAligned = TOP_ALIGNED.has(node.kind)

  const lines = Math.max(1, value.split('\n').length)
  const blockH = lines * lh

  const boxW = Math.max(24, node.w - pad.x * 2)
  const boxLeft = node.x + pad.x
  let boxTop: number
  if (isFrame) boxTop = node.y - 8 - lh
  else if (topAligned) boxTop = node.y + pad.y + tagH
  else boxTop = node.y + (node.h - blockH - tagH) / 2 + tagH

  const screen = {
    left: viewport.x + boxLeft * viewport.k,
    top: viewport.y + boxTop * viewport.k,
    width: boxW * viewport.k,
    height: blockH * viewport.k,
  }
  if (screen.left > size.w || screen.top > size.h) return null

  return (
    <textarea
      data-ui
      ref={ref}
      className="node-text-input"
      value={value}
      spellCheck={false}
      placeholder="Type…"
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => finish()}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Escape') {
          e.preventDefault()
          finish()
        } else if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          finish()
        } else if (e.key === 'Tab') {
          e.preventDefault()
          finish(() => spawn(e.shiftKey ? 'left' : 'right'))
        }
      }}
      style={{
        left: screen.left,
        top: screen.top,
        width: screen.width,
        height: screen.height,
        fontFamily: node.style.mono ? MONO : SANS,
        fontSize: node.style.fontSize * viewport.k,
        fontWeight: node.style.bold ? 600 : 420,
        lineHeight: `${lh * viewport.k}px`,
        textAlign: isFrame ? 'left' : node.style.align,
        color: isFrame ? '#8a8a83' : textColor(node.style.fill),
        caretColor: '#2f6ff0',
        background: isFrame ? 'transparent' : FILLS[node.style.fill] === 'transparent' ? 'transparent' : 'transparent',
      }}
    />
  )
}
