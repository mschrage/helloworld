import { memo } from 'react'
import { shapePath } from '../lib/geometry'
import { dashArray, FILLS, INK_SOFT, textColor } from '../lib/theme'
import { padOf } from '../lib/theme'
import { lineHeight, MONO, SANS, wrapText } from '../lib/text'
import type { DiagramNode } from '../types'

const TOP_ALIGNED = new Set(['note', 'frame', 'text'])

interface Props {
  node: DiagramNode
  /** Suppress the label while a live textarea is floating over the shape. */
  hideText?: boolean
}

function NodeGlyph({ node: n }: { node: DiagramNode }) {
  const stroke = dashArray(n.style.stroke, n.style.weight)
  const common = {
    fill: 'none',
    stroke: n.style.fill === 'ink' ? '#3d3d3a' : '#3d3d3a',
    strokeWidth: n.style.weight,
    strokeDasharray: stroke,
  }
  switch (n.kind) {
    case 'cylinder': {
      const ry = Math.min(n.h * 0.16, 16)
      return (
        <path
          d={`M${n.x} ${n.y + ry} A${n.w / 2} ${ry} 0 0 0 ${n.x + n.w} ${n.y + ry}`}
          {...common}
          strokeDasharray={stroke}
        />
      )
    }
    case 'note': {
      const f = Math.min(n.w * 0.18, n.h * 0.34, 22)
      return (
        <path
          d={`M${n.x + n.w - f} ${n.y} L${n.x + n.w - f} ${n.y + f} L${n.x + n.w} ${n.y + f}`}
          {...common}
        />
      )
    }
    case 'queue': {
      const rx = Math.min(n.w * 0.1, 14)
      return (
        <path
          d={`M${n.x + n.w - rx} ${n.y} A${rx} ${n.h / 2} 0 0 0 ${n.x + n.w - rx} ${n.y + n.h}`}
          {...common}
        />
      )
    }
    case 'actor': {
      const cx = n.x + n.w / 2
      const top = n.y + 6
      const r = 11
      return (
        <g {...common} strokeLinecap="round">
          <circle cx={cx} cy={top + r} r={r} fill={FILLS.paper} />
          <path d={`M${cx} ${top + r * 2} v22`} />
          <path d={`M${cx - 16} ${top + r * 2 + 8} h32`} />
          <path d={`M${cx} ${top + r * 2 + 22} l-13 15 M${cx} ${top + r * 2 + 22} l13 15`} />
        </g>
      )
    }
    default:
      return null
  }
}

export const NodeView = memo(function NodeView({ node: n, hideText }: Props) {
  const pad = padOf(n.kind)
  const isFrame = n.kind === 'frame'
  const isActor = n.kind === 'actor'
  const fill = FILLS[n.style.fill]
  const strokeW = n.kind === 'text' ? 0 : n.style.weight
  const color = textColor(n.style.fill)

  const innerW = Math.max(12, n.w - pad.x * 2)
  const lines = n.text ? wrapText(n.text, innerW, n.style.fontSize, n.style.bold, n.style.mono) : []
  const lh = lineHeight(n.style.fontSize)
  const hasTag = !!n.tag && !isFrame
  const tagH = hasTag ? 13 : 0

  const topAligned = TOP_ALIGNED.has(n.kind) || isActor
  const blockH = lines.length * lh + tagH
  let textTop: number
  if (isFrame) textTop = n.y - 8
  else if (isActor) textTop = n.y + n.h - lines.length * lh - 2
  else if (topAligned) textTop = n.y + pad.y
  else textTop = n.y + (n.h - blockH) / 2

  const anchorX =
    n.style.align === 'left' ? n.x + pad.x : n.style.align === 'right' ? n.x + n.w - pad.x : n.x + n.w / 2
  const anchor = n.style.align === 'left' ? 'start' : n.style.align === 'right' ? 'end' : 'middle'

  return (
    <g opacity={n.style.opacity} data-node={n.id}>
      {n.kind !== 'text' && n.kind !== 'actor' && (
        <path
          d={shapePath(n)}
          fill={fill}
          stroke={strokeW > 0 ? '#3d3d3a' : 'none'}
          strokeWidth={strokeW}
          strokeDasharray={dashArray(n.style.stroke, n.style.weight)}
          strokeLinejoin={n.kind === 'diamond' || n.kind === 'hexagon' ? 'miter' : 'round'}
        />
      )}
      <NodeGlyph node={n} />

      {isFrame && n.text && !hideText && (
        <text
          x={n.x + 1}
          y={n.y - 7}
          fontFamily={MONO}
          fontSize={10}
          letterSpacing="0.13em"
          fill={INK_SOFT}
          style={{ userSelect: 'none' }}
        >
          {n.text.toUpperCase()}
        </text>
      )}

      {!isFrame && hasTag && (
        <text
          x={anchorX}
          y={textTop + 9}
          textAnchor={anchor}
          fontFamily={MONO}
          fontSize={9}
          letterSpacing="0.14em"
          fill={n.style.fill === 'ink' ? '#b9b9b1' : INK_SOFT}
          style={{ userSelect: 'none' }}
        >
          {n.tag!.toUpperCase()}
        </text>
      )}

      {!isFrame && lines.length > 0 && !hideText && (
        <text
          x={anchorX}
          y={textTop + tagH + n.style.fontSize * 0.82}
          textAnchor={anchor}
          fontFamily={n.style.mono ? MONO : SANS}
          fontSize={n.style.fontSize}
          fontWeight={n.style.bold ? 600 : 420}
          fill={color}
          style={{ userSelect: 'none', whiteSpace: 'pre' }}
        >
          {lines.map((line, i) => (
            <tspan key={i} x={anchorX} dy={i === 0 ? 0 : lh}>
              {line || ' '}
            </tspan>
          ))}
        </text>
      )}
    </g>
  )
})
