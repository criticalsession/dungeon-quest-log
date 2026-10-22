import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Flourish } from '../components/Flourish'
import { BLANK, QuestEditor } from '../components/QuestEditor'
import { QuestView } from '../components/QuestView'
import { getActiveName } from '../lib/playerName'
import {
  acquireLock,
  createQuest,
  heartbeatLock,
  QuestError,
  releaseLock,
  releaseLockOnUnload,
  saveQuest,
  type QuestFields,
} from '../lib/questApi'
import { supabase } from '../lib/supabase'
import { useUnsavedGuard } from '../lib/useUnsavedGuard'
import { useQuests, type Quest } from '../store/quests'
import { useToasts } from '../store/toasts'

const SAVE_FAILED = 'Your words could not reach the archive. Try again.'

const fieldsOf = (q: Quest): QuestFields => ({
  title: q.title,
  description: q.description,
  date_received: q.date_received,
  session_number: q.session_number,
  quest_giver: q.quest_giver ?? '',
  location_received: q.location_received ?? '',
  quest_location: q.quest_location ?? '',
})

function NotFound() {
  const { search } = useLocation()
  return (
    <div className="notice">
      <p>No such quest is written here.</p>
      <Link className="btn btn-secondary" to={`/${search}`}>
        Return to the log
      </Link>
    </div>
  )
}

/** Right page with nothing selected (`#/`). */
export function EmptyQuestPage() {
  return (
    <section className="page page-right">
      <div className="empty-state">
        <Flourish />
        <p>Choose a quest from the log, or inscribe a new one.</p>
      </div>
    </section>
  )
}

/** Right page for `#/quest/:id`. */
export function QuestPage() {
  const { id } = useParams()
  const quest = useQuests((s) => (id ? s.quests[id] : undefined))
  // Someone else archiving the quest while it is open leaves it open, with a note (plan 7.4).
  const wasArchived = useRef(quest?.archived)
  const [archivedBy, setArchivedBy] = useState<string | null>(null)
  useEffect(() => setArchivedBy(null), [id])
  useEffect(() => {
    if (quest && !wasArchived.current && quest.archived && quest.updated_by_name !== getActiveName()) {
      setArchivedBy(quest.updated_by_name)
    }
    if (!quest?.archived) setArchivedBy(null)
    wasArchived.current = quest?.archived
  }, [quest])

  return (
    <section className="page page-right">
      {quest ? <QuestView quest={quest} archivedBy={archivedBy} /> : <NotFound />}
    </section>
  )
}

/** Right page for `#/new`. Nothing exists yet, so there is no lock to take. */
export function NewQuestPage() {
  const navigate = useNavigate()
  const { search } = useLocation()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [dirty, setDirty] = useState(false)
  const allow = useRef(false)
  const blocker = useUnsavedGuard(dirty, allow)

  async function save(fields: QuestFields) {
    setSaving(true)
    setError('')
    try {
      const quest = await createQuest(getActiveName(), fields)
      allow.current = true
      navigate(`/quest/${quest.id}${search}`)
    } catch {
      setError(SAVE_FAILED)
      setSaving(false)
    }
  }

  return (
    <section className="page page-right">
      <QuestEditor
        initial={BLANK}
        saving={saving}
        canSave
        banner={error && <p className="form-error" role="alert">{error}</p>}
        onDirtyChange={setDirty}
        onSave={save}
        onAbandon={() => navigate(`/${search}`)}
      />
      <ConfirmDialog open={blocker.state === 'blocked'} onKeep={() => blocker.reset?.()} onAbandon={() => blocker.proceed?.()} />
    </section>
  )
}

type EditState =
  | { kind: 'acquiring' }
  | { kind: 'ready'; initial: QuestFields }
  | { kind: 'locked'; message: string }

/** Right page for `#/quest/:id/edit`. Takes the edit lock when it opens and gives it up when it closes. */
export function EditQuestPage() {
  const { id } = useParams()
  const { search } = useLocation()
  const navigate = useNavigate()
  const exists = useQuests((s) => !!(id && s.quests[id]))
  const [state, setState] = useState<EditState>({ kind: 'acquiring' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [lockLost, setLockLost] = useState(false)
  const [dirty, setDirty] = useState(false)
  // save_quest releases the lock itself; otherwise leaving the page does.
  const sealed = useRef(false)
  const blocker = useUnsavedGuard(dirty, sealed)
  const ready = state.kind === 'ready'

  // Keep the hold alive while editing, and check it as soon as the tab is looked at again (plan 7.6).
  useEffect(() => {
    if (!id || !ready) return
    let stopped = false
    const beat = () => {
      heartbeatLock(id).then(
        (held) => {
          if (!held && !stopped) setLockLost(true)
        },
        () => undefined, // a network blip: the next beat tries again
      )
    }
    const timer = setInterval(beat, 30_000)
    const onVisible = () => document.visibilityState === 'visible' && beat()
    // The page can't await anything while it closes; a keepalive request carries the release out.
    const onHide = () => {
      if (!sealed.current) releaseLockOnUnload(id)
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('pagehide', onHide)
    return () => {
      stopped = true
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('pagehide', onHide)
    }
  }, [id, ready])

  useEffect(() => {
    if (!id || !exists) return
    let cancelled = false
    sealed.current = false
    acquireLock(id, getActiveName()).then(
      () => {
        // The draft starts from the store as it is now and is never refreshed afterwards.
        const quest = useQuests.getState().quests[id]
        if (!cancelled && quest) setState({ kind: 'ready', initial: fieldsOf(quest) })
      },
      async (e: unknown) => {
        if (cancelled) return
        let message = SAVE_FAILED
        if (e instanceof QuestError && e.code === 'QUEST_LOCKED') {
          const { data } = await supabase.from('quest_locks').select('holder_name').eq('quest_id', id).maybeSingle()
          message = `${data?.holder_name ?? 'Someone'} is already penning changes to this quest.`
        }
        if (cancelled) return
        if (message.endsWith('to this quest.')) {
          // Plan 7.6: back to the quest view with a toast.
          useToasts.getState().push({ before: message })
          navigate(`/quest/${id}${search}`, { replace: true })
        } else setState({ kind: 'locked', message })
      },
    )
    return () => {
      cancelled = true
      if (!sealed.current) releaseLock(id).catch(() => undefined)
    }
  }, [id, exists, navigate, search])

  if (!id || !exists) {
    return (
      <section className="page page-right">
        <NotFound />
      </section>
    )
  }

  const view = `/quest/${id}${search}`

  async function save(fields: QuestFields) {
    setSaving(true)
    setError('')
    try {
      await saveQuest(id!, getActiveName(), fields)
      sealed.current = true
      navigate(view)
    } catch (e) {
      if (e instanceof QuestError && e.code === 'LOCK_NOT_HELD') setLockLost(true)
      else setError(SAVE_FAILED)
      setSaving(false)
    }
  }

  return (
    <section className="page page-right">
      {state.kind === 'locked' && (
        <div className="notice">
          <p>{state.message}</p>
          <Link className="btn btn-secondary" to={view}>
            Return to the quest
          </Link>
        </div>
      )}
      {state.kind === 'ready' && (
        <QuestEditor
          initial={state.initial}
          saving={saving}
          canSave={!lockLost}
          banner={
            lockLost ? (
              <p className="form-error" role="alert">
                Your hold on this page lapsed and someone else has taken up the pen. Your changes can’t be sealed.
              </p>
            ) : (
              error && <p className="form-error" role="alert">{error}</p>
            )
          }
          extraActions={(draft) =>
            lockLost && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  const div = document.createElement('div')
                  div.innerHTML = draft.description
                  void navigator.clipboard?.writeText(div.textContent ?? '')
                }}
              >
                Copy my text
              </button>
            )
          }
          onDirtyChange={setDirty}
          onSave={save}
          onAbandon={() => navigate(view)}
        />
      )}
      <ConfirmDialog open={blocker.state === 'blocked'} onKeep={() => blocker.reset?.()} onAbandon={() => blocker.proceed?.()} />
    </section>
  )
}
