import { useQuests, type Quest, type QuestStatus } from '../store/quests'
import { getClientId } from './clientId'
import { trackOwnWrite } from './realtime'
import { getAccessToken, supabase } from './supabase'

export type QuestErrorCode = 'QUEST_LOCKED' | 'LOCK_NOT_HELD' | 'NOT_AUTHENTICATED' | 'NETWORK' | 'OTHER'

export class QuestError extends Error {
  code: QuestErrorCode
  constructor(code: QuestErrorCode, message: string) {
    super(message)
    this.code = code
  }
}

const KNOWN: QuestErrorCode[] = ['QUEST_LOCKED', 'LOCK_NOT_HELD', 'NOT_AUTHENTICATED']

/** Postgres errors carry our CAPS codes in the message; a fetch failure has no Postgres code at all. */
function toQuestError(error: { message: string; code?: string }): QuestError {
  const known = KNOWN.find((c) => error.message.includes(c))
  if (known) return new QuestError(known, error.message)
  return new QuestError(error.code ? 'OTHER' : 'NETWORK', error.message)
}

async function call<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw toQuestError(error)
  return data as T
}

/** Apply a row the database just returned, so this tab is right before the realtime event arrives. */
async function callQuest(fn: string, args: Record<string, unknown>): Promise<Quest> {
  const quest = await trackOwnWrite(() => call<Quest>(fn, args))
  useQuests.getState().upsertQuest(quest)
  return quest
}

export type QuestFields = {
  title: string
  description: string
  date_received: string | null
  session_number: number | null
  quest_giver: string
  location_received: string
  quest_location: string
}

const fieldArgs = (f: QuestFields) => ({
  p_title: f.title,
  p_description: f.description,
  p_date_received: f.date_received,
  p_session_number: f.session_number,
  p_quest_giver: f.quest_giver,
  p_location_received: f.location_received,
  p_quest_location: f.quest_location,
})

export const createQuest = (author: string, fields: QuestFields) =>
  callQuest('create_quest', { p_author: author, ...fieldArgs(fields) })

/** Saving also releases the lock, in the same transaction. */
export const saveQuest = (questId: string, author: string, fields: QuestFields) =>
  callQuest('save_quest', { p_quest_id: questId, p_client_id: getClientId(), p_author: author, ...fieldArgs(fields) })

export const setStatus = (questId: string, author: string, status: QuestStatus) =>
  callQuest('set_status', { p_quest_id: questId, p_client_id: getClientId(), p_author: author, p_status: status })

export const setArchived = (questId: string, author: string, archived: boolean) =>
  callQuest('set_archived', { p_quest_id: questId, p_client_id: getClientId(), p_author: author, p_archived: archived })

// Lock calls run one at a time: React StrictMode (and quick navigation) can fire a release
// right before an acquire, and out-of-order arrival would drop the lock we just took.
let lockQueue: Promise<unknown> = Promise.resolve()
const queued = <T>(job: () => Promise<T>): Promise<T> => {
  const run = lockQueue.then(job, job)
  lockQueue = run.catch(() => undefined)
  return run
}

// The quest this tab holds the edit lock on, so "Close the book" can give it up.
let heldQuestId: string | null = null

export const acquireLock = (questId: string, name: string) =>
  queued(async () => {
    await call<void>('acquire_lock', { p_quest_id: questId, p_client_id: getClientId(), p_name: name })
    heldQuestId = questId
  })

export const releaseLock = (questId: string) =>
  queued(async () => {
    if (heldQuestId === questId) heldQuestId = null
    await call<void>('release_lock', { p_quest_id: questId, p_client_id: getClientId() })
  })

export const releaseHeldLock = async () => {
  if (heldQuestId) await releaseLock(heldQuestId).catch(() => undefined)
}

/** False means the lock is gone: it expired and someone else took it. */
export const heartbeatLock = (questId: string) =>
  call<boolean>('heartbeat_lock', { p_quest_id: questId, p_client_id: getClientId() })

/** For `pagehide`, which can't await: a keepalive request outlives the page. */
export function releaseLockOnUnload(questId: string) {
  const token = getAccessToken()
  if (!token) return
  void fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/release_lock`, {
    method: 'POST',
    keepalive: true,
    headers: {
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_quest_id: questId, p_client_id: getClientId() }),
  }).catch(() => undefined)
}
