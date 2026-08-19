import { useCallback, useEffect, useRef, useState } from 'react'
import { Canvas } from './canvas/Canvas'
import { keyLabel } from './state/commands'
import { Toolbar } from './ui/Toolbar'
import { Inspector } from './ui/Inspector'
import { TopBar } from './ui/TopBar'
import { StatusBar } from './ui/StatusBar'
import { CommandPalette } from './ui/CommandPalette'
import { ShortcutsSheet } from './ui/ShortcutsSheet'
import { useHotkeys } from './state/useHotkeys'
import { useStore } from './state/store'
import { env } from './state/env'

const SEEN_KEY = 'vellum.seen.v1'

export default function App() {
  const [palette, setPalette] = useState(false)
  const [shortcuts, setShortcuts] = useState(false)
  const [hint, setHint] = useState(() => !localStorage.getItem(SEEN_KEY))
  const rootRef = useRef<HTMLDivElement>(null)
  const toast = useStore((s) => s.toast)

  const onSize = useCallback((s: { w: number; h: number }) => {
    env.size = s
  }, [])

  useEffect(() => {
    env.svg = rootRef.current?.querySelector('svg.canvas') ?? null
  }, [])

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const el = env.svg
      if (!el) return
      const r = el.getBoundingClientRect()
      env.pointer = { x: e.clientX - r.left, y: e.clientY - r.top }
    }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  // Frame the starter scene once the canvas has real dimensions.
  useEffect(() => {
    const id = requestAnimationFrame(() => useStore.getState().fit(env.size))
    return () => cancelAnimationFrame(id)
  }, [])

  const dismissHint = () => {
    setHint(false)
    localStorage.setItem(SEEN_KEY, '1')
  }

  useHotkeys({
    openPalette: () => setPalette(true),
    openShortcuts: () => setShortcuts((v) => !v),
    closeShortcuts: () => setShortcuts(false),
    paletteOpen: palette,
    shortcutsOpen: shortcuts,
  })

  return (
    <div className="app" ref={rootRef}>
      <TopBar onPalette={() => setPalette(true)} onShortcuts={() => setShortcuts(true)} />
      <main className="stage">
        <Canvas onSize={onSize} />
        <Toolbar />
        <Inspector />
        <StatusBar />

        {hint && (
          <div className="hint" data-ui>
            <p>
              <strong>Draw fast.</strong> Double-click anywhere to drop a shape, type its name, then
              press <kbd>⇥</kbd> to chain the next one. Drag from a shape’s side dot to link it.
            </p>
            <p className="hint-sub">
              <kbd>{keyLabel('mod+k')}</kbd> for every command · <kbd>?</kbd> for the key map
            </p>
            <button onClick={dismissHint} aria-label="Dismiss">Got it</button>
          </div>
        )}

        {toast && (
          <div className="toast" key={toast.id}>
            {toast.text}
          </div>
        )}
      </main>

      {palette && <CommandPalette onClose={() => setPalette(false)} />}
      {shortcuts && <ShortcutsSheet onClose={() => setShortcuts(false)} />}
    </div>
  )
}
