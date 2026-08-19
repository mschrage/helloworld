import { comboLabel, COMMANDS, keyLabel, MOD } from '../state/commands'
import { Icon } from './Icon'

const EXTRA: Record<string, [string, string][]> = {
  Canvas: [
    ['Pan', 'Space-drag · middle-drag · two-finger scroll'],
    ['Zoom', `${MOD} + scroll · pinch`],
    ['Marquee select', 'Drag on empty canvas'],
    ['Add & connect', 'Drag from a shape’s side dot onto empty canvas'],
    ['New shape here', 'Double-click empty canvas'],
    ['Edit label', 'Double-click a shape or connector'],
    ['Chain shapes', 'Type a label, then ⇥ for the next one'],
    ['Duplicate-drag', 'Alt-drag a shape'],
    ['Constrain drag', 'Shift-drag'],
    ['Ignore snapping', `Hold ${MOD} while dragging`],
    ['Keep tool active', 'Shift-click or Alt-click a tool'],
  ],
}

const GROUP_ORDER = ['Canvas', 'Tools', 'Insert', 'Build', 'Edit', 'Arrange', 'Style', 'View', 'File']

export function ShortcutsSheet({ onClose }: { onClose(): void }) {
  const grouped = new Map<string, [string, string[] | string][]>()
  grouped.set('Canvas', EXTRA.Canvas.map(([a, b]) => [a, b] as [string, string]))

  const seen = new Set<string>()
  for (const c of COMMANDS) {
    if (!c.combo) continue
    const key = c.group + '|' + c.title
    if (seen.has(key)) continue
    seen.add(key)
    const list = grouped.get(c.group) ?? []
    list.push([c.title, comboLabel(c.combo)])
    grouped.set(c.group, list)
  }

  return (
    <div className="sheet-scrim" data-ui onPointerDown={onClose}>
      <div className="sheet" onPointerDown={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>Keyboard</h2>
          <p>Everything here is also in the command palette — <kbd>{keyLabel('mod+k')}</kbd>.</p>
          <button className="sheet-close" onClick={onClose} aria-label="Close">
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="sheet-body">
          {GROUP_ORDER.filter((g) => grouped.has(g)).map((g) => (
            <section key={g}>
              <h3>{g}</h3>
              <dl>
                {grouped.get(g)!.map(([title, keys], i) => (
                  <div key={i}>
                    <dt>{title}</dt>
                    <dd>
                      {Array.isArray(keys) ? (
                        keys.map((k, j) => <kbd key={j}>{k}</kbd>)
                      ) : (
                        <span className="sheet-note">{keys}</span>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
