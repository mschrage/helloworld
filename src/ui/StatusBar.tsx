import { useStore, selectionSize } from '../state/store'
import { env } from '../state/env'
import { keyLabel } from '../state/commands'
import { Icon } from './Icon'

export function StatusBar() {
  const k = useStore((s) => s.viewport.k)
  const selection = useStore((s) => s.selection)
  const scene = useStore((s) => s.scene)
  const showGrid = useStore((s) => s.showGrid)
  const snap = useStore((s) => s.snapToGrid)
  const store = useStore.getState()
  const count = selectionSize(selection)

  return (
    <div className="statusbar" data-ui>
      <div className="status-group">
        <button
          className="status-btn"
          onClick={() => store.zoomTo(k / 1.25, env.size)}
          data-tip="Zoom out"
          aria-label="Zoom out"
        >
          <Icon name="zoomOut" size={16} />
        </button>
        <button className="status-zoom" onClick={() => store.zoomTo(1, env.size)} data-tip="Reset to 100%" data-key="0">
          {Math.round(k * 100)}%
        </button>
        <button
          className="status-btn"
          onClick={() => store.zoomTo(k * 1.25, env.size)}
          data-tip="Zoom in"
          aria-label="Zoom in"
        >
          <Icon name="zoomIn" size={16} />
        </button>
      </div>

      <div className="status-group">
        <button
          className={`status-btn${showGrid ? ' is-on' : ''}`}
          onClick={store.toggleGrid}
          data-tip="Dot grid"
          data-key="G"
          aria-label="Toggle grid"
        >
          <Icon name="grid" size={16} />
        </button>
        <button
          className={`status-btn${snap ? ' is-on' : ''}`}
          onClick={store.toggleSnap}
          data-tip="Snapping"
          data-key={keyLabel('shift+g')}
          aria-label="Toggle snapping"
        >
          <Icon name="magnet" size={16} />
        </button>
      </div>

      <div className="status-meta">
        {count > 0 ? (
          <>
            <strong>{count}</strong> selected
          </>
        ) : (
          <>
            {scene.nodes.length} shapes · {scene.edges.length} links
          </>
        )}
      </div>
    </div>
  )
}
