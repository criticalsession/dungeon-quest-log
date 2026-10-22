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
