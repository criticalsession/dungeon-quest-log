import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { useQuests, type Lock, type Quest } from '../store/quests'
import { useToasts } from '../store/toasts'
import { getActiveName } from './playerName'
import { supabase } from './supabase'

// How long the channel may be down before the banner shows, so a quick blip stays quiet (plan 7.7).
const BANNER_DELAY_MS = 10_000
// A change by my own name this soon after one of my writes is taken to be my own echo.
const ECHO_MS = 5000

let writesInFlight = 0
let lastWriteDone = 0

/** Wrap an RPC that writes a quest, so its realtime echo doesn't toast the player who made it. */
export async function trackOwnWrite<T>(job: () => Promise<T>): Promise<T> {
  writesInFlight++
  try {
    return await job()
  } finally {
    writesInFlight--
    lastWriteDone = Date.now()
  }
}

const isOwnEcho = (row: Quest) =>
  row.updated_by_name === getActiveName() && (writesInFlight > 0 || Date.now() - lastWriteDone < ECHO_MS)

/** What changed between two copies of a quest, as a toast; null where the change deserves none. */
function describe(prev: Quest | undefined, next: Quest, inserted: boolean) {
  const who = next.updated_by_name
  if (!prev) return inserted ? { before: `${who} inscribed a new quest: `, title: next.title } : null
  if (!prev.archived && next.archived) return { before: `${who} archived `, title: next.title }
  if (prev.archived && !next.archived) return { before: `${who} returned `, title: next.title, after: ' to the log' }
  if (prev.status !== next.status) {
    if (next.status === 'fulfilled') return { before: `${who} marked `, title: next.title, after: ' as fulfilled' }
    if (next.status === 'on_hold') return { before: `${who} set aside `, title: next.title }
    return prev.status === 'fulfilled'
      ? { before: `${who} reopened `, title: next.title }
      : { before: `${who} took up `, title: next.title, after: ' again' }
  }
  return { before: `${who} amended `, title: next.title }
}

function onQuestEvent(payload: RealtimePostgresChangesPayload<Quest>) {
  if (payload.eventType === 'DELETE') return // the app never deletes (archive instead)
  const next = payload.new
  const store = useQuests.getState()
  const prev = store.quests[next.id]
  // Already known (an RPC reply or a refetch got here first): nothing new to show.
  if (prev && prev.version >= next.version) return
  store.upsertQuest(next)
  if (!store.loaded || isOwnEcho(next)) return
  const toast = describe(prev, next, payload.eventType === 'INSERT')
  if (toast) useToasts.getState().push(toast)
}

function onLockEvent(payload: RealtimePostgresChangesPayload<Lock>) {
  const { applyLock } = useQuests.getState()
  if (payload.eventType === 'DELETE') applyLock({ quest_id: payload.old.quest_id as string }, true)
  else applyLock(payload.new, false)
}

/** Subscribe to both tables and keep the store in step. Returns the function that stops it. */
export function startRealtime() {
  const { load, setConnection } = useQuests.getState()
  let bannerTimer: ReturnType<typeof setTimeout> | undefined

  const channel = supabase
    .channel('quest-log')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'quests' }, onQuestEvent)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'quest_locks' }, onLockEvent)
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(bannerTimer)
        bannerTimer = undefined
        setConnection('live')
        // Events may have been missed before the first subscription and during any gap.
        void load()
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        bannerTimer ??= setTimeout(() => setConnection('reconnecting'), BANNER_DELAY_MS)
      }
    })

  const onVisible = () => document.visibilityState === 'visible' && void load()
  document.addEventListener('visibilitychange', onVisible)

  return () => {
    clearTimeout(bannerTimer)
    document.removeEventListener('visibilitychange', onVisible)
    void supabase.removeChannel(channel)
  }
}
