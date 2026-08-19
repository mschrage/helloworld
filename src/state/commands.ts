import { exportPngFile, exportSvgFile, openSceneFile, saveSceneFile } from '../lib/io'
import { sceneBounds, selectionBounds, selectionSize, useStore } from './store'
import { env, isMac } from './env'
import type { ShapeKind } from '../types'

export interface Command {
  id: string
  title: string
  group: string
  combo?: string
  /** Extra words to match in the palette. */
  alias?: string
  run: () => void
}

const S = () => useStore.getState()

const boundsForExport = () => {
  const s = S()
  return (
    (selectionSize(s.selection) > 1 ? selectionBounds(s.scene, s.selection) : null) ??
    sceneBounds(s.scene) ?? { x: 0, y: 0, w: 400, h: 300 }
  )
}

const shapeCmd = (kind: ShapeKind, title: string, combo: string, alias?: string): Command => ({
  id: `tool.${kind}`,
  title,
  group: 'Insert',
  combo,
  alias,
  run: () => S().setTool({ shape: kind }),
})

export const COMMANDS: Command[] = [
  /* ------------------------------------------------------------ tools */
  { id: 'tool.select', title: 'Select tool', group: 'Tools', combo: 'v', run: () => S().setTool('select') },
  { id: 'tool.hand', title: 'Pan tool', group: 'Tools', combo: 'h', alias: 'hand move', run: () => S().setTool('hand') },
  {
    id: 'tool.edge',
    title: 'Connector tool',
    group: 'Tools',
    combo: 'l',
    alias: 'line arrow link',
    run: () => S().setTool('edge'),
  },
  { id: 'tool.pen', title: 'Pen tool', group: 'Tools', combo: 'p', alias: 'draw ink sketch', run: () => S().setTool('pen') },
  { id: 'tool.eraser', title: 'Eraser tool', group: 'Tools', combo: 'e', run: () => S().setTool('eraser') },

  /* ----------------------------------------------------------- insert */
  shapeCmd('round', 'Rounded box', 'r', 'service component'),
  shapeCmd('rect', 'Square box', 'shift+r', 'rectangle module'),
  shapeCmd('pill', 'Pill', 'shift+p', 'terminator start end'),
  shapeCmd('ellipse', 'Ellipse', 'o', 'circle state'),
  shapeCmd('diamond', 'Decision', 'd', 'branch condition if'),
  shapeCmd('hexagon', 'Hexagon', 'x', 'gateway preparation'),
  shapeCmd('parallelogram', 'Input / output', 'i', 'io data'),
  shapeCmd('cylinder', 'Data store', 's', 'database db storage'),
  shapeCmd('queue', 'Queue', 'q', 'topic bus kafka'),
  shapeCmd('document', 'Document', 'shift+d', 'artifact report'),
  shapeCmd('note', 'Note', 'n', 'annotation comment'),
  shapeCmd('actor', 'Actor', 'u', 'user person role'),
  shapeCmd('cloud', 'Cloud', 'k', 'external internet third party'),
  shapeCmd('text', 'Text', 't', 'label caption'),
  shapeCmd('frame', 'Frame', 'f', 'group boundary container swimlane'),

  /* ------------------------------------------------------------- edit */
  { id: 'edit.undo', title: 'Undo', group: 'Edit', combo: 'mod+z', run: () => S().undo() },
  { id: 'edit.redo', title: 'Redo', group: 'Edit', combo: 'mod+shift+z', run: () => S().redo() },
  { id: 'edit.redo2', title: 'Redo', group: 'Edit', combo: 'mod+y', run: () => S().redo() },
  { id: 'edit.copy', title: 'Copy', group: 'Edit', combo: 'mod+c', run: () => S().copy() },
  { id: 'edit.cut', title: 'Cut', group: 'Edit', combo: 'mod+x', run: () => S().cut() },
  {
    id: 'edit.paste',
    title: 'Paste',
    group: 'Edit',
    combo: 'mod+v',
    run: () => S().paste(worldPointer()),
  },
  { id: 'edit.duplicate', title: 'Duplicate', group: 'Edit', combo: 'mod+d', run: () => S().duplicate() },
  { id: 'edit.delete', title: 'Delete', group: 'Edit', combo: 'backspace', run: () => S().remove() },
  { id: 'edit.delete2', title: 'Delete', group: 'Edit', combo: 'delete', run: () => S().remove() },
  { id: 'edit.selectAll', title: 'Select all', group: 'Edit', combo: 'mod+a', run: () => S().selectAll() },
  {
    id: 'edit.selectConnected',
    title: 'Select connected',
    group: 'Edit',
    combo: 'mod+shift+a',
    alias: 'subgraph neighbours',
    run: () => S().selectConnected(),
  },
  {
    id: 'edit.rename',
    title: 'Edit label',
    group: 'Edit',
    combo: 'enter',
    alias: 'text rename type',
    run: () => {
      const s = S()
      const id = s.selection.nodes[0] ?? s.selection.edges[0]
      if (id) s.setEditing(id)
    },
  },
  {
    id: 'edit.deselect',
    title: 'Deselect',
    group: 'Edit',
    combo: 'escape',
    run: () => {
      const s = S()
      if (s.editing) s.setEditing(null)
      else if (selectionSize(s.selection)) s.clearSelection()
      else if (s.tool !== 'select') s.setTool('select')
    },
  },

  /* ------------------------------------------------------------ build */
  {
    id: 'build.spawnRight',
    title: 'Add connected node →',
    group: 'Build',
    combo: 'tab',
    alias: 'chain next child',
    run: () => S().spawn('right'),
  },
  { id: 'build.spawnR', title: 'Add connected node →', group: 'Build', combo: 'alt+arrowright', run: () => S().spawn('right') },
  { id: 'build.spawnL', title: 'Add connected node ←', group: 'Build', combo: 'alt+arrowleft', run: () => S().spawn('left') },
  { id: 'build.spawnU', title: 'Add connected node ↑', group: 'Build', combo: 'alt+arrowup', run: () => S().spawn('up') },
  { id: 'build.spawnD', title: 'Add connected node ↓', group: 'Build', combo: 'alt+arrowdown', run: () => S().spawn('down') },
  {
    id: 'build.connect',
    title: 'Connect selected nodes',
    group: 'Build',
    combo: 'mod+enter',
    alias: 'link arrow join',
    run: () => S().connectSelection(),
  },
  {
    id: 'build.reverse',
    title: 'Reverse connector',
    group: 'Build',
    combo: 'shift+7',
    alias: 'flip direction',
    run: () => S().reverseEdges(),
  },
  {
    id: 'build.tidyLR',
    title: 'Tidy layout — left to right',
    group: 'Build',
    combo: 'alt+l',
    alias: 'auto arrange graph',
    run: () => S().autoLayout('LR'),
  },
  {
    id: 'build.tidyTB',
    title: 'Tidy layout — top to bottom',
    group: 'Build',
    combo: 'alt+shift+l',
    alias: 'auto arrange graph vertical',
    run: () => S().autoLayout('TB'),
  },

  /* ---------------------------------------------------------- arrange */
  { id: 'arrange.left', title: 'Align left', group: 'Arrange', combo: 'alt+1', run: () => S().align('left') },
  { id: 'arrange.hcenter', title: 'Align centres', group: 'Arrange', combo: 'alt+2', run: () => S().align('hcenter') },
  { id: 'arrange.right', title: 'Align right', group: 'Arrange', combo: 'alt+3', run: () => S().align('right') },
  { id: 'arrange.top', title: 'Align top', group: 'Arrange', combo: 'alt+4', run: () => S().align('top') },
  { id: 'arrange.vcenter', title: 'Align middles', group: 'Arrange', combo: 'alt+5', run: () => S().align('vcenter') },
  { id: 'arrange.bottom', title: 'Align bottom', group: 'Arrange', combo: 'alt+6', run: () => S().align('bottom') },
  {
    id: 'arrange.distH',
    title: 'Distribute horizontally',
    group: 'Arrange',
    combo: 'alt+7',
    run: () => S().distribute('h'),
  },
  {
    id: 'arrange.distV',
    title: 'Distribute vertically',
    group: 'Arrange',
    combo: 'alt+8',
    run: () => S().distribute('v'),
  },
  { id: 'arrange.match', title: 'Match size', group: 'Arrange', combo: 'alt+m', run: () => S().matchSize('both') },
  { id: 'arrange.front', title: 'Bring to front', group: 'Arrange', combo: 'mod+]', run: () => S().order('front') },
  { id: 'arrange.back', title: 'Send to back', group: 'Arrange', combo: 'mod+[', run: () => S().order('back') },
  {
    id: 'arrange.forward',
    title: 'Bring forward',
    group: 'Arrange',
    combo: 'mod+alt+]',
    run: () => S().order('forward'),
  },
  {
    id: 'arrange.backward',
    title: 'Send backward',
    group: 'Arrange',
    combo: 'mod+alt+[',
    run: () => S().order('backward'),
  },

  /* ------------------------------------------------------------ style */
  ...(['none', 'paper', 'g1', 'g2', 'g3', 'g4', 'ink'] as const).map((fill, i) => ({
    id: `style.fill.${fill}`,
    title: `Fill — ${['transparent', 'white', 'grey 1', 'grey 2', 'grey 3', 'grey 4', 'ink'][i]}`,
    group: 'Style',
    combo: String(i + 1),
    alias: 'colour shade',
    run: () => S().styleNodes({ fill }),
  })),
  {
    id: 'style.fillNext',
    title: 'Cycle fill darker',
    group: 'Style',
    combo: 'shift+]',
    run: () => S().cycleFill(1),
  },
  {
    id: 'style.fillPrev',
    title: 'Cycle fill lighter',
    group: 'Style',
    combo: 'shift+[',
    run: () => S().cycleFill(-1),
  },
  {
    id: 'style.bigger',
    title: 'Increase text size',
    group: 'Style',
    combo: ']',
    run: () => bumpFont(1),
  },
  {
    id: 'style.smaller',
    title: 'Decrease text size',
    group: 'Style',
    combo: '[',
    run: () => bumpFont(-1),
  },
  { id: 'style.bold', title: 'Toggle bold', group: 'Style', combo: 'mod+b', run: () => toggleNodeStyle('bold') },
  {
    id: 'style.mono',
    title: 'Toggle monospace',
    group: 'Style',
    combo: 'mod+shift+m',
    alias: 'code font',
    run: () => toggleNodeStyle('mono'),
  },
  {
    id: 'style.dash',
    title: 'Cycle line style',
    group: 'Style',
    combo: 'shift+4',
    alias: 'dashed dotted solid',
    run: () => {
      const order = ['solid', 'dashed', 'dotted'] as const
      const s = S()
      const node = s.scene.nodes.find((n) => s.selection.nodes.includes(n.id))
      const edge = s.scene.edges.find((e) => s.selection.edges.includes(e.id))
      const cur = edge?.style.stroke ?? node?.style.stroke ?? s.lastNodeStyle.stroke
      const next = order[(order.indexOf(cur) + 1) % order.length]
      if (s.selection.edges.length) s.styleEdges({ stroke: next })
      if (s.selection.nodes.length || !s.selection.edges.length) s.styleNodes({ stroke: next })
    },
  },
  {
    id: 'style.weight',
    title: 'Cycle line weight',
    group: 'Style',
    combo: 'shift+w',
    alias: 'thickness stroke',
    run: () => {
      const order = [0.75, 1, 1.5, 2.5]
      const s = S()
      const node = s.scene.nodes.find((n) => s.selection.nodes.includes(n.id))
      const cur = node?.style.weight ?? s.lastNodeStyle.weight
      const next = order[(order.findIndex((w) => w >= cur) + 1) % order.length]
      s.styleNodes({ weight: next })
      if (s.selection.edges.length) s.styleEdges({ weight: next })
    },
  },
  {
    id: 'style.routeOrth',
    title: 'Connector — elbow',
    group: 'Style',
    combo: 'shift+1',
    run: () => S().styleEdges({ routing: 'orthogonal' }),
  },
  {
    id: 'style.routeStraight',
    title: 'Connector — straight',
    group: 'Style',
    combo: 'shift+2',
    run: () => S().styleEdges({ routing: 'straight' }),
  },
  {
    id: 'style.routeCurve',
    title: 'Connector — curved',
    group: 'Style',
    combo: 'shift+3',
    run: () => S().styleEdges({ routing: 'curve' }),
  },
  {
    id: 'style.endCap',
    title: 'Toggle end arrowhead',
    group: 'Style',
    combo: 'shift+5',
    run: () => {
      const s = S()
      const e = s.scene.edges.find((x) => s.selection.edges.includes(x.id))
      const cur = e?.endCap ?? s.edgeDefaults.endCap
      s.styleEdges({ endCap: cur === 'none' ? 'arrow' : 'none' })
    },
  },
  {
    id: 'style.startCap',
    title: 'Toggle start arrowhead',
    group: 'Style',
    combo: 'shift+6',
    run: () => {
      const s = S()
      const e = s.scene.edges.find((x) => s.selection.edges.includes(x.id))
      s.styleEdges({ startCap: e && e.startCap !== 'none' ? 'none' : 'arrow' })
    },
  },

  /* ------------------------------------------------------------- view */
  {
    id: 'view.zoomIn',
    title: 'Zoom in',
    group: 'View',
    combo: 'mod+=',
    run: () => S().zoomTo(S().viewport.k * 1.25, env.size),
  },
  {
    id: 'view.zoomOut',
    title: 'Zoom out',
    group: 'View',
    combo: 'mod+-',
    run: () => S().zoomTo(S().viewport.k / 1.25, env.size),
  },
  { id: 'view.zoom100', title: 'Zoom to 100%', group: 'View', combo: '0', run: () => S().zoomTo(1, env.size) },
  { id: 'view.fit', title: 'Zoom to fit', group: 'View', combo: '9', run: () => S().fit(env.size) },
  {
    id: 'view.fitSelection',
    title: 'Zoom to selection',
    group: 'View',
    combo: '8',
    run: () => S().fit(env.size, true),
  },
  { id: 'view.grid', title: 'Toggle dot grid', group: 'View', combo: 'g', run: () => S().toggleGrid() },
  { id: 'view.snap', title: 'Toggle snapping', group: 'View', combo: 'shift+g', run: () => S().toggleSnap() },
  {
    id: 'view.inspector',
    title: 'Toggle inspector',
    group: 'View',
    combo: '\\',
    alias: 'panel sidebar properties',
    run: () => S().toggleInspector(),
  },

  /* ------------------------------------------------------------- file */
  {
    id: 'file.new',
    title: 'New diagram',
    group: 'File',
    combo: 'mod+alt+n',
    run: () => {
      if (confirm('Start a new diagram? The current one will be cleared.')) S().newScene()
    },
  },
  { id: 'file.save', title: 'Save as .json', group: 'File', combo: 'mod+s', run: () => saveSceneFile(S().scene) },
  {
    id: 'file.open',
    title: 'Open .json',
    group: 'File',
    combo: 'mod+o',
    run: async () => {
      const scene = await openSceneFile()
      if (scene) {
        S().loadScene(scene)
        S().fit(env.size)
        S().notify('Opened')
      }
    },
  },
  {
    id: 'file.svg',
    title: 'Export SVG',
    group: 'File',
    combo: 'mod+e',
    run: async () => {
      if (!env.svg) return
      await exportSvgFile(env.svg, boundsForExport(), S().scene.title)
      S().notify('SVG exported')
    },
  },
  {
    id: 'file.png',
    title: 'Export PNG (2×)',
    group: 'File',
    combo: 'mod+shift+e',
    run: async () => {
      if (!env.svg) return
      await exportPngFile(env.svg, boundsForExport(), S().scene.title, 2)
      S().notify('PNG exported')
    },
  },
  {
    id: 'file.pngTransparent',
    title: 'Export PNG — transparent (3×)',
    group: 'File',
    run: async () => {
      if (!env.svg) return
      await exportPngFile(env.svg, boundsForExport(), S().scene.title, 3, true)
      S().notify('PNG exported')
    },
  },
]

function bumpFont(dir: 1 | -1) {
  const steps = [9, 10, 11, 12, 13, 14, 16, 18, 21, 24, 30, 36, 48]
  const s = S()
  const node = s.scene.nodes.find((n) => s.selection.nodes.includes(n.id))
  const cur = node?.style.fontSize ?? s.lastNodeStyle.fontSize
  let idx = steps.findIndex((v) => v >= cur)
  if (idx < 0) idx = steps.length - 1
  const next = steps[Math.min(steps.length - 1, Math.max(0, idx + dir))]
  s.styleNodes({ fontSize: next })
  for (const id of s.selection.nodes) s.fitNodeHeight(id)
}

function toggleNodeStyle(key: 'bold' | 'mono') {
  const s = S()
  const node = s.scene.nodes.find((n) => s.selection.nodes.includes(n.id))
  const cur = node?.style[key] ?? s.lastNodeStyle[key]
  s.styleNodes({ [key]: !cur })
}

function worldPointer() {
  const { viewport } = S()
  return {
    x: (env.pointer.x - viewport.x) / viewport.k,
    y: (env.pointer.y - viewport.y) / viewport.k,
  }
}

/* --------------------------------------------------------------- keys */

const CODE_MAP: Record<string, string> = {
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Slash: '/',
  Minus: '-',
  Equal: '=',
  Comma: ',',
  Period: '.',
  Backquote: '`',
  Semicolon: ';',
  Quote: "'",
}

export function eventCombo(e: KeyboardEvent): string {
  let key: string
  if (/^Key[A-Z]$/.test(e.code)) key = e.code.slice(3).toLowerCase()
  else if (/^Digit[0-9]$/.test(e.code)) key = e.code.slice(5)
  else if (/^Numpad[0-9]$/.test(e.code)) key = e.code.slice(6)
  else if (CODE_MAP[e.code]) key = CODE_MAP[e.code]
  else key = e.key.toLowerCase()

  const parts: string[] = []
  if (isMac ? e.metaKey : e.ctrlKey) parts.push('mod')
  if (isMac ? e.ctrlKey : e.metaKey) parts.push('ctrl')
  if (e.altKey) parts.push('alt')
  if (e.shiftKey) parts.push('shift')
  parts.push(key)
  return parts.join('+')
}

const SYMBOLS: Record<string, string> = {
  mod: isMac ? '⌘' : 'Ctrl',
  alt: isMac ? '⌥' : 'Alt',
  shift: isMac ? '⇧' : 'Shift',
  ctrl: isMac ? '⌃' : 'Ctrl',
  enter: '↵',
  escape: 'Esc',
  backspace: '⌫',
  delete: 'Del',
  tab: '⇥',
  arrowup: '↑',
  arrowdown: '↓',
  arrowleft: '←',
  arrowright: '→',
  ' ': 'Space',
}

export function comboLabel(combo: string): string[] {
  return combo.split('+').map((part) => SYMBOLS[part] ?? (part.length === 1 ? part.toUpperCase() : part))
}

/** Bare modifier glyphs, for prose that mentions a key without a full combo. */
export const MOD = SYMBOLS.mod
export const ALT = SYMBOLS.alt

/** Flat, platform-correct label for inline tooltips: "⌘⇧M" on mac, "Ctrl+Shift+M" elsewhere. */
export function keyLabel(combo: string): string {
  return comboLabel(combo).join(isMac ? '' : '+')
}

export const commandByCombo = new Map<string, Command>()
for (const c of COMMANDS) if (c.combo && !commandByCombo.has(c.combo)) commandByCombo.set(c.combo, c)

export const PALETTE_COMMANDS = COMMANDS.filter(
  (c) => !['edit.redo2', 'edit.delete2', 'build.spawnR'].includes(c.id),
)
