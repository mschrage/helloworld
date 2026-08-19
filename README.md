# Vellum

A keyboard-first diagramming canvas for technical design — software architecture,
SDLC processes, control flow. Whites and greys, pencil-thin lines, no chrome you
didn't ask for.

```bash
npm install
npm run dev      # http://localhost:3000
npm run build
```

## The idea

Most diagram tools make you reach for the mouse for everything. Vellum is built so a
diagram grows out of typing: drop a shape, name it, press `⇥`, name the next one. The
connector, placement and spacing are inferred. Everything else — style, routing,
alignment, layout — is one keystroke away, and every command is in `⌘K`.

## Getting around

| | |
|---|---|
| New shape here | Double-click empty canvas |
| Chain the next shape | Type a label, then `⇥` (or `⌥←↑↓→` for a direction) |
| Link two shapes | Drag from a shape's side dot |
| Add & connect | Drag from a side dot onto empty canvas |
| Edit a label | Double-click a shape or connector, or `↵` |
| Pan | Space-drag · middle-drag · two-finger scroll |
| Zoom | `⌘`+scroll · pinch · `⌘=` / `⌘-` / `0` (100%) / `9` (fit) / `8` (selection) |
| Every command | `⌘K` |
| Full key map | `?` |

Fifteen shapes (`R` `⇧R` `⇧P` `O` `D` `X` `I` `S` `Q` `⇧D` `N` `U` `K` `T` `F`), seven
greys (`1`–`7`), three routings (`⇧1` `⇧2` `⇧3`), align and distribute on `⌥1`–`⌥8`,
and one-key auto-layout with `⌥L` / `⌥⇧L`.

Shortcuts are shown for macOS; on Windows and Linux they read `Ctrl` / `Alt` / `Shift`.

## What's in the box

- **Shapes** — box, rounded box, pill, ellipse, decision, hexagon, input/output, data
  store, queue, document, note, actor, cloud, free text and dashed grouping frames.
- **Connectors** — orthogonal, straight or curved, with side anchors that pick
  themselves, six end caps, dashed/dotted lines and inline labels.
- **Layout** — snapping to a dot grid with live alignment guides, align/distribute/
  match-size, z-ordering, and a layered auto-tidy that packs disconnected flows apart
  and re-wraps frames around whatever they were holding.
- **Ink** — a pressure-free pen for annotation, plus an eraser.
- **Export** — SVG and PNG (2× or transparent) with fonts embedded, so a download opens
  the same everywhere. Scenes save to `.vellum.json` and autosave to `localStorage`.

## How it's put together

No diagram library — the canvas is hand-rolled SVG so the line weights, silhouettes and
hit-testing stay under our control.

```
src/
  canvas/    Canvas.tsx      pointer gesture state machine, pan/zoom, overlays
             NodeView.tsx    shape + measured SVG text
             EdgeView.tsx    routed paths and end caps
             TextEditor.tsx  floating textarea matched to the SVG typography
  lib/       geometry.ts     silhouettes, boundary clipping, elbow routing
             layout.ts       Sugiyama-lite layered auto-layout
             snap.ts         grid + peer alignment guides
             text.ts         canvas-measured greedy word wrap
             theme.ts        the grey palette and per-shape defaults
             io.ts           SVG/PNG export, scene save/open
  state/     store.ts        zustand scene store with snapshot undo/redo
             commands.ts     the single command registry behind keys and ⌘K
             useHotkeys.ts   window key handling
  ui/        toolbar, inspector, top bar, palette, key map, status bar
```

Labels are laid out as real SVG `<text>` with canvas-measured word wrap rather than
`foreignObject`, because Chrome won't rasterise foreign content inside an exported SVG.
That one constraint is why the text pipeline exists.

Built with Vite, React and TypeScript.
