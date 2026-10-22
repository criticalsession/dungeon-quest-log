import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { formatLongDate, formatRelative } from '../lib/dates'
import { questKicker } from '../lib/ordinal'
import { getActiveName } from '../lib/playerName'
import { QuestError, setArchived, setStatus } from '../lib/questApi'
import { sanitizeHtml } from '../lib/sanitize'
import { useNow } from '../lib/useNow'
import { getClientId } from '../lib/clientId'
import { lockHeldByOther, useQuests, type Quest, type QuestStatus } from '../store/quests'
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

type Action = { label: string; run: (id: string, name: string) => Promise<unknown> }

const toStatus = (label: string, status: QuestStatus): Action => ({ label, run: (id, name) => setStatus(id, name, status) })
const toArchived = (label: string, archived: boolean): Action => ({ label, run: (id, name) => setArchived(id, name, archived) })

/** The buttons that apply to this quest's state (plan 7.4). */
function actionsFor(q: Quest): Action[] {
  if (q.archived) return [toArchived('Return to the log', false)]
  if (q.status === 'active') return [toStatus('Mark fulfilled', 'fulfilled'), toStatus('Set aside', 'on_hold'), toArchived('Archive', true)]
  if (q.status === 'on_hold') return [toStatus('Take up again', 'active'), toStatus('Mark fulfilled', 'fulfilled'), toArchived('Archive', true)]
  return [toStatus('Reopen the quest', 'active'), toArchived('Archive', true)]
}

function QuestActions({ quest }: { quest: Quest }) {
  const navigate = useNavigate()
  const { search } = useLocation()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const locks = useQuests((s) => s.locks)
  const now = useNow(15_000)
  const holder = lockHeldByOther(locks, quest.id, getClientId(), now)?.holder_name
  const lockedTitle = holder ? `${holder} is penning changes` : undefined

  async function perform(action: Action) {
    setBusy(true)
    setError('')
    try {
      await action.run(quest.id, getActiveName())
    } catch (e) {
      setError(
        e instanceof QuestError && e.code === 'QUEST_LOCKED'
          ? 'Someone is penning changes to this quest. Try again in a moment.'
          : 'Your words could not reach the archive. Try again.',
      )
    }
    setBusy(false)
  }

  return (
    <>
      {holder && <p className="lock-note">{holder} is penning changes…</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="quest-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || !!holder}
          title={lockedTitle}
          onClick={() => navigate(`/quest/${quest.id}/edit${search}`)}
        >
          Amend
        </button>
        {actionsFor(quest).map((a) => (
          <button
            key={a.label}
            type="button"
            className="btn btn-secondary"
            disabled={busy || !!holder}
            title={lockedTitle}
            onClick={() => void perform(a)}
          >
            {a.label}
          </button>
        ))}
      </div>
    </>
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
      <QuestActions quest={quest} />
      <p className="quest-foot">
        Last amended by {quest.updated_by_name}, {formatRelative(quest.updated_at, now)}
      </p>
    </article>
  )
}
