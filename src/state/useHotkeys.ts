import { useEffect } from 'react'
import { commandByCombo, eventCombo } from './commands'
import { selectionSize, useStore } from './store'
import { isTypingTarget } from '../canvas/Canvas'

interface Handlers {
  openPalette(): void
  openShortcuts(): void
  closeShortcuts(): void
  paletteOpen: boolean
  shortcutsOpen: boolean
}

const ARROWS: Record<string, [number, number]> = {
  arrowleft: [-1, 0],
  arrowright: [1, 0],
  arrowup: [0, -1],
  arrowdown: [0, 1],
}

export function useHotkeys({
  openPalette,
  openShortcuts,
  closeShortcuts,
  paletteOpen,
  shortcutsOpen,
}: Handlers) {
  useEffect(() => {
    let nudging = false

    const onKeyDown = (e: KeyboardEvent) => {
      const combo = eventCombo(e)

      if (combo === 'mod+k') {
        e.preventDefault()
        closeShortcuts()
        openPalette()
        return
      }
      if (paletteOpen) return

      // The key map is modal: dismiss it before anything else reaches the canvas.
      if (shortcutsOpen) {
        if (combo === 'escape' || combo === 'shift+/' || combo === '?') {
          e.preventDefault()
          closeShortcuts()
        }
        return
      }

      if (isTypingTarget(e.target)) return

      if (combo === 'shift+/' || combo === '?') {
        e.preventDefault()
        openShortcuts()
        return
      }

      const s = useStore.getState()

      // Arrow nudging (plain / shift for a big step, alt spawns instead).
      const bare = combo.replace(/^shift\+/, '')
      if (!e.altKey && !e.metaKey && !e.ctrlKey && ARROWS[bare]) {
        if (selectionSize(s.selection)) {
          e.preventDefault()
          if (!nudging) {
            s.begin()
            nudging = true
          }
          const step = e.shiftKey ? 10 : s.snapToGrid ? s.gridSize : 1
          const [dx, dy] = ARROWS[bare]
          s.nudge(dx * step, dy * step)
          return
        }
      }

      const cmd = commandByCombo.get(combo)
      if (!cmd) return

      // Tab only chains a new node when something is selected; otherwise let
      // the browser move focus.
      if (combo === 'tab' && !s.selection.nodes.length) return
      if (combo === 'enter' && !selectionSize(s.selection)) return

      e.preventDefault()
      cmd.run()
    }

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key.startsWith('Arrow')) nudging = false
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [openPalette, openShortcuts, closeShortcuts, paletteOpen, shortcutsOpen])
}
