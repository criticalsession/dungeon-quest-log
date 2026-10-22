import { useMemo } from 'react'
import { formatLongDate, formatRelative } from '../lib/dates'
import { questKicker } from '../lib/ordinal'
import { sanitizeHtml } from '../lib/sanitize'
import { useNow } from '../lib/useNow'
import type { Quest } from '../store/quests'
import { WaxSeal } from './WaxSeal'

function LedgerRow({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`ledger-row${wide ? ' ledger-wide' : ''}`}>
      <dt>{label}</dt>
      <span className="ledger-leader" aria-hidden="true" />
      <dd>{value}</dd>
    </div>
  )
}

export function QuestView({ quest }: { quest: Quest }) {
  const now = useNow(60_000)
  const html = useMemo(() => sanitizeHtml(quest.description), [quest.description])

  const rows = [
    quest.date_received && <LedgerRow key="date" label="Received" value={formatLongDate(quest.date_received)} />,
    quest.session_number !== null && <LedgerRow key="session" label="Session" value={String(quest.session_number)} />,
    quest.quest_giver && <LedgerRow key="giver" label="Given by" value={quest.quest_giver} />,
    quest.location_received && <LedgerRow key="at" label="Received at" value={quest.location_received} />,
    quest.quest_location && <LedgerRow key="where" label="Quest location" value={quest.quest_location} wide />,
  ].filter(Boolean)

  return (
    <article className="quest-view">
      <header className="quest-head">
        <div>
          <p className="kicker">{questKicker(quest.quest_number)}</p>
          <h2 className="quest-title">{quest.title}</h2>
        </div>
        <WaxSeal status={quest.status} archived={quest.archived} />
      </header>
      {rows.length > 0 && <dl className="ledger">{rows}</dl>}
      {html && <div className="description" dangerouslySetInnerHTML={{ __html: html }} />}
      {/* Action buttons (Amend, status, archive) arrive with the write path (phase 5). */}
      <p className="quest-foot">
        Last amended by {quest.updated_by_name}, {formatRelative(quest.updated_at, now)}
      </p>
    </article>
  )
}
