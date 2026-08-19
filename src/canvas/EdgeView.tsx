import { memo } from 'react'
import { dashArray, INK } from '../lib/theme'
import { measureText, SANS } from '../lib/text'
import type { RoutedEdge } from '../lib/geometry'
import type { DiagramEdge, EndCap, Point } from '../types'

function Cap({ at, dir, kind, weight }: { at: Point; dir: Point; kind: EndCap; weight: number }) {
  if (kind === 'none') return null
  const s = 1 + weight * 0.55
  const angle = (Math.atan2(dir.y, dir.x) * 180) / Math.PI
  const t = `translate(${at.x} ${at.y}) rotate(${angle}) scale(${s})`
  switch (kind) {
    case 'arrow':
      return <path transform={t} d="M0 0 L-9.5 4 L-7.4 0 L-9.5 -4 Z" fill={INK} stroke="none" />
    case 'open':
      return (
        <path
          transform={t}
          d="M-9 4.6 L0 0 L-9 -4.6"
          fill="none"
          stroke={INK}
          strokeWidth={1 / s}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )
    case 'dot':
      return <circle transform={t} cx={-3} cy={0} r={3} fill={INK} stroke="none" />
    case 'diamond':
      return <path transform={t} d="M0 0 L-5 3.6 L-10 0 L-5 -3.6 Z" fill={INK} stroke="none" />
    case 'bar':
      return (
        <path transform={t} d="M0 -5 L0 5" fill="none" stroke={INK} strokeWidth={1.4 / s} strokeLinecap="round" />
      )
    default:
      return null
  }
}

interface Props {
  edge: DiagramEdge
  route: RoutedEdge
}

export const EdgeView = memo(function EdgeView({ edge, route }: Props) {
  const w = edge.style.weight
  const labelW = edge.label ? measureText(edge.label, edge.style.fontSize, false, false) : 0
  return (
    <g data-edge={edge.id}>
      <path
        d={route.d}
        fill="none"
        stroke={INK}
        strokeWidth={w}
        strokeDasharray={dashArray(edge.style.stroke, w)}
        strokeLinecap={edge.style.stroke === 'dotted' ? 'round' : 'butt'}
        strokeLinejoin="round"
      />
      <Cap at={route.start} dir={route.startDir} kind={edge.startCap} weight={w} />
      <Cap at={route.end} dir={route.endDir} kind={edge.endCap} weight={w} />
      {edge.label && (
        <g>
          <rect
            x={route.mid.x - labelW / 2 - 5}
            y={route.mid.y - edge.style.fontSize / 2 - 3.5}
            width={labelW + 10}
            height={edge.style.fontSize + 7}
            rx={3}
            fill="#fbfbfa"
          />
          <text
            x={route.mid.x}
            y={route.mid.y + edge.style.fontSize * 0.35}
            textAnchor="middle"
            fontFamily={SANS}
            fontSize={edge.style.fontSize}
            fill="#6c6c66"
            style={{ userSelect: 'none' }}
          >
            {edge.label}
          </text>
        </g>
      )}
    </g>
  )
})
