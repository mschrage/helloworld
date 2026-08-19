import { useState } from 'react'
import { useStore } from '../state/store'
import { env } from '../state/env'
import { COMMANDS, keyLabel } from '../state/commands'
import { Icon } from './Icon'

const run = (id: string) => COMMANDS.find((c) => c.id === id)?.run()

export function TopBar({
  onPalette,
  onShortcuts,
}: {
  onPalette(): void
  onShortcuts(): void
}) {
  const title = useStore((s) => s.scene.title)
  const setTitle = useStore((s) => s.setTitle)
  const past = useStore((s) => s.past.length)
  const future = useStore((s) => s.future.length)
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)
  const [menu, setMenu] = useState(false)

  return (
    <header className="topbar" data-ui>
      <div className="brand">
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
          <rect x="1.4" y="2.4" width="8" height="5.6" rx="1" stroke="#3d3d3a" strokeWidth="1.1" />
          <rect x="10.6" y="12" width="8" height="5.6" rx="1" stroke="#3d3d3a" strokeWidth="1.1" />
          <path d="M5.4 8v4.6a2 2 0 0 0 2 2h3.2" stroke="#3d3d3a" strokeWidth="1.1" />
        </svg>
        <span>Vellum</span>
      </div>

      <input
        className="title-input"
        value={title}
        placeholder="Untitled diagram"
        onChange={(e) => setTitle(e.target.value)}
        spellCheck={false}
      />

      <div className="topbar-spacer" />

      <button className="tb-btn" onClick={onPalette} data-tip="Command palette" data-key={keyLabel('mod+k')}>
        <Icon name="search" size={17} />
        <span className="tb-label">Commands</span>
      </button>

      <div className="tb-group">
        <button
          className="tb-btn icon"
          disabled={!past}
          onClick={undo}
          data-tip="Undo"
          data-key={keyLabel('mod+z')}
          aria-label="Undo"
        >
          <Icon name="undo" size={17} />
        </button>
        <button
          className="tb-btn icon"
          disabled={!future}
          onClick={redo}
          data-tip="Redo"
          data-key={keyLabel('mod+shift+z')}
          aria-label="Redo"
        >
          <Icon name="redo" size={17} />
        </button>
      </div>

      <div className="tb-group">
        <button
          className="tb-btn icon"
          onClick={() => useStore.getState().fit(env.size)}
          data-tip="Zoom to fit"
          data-key="9"
          aria-label="Zoom to fit"
        >
          <Icon name="fit" size={17} />
        </button>
      </div>

      <div className="menu-anchor">
        <button
          className={`tb-btn${menu ? ' is-active' : ''}`}
          onClick={() => setMenu((v) => !v)}
          data-tip="File & export"
        >
          <Icon name="download" size={17} />
          <span className="tb-label">Export</span>
        </button>
        {menu && (
          <>
            <div className="menu-scrim" onClick={() => setMenu(false)} />
            <div className="menu">
              <button onClick={() => { run('file.svg'); setMenu(false) }}>
                <Icon name="download" size={16} /> Export SVG <kbd>{keyLabel('mod+e')}</kbd>
              </button>
              <button onClick={() => { run('file.png'); setMenu(false) }}>
                <Icon name="download" size={16} /> Export PNG 2× <kbd>{keyLabel('mod+shift+e')}</kbd>
              </button>
              <button onClick={() => { run('file.pngTransparent'); setMenu(false) }}>
                <Icon name="download" size={16} /> Export PNG transparent
              </button>
              <div className="menu-sep" />
              <button onClick={() => { run('file.save'); setMenu(false) }}>
                <Icon name="file" size={16} /> Save .json <kbd>{keyLabel('mod+s')}</kbd>
              </button>
              <button onClick={() => { run('file.open'); setMenu(false) }}>
                <Icon name="upload" size={16} /> Open .json <kbd>{keyLabel('mod+o')}</kbd>
              </button>
              <div className="menu-sep" />
              <button onClick={() => { run('file.new'); setMenu(false) }}>
                <Icon name="plus" size={16} /> New diagram
              </button>
            </div>
          </>
        )}
      </div>

      <button className="tb-btn icon" onClick={onShortcuts} data-tip="Keyboard shortcuts" data-key="?" aria-label="Shortcuts">
        <Icon name="help" size={17} />
      </button>
    </header>
  )
}
