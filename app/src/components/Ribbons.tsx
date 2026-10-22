import type { KeyboardEvent } from 'react'
import type { Tab } from '../store/quests'

export const TABS: { id: Tab; label: string; colour: string }[] = [
  { id: 'all', label: 'All quests', colour: 'var(--ribbon-all)' },
  { id: 'active', label: 'Active', colour: 'var(--status-active)' },
  { id: 'on_hold', label: 'On hold', colour: 'var(--status-hold)' },
  { id: 'fulfilled', label: 'Fulfilled', colour: 'var(--status-done)' },
  { id: 'archive', label: 'Archive', colour: 'var(--status-archive)' },
]

/** The filter tabs: silk ribbons tucked under the right cover. The selected one slides further out. */
export function Ribbons({ tab, onSelect }: { tab: Tab; onSelect: (tab: Tab) => void }) {
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const step = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0
    if (!step) return
    e.preventDefault()
    const next = TABS[(TABS.findIndex((t) => t.id === tab) + step + TABS.length) % TABS.length]
    onSelect(next.id)
    e.currentTarget.querySelector<HTMLElement>(`[data-tab="${next.id}"]`)?.focus()
  }

  return (
    <nav className="ribbons" aria-label="Filter the quests">
      <div role="tablist" aria-orientation="vertical" onKeyDown={onKeyDown}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            data-tab={t.id}
            aria-selected={t.id === tab}
            tabIndex={t.id === tab ? 0 : -1}
            className="ribbon"
            style={{ ['--ribbon-colour' as string]: t.colour }}
            onClick={() => onSelect(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
    </nav>
  )
}
