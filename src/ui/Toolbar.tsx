import { useState } from 'react'
import { useStore } from '../state/store'
import { Icon, ShapeIcon } from './Icon'
import type { IconName } from './Icon'
import type { ShapeKind, Tool } from '../types'

interface ToolDef {
  id: string
  tool: Tool
  icon: IconName
  label: string
  key: string
}

const TOOLS: ToolDef[] = [
  { id: 'select', tool: 'select', icon: 'cursor', label: 'Select', key: 'V' },
  { id: 'hand', tool: 'hand', icon: 'hand', label: 'Pan', key: 'H' },
  { id: 'edge', tool: 'edge', icon: 'connector', label: 'Connector', key: 'L' },
  { id: 'pen', tool: 'pen', icon: 'pen', label: 'Pen', key: 'P' },
  { id: 'eraser', tool: 'eraser', icon: 'eraser', label: 'Eraser', key: 'E' },
]

const PRIMARY: { kind: ShapeKind; label: string; key: string }[] = [
  { kind: 'round', label: 'Rounded box', key: 'R' },
  { kind: 'rect', label: 'Square box', key: '⇧R' },
  { kind: 'diamond', label: 'Decision', key: 'D' },
  { kind: 'cylinder', label: 'Data store', key: 'S' },
  { kind: 'queue', label: 'Queue', key: 'Q' },
  { kind: 'actor', label: 'Actor', key: 'U' },
  { kind: 'note', label: 'Note', key: 'N' },
  { kind: 'text', label: 'Text', key: 'T' },
  { kind: 'frame', label: 'Frame', key: 'F' },
]

const SECONDARY: { kind: ShapeKind; label: string; key: string }[] = [
  { kind: 'pill', label: 'Pill', key: '⇧P' },
  { kind: 'ellipse', label: 'Ellipse', key: 'O' },
  { kind: 'hexagon', label: 'Hexagon', key: 'X' },
  { kind: 'parallelogram', label: 'Input / output', key: 'I' },
  { kind: 'document', label: 'Document', key: '⇧D' },
  { kind: 'cloud', label: 'Cloud', key: 'K' },
]

export function Toolbar() {
  const tool = useStore((s) => s.tool)
  const stickyTool = useStore((s) => s.stickyTool)
  const setTool = useStore((s) => s.setTool)
  const [expanded, setExpanded] = useState(false)

  const isActive = (t: Tool) =>
    typeof t === 'object' ? typeof tool === 'object' && tool.shape === t.shape : tool === t

  const pick = (t: Tool, e: React.MouseEvent) => {
    setTool(t, e.altKey || e.shiftKey)
  }

  return (
    <div className="rail" data-ui>
      {TOOLS.map((t) => (
        <button
          key={t.id}
          className={`rail-btn${isActive(t.tool) ? ' is-active' : ''}`}
          onClick={(e) => pick(t.tool, e)}
          data-tip={t.label}
          data-key={t.key}
          aria-label={t.label}
        >
          <Icon name={t.icon} />
        </button>
      ))}

      <div className="rail-sep" />

      {PRIMARY.map((s) => (
        <button
          key={s.kind}
          className={`rail-btn${isActive({ shape: s.kind }) ? ' is-active' : ''}`}
          onClick={(e) => pick({ shape: s.kind }, e)}
          data-tip={s.label}
          data-key={s.key}
          aria-label={s.label}
        >
          <ShapeIcon kind={s.kind} />
        </button>
      ))}

      {expanded &&
        SECONDARY.map((s) => (
          <button
            key={s.kind}
            className={`rail-btn${isActive({ shape: s.kind }) ? ' is-active' : ''}`}
            onClick={(e) => pick({ shape: s.kind }, e)}
            data-tip={s.label}
            data-key={s.key}
            aria-label={s.label}
          >
            <ShapeIcon kind={s.kind} />
          </button>
        ))}

      <button
        className="rail-btn rail-more"
        onClick={() => setExpanded((v) => !v)}
        data-tip={expanded ? 'Fewer shapes' : 'More shapes'}
        aria-label="More shapes"
      >
        <span className={`chev${expanded ? ' up' : ''}`} />
      </button>

      {stickyTool && <div className="rail-lock" data-tip="Tool stays active — press Esc or V to release">lock</div>}
    </div>
  )
}
