import { create } from 'zustand'
import { supabase } from '../lib/supabase'

export type QuestStatus = 'active' | 'on_hold' | 'fulfilled'

export type Quest = {
  id: string
  quest_number: number
  title: string
  description: string
  date_received: string | null
  session_number: number | null
  quest_giver: string | null
  location_received: string | null
  quest_location: string | null
  status: QuestStatus
  archived: boolean
  created_at: string
  created_by_name: string
  updated_at: string
  updated_by_name: string
  version: number
}

export type Lock = {
  quest_id: string
  client_id: string
  holder_name: string
  acquired_at: string
  expires_at: string
}

export type Connection = 'connecting' | 'live' | 'reconnecting' | 'sealed'

type State = {
  quests: Record<string, Quest>
  locks: Record<string, Lock>
  loaded: boolean
  connection: Connection
  /** Fetch both tables. Safe to call again: a call while one is running joins it. */
  load: () => Promise<void>
  /** Insert or replace one quest (a row an RPC returned). */
  upsertQuest: (quest: Quest) => void
  /** Forget everything (on "Close the book"). */
  reset: () => void
}

const empty = { quests: {}, locks: {}, loaded: false, connection: 'connecting' as Connection }

let inFlight: Promise<void> | null = null

export const useQuests = create<State>((set, get) => ({
  ...empty,

  load: () => {
    inFlight ??= (async () => {
      if (!get().loaded) set({ connection: 'connecting' })
      try {
        const [quests, locks] = await Promise.all([
          supabase.from('quests').select('*'),
          supabase.from('quest_locks').select('*'),
        ])
        if (quests.error || locks.error) throw quests.error ?? locks.error
        set({
          quests: Object.fromEntries((quests.data as Quest[]).map((q) => [q.id, q])),
          locks: Object.fromEntries((locks.data as Lock[]).map((l) => [l.quest_id, l])),
          loaded: true,
          connection: 'live',
        })
      } catch {
        // Unreachable, 5xx or a paused project all look the same to the player (plan 7.8).
        // Once loaded, a failed refetch keeps the data on screen; phase 7 handles reconnecting.
        if (!get().loaded) set({ connection: 'sealed' })
      }
    })().finally(() => {
      inFlight = null
    })
    return inFlight
  },

  upsertQuest: (quest) =>
    set((s) => {
      const known = s.quests[quest.id]
      // Never go backwards if a newer copy (from a realtime event) got here first.
      if (known && known.version > quest.version) return s
      return { quests: { ...s.quests, [quest.id]: quest } }
    }),

  reset: () => set(empty),
}))

// ── Selectors ──────────────────────────────────────────────────────────────

export type Tab = 'all' | 'active' | 'on_hold' | 'fulfilled' | 'archive'

export const STATUS_ORDER: QuestStatus[] = ['active', 'on_hold', 'fulfilled']
export const STATUS_LABEL: Record<QuestStatus, string> = {
  active: 'Active',
  on_hold: 'On hold',
  fulfilled: 'Fulfilled',
}

/** Ascending, with missing values last. */
const compare = (a: string | number | null, b: string | number | null) =>
  a === b ? 0 : a === null ? 1 : b === null ? -1 : a < b ? -1 : 1

/** Oldest first: session, then date received, then creation order (plan 7.3). */
const byAge = (a: Quest, b: Quest) =>
  compare(a.session_number, b.session_number) ||
  compare(a.date_received, b.date_received) ||
  a.quest_number - b.quest_number

export type Group = {
  key: string
  /** Set only where the group gets a header ("Active · 4"). */
  status: QuestStatus | null
  quests: Quest[]
}

/** The groups shown for a ribbon: three headed groups for All, one bare group otherwise. */
export function groupsForTab(quests: Record<string, Quest>, tab: Tab): Group[] {
  const all = Object.values(quests).sort(byAge)
  if (tab === 'archive') return [{ key: tab, status: null, quests: all.filter((q) => q.archived) }]
  const live = all.filter((q) => !q.archived)
  if (tab !== 'all') return [{ key: tab, status: null, quests: live.filter((q) => q.status === tab) }]
  return STATUS_ORDER.map((status) => ({
    key: status,
    status,
    quests: live.filter((q) => q.status === status),
  })).filter((g) => g.quests.length > 0)
}

/** The live lock on a quest that someone else holds (mine, or an expired one, doesn't count). */
export function lockHeldByOther(locks: Record<string, Lock>, questId: string, myClientId: string, now = Date.now()) {
  const lock = locks[questId]
  return lock && lock.client_id !== myClientId && new Date(lock.expires_at).getTime() > now ? lock : undefined
}
