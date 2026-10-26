# AGENTS.md

Guidance for anyone (human or agent) changing this repo. **`docs/IMPLEMENTATION_PLAN.md` is the source of truth**: when it conflicts with the mockup (`docs/design/tome-mockup.html`), the plan wins. Build order is in plan section 10; commit after each step.

## Status

- Steps 1 (scaffold), 2 (database), 3 (login), 4 (read path), 5 (write path) and 6 (locks) are done; the real Supabase project is set up and `app/.env` holds real values. Step 3 was checked by the owner by hand (login, reload, "Close the book"); only the rate-limit message is untested. Step 4 was checked in the browser with mocked data only (see the plan); the owner should look at it with real quests. Step 5 was checked in the browser with mocked RPC calls only (see the plan); it has not been tried against the real database or with two browsers. Step 6 was checked by the owner with two browsers on the real project (lock items of the acceptance test; B needed a reload to see changes). Step 7 (live sync) was checked by the owner with two browsers on the real project. Step 8 (polish) is partly done: narrow layout, ribbon keys, `CREDITS.md` and the player README are written and the narrow log was checked at 390 px with mocked data; see plan section 10 for what is still unchecked.
- `LoginPage` and the log are real. `LogPage` is the layout route for `#/` and `#/quest/:id`: ribbons (`Ribbons`), left page (`QuestList`), "Close the book" in the left page footer, and the right page through `<Outlet />` (`EmptyQuestPage`, `QuestPage` in `pages/QuestPage.tsx`). "Inscribe a quest" goes to `#/new`; `QuestView` has the Amend, status and archive buttons.
- Write path: all writes go through `lib/questApi.ts` (RPC wrappers; errors become `QuestError` with a `code`). It puts each returned row in the store (`upsertQuest`, which ignores an older `version`), so this tab is right before phase 7's realtime events arrive. `EditQuestPage` acquires the lock on open and releases it on unmount unless `save_quest` already did; lock calls are serialised in `questApi` because React StrictMode fires release before acquire. The editor (`QuestEditor`) copies its starting values once and keeps its own draft, so store updates never touch it. 
- Locks (phase 6): `EditQuestPage` heartbeats every 30 s and on `visibilitychange`, releases on `pagehide` (`releaseLockOnUnload`, a keepalive fetch using the token `supabase.ts` keeps from `onAuthStateChange`), and shows the lock-lost banner when a beat returns false. `lib/useUnsavedGuard.ts` holds one module-level "unsaved" flag: it drives `useBlocker` (only blocks a change of path; set `allow.current` before a navigation that must pass), `beforeunload`, and the same question when "Close the book" is pressed with a dirty draft (`LogPage` renders its own `ConfirmDialog`). `closeTheBook` releases the held lock first (`releaseHeldLock`). `QuestRow`/`QuestView` show others' locks; `useNow(15_000)` makes expired ones vanish. Mind that the app has several `dialog.confirm` elements in the DOM (one per page that uses it) when testing.
- Live sync (phase 7): `lib/realtime.ts` `startRealtime()` runs from `LogPage`; realtime events go through `upsertQuest` (version guard) and `applyLock`; `load()` refetches on every `SUBSCRIBED` and on `visibilitychange` and never lowers a row's version. Toasts: `store/toasts.ts` + `components/Toasts.tsx` (in `Stage`, outside the book, with the connection banner). Own writes are wrapped by `trackOwnWrite` so their echo doesn't toast. The `/edit` lock refusal now toasts and returns to the view.
- `QuestView`: only `.description` scrolls (book mode); head, ledger, buttons and the "Last amended" line stay fixed. `.quest-head` has padding so the tilted seal is not clipped or wider than the page. Narrow mode lets the whole column scroll.
- Narrow layout (phase 8): `Stage` uses `matchMedia` (`max-width: 899px` or portrait) and renders `.stage-narrow` without the book image or transform; `styles/narrow.css` overrides the page, ribbon and type rules with real pixels. Keep new page CSS working in both modes.
- Store is `store/quests.ts` (zustand): quests, locks, `loaded`, `connection`, `load()` (one fetch of both tables, joins one already running), `reset()` (called by `closeTheBook`), plus the grouping/sorting and lock selectors. `connection` is driven by the realtime channel status after the first load.
- The ribbon filter lives in `?tab=` (`all` is omitted from the URL; values `active`, `on_hold`, `fulfilled`, `archive`) and is carried along when picking a quest. The log route has `shouldRevalidate: () => false` so changing it doesn't re-run `requireLogin`.
- Auth guard is route loaders in `lib/auth.ts` (`requireLogin` on the log routes, `skipLoginIfSignedIn` on login). The active name lives in `sessionStorage['dql.name']`, the pre-fill name in `localStorage['dql.lastName']` (`lib/playerName.ts`). A new tab has a session but no name, so it asks for the name again, as designed.
- Shared button classes (`.btn`, `.btn-primary`, `.btn-secondary`) and form styles are in `styles/book.css`; the log's styles (ribbons, list, quest view, seal) are in `styles/log.css`.
- Ordinals above 999 have no words: `toOrdinalWords` returns `null` and `questKicker` gives "Quest 1000". 101 reads "one hundred first" (no "and").

## Commands

All app commands run from `app/`.

| Task | Command |
|---|---|
| Dev server | `npm run dev` |
| Production build (typecheck + bundle) | `npm run build` |
| Tests | `npm test` (vitest; `lib/ordinal.ts` has its tests) |
| Run the real thing | double-click `run.bat` (Docker Desktop must already be running) |
| Stop | `stop.bat` |
| Player demo video | see `tools/demo/README.md` (fakes Supabase in the browser; output goes to the ignored `demo/`) |

### Windows gotchas

- **`npm run build` can fail on the `&&` in the script** if npm's `script-shell` is `powershell` (it is on the owner's PC; Windows PowerShell 5 has no `&&`). Locally use `npm run build --script-shell=cmd.exe`. Don't "fix" this in `package.json` or add a project `.npmrc`: Docker builds on Alpine, where `cmd.exe` doesn't exist.
- The Bash tool's `node` shim may be broken. Use PowerShell for node/npm/docker.
- Very large multi-file shell heredocs failed to parse in Bash. Use the Write tool for files.
- `.bat` files must keep **CRLF** line endings. After editing one, normalise it (git warns about LF to CRLF; that's fine for other files).
- Don't use `timeout` in `.bat` files (fails without a console). If a wait is ever needed, use `ping -n N 127.0.0.1 >nul`.

## Decisions made while building (not in the plan, or changed from it)

- **Port:** `QUESTLOG_PORT` lives in the root `.env` (committed), default **47218**, not 8080. Docker Compose reads that file automatically and `run.bat` parses it to open the browser. Players change it there if the port is taken. Plan 8.6 and 8.7 were updated to match.
- **`run.bat` never starts Docker Desktop.** If `docker info` fails it prints a message and pauses.
- There are two `.env` files with different jobs: root `.env` (port only) and `app/.env` (Supabase URL, publishable key, party email, all `VITE_*`). `app/.env` holds the real project values (the publishable key is public by design). Both are committed on purpose; never put secrets in either.
- Dependencies are the latest at install time: React 19, react-router 8, Vite 8, TypeScript 7, zustand 5, Tiptap 3. Check release notes if an API in the plan looks outdated (`createHashRouter` and `useBlocker` are imported from `react-router`, not `react-router-dom`).
- `app/tsconfig.tsbuildinfo` is ignored (`*.tsbuildinfo` in `.gitignore`).

## Architecture notes that are easy to get wrong

- **Two image layers.** The table (`tome-table.webp`) is the `body` background, `cover`, full-bleed, no blur. The book (`tome-book.webp`, transparent, no shadow) is an `<img>` inside the stage; the drop shadow is CSS.
- **The book stage is a fixed 2000×1333 design space** (`components/Stage.tsx`), scaled with `transform: translate(-50%,-50%) scale(s)` where `s = min(innerWidth/2240, innerHeight/1120)` (1120 = `MIN_VISIBLE_H`, the height that gives full-size pages, so windows wider than about 2:1 shrink the book instead of squashing the pages). The extra room beyond 2000×1333 is for the ribbons that stick out right of the book. Position book content in **design pixels**, never viewport units. Content boxes: left `235→930 × 180→1050`, right `1075→1765 × 180→1050` (`.page-left` / `.page-right` in `styles/book.css`; regions table in plan 9.2).
- Stage z-order: ribbons 0 (tucked under the cover, left end at x≈1890), book image 1, page content 2. Toasts live outside the stage, bottom-left of the window, over the table.
- The router is `createHashRouter` with `Stage` as the layout route and pages as children rendered through `<Outlet />`. Page components return `.page` sections placed absolutely inside the stage.
- Fonts are in `app/public/fonts/` (Solbera's D&D fonts, CC BY-SA 4.0) and declared in `styles/fonts.css`. Use the CSS variables `--font-title`, `--font-body`, `--font-label`, `--font-note` from `styles/theme.css`, not raw family names. `CREDITS.md` credits the fonts and the artwork.
- Colour tokens are all in `styles/theme.css` (plan 9.4). Don't hardcode colours elsewhere. Don't use `--ink-leader` for text.
- `public/images/tome-table.webp` and `tome-book.webp` are copies of the files in `docs/design/`. If the art changes, update both, and remeasure the regions table in plan 9.2 (the book's alpha edges and paper extents were measured with a script on that image).
- nginx: `index.html` is `no-cache`; `/assets/`, `/fonts/`, `/images/` are immutable for a year. Never rename a file in `fonts/` or `images/` without changing its URL, or players will see the stale one.

## Rules from the plan worth repeating

- The repo is **public**. Nothing secret is ever committed. Only the Supabase URL and publishable key go in `app/.env`.
- No backend of our own: the browser talks to Supabase directly. Writes go only through `SECURITY DEFINER` SQL functions; tables have no insert/update/delete policies.
- Live updates must never navigate the user or disturb a draft being typed.
- No candle, no hand-drawn map, no emoji or icon fonts, no delete feature (archive instead), no ambient animation. Respect `prefers-reduced-motion`.
- Use the exact UI strings in plan 9.8.

## Verifying changes

- Visual/scaling changes: build, serve with `npx vite preview app --port 4173` (from the repo root, or `npx vite preview` in `app/`), and check `.stage` bounding box at 1280×720, 1920×1080 and 2560×1440, plus an ultrawide (2560×1080) and a squarer window (1280×1024) to see the table crop. After a viewport resize wait about a second before reading, since the scale updates on the `resize` event.
- Docker changes: `docker compose up -d --build`, then request `http://localhost:47218` (use the port in the root `.env`). Port conflicts show up as "port is already allocated".
- Only step 1's scaling and Docker serving have been verified so far. `run.bat` itself has not been run end to end.
