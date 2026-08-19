import { useMemo } from 'react'
import { useStore, selectionSize } from '../state/store'
import { FILLS, FILL_ORDER, SHAPES } from '../lib/theme'
import { keyLabel } from '../state/commands'
import { Icon, ShapeIcon } from './Icon'
import type { IconName } from './Icon'
import type { DashStyle, EndCap, ShapeKind, TextAlign } from '../types'

const ALL_SHAPES: ShapeKind[] = [
  'round',
  'rect',
  'pill',
  'ellipse',
  'diamond',
  'hexagon',
  'parallelogram',
  'cylinder',
  'queue',
  'document',
  'note',
  'actor',
  'cloud',
  'text',
  'frame',
]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="insp-section">
      <h3>{title}</h3>
      {children}
    </section>
  )
}

function Row({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div className="insp-row">
      {label && <span className="insp-label">{label}</span>}
      <div className="insp-controls">{children}</div>
    </div>
  )
}

function Seg<T extends string | number>({
  value,
  options,
  onChange,
  grow,
}: {
  value: T | undefined
  options: { v: T; icon?: IconName; text?: string; tip?: string }[]
  onChange: (v: T) => void
  grow?: boolean
}) {
  return (
    <div className={`seg${grow ? ' grow' : ''}`}>
      {options.map((o) => (
        <button
          key={String(o.v)}
          className={value === o.v ? 'is-active' : ''}
          onClick={() => onChange(o.v)}
          data-tip={o.tip}
          aria-label={o.tip ?? o.text}
        >
          {o.icon ? <Icon name={o.icon} size={18} /> : o.text}
        </button>
      ))}
    </div>
  )
}

function Num({
  value,
  onChange,
  label,
}: {
  value: number
  onChange: (v: number) => void
  label: string
}) {
  return (
    <label className="num">
      <span>{label}</span>
      <input
        type="number"
        value={Math.round(value)}
        onChange={(e) => {
          const v = Number(e.target.value)
          if (!Number.isNaN(v)) onChange(v)
        }}
      />
    </label>
  )
}

export function Inspector() {
  const scene = useStore((s) => s.scene)
  const selection = useStore((s) => s.selection)
  const show = useStore((s) => s.showInspector)
  const store = useStore()

  const nodes = useMemo(
    () => scene.nodes.filter((n) => selection.nodes.includes(n.id)),
    [scene.nodes, selection.nodes],
  )
  const edges = useMemo(
    () => scene.edges.filter((e) => selection.edges.includes(e.id)),
    [scene.edges, selection.edges],
  )

  if (!show) return null

  const n = nodes[0]
  const e = edges[0]
  const style = n?.style ?? store.lastNodeStyle
  const single = nodes.length === 1

  return (
    <aside className="inspector" data-ui>
      {selectionSize(selection) === 0 && (
        <>
          <Section title="Canvas">
            <Row label="Title">
              <input
                className="text-input"
                value={scene.title}
                placeholder="Untitled"
                onChange={(ev) => store.setTitle(ev.target.value)}
              />
            </Row>
            <Row>
              <button
                className={`chip${store.showGrid ? ' is-active' : ''}`}
                onClick={store.toggleGrid}
                data-tip="Dot grid"
                data-key="G"
              >
                <Icon name="grid" size={16} /> Grid
              </button>
              <button
                className={`chip${store.snapToGrid ? ' is-active' : ''}`}
                onClick={store.toggleSnap}
                data-tip="Snap to grid & guides"
                data-key={keyLabel('shift+g')}
              >
                <Icon name="magnet" size={16} /> Snap
              </button>
            </Row>
          </Section>

          <Section title="Layout">
            <Row>
              <button className="chip wide" onClick={() => store.autoLayout('LR')} data-key={keyLabel('alt+l')}>
                <Icon name="tidy" size={16} /> Tidy left → right
              </button>
            </Row>
            <Row>
              <button className="chip wide" onClick={() => store.autoLayout('TB')} data-key={keyLabel('alt+shift+l')}>
                <Icon name="tidy" size={16} /> Tidy top → bottom
              </button>
            </Row>
          </Section>

          <Section title="Default style">
            <Row label="Fill">
              <div className="swatches">
                {FILL_ORDER.map((f) => (
                  <button
                    key={f}
                    className={`swatch${store.lastNodeStyle.fill === f ? ' is-active' : ''}${f === 'none' ? ' is-none' : ''}`}
                    style={{ background: FILLS[f] }}
                    onClick={() => store.styleNodes({ fill: f })}
                    aria-label={f}
                  />
                ))}
              </div>
            </Row>
          </Section>

          <div className="insp-empty">
            Select something to style it, or press <kbd>{keyLabel('mod+k')}</kbd> for every command.
          </div>
        </>
      )}

      {nodes.length > 0 && (
        <>
          <Section title={nodes.length > 1 ? `${nodes.length} shapes` : SHAPES[n.kind].label}>
            <Row label="Fill">
              <div className="swatches">
                {FILL_ORDER.map((f) => (
                  <button
                    key={f}
                    className={`swatch${style.fill === f ? ' is-active' : ''}${f === 'none' ? ' is-none' : ''}`}
                    style={{ background: FILLS[f] }}
                    onClick={() => store.styleNodes({ fill: f })}
                    data-tip={f === 'none' ? 'Transparent' : undefined}
                    aria-label={f}
                  />
                ))}
              </div>
            </Row>
            <Row label="Line">
              <Seg<DashStyle>
                value={style.stroke}
                options={[
                  { v: 'solid', text: '——', tip: 'Solid' },
                  { v: 'dashed', text: '– –', tip: 'Dashed' },
                  { v: 'dotted', text: '· ·', tip: 'Dotted' },
                ]}
                onChange={(v) => store.styleNodes({ stroke: v })}
              />
              <Seg<number>
                value={style.weight}
                options={[
                  { v: 0.75, text: 'xs', tip: 'Hairline' },
                  { v: 1, text: 's', tip: 'Thin' },
                  { v: 1.5, text: 'm', tip: 'Medium' },
                  { v: 2.5, text: 'l', tip: 'Bold' },
                ]}
                onChange={(v) => store.styleNodes({ weight: v })}
              />
            </Row>
            {(n?.kind === 'round' || n?.kind === 'rect' || n?.kind === 'frame') && (
              <Row label="Corner">
                <input
                  className="range"
                  type="range"
                  min={0}
                  max={32}
                  value={style.radius}
                  onChange={(ev) => store.styleNodes({ radius: Number(ev.target.value) })}
                />
                <span className="num-readout">{Math.round(style.radius)}</span>
              </Row>
            )}
            <Row label="Opacity">
              <input
                className="range"
                type="range"
                min={10}
                max={100}
                value={Math.round(style.opacity * 100)}
                onChange={(ev) => store.styleNodes({ opacity: Number(ev.target.value) / 100 })}
              />
              <span className="num-readout">{Math.round(style.opacity * 100)}</span>
            </Row>
          </Section>

          <Section title="Text">
            <Row label="Size">
              <Seg<number>
                value={style.fontSize}
                options={[
                  { v: 11, text: 'S' },
                  { v: 13, text: 'M' },
                  { v: 16, text: 'L' },
                  { v: 21, text: 'XL' },
                ]}
                onChange={(v) => {
                  store.styleNodes({ fontSize: v })
                  for (const id of selection.nodes) store.fitNodeHeight(id)
                }}
              />
              <Seg<TextAlign>
                value={style.align}
                options={[
                  { v: 'left', icon: 'alignLeft', tip: 'Left' },
                  { v: 'center', icon: 'alignCenterH', tip: 'Centre' },
                  { v: 'right', icon: 'alignRight', tip: 'Right' },
                ]}
                onChange={(v) => store.styleNodes({ align: v })}
              />
            </Row>
            <Row>
              <button
                className={`chip${style.bold ? ' is-active' : ''}`}
                onClick={() => store.styleNodes({ bold: !style.bold })}
                data-key={keyLabel('mod+b')}
              >
                <Icon name="bold" size={16} /> Bold
              </button>
              <button
                className={`chip${style.mono ? ' is-active' : ''}`}
                onClick={() => store.styleNodes({ mono: !style.mono })}
                data-key={keyLabel('mod+shift+m')}
              >
                <Icon name="code" size={16} /> Mono
              </button>
            </Row>
            {single && n.kind !== 'frame' && n.kind !== 'text' && (
              <Row label="Tag">
                <input
                  className="text-input"
                  value={n.tag ?? ''}
                  placeholder="e.g. svc, queue, v2"
                  onChange={(ev) =>
                    store.patchNodes([n.id], () => ({ tag: ev.target.value || undefined }))
                  }
                />
              </Row>
            )}
          </Section>

          {single && (
            <Section title="Shape">
              <div className="shape-grid">
                {ALL_SHAPES.map((k) => (
                  <button
                    key={k}
                    className={`shape-cell${n.kind === k ? ' is-active' : ''}`}
                    onClick={() => store.patchNodes([n.id], () => ({ kind: k }))}
                    data-tip={SHAPES[k].label}
                  >
                    <ShapeIcon kind={k} size={18} />
                  </button>
                ))}
              </div>
            </Section>
          )}

          <Section title="Arrange">
            <Row>
              <div className="icon-row">
                {(
                  [
                    ['left', 'alignLeft', 'Align left', keyLabel('alt+1')],
                    ['hcenter', 'alignCenterH', 'Align centres', keyLabel('alt+2')],
                    ['right', 'alignRight', 'Align right', keyLabel('alt+3')],
                    ['top', 'alignTop', 'Align top', keyLabel('alt+4')],
                    ['vcenter', 'alignCenterV', 'Align middles', keyLabel('alt+5')],
                    ['bottom', 'alignBottom', 'Align bottom', keyLabel('alt+6')],
                  ] as const
                ).map(([mode, icon, tip, key]) => (
                  <button
                    key={mode}
                    className="icon-btn"
                    disabled={nodes.length < 2}
                    onClick={() => store.align(mode)}
                    data-tip={tip}
                    data-key={key}
                  >
                    <Icon name={icon} size={18} />
                  </button>
                ))}
              </div>
            </Row>
            <Row>
              <div className="icon-row">
                <button
                  className="icon-btn"
                  disabled={nodes.length < 3}
                  onClick={() => store.distribute('h')}
                  data-tip="Distribute horizontally"
                  data-key={keyLabel('alt+7')}
                >
                  <Icon name="distH" size={18} />
                </button>
                <button
                  className="icon-btn"
                  disabled={nodes.length < 3}
                  onClick={() => store.distribute('v')}
                  data-tip="Distribute vertically"
                  data-key={keyLabel('alt+8')}
                >
                  <Icon name="distV" size={18} />
                </button>
                <button
                  className="icon-btn"
                  disabled={nodes.length < 2}
                  onClick={() => store.matchSize('both')}
                  data-tip="Match size to last"
                  data-key={keyLabel('alt+m')}
                >
                  <Icon name="swap" size={18} />
                </button>
                <button
                  className="icon-btn"
                  onClick={() => store.order('front')}
                  data-tip="Bring to front"
                  data-key={keyLabel('mod+]')}
                >
                  <Icon name="toFront" size={18} />
                </button>
                <button
                  className="icon-btn"
                  onClick={() => store.order('back')}
                  data-tip="Send to back"
                  data-key={keyLabel('mod+[')}
                >
                  <Icon name="toBack" size={18} />
                </button>
              </div>
            </Row>
            {single && (
              <Row>
                <div className="nums">
                  <Num label="X" value={n.x} onChange={(v) => store.patchNodes([n.id], () => ({ x: v }))} />
                  <Num label="Y" value={n.y} onChange={(v) => store.patchNodes([n.id], () => ({ y: v }))} />
                  <Num label="W" value={n.w} onChange={(v) => store.patchNodes([n.id], () => ({ w: Math.max(16, v) }))} />
                  <Num label="H" value={n.h} onChange={(v) => store.patchNodes([n.id], () => ({ h: Math.max(16, v) }))} />
                </div>
              </Row>
            )}
          </Section>
        </>
      )}

      {edges.length > 0 && (
        <Section title={edges.length > 1 ? `${edges.length} connectors` : 'Connector'}>
          <Row label="Route">
            <Seg
              value={e.routing}
              options={[
                { v: 'orthogonal' as const, icon: 'routeElbow', tip: 'Elbow' },
                { v: 'straight' as const, icon: 'routeStraight', tip: 'Straight' },
                { v: 'curve' as const, icon: 'routeCurve', tip: 'Curved' },
              ]}
              onChange={(v) => store.styleEdges({ routing: v })}
            />
          </Row>
          <Row label="Ends">
            <Seg<EndCap>
              value={e.startCap}
              options={[
                { v: 'none', text: '—', tip: 'No start cap' },
                { v: 'arrow', icon: 'arrowStart', tip: 'Arrow' },
                { v: 'dot', text: '●', tip: 'Dot' },
                { v: 'diamond', text: '◆', tip: 'Diamond' },
              ]}
              onChange={(v) => store.styleEdges({ startCap: v })}
            />
            <Seg<EndCap>
              value={e.endCap}
              options={[
                { v: 'none', text: '—', tip: 'No end cap' },
                { v: 'arrow', icon: 'arrowEnd', tip: 'Arrow' },
                { v: 'open', text: '›', tip: 'Open' },
                { v: 'bar', text: '|', tip: 'Bar' },
              ]}
              onChange={(v) => store.styleEdges({ endCap: v })}
            />
          </Row>
          <Row label="Line">
            <Seg<DashStyle>
              value={e.style.stroke}
              options={[
                { v: 'solid', text: '——' },
                { v: 'dashed', text: '– –' },
                { v: 'dotted', text: '· ·' },
              ]}
              onChange={(v) => store.styleEdges({ stroke: v })}
            />
            <Seg<number>
              value={e.style.weight}
              options={[
                { v: 0.75, text: 'xs' },
                { v: 1, text: 's' },
                { v: 1.5, text: 'm' },
                { v: 2.5, text: 'l' },
              ]}
              onChange={(v) => store.styleEdges({ weight: v })}
            />
          </Row>
          {edges.length === 1 && (
            <Row label="Label">
              <input
                className="text-input"
                value={e.label}
                placeholder="e.g. publish"
                onChange={(ev) => store.patchEdges([e.id], () => ({ label: ev.target.value }))}
              />
            </Row>
          )}
          <Row>
            <button className="chip wide" onClick={store.reverseEdges} data-key={keyLabel('shift+7')}>
              <Icon name="reverse" size={16} /> Reverse direction
            </button>
          </Row>
        </Section>
      )}

      {selectionSize(selection) > 0 && (
        <div className="insp-footer">
          <button className="chip danger wide" onClick={() => store.remove()} data-key="⌫">
            <Icon name="trash" size={16} /> Delete selection
          </button>
        </div>
      )}
    </aside>
  )
}
