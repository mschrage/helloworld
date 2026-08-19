import { useEffect, useMemo, useRef, useState } from 'react'
import { comboLabel, PALETTE_COMMANDS } from '../state/commands'
import type { Command } from '../state/commands'

/** Subsequence match with a light score — good enough, and instant. */
function score(cmd: Command, q: string): number {
  if (!q) return 1
  const hay = `${cmd.group} ${cmd.title} ${cmd.alias ?? ''}`.toLowerCase()
  const title = cmd.title.toLowerCase()
  if (title.startsWith(q)) return 1000
  if (title.includes(q)) return 700 - title.indexOf(q)
  if (hay.includes(q)) return 400
  let i = 0
  let hits = 0
  for (const ch of hay) {
    if (ch === q[i]) {
      i++
      hits++
      if (i === q.length) break
    }
  }
  return i === q.length ? 100 + hits : -1
}

export function CommandPalette({ onClose }: { onClose(): void }) {
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return PALETTE_COMMANDS.map((c) => ({ c, s: score(c, needle) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 40)
      .map((r) => r.c)
  }, [q])

  useEffect(() => setActive(0), [q])

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('[data-active="true"]')
    el?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const commit = (cmd: Command | undefined) => {
    if (!cmd) return
    onClose()
    // Let the palette unmount before the command touches focus/selection.
    requestAnimationFrame(() => cmd.run())
  }

  return (
    <div className="palette-scrim" data-ui onPointerDown={onClose}>
      <div className="palette" onPointerDown={(e) => e.stopPropagation()}>
        <div className="palette-field">
          <input
            ref={inputRef}
            value={q}
            placeholder="Search commands…"
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation()
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActive((i) => Math.min(results.length - 1, i + 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActive((i) => Math.max(0, i - 1))
              } else if (e.key === 'Enter') {
                e.preventDefault()
                commit(results[active])
              } else if (e.key === 'Escape') {
                e.preventDefault()
                onClose()
              }
            }}
          />
        </div>
        <div className="palette-list" ref={listRef}>
          {results.length === 0 && <div className="palette-empty">No commands match “{q}”.</div>}
          {results.map((c, i) => (
            <button
              key={c.id}
              data-active={i === active}
              className={`palette-item${i === active ? ' is-active' : ''}`}
              onPointerEnter={() => setActive(i)}
              onClick={() => commit(c)}
            >
              <span className="palette-group">{c.group}</span>
              <span className="palette-title">{c.title}</span>
              {c.combo && (
                <span className="palette-keys">
                  {comboLabel(c.combo).map((k, j) => (
                    <kbd key={j}>{k}</kbd>
                  ))}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
