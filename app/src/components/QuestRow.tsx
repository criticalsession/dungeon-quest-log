import { memo } from 'react'
import type { Quest } from '../store/quests'
import { ChevronIcon, PadlockIcon, StatusMarker } from './icons'

const metaLine = (q: Quest) =>
  [
    q.session_number !== null && `Session ${q.session_number}`,
    q.quest_giver && `from ${q.quest_giver}`,
    q.quest_location,
  ]
    .filter(Boolean)
    .join(' · ')

export const QuestRow = memo(function QuestRow({
  quest,
  selected,
  lockedBy,
  onSelect,
}: {
  quest: Quest
  selected: boolean
  /** Name of the player penning changes, when someone else holds the lock. */
  lockedBy?: string
  onSelect: (id: string) => void
}) {
  const meta = metaLine(quest)
  return (
    <button
      type="button"
      className={`qrow${selected ? ' qrow-selected' : ''}${quest.status === 'fulfilled' ? ' qrow-done' : ''}`}
      aria-current={selected ? 'true' : undefined}
      onClick={() => onSelect(quest.id)}
    >
      {lockedBy ? <PadlockIcon /> : <StatusMarker status={quest.status} />}
      <span className="qrow-text">
        <span className="qrow-title">{quest.title}</span>
        {lockedBy ? (
          <span className="qrow-meta qrow-lock">{lockedBy} is penning changes…</span>
        ) : (
          meta && <span className="qrow-meta">{meta}</span>
        )}
      </span>
      {selected && <ChevronIcon />}
    </button>
  )
})
