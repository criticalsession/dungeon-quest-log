import { createClient } from '@supabase/supabase-js'

export const PARTY_EMAIL = import.meta.env.VITE_PARTY_EMAIL as string

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
  {
    auth: { persistSession: true, autoRefreshToken: true },
    realtime: { params: { eventsPerSecond: 10 } },
  },
)

// The latest access token, kept where `pagehide` can read it without awaiting anything (plan 7.6).
let accessToken: string | null = null
supabase.auth.onAuthStateChange((_event, session) => {
  accessToken = session?.access_token ?? null
})
export const getAccessToken = () => accessToken
