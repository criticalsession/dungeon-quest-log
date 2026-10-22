# Dungeon Quest Log: implementation phases

Summary of the build order in `IMPLEMENTATION_PLAN.md` (section 10). Commit after each phase.

| # | Phase | What it delivers | Status |
|---|---|---|---|
| 1 | **Scaffold** | Vite React TS app, router, table and book layers with scaling, fonts, theme tokens, Docker setup, `run.bat` / `stop.bat` | Done |
| 2 | **Database** | `supabase/schema.sql`, README setup checklist, `.env.example`, keep-alive workflow | Not started |
| 3 | **Login** | Login page on the book, auth guard, name handling, "Close the book" | Not started |
| 4 | **Read path** | Store, initial load, quest list with ribbons and grouping, quest view, empty and sealed states | Not started |
| 5 | **Write path** | Create, amend (Tiptap), status buttons, archive and unarchive, all via RPC | Not started |
| 6 | **Locks** | Edit locks: acquire, heartbeat, release, lock display, lock-lost handling, unsaved-changes dialog | Not started |
| 7 | **Live sync** | Realtime subscription, refetch on reconnect and visibility, toasts, connection banner | Not started |
| 8 | **Polish** | Narrow-screen fallback, keyboard navigation, reduced motion, `CREDITS.md`, player README | Not started |
