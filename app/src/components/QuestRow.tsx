import { memo } from 'react'
import type { Quest } from '../store/quests'
import { ChevronIcon, StatusMarker } from './icons'

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
  onSelect,
}: {
  quest: Quest
  selected: boolean
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
      <StatusMarker status={quest.status} />
      <span className="qrow-text">
        <span className="qrow-title">{quest.title}</span>
        {meta && <span className="qrow-meta">{meta}</span>}
      </span>
      {selected && <ChevronIcon />}
    </button>
  )
})
