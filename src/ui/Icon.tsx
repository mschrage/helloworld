import { shapePath } from '../lib/geometry'
import { makeStyle } from '../lib/theme'
import type { DiagramNode, ShapeKind } from '../types'

/**
 * Shape tools use their own silhouette as the icon — the most honest,
 * lowest-noise iconography available to a diagram editor.
 */
export function ShapeIcon({ kind, size = 20 }: { kind: ShapeKind; size?: number }) {
  const box = 20
  const inset = 2.5
  const w = box - inset * 2
  const h = kind === 'cylinder' || kind === 'ellipse' || kind === 'diamond' ? box - inset * 2 : 11
  const node: DiagramNode = {
    id: 'icon',
    kind,
    x: inset,
    y: (box - h) / 2,
    w,
    h,
    text: '',
    style: { ...makeStyle(kind), radius: 2.5, weight: 1.1 },
  }

  if (kind === 'text') {
    return (
      <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
        <path d="M4.5 5.5h11M10 5.5v9" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      </svg>
    )
  }

  if (kind === 'frame') {
    return (
      <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
        <rect
          x="2.6"
          y="3.6"
          width="14.8"
          height="12.8"
          rx="1.5"
          stroke="currentColor"
          strokeWidth="1.1"
          strokeDasharray="2.6 2"
        />
      </svg>
    )
  }

  if (kind === 'actor') {
    return (
      <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.1">
        <circle cx="10" cy="5.6" r="2.6" />
        <path d="M10 8.4v5M6.2 10.4h7.6M10 13.4l-2.8 3.4M10 13.4l2.8 3.4" strokeLinecap="round" />
      </svg>
    )
  }

  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path
        d={shapePath(node)}
        stroke="currentColor"
        strokeWidth="1.1"
        fill="none"
        strokeLinejoin={kind === 'diamond' || kind === 'hexagon' ? 'miter' : 'round'}
      />
      {kind === 'cylinder' && (
        <path
          d={`M${node.x} ${node.y + 2.4} A${node.w / 2} 2.4 0 0 0 ${node.x + node.w} ${node.y + 2.4}`}
          stroke="currentColor"
          strokeWidth="1.1"
          fill="none"
        />
      )}
      {kind === 'note' && (
        <path
          d={`M${node.x + node.w - 3.4} ${node.y} v3.4 h3.4`}
          stroke="currentColor"
          strokeWidth="1.1"
          fill="none"
        />
      )}
      {kind === 'queue' && (
        <path
          d={`M${node.x + node.w - 1.9} ${node.y} A1.9 ${node.h / 2} 0 0 0 ${node.x + node.w - 1.9} ${node.y + node.h}`}
          stroke="currentColor"
          strokeWidth="1.1"
          fill="none"
        />
      )}
    </svg>
  )
}

const P = (d: string, extra?: Record<string, string | number>) => ({ d, ...extra })

const GLYPHS: Record<string, ReturnType<typeof P>[]> = {
  cursor: [P('M5 3.4l10.2 6.1-4.6 1.1-1.6 4.6z')],
  hand: [
    P('M7 10.5V5.4a1.15 1.15 0 0 1 2.3 0v4.3'),
    P('M9.3 9.7V4.6a1.15 1.15 0 0 1 2.3 0v5.1'),
    P('M11.6 10V6.2a1.15 1.15 0 0 1 2.3 0v6.1a4 4 0 0 1-4 4h-.9a3.4 3.4 0 0 1-2.6-1.3L4 12.3a1.1 1.1 0 0 1 1.6-1.5L7 12'),
  ],
  connector: [P('M3.5 5h4a4 4 0 0 1 4 4v3'), P('M9.2 10.6l2.3 2.6 2.3-2.6')],
  pen: [P('M4 16l1-3.4L13.1 4.5a1.6 1.6 0 0 1 2.3 2.3L7.3 15z'), P('M4.9 12.7l2.4 2.3')],
  eraser: [P('M4.4 12.6l5.4-5.4a1.6 1.6 0 0 1 2.3 0l2.6 2.6a1.6 1.6 0 0 1 0 2.3L11.6 15H6.8z'), P('M8.6 15H16')],
  undo: [P('M6.6 7.4L4 10l2.6 2.6'), P('M4 10h7.2a3.6 3.6 0 0 1 0 7.2h-1')],
  redo: [P('M13.4 7.4L16 10l-2.6 2.6'), P('M16 10H8.8a3.6 3.6 0 0 0 0 7.2h1')],
  grid: [P('M3 7.5h14M3 12.5h14M7.5 3v14M12.5 3v14')],
  magnet: [
    P('M6 4v6a4 4 0 0 0 8 0V4'),
    P('M6 4h3v6a1 1 0 0 0 2 0V4h3'),
  ],
  download: [P('M10 3.5v9'), P('M6.5 9.4L10 12.9l3.5-3.5'), P('M3.8 15.6h12.4')],
  upload: [P('M10 12.9v-9'), P('M6.5 7L10 3.5 13.5 7'), P('M3.8 15.6h12.4')],
  plus: [P('M10 4.5v11M4.5 10h11')],
  search: [P('M9 3.6a5.4 5.4 0 1 0 0 10.8 5.4 5.4 0 0 0 0-10.8z'), P('M13 13l3.4 3.4')],
  close: [P('M5 5l10 10M15 5L5 15')],
  help: [P('M7.4 7.6a2.7 2.7 0 1 1 3.4 2.6c-.6.2-.8.7-.8 1.3v.5'), P('M10 15.2h.01')],
  layers: [P('M10 3.4L3.6 6.7 10 10l6.4-3.3z'), P('M3.6 10.6L10 13.9l6.4-3.3')],
  alignLeft: [P('M4 3.5v13'), P('M6.4 6.5h7.8v2.6H6.4z'), P('M6.4 11.4h4.8V14H6.4z')],
  alignCenterH: [P('M10 3.5v13'), P('M6.1 6.5h7.8v2.6H6.1z'), P('M7.6 11.4h4.8V14H7.6z')],
  alignRight: [P('M16 3.5v13'), P('M5.8 6.5h7.8v2.6H5.8z'), P('M8.8 11.4h4.8V14H8.8z')],
  alignTop: [P('M3.5 4h13'), P('M6.5 6.4h2.6v7.8H6.5z'), P('M11.4 6.4H14v4.8h-2.6z')],
  alignCenterV: [P('M3.5 10h13'), P('M6.5 6.1h2.6v7.8H6.5z'), P('M11.4 7.6H14v4.8h-2.6z')],
  alignBottom: [P('M3.5 16h13'), P('M6.5 5.8h2.6v7.8H6.5z'), P('M11.4 8.8H14v4.8h-2.6z')],
  distH: [P('M3.6 3.5v13'), P('M16.4 3.5v13'), P('M8 6.6h4v6.8H8z')],
  distV: [P('M3.5 3.6h13'), P('M3.5 16.4h13'), P('M6.6 8h6.8v4H6.6z')],
  toFront: [P('M6.5 6.5h7v7h-7z'), P('M9.4 4h6.1v6.1'), P('M4.5 9.9v5.6h5.6')],
  toBack: [P('M4.5 4h7v7h-7z'), P('M8.5 8.5h7v7h-7z')],
  tidy: [P('M3.6 5.4h5.2v3.2H3.6z'), P('M11.2 11.4h5.2v3.2h-5.2z'), P('M6.2 8.6v2.4a2 2 0 0 0 2 2h3')],
  routeElbow: [P('M3.6 5.6h5.2a2 2 0 0 1 2 2v4.8h5.6')],
  routeStraight: [P('M3.6 15.4L16.4 4.6')],
  routeCurve: [P('M3.6 15.4C9 15.4 11 4.6 16.4 4.6')],
  arrowEnd: [P('M3.6 10h10.2'), P('M11.2 7.1L14.6 10l-3.4 2.9')],
  arrowStart: [P('M16.4 10H6.2'), P('M8.8 7.1L5.4 10l3.4 2.9')],
  dash: [P('M3.4 10h3.2M8.4 10h3.2M13.4 10h3.2')],
  bold: [P('M6.6 4.4h4.2a2.8 2.8 0 0 1 0 5.6H6.6zM6.6 10h4.9a2.8 2.8 0 0 1 0 5.6H6.6z')],
  code: [P('M7.2 6.4L3.6 10l3.6 3.6'), P('M12.8 6.4L16.4 10l-3.6 3.6')],
  trash: [P('M4.6 6h10.8'), P('M8 6V4.4h4V6'), P('M6.2 6l.7 9.4h6.2L13.8 6')],
  duplicate: [P('M7.4 7.4h8v8h-8z'), P('M12.6 5.6V4.5h-8v8h1.1')],
  zoomIn: [P('M9 3.6a5.4 5.4 0 1 0 0 10.8 5.4 5.4 0 0 0 0-10.8z'), P('M13 13l3.4 3.4'), P('M6.8 9h4.4M9 6.8v4.4')],
  zoomOut: [P('M9 3.6a5.4 5.4 0 1 0 0 10.8 5.4 5.4 0 0 0 0-10.8z'), P('M13 13l3.4 3.4'), P('M6.8 9h4.4')],
  fit: [P('M4 7.4V4h3.4'), P('M12.6 4H16v3.4'), P('M16 12.6V16h-3.4'), P('M7.4 16H4v-3.4')],
  file: [P('M5.4 3.5h6L14.6 7v9.5H5.4z'), P('M11.2 3.5V7h3.4')],
  reverse: [P('M4 7.6h9.4'), P('M11 5.1l2.6 2.5-2.6 2.5'), P('M16 12.4H6.6'), P('M9 9.9l-2.6 2.5L9 14.9')],
  frameIcon: [P('M6 3v14M14 3v14M3 6h14M3 14h14')],
  swap: [P('M4 8h9M10.6 5.2L13.4 8l-2.8 2.8'), P('M16 12h-9M9.4 9.2L6.6 12l2.8 2.8')],
}

export function Icon({
  name,
  size = 20,
  strokeWidth = 1.15,
}: {
  name: keyof typeof GLYPHS
  size?: number
  strokeWidth?: number
}) {
  const paths = GLYPHS[name] ?? []
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths.map((p, i) => (
        <path key={i} {...p} />
      ))}
    </svg>
  )
}

export type IconName = keyof typeof GLYPHS
