# Dungeon Quest Log: implementation plan

This is the complete brief for building the first version. It is written so that someone with no access to the original planning conversation can build the app from it. When something here conflicts with a mockup, this document wins.

---

## 1. What we're building

A shared quest tracker for one D&D party.

- Every player runs the app on their own PC in Docker. Double-clicking `run.bat` builds it, starts it and opens the browser.
- All players share **one Supabase database** (free tier) and therefore one quest log.
- The repo is **public**, so nothing secret may be committed. Access is protected by **one shared party password** that is stored and checked in the database.
- Every change (new quest, edit, status change, archive) appears **live** in every player's browser. A live update must never move the player to another page or lose what they are typing.
- While someone edits a quest, it is **locked** for everyone else.
- The look is an **old leather-bound quest journal lying open on a tavern table** (the "Tome"). Section 9 has the full visual spec.

### Features

| Feature | Notes |
|---|---|
| View all quests | Grouped by status, oldest first |
| Create a quest | "Inscribe a quest" |
| Edit a quest | Rich-text description; locks the quest |
| Activate / set aside / fulfil / reactivate | Status changes: active, on hold, fulfilled |
| Archive / unarchive | Separate from status; archived quests leave the main view |
| Live sync | Supabase Realtime |
| Edit locking | Lock lasts while editing, expires about 2 minutes after the editor's tab stops renewing it |
| Shared password, name at each login | Each player types a display name when logging in |

**Out of scope for v1:** deleting quests (archive replaces delete), per-player accounts, objectives or checklists, rewards, images in quests, a mobile-first layout.

---

## 2. Decisions already made (don't revisit)

| Topic | Decision |
|---|---|
| Visual direction | The Tome: open book on a tavern table, using the supplied background art |
| Candle / candle glow | **None.** Remove it entirely |
| Hand-drawn map on the quest page | **None** |
| Auth | One shared Supabase Auth user (fixed email in config, shared password). Each player enters a **display name** at every login (pre-filled with the last name used on that PC) |
| Fonts | D&D handbook look: Solbera's free fonts (section 9.3). **Titles use Nodesto** |
| Wording | Fantasy wording on buttons and labels (section 9.8) |
| Session numbers | Regular digits: "Session 12" (not Roman numerals) |
| Quest number heading | Keep "Quest the twelfth": an ordinal in words, based on creation order |
| List order within a group | **Oldest first** (section 7.3) |
| Confirm dialog | Only when there are unsaved changes. Leaving an editor with no changes releases the lock silently |
| Stuck locks | Expiry only (no "break the lock" button) |
| Supabase pausing | A free GitHub Actions job pings the database every 3 days |
| Filter ribbons | Drawn by the app (**not** part of the background image). The selected ribbon slides further out |
| Delete | Not offered. Archive instead |

---

## 3. Architecture

```
 Player PC (each player)                         Supabase (free tier, shared)
 ┌───────────────────────────────┐               ┌──────────────────────────────┐
 │ run.bat                       │               │ Auth: 1 user (party account) │
 │  └─ docker compose up         │               │ Postgres: quests, quest_locks│
 │      └─ nginx serves the SPA  │──── HTTPS ───▶│   RLS: authenticated only    │
 │ Browser: React SPA            │◀─ websocket ──│   writes via SQL functions   │
 │  (supabase-js, Realtime)      │               │ Realtime: postgres_changes   │
 └───────────────────────────────┘               └──────────────────────────────┘
                                                   ▲
 GitHub Actions (every 3 days) ── POST rpc/ping ───┘
```

- **There is no backend of our own.** The browser talks straight to Supabase with `@supabase/supabase-js`. The Docker container is only nginx serving the static build.
- **Committed config:** the Supabase URL and the **publishable (anon) key** are committed to the repo. They are designed to be public, and security comes from Row Level Security plus the password.
- **Reads:** plain `select` on the tables, allowed only for the `authenticated` role.
- **Writes:** only through `SECURITY DEFINER` SQL functions, which check the edit lock atomically. Tables have no insert, update or delete policies.

### Stack

Use the latest stable version of each at implementation time.

| Piece | Choice |
|---|---|
| Build | Vite + React + TypeScript |
| Routing | `react-router` with `createHashRouter` (data router, so `useBlocker` works) |
| State | `zustand`, one store for quests and locks |
| Backend client | `@supabase/supabase-js` v2 |
| Rich text | `@tiptap/react` + `@tiptap/starter-kit` (+ `@tiptap/extension-placeholder`) |
| Sanitising | `dompurify` |
| Serving | `nginx:alpine` in Docker, multi-stage build from `node:22-alpine` |

---

## 4. Repository layout

```
/
├─ README.md                    ← player setup + one-time Supabase setup
├─ CREDITS.md                   ← font licences, artwork credit
├─ run.bat                      ← start + open browser
├─ stop.bat                     ← docker compose down
├─ docker-compose.yml
├─ .github/workflows/keep-supabase-awake.yml
├─ supabase/
│  └─ schema.sql                ← run once in the Supabase SQL editor
├─ app/
│  ├─ Dockerfile
│  ├─ nginx.conf
│  ├─ .env                      ← COMMITTED: URL, publishable key, party email
│  ├─ .env.example
│  ├─ index.html
│  ├─ package.json, tsconfig.json, vite.config.ts
│  ├─ public/
│  │  ├─ images/tome-table.webp, tome-book.webp   ← copies of docs/design/
│  │  └─ fonts/*.otf                   ← see 9.3
│  └─ src/
│     ├─ main.tsx, router.tsx
│     ├─ lib/ supabase.ts, clientId.ts, ordinal.ts, dates.ts, sanitize.ts
│     ├─ store/ quests.ts              ← zustand: quests, locks, connection state
│     ├─ sync/ realtime.ts, locks.ts   ← subscriptions, heartbeat, unload release
│     ├─ components/ Stage, Book, Ribbons, QuestList, QuestRow, QuestView,
│     │              QuestEditor, EditorToolbar, WaxSeal, Flourish, LedgerField,
│     │              ConfirmDialog, Toasts, SealedArchiveNotice
│     ├─ pages/ LoginPage, LogPage
│     └─ styles/ fonts.css, theme.css (CSS custom properties), book.css
└─ docs/
   ├─ IMPLEMENTATION_PLAN.md    ← this file
   └─ design/
      ├─ tome-table.webp        ← table art, full-bleed background (2000×1333, no book)
      ├─ tome-book.webp         ← the open book, transparent cut-out (2000×1333)
      └─ tome-mockup.html       ← static visual reference (open in a browser)
```

---

## 5. One-time Supabase setup (done by the repo owner)

This goes in the README as a checklist. The implementer writes the SQL and the README. The owner clicks through the dashboard.

1. Create a free project at <https://supabase.com/dashboard>.
2. **SQL Editor:** paste and run `supabase/schema.sql`.
3. **Authentication → Sign In / Providers:**
   - Turn **off** "Allow new users to sign up".
   - Keep the Email provider enabled.
4. **Authentication → Users → Add user → Create new user:**
   - Email: any valid-looking address, e.g. `party@example.com`. It's never emailed.
   - Password: the party password. Use a long passphrase, since the repo is public.
   - Tick **Auto Confirm User**.
5. **Project Settings → API (or API Keys):** copy the Project URL and the **publishable** key (`sb_publishable_…`; the legacy `anon` key also works). Put them in `app/.env`, set `VITE_PARTY_EMAIL` to the email from step 4, then commit and push.
6. **Changing the password later:** Authentication → Users → the user → reset or update the password. Players then use the new one at their next login.

`app/.env` (committed):

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
VITE_PARTY_EMAIL=party@example.com
```

---

## 6. Database (`supabase/schema.sql`)

The SQL below is a reference draft. It should run as is; adjust it if it doesn't. Error codes and messages that the client relies on are in **CAPS**.

```sql
-- ── Types ──────────────────────────────────────────────────────────────
create type public.quest_status as enum ('active', 'on_hold', 'fulfilled');

-- ── Tables ─────────────────────────────────────────────────────────────
create table public.quests (
  id                uuid primary key default gen_random_uuid(),
  quest_number      integer generated always as identity unique,   -- "Quest the twelfth"
  title             text not null check (char_length(btrim(title)) between 1 and 200),
  description       text not null default '' check (char_length(description) <= 200000), -- sanitised HTML
  date_received     date,
  session_number    integer check (session_number >= 0),
  quest_giver       text check (char_length(quest_giver) <= 200),
  location_received text check (char_length(location_received) <= 200),
  quest_location    text check (char_length(quest_location) <= 200),
  status            public.quest_status not null default 'active',
  archived          boolean not null default false,
  created_at        timestamptz not null default now(),
  created_by_name   text not null check (char_length(created_by_name) between 1 and 40),
  updated_at        timestamptz not null default now(),
  updated_by_name   text not null check (char_length(updated_by_name) between 1 and 40),
  version           integer not null default 1
);

create table public.quest_locks (
  quest_id    uuid primary key references public.quests(id) on delete cascade,
  client_id   uuid not null,            -- one per browser tab
  holder_name text not null check (char_length(holder_name) between 1 and 40),
  acquired_at timestamptz not null default now(),
  expires_at  timestamptz not null
);

-- ── Security: read-only for the logged-in party, nothing for anon ──────
alter table public.quests      enable row level security;
alter table public.quest_locks enable row level security;

create policy "party can read quests" on public.quests      for select to authenticated using (true);
create policy "party can read locks"  on public.quest_locks for select to authenticated using (true);

revoke insert, update, delete, truncate on public.quests, public.quest_locks from anon, authenticated;

-- ── Realtime ───────────────────────────────────────────────────────────
alter table public.quest_locks replica identity full;
alter publication supabase_realtime add table public.quests, public.quest_locks;

-- ── Helpers (not callable by clients) ──────────────────────────────────
create or replace function public._assert_party() returns void
language plpgsql set search_path = public as $$
begin
  if auth.role() is distinct from 'authenticated' then
    raise exception 'NOT_AUTHENTICATED' using errcode = '42501';
  end if;
end $$;

create or replace function public._assert_unlocked(p_quest_id uuid, p_client_id uuid) returns void
language plpgsql set search_path = public as $$
begin
  if exists (select 1 from quest_locks
             where quest_id = p_quest_id and client_id <> p_client_id and expires_at > now()) then
    raise exception 'QUEST_LOCKED' using errcode = 'P0001';
  end if;
end $$;

revoke all on function public._assert_party()                from public, anon, authenticated;
revoke all on function public._assert_unlocked(uuid, uuid)   from public, anon, authenticated;

-- ── Locks ──────────────────────────────────────────────────────────────
create or replace function public.acquire_lock(p_quest_id uuid, p_client_id uuid, p_name text)
returns public.quest_locks language plpgsql security definer set search_path = public as $$
declare l public.quest_locks;
begin
  perform _assert_party();
  insert into quest_locks as ql (quest_id, client_id, holder_name, expires_at)
  values (p_quest_id, p_client_id, p_name, now() + interval '2 minutes')
  on conflict (quest_id) do update
     set client_id = excluded.client_id, holder_name = excluded.holder_name,
         acquired_at = now(), expires_at = excluded.expires_at
   where ql.expires_at < now() or ql.client_id = excluded.client_id
  returning * into l;
  if not found then raise exception 'QUEST_LOCKED' using errcode = 'P0001'; end if;
  return l;
end $$;

create or replace function public.heartbeat_lock(p_quest_id uuid, p_client_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  perform _assert_party();
  update quest_locks set expires_at = now() + interval '2 minutes'
   where quest_id = p_quest_id and client_id = p_client_id;
  return found;   -- false = lock lost (expired and taken by someone else)
end $$;

create or replace function public.release_lock(p_quest_id uuid, p_client_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform _assert_party();
  delete from quest_locks where quest_id = p_quest_id and client_id = p_client_id;
end $$;

-- ── Quest writes ───────────────────────────────────────────────────────
create or replace function public.create_quest(
  p_author text, p_title text, p_description text default '',
  p_date_received date default null, p_session_number integer default null,
  p_quest_giver text default null, p_location_received text default null, p_quest_location text default null)
returns public.quests language plpgsql security definer set search_path = public as $$
declare q public.quests;
begin
  perform _assert_party();
  insert into quests (title, description, date_received, session_number, quest_giver,
                      location_received, quest_location, created_by_name, updated_by_name)
  values (btrim(p_title), coalesce(p_description, ''), p_date_received, p_session_number,
          nullif(btrim(p_quest_giver), ''), nullif(btrim(p_location_received), ''),
          nullif(btrim(p_quest_location), ''), p_author, p_author)
  returning * into q;
  return q;
end $$;

create or replace function public.save_quest(
  p_quest_id uuid, p_client_id uuid, p_author text, p_title text, p_description text,
  p_date_received date, p_session_number integer, p_quest_giver text,
  p_location_received text, p_quest_location text)
returns public.quests language plpgsql security definer set search_path = public as $$
declare q public.quests;
begin
  perform _assert_party();
  if not exists (select 1 from quest_locks where quest_id = p_quest_id and client_id = p_client_id) then
    raise exception 'LOCK_NOT_HELD' using errcode = 'P0001';
  end if;
  update quests set
      title = btrim(p_title), description = coalesce(p_description, ''),
      date_received = p_date_received, session_number = p_session_number,
      quest_giver = nullif(btrim(p_quest_giver), ''),
      location_received = nullif(btrim(p_location_received), ''),
      quest_location = nullif(btrim(p_quest_location), ''),
      updated_at = now(), updated_by_name = p_author, version = version + 1
  where id = p_quest_id
  returning * into q;
  delete from quest_locks where quest_id = p_quest_id;
  return q;
end $$;

create or replace function public.set_status(
  p_quest_id uuid, p_client_id uuid, p_author text, p_status public.quest_status)
returns public.quests language plpgsql security definer set search_path = public as $$
declare q public.quests;
begin
  perform _assert_party();
  perform _assert_unlocked(p_quest_id, p_client_id);
  update quests set status = p_status, updated_at = now(), updated_by_name = p_author, version = version + 1
   where id = p_quest_id returning * into q;
  return q;
end $$;

create or replace function public.set_archived(
  p_quest_id uuid, p_client_id uuid, p_author text, p_archived boolean)
returns public.quests language plpgsql security definer set search_path = public as $$
declare q public.quests;
begin
  perform _assert_party();
  perform _assert_unlocked(p_quest_id, p_client_id);
  update quests set archived = p_archived, updated_at = now(), updated_by_name = p_author, version = version + 1
   where id = p_quest_id returning * into q;
  return q;
end $$;

-- ── Keep-alive (callable without login; returns nothing sensitive) ─────
create or replace function public.ping() returns text
language sql security definer set search_path = public as $$ select 'pong'::text $$;

-- ── Grants ─────────────────────────────────────────────────────────────
revoke all on function public.acquire_lock(uuid, uuid, text)  from public, anon;
revoke all on function public.heartbeat_lock(uuid, uuid)      from public, anon;
revoke all on function public.release_lock(uuid, uuid)        from public, anon;
revoke all on function public.create_quest(text, text, text, date, integer, text, text, text) from public, anon;
revoke all on function public.save_quest(uuid, uuid, text, text, text, date, integer, text, text, text) from public, anon;
revoke all on function public.set_status(uuid, uuid, text, public.quest_status) from public, anon;
revoke all on function public.set_archived(uuid, uuid, text, boolean) from public, anon;

grant execute on function public.acquire_lock(uuid, uuid, text)  to authenticated;
grant execute on function public.heartbeat_lock(uuid, uuid)      to authenticated;
grant execute on function public.release_lock(uuid, uuid)        to authenticated;
grant execute on function public.create_quest(text, text, text, date, integer, text, text, text) to authenticated;
grant execute on function public.save_quest(uuid, uuid, text, text, text, date, integer, text, text, text) to authenticated;
grant execute on function public.set_status(uuid, uuid, text, public.quest_status) to authenticated;
grant execute on function public.set_archived(uuid, uuid, text, boolean) to authenticated;
grant execute on function public.ping() to anon, authenticated;
```

**Notes:**
- `version` exists for debugging and possible future conflict checks. Nothing depends on it yet.
- **Status changes and archiving don't take a lock.** They are refused only if *someone else* holds a live lock.
- **Sanitise twice:** the client cleans `description` with DOMPurify before saving *and* before displaying it (section 8.4).

---

## 7. App behaviour

### 7.1 Login (`#/login`)

- **Fields:** "Your name" (1–40 characters, trimmed, required, pre-filled from `localStorage['dql.lastName']`) and "The party's password".
- **Login call:** `supabase.auth.signInWithPassword({ email: VITE_PARTY_EMAIL, password })`.
- **On success:**
  - Save the name to `localStorage['dql.lastName']` (for pre-filling) and `sessionStorage['dql.name']` (the active name).
  - Go to `#/`.
- **Auth guard:** any route except login needs both a Supabase session and an active name. If either is missing, go to `#/login` (the name field is pre-filled).
- **"Close the book" (log out):** release any held lock, call `supabase.auth.signOut()`, clear `sessionStorage['dql.name']`, then go to `#/login`.
- **Wrong password:** "That password is not known here."
- **Rate limited:** "Too many attempts. Rest a moment and try again."

### 7.2 Routes (hash router)

| Route | Left page | Right page |
|---|---|---|
| `#/` | Quest list | Empty state |
| `#/quest/:id` | Quest list (row highlighted) | Quest view |
| `#/quest/:id/edit` | Quest list | Editor (holds the lock) |
| `#/new` | Quest list | Editor for a new quest (no lock needed; nothing exists until saved) |

- **Filter state:** the selected ribbon is UI state stored in the query string (`?tab=active`). It is **not** a navigation, so changing tabs never triggers the confirm dialog, even while editing.
- **Leaving an editor:** any navigation away from `/edit` or `/new` with unsaved changes goes through `useBlocker`, which opens the confirm dialog. That includes clicking another quest, the back button or "Abandon changes".

### 7.3 Quest list (left page)

**Ribbon tabs** (top to bottom): **All quests** (default), **Active**, **On hold**, **Fulfilled**, **Archive**.

- **All quests:** archived quests are excluded. Three groups are shown in this order: *Active*, *On hold*, *Fulfilled*. Each has a small-caps header with a count, e.g. "Active · 4", and empty groups are hidden.
- **Active / On hold / Fulfilled:** only that status, not archived, without a group header (the page header names the filter).
- **Archive:** only archived quests, any status. Each row shows its status marker.

**Order within each group:** oldest first.

```
order by session_number asc nulls last, date_received asc nulls last, quest_number asc
```

**Each row is a `<button>`** containing:
- **Status marker:**
  - Active: crimson diamond
  - On hold: hollow teal diamond
  - Fulfilled: gold circle with a tick
- **Title** in Nodesto.
- **Italic meta line** in Bookinsanity, showing only the parts that exist: "Session 12 · from Sister Velka · Harrowmere Abbey". The place is the quest location.

**Row states:**
- **Fulfilled:** title struck through in crimson ink, row slightly faded.
- **Selected:** faint crimson wash and a 1px crimson inset outline, plus a small chevron on the right.
- **Locked by someone else:** a padlock replaces the marker, and the meta line becomes "*{name} is penning changes…*" in Zatanna Misdirection, colour `--ink-warning`. Clicking the row still opens the quest view (read-only).

**Other list behaviour:**
- **"Inscribe a quest"** sits in the page header (primary crimson button) and goes to `#/new`.
- **Scrolling:** the list scrolls **inside the page area** with a thin ink-brown scrollbar and a soft fade at the bottom edge. Scroll position is kept across live updates: rows are keyed by `id`, and nothing re-mounts the list.
- **Empty states:**
  - All quests: "The log is empty. Inscribe the party's first quest."
  - Filtered tab: "No quests here."

### 7.4 Quest view (right page)

From top to bottom:

1. **Kicker:** "Quest the twelfth" (small caps, crimson), using `toOrdinalWords(quest_number)` (section 8.5).
2. **Title:** Nodesto, large.
3. **Wax seal** at the top right, rotated -8°. Colour and label follow the status: Active (crimson), On hold (teal), Fulfilled (gold). Archived quests show an ash-grey seal labelled "Archived".
4. **Ledger:** two columns of label / dotted leader / value. Only filled fields are shown, and the ledger is hidden entirely when all are empty.

   | Label | Value |
   |---|---|
   | Received | `3 October 2026` (long date) |
   | Session | `12` |
   | Given by | quest giver |
   | Received at | location received |
   | Quest location | spans both columns |

5. **Description:** sanitised HTML in Bookinsanity. The first letter of the first paragraph is a **drop cap**: a crimson box with a double gold border, the letter in Solbera Imitation, gold (section 9.6).
6. **Actions** (bottom right; each is shown only when it applies):

   | Quest state | Buttons |
   |---|---|
   | Active | **Amend** (primary) · Mark fulfilled · Set aside · Archive |
   | On hold | **Amend** · Take up again · Mark fulfilled · Archive |
   | Fulfilled | **Amend** · Reopen the quest · Archive |
   | Archived (any status) | **Amend** · Return to the log |

7. **Footer:** an italic line, "Last amended by Tamsin, 2 hours ago", using relative time (`Intl.RelativeTimeFormat`) that refreshes every minute.

**While someone else holds the lock:**
- Every action button is disabled. Each gets a `title` tooltip ("Mira is penning changes"), and a notice line appears above the actions.
- The view still updates live when they save.

**Long descriptions:** the right page body scrolls inside the page, with a fade at the bottom.

**Empty state** (nothing selected): a centred faded flourish and the italic line "Choose a quest from the log, or inscribe a new one."

**Quest archived by someone else while you're viewing it:** stay on the page and show the notice "This quest was archived by Tamsin." with a "Return to the log" button.

**Unknown or missing id:** "No such quest is written here." plus a link back to the log.

### 7.5 Editor (right page, `/edit` and `/new`)

- **Title:** Nodesto, with an ink underline. Required.
- **Ledger fields:** date (`type=date`), session (`type=number`, min 0), given by, received at, quest location. Each field has a dotted underline and no box. The labels match the view.
- **Description:** a Tiptap editor on parchment with a small toolbar of ink-coloured inline-SVG icon buttons, each with an `aria-label`:
  - Bold, Italic
  - Heading (H2), Subheading (H3)
  - Bullet list, Numbered list
  - Quote, Divider
  - Undo, Redo
  - Placeholder text: "Write what the party learned…"
- **Buttons:**
  - **Seal the entry** (primary): save, then go to `#/quest/:id`.
  - **Abandon changes:** confirm if there are changes, then go back.
- **Status and archive:** not editable here. A new quest is always created as active.
- **Unsaved-changes check:** the draft is compared field by field with the snapshot taken when editing started. The description is compared as normalised HTML.
- **Saving errors:**
  - `LOCK_NOT_HELD`: switch to the lock-lost state (7.6).
  - Network failure: keep the draft, show "Your words could not reach the archive. Try again."

### 7.6 Edit locking (client side)

- **`clientId`:** `crypto.randomUUID()` per tab, kept in `sessionStorage['dql.clientId']`, so a reload of the same tab keeps it and can re-take its own lock.
- **Entering `/edit`:**
  - Call `acquire_lock(id, clientId, name)`.
  - On `QUEST_LOCKED`, go to the quest view with a toast: "Mira is already penning changes to this quest."
  - On success, take the draft snapshot **from the store at that moment**. It is never refreshed from live updates afterwards.
- **Heartbeat:** `heartbeat_lock` every **30 s** while on `/edit`. Also call it immediately when the tab becomes visible again (`visibilitychange`).
  - **If it returns `false`, the lock is lost:**
    - Show a banner on the page: "Your hold on this page lapsed and someone else has taken up the pen. Your changes can't be sealed."
    - Disable Save.
    - Offer **Copy my text**, which puts the draft description as plain text on the clipboard, and **Abandon changes**.
- **Leaving the editor in the app:**
  - With unsaved changes: the confirm dialog (9.7). On confirm, call `release_lock` and navigate.
  - With no changes: release and navigate immediately.
- **Closing or reloading the tab:**
  - `beforeunload`: if there are unsaved changes, call `event.preventDefault()` (and set `returnValue = ''`) so the browser shows its own "Leave site?" prompt. The text can't be customised.
  - `pagehide`: release the lock with `fetch(\`${URL}/rest/v1/rpc/release_lock\`, { method: 'POST', keepalive: true, headers: { apikey, Authorization: \`Bearer ${accessToken}\`, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_quest_id, p_client_id }) })`. Keep the latest access token in a module variable, updated from `onAuthStateChange`, because `pagehide` can't await anything.
  - If the release never arrives (crash, sleep, power cut), the lock expires about 2 minutes later.
- **Saving:** `save_quest` releases the lock in the same transaction.
- **Showing locks:** a lock counts as live if it's in the store and `expires_at > now()`. Re-evaluate every 15 s so expired locks disappear from the UI without a new event.

### 7.7 Live sync

- **Initial load:** `select * from quests` and `select * from quest_locks` into the zustand store. The data is small, so load everything.
- **Subscription:** one channel with `postgres_changes` on `public.quests` and `public.quest_locks` (event `*`). Apply INSERT, UPDATE and DELETE to the store by `id` / `quest_id`.
- **Missed events:** on every `SUBSCRIBED` status (first time and after reconnects), and on `visibilitychange` back to visible, **re-fetch both tables**.
- **The editor's draft is separate state.** Store updates must never reset it, change focus or move the caret.
- **Toasts for other players' changes** (not your own), shown bottom-left on small parchment slips for 5 s and stacked at most 3:
  - "Tamsin inscribed a new quest: *The Ninth Bell*"
  - "Mira marked *The Ninth Bell* as fulfilled"
  - "Mira archived *The Ninth Bell*"
  - No toast for lock or heartbeat changes.
  - To tell changes apart, compare the previous and next row and use `updated_by_name`. Skip a toast when `updated_by_name` equals your own name **and** the change came from this tab (track the ids of quests you just wrote).
- **Connection lost** (channel error or closed and not recovering within about 10 s): show a thin banner at the top, "The connection to the archive wavers… reconnecting." Hide it when the channel is subscribed again.

### 7.8 Database unreachable or paused

If the first fetch fails with a network error, a 5xx response, or Supabase's "project paused" response, show a full-page notice on the book (both pages):

- Title: **"The archive is sealed"**
- Body: "We can't reach the party's records. If the game has been on a long break, the database may be asleep; whoever runs the Supabase project can restore it from the dashboard."
- Button: "Try again"

---

## 8. Implementation details

### 8.1 Supabase client (`lib/supabase.ts`)

```ts
createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
  realtime: { params: { eventsPerSecond: 10 } },
});
```

Call RPCs with `supabase.rpc('acquire_lock', { p_quest_id, p_client_id, p_name })`. Map Postgres errors by `error.message` (`QUEST_LOCKED`, `LOCK_NOT_HELD`, `NOT_AUTHENTICATED`).

### 8.2 Store shape (`store/quests.ts`)

```ts
type Quest = { id; quest_number; title; description; date_received: string|null; session_number: number|null;
  quest_giver: string|null; location_received: string|null; quest_location: string|null;
  status: 'active'|'on_hold'|'fulfilled'; archived: boolean; created_at; created_by_name;
  updated_at; updated_by_name; version };
type Lock = { quest_id; client_id; holder_name; acquired_at; expires_at };
state: { quests: Record<id, Quest>; locks: Record<quest_id, Lock>; loaded: boolean;
         connection: 'connecting'|'live'|'reconnecting'|'sealed' }
```

Write selectors for: grouped and filtered lists, one quest by id, and the live lock for a quest (one not held by my `clientId`).

### 8.3 Rich text

- Store **HTML**.
- **Allowed in DOMPurify:** `p, br, strong, em, h2, h3, ul, ol, li, blockquote, hr`. No attributes.
- **Apply it:** on save (before calling the RPC) and on render (before `dangerouslySetInnerHTML`).
- **Pasted text:** Tiptap StarterKit already limits pasted HTML to the allowed nodes. Disable `code`, `codeBlock` and `strike` in StarterKit.

### 8.4 Dates

- **Display:** `new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })` gives "3 October 2026".
- **Storage:** `date_received` stays as an ISO `YYYY-MM-DD` string. Never convert it through `Date` in a way that shifts the timezone.

### 8.5 Ordinal words (`lib/ordinal.ts`)

`toOrdinalWords(n)` turns 1 into "first", 12 into "twelfth", 21 into "twenty-first" and 100 into "one hundredth". It must handle 1–999. Above that, fall back to "Quest 1000". Write unit tests for 1, 2, 3, 11, 12, 13, 20, 21, 99, 100, 101, 112 and 999.

### 8.6 Docker

`app/Dockerfile`:

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
```

`app/nginx.conf`:
- Serve `/usr/share/nginx/html`.
- `try_files $uri /index.html`.
- Turn on gzip for text, JS and CSS.
- `Cache-Control: public, max-age=31536000, immutable` for `/assets/`, `/fonts/` and `/images/`.
- `no-cache` for `index.html`.

`docker-compose.yml`:

```yaml
services:
  questlog:
    build: ./app
    container_name: dungeon-quest-log
    ports:
      - "${QUESTLOG_PORT:-47218}:80"
    restart: unless-stopped
```

### 8.7 `run.bat` / `stop.bat`

**`run.bat`** must:
1. `cd /d "%~dp0"`.
2. Check Docker with `docker info >nul 2>&1`. If that fails, print a clear message (start Docker Desktop and run again) and `pause`. Don't try to start Docker.
3. Run `docker compose up -d --build`. If it fails, print the error and `pause`.
4. Wait for the page, polling up to about 30 s with PowerShell:
   `powershell -NoProfile -Command "for($i=0;$i -lt 30;$i++){try{Invoke-WebRequest -UseBasicParsing http://localhost:%QUESTLOG_PORT% -TimeoutSec 2 | Out-Null; exit 0}catch{Start-Sleep 1}}; exit 1"`
5. Open the browser with `start "" http://localhost:%QUESTLOG_PORT%`.

The port is `QUESTLOG_PORT` in the root `.env` file (committed, default 47218). Docker Compose reads that file itself, and `run.bat` parses it to open the right URL. Players change it there if the port is taken.

**`stop.bat`:** `docker compose down`.

### 8.8 Keep-alive workflow (`.github/workflows/keep-supabase-awake.yml`)

It reads the committed `app/.env`, so there is nothing to configure. It costs nothing: GitHub Actions minutes are free and unlimited for public repos, and each run takes a few seconds.

```yaml
name: Keep Supabase awake
on:
  schedule:
    - cron: "17 6 */3 * *"   # every 3 days, 06:17 UTC
  workflow_dispatch:
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Ping the database
        run: |
          set -a; . app/.env; set +a
          curl --fail -sS -X POST "$VITE_SUPABASE_URL/rest/v1/rpc/ping" \
            -H "apikey: $VITE_SUPABASE_PUBLISHABLE_KEY" \
            -H "Content-Type: application/json" -d '{}'
```

Put this in the README: GitHub disables scheduled workflows in a public repo after 60 days without commits. GitHub emails a warning, and re-enabling it is one click on the repo's **Actions** tab.

---

## 9. Visual design: the Tome

### 9.1 Reference files

- **`docs/design/tome-table.webp`:** the dark oak tavern table, **2000×1333 px**, no book. Props sit around the edges: bell and coins top-left, pouch, wax-sealed letter, chest and coins down the left edge, quill and inkwell bottom-right. The user generated it with ChatGPT.
- **`docs/design/tome-book.webp`:** the open red-leather book with brass corners, blank parchment pages and a red bookmark, as a **transparent cut-out**, 2000×1333 px (the book spans about x 63→1938, y 43→1296 including the bookmark). It has no shadow; the app adds one with CSS.
- **`docs/design/tome-mockup.html`:** a static HTML mockup to open in a browser. It shows the intended page content: list rows, ledger, drop cap, wax seal, buttons, ribbons. Its table and book are drawn in CSS and **are replaced by the two images** in the real app.
  - Its fonts are stand-ins: Cinzel and Cinzel Decorative become **Nodesto**, and EB Garamond becomes **Bookinsanity**.
  - Its ribbons hang vertically. The real ribbons follow section 9.5.
  - Its quest names are only sample content.

### 9.2 The table and the stage

Two layers, so the screen is always full and the book is never cropped:

- **Table (full-bleed):** `body` uses `tome-table.webp` with `background-size: cover`, centred. It crops freely to fill any window shape. No blur, no bars.
- **Stage (the book):** everything on the book is laid out in a fixed **2000×1333** design space. The stage is an absolutely-positioned 2000×1333 element, centred in the window and scaled with `transform: scale(s)`, containing `tome-book.webp` at 100%.
  - `s = min(innerWidth / 2240, innerHeight / 1380)`, recomputed on `resize`. The extra room (240 px wide, 47 px tall, beyond the 2000×1333 stage) leaves space for the ribbons that stick out to the right of the book.
  - The book image has `filter: drop-shadow(0 28px 36px rgba(0,0,0,.65))` so it sits on the table.
  - All page content is positioned in design pixels inside the stage, so text stays exactly on the parchment at any window size.
  - Layers inside the stage: ribbons (z 0, tucked under the cover), book image (z 1), page content (z 2).
- **Narrow fallback:** below 900 px of viewport width, or in portrait, drop the stage. Show a single scrolling column on a CSS parchment (gradient from the mockup) over the table: the list first, then the quest. This is a low-priority step; build it last.

**Measured regions** (design pixels, on `tome-book.webp`; nudge by a few px if anything looks off):

| Region | x | y | Notes |
|---|---|---|---|
| Book (outer, incl. brass corners) | 63 → 1938 | 43 → 1150 | bookmark hangs down to y 1296 |
| Left page paper | ≈ 172 → 1000 | ≈ 88 → 1089 | darkens toward the spine from x ≈ 946 |
| Spine | ≈ 1002 | | |
| Right page paper | ≈ 1004 → 1835 | ≈ 96 → 1089 | page-stack edge at about 1835 → 1880 |
| **Left content box (use this)** | **235 → 930** (w 695) | **180 → 1050** (h 870) | clear of edges and spine shading |
| **Right content box (use this)** | **1075 → 1765** (w 690) | **180 → 1050** (h 870) | |
| Ribbon anchor | left end at x = 1890 (under the cover), book edge at ≈ 1925 | 260 → 760 | the table shows beyond the book |
| Bookmark (in the image) | 1033 → 1087 | 1090 → 1296 | decoration only |

**Design-space type sizes** (scaled down with the stage, so about 0.7× on a 1440 px wide window):

| Use | Size |
|---|---|
| Body | 24px / 1.55 |
| Meta and italics | 20px |
| Small-caps labels | 17px |
| Row titles | 26px |
| Quest title | 52px |
| "Quest Log" header | 64px |
| Buttons | 17px |

### 9.3 Fonts (Solbera's D&D 5e fonts, CC BY-SA 4.0)

**Source:** <https://github.com/jonathonf/solbera-dnd-fonts> (default branch `master`). Download each file from `https://raw.githubusercontent.com/jonathonf/solbera-dnd-fonts/master/<Folder>/<File>` (URL-encode spaces as `%20`). Save them to `app/public/fonts/` under the kebab-case names below, and declare them in `styles/fonts.css` with `@font-face` (`format('opentype')`, `font-display: swap`).

| Role | Folder / file in repo | Save as | CSS family |
|---|---|---|---|
| **Titles** (quest titles, "Quest Log", ribbons, page headings) | `Nodesto Caps Condensed/Nodesto Caps Condensed.otf` | `nodesto-caps-condensed.otf` | `Nodesto` (400) |
| Titles bold | `Nodesto Caps Condensed/NodestoCapsCondensed-Bold.otf` | `nodesto-caps-condensed-bold.otf` | `Nodesto` (700) |
| **Body** | `Bookinsanity/Bookinsanity.otf` | `bookinsanity.otf` | `Bookinsanity` (400) |
| Body italic | `Bookinsanity/Bookinsanity Italic.otf` | `bookinsanity-italic.otf` | `Bookinsanity` (400 italic) |
| Body bold | `Bookinsanity/Bookinsanity Bold.otf` | `bookinsanity-bold.otf` | `Bookinsanity` (700) |
| Body bold italic | `Bookinsanity/Bookinsanity Bold Italic.otf` | `bookinsanity-bold-italic.otf` | `Bookinsanity` (700 italic) |
| **Labels and buttons** (small caps: field labels, group headers, buttons, kicker) | `Mr Eaves/Mr Eaves Small Caps.otf` | `mr-eaves-small-caps.otf` | `Mr Eaves` |
| **Drop cap** | `Solbera Imitation/Solbera Imitation.otf` | `solbera-imitation.otf` | `Solbera Imitation` |
| **Handwritten notes** (lock note "Mira is penning changes…", toasts) | `Zatanna Misdirection/Zatanna Misdirection.otf` | `zatanna-misdirection.otf` | `Zatanna` |

**Fallback stacks:**
- Titles: `Nodesto, 'Cinzel', serif`
- Body: `Bookinsanity, 'Palatino Linotype', 'Book Antiqua', Georgia, serif`
- Labels: `'Mr Eaves', 'Cinzel', serif`

Put the licence credit in `CREDITS.md` (section 11).

### 9.4 Colour tokens (`styles/theme.css`)

```css
:root {
  /* ink */
  --ink:            #2b1a0c;  /* body text */
  --ink-title:      #3a1608;  /* titles */
  --ink-muted:      #6e5030;  /* meta lines, italics */
  --ink-label:      #7a5a34;  /* small-caps labels */
  --ink-leader:     #a8885a;  /* dotted leaders, field underlines */
  --ink-warning:    #8a2a12;  /* lock notes, errors */
  /* accents */
  --crimson:        #9c1f1a;  /* active marker, kicker, selected outline */
  --crimson-deep:   #7d1a14;  /* primary button fill, drop-cap box */
  --crimson-edge:   #4e0e09;  /* primary button border */
  --gold:           #c9a04a;  /* drop-cap border, flourishes */
  --gold-bright:    #f2cf7a;  /* drop-cap letter */
  --on-crimson:     #f6e2b8;  /* text on crimson */
  /* status */
  --status-active:  #9c1f1a;
  --status-hold:    #24474f;
  --status-done:    #8a6a1e;
  --status-archive: #4a423c;
  --ribbon-all:     #4b2e5a;  /* "All quests" ribbon (royal purple) */
  /* surfaces */
  --parchment:      #f0e0b8;  /* dialogs, toasts, fallback page */
  --parchment-dark: #d4b47a;
  --wash-selected:  rgba(156, 31, 26, .10);
  --wash-hover:     rgba(120, 70, 20, .10);
}
```

### 9.5 Ribbons (filter tabs)

- **Position:** horizontal silk ribbons emerging from the right edge of the book. Left end at x = 1890 (hidden under the cover, which is at x ≈ 1925), stacked from y ≈ 260 with 12 px gaps. Each is about **58 px tall**.
- **Shape:** swallowtail notch on the right end (`clip-path: polygon(0 0, 100% 0, calc(100% - 16px) 50%, 100% 100%, 0 100%)`). Fill is a subtle vertical gradient of the ribbon colour, with a 1px lighter line along the top.
- **Shadow:** the left end gets an inner shadow (`inset 10px 0 10px -6px rgba(0,0,0,.6)`) so the ribbon looks tucked under the cover.
- **Label:** Nodesto 24px, `--on-crimson`, letter-spacing .06em.
- **Length:** visible part beyond the cover is **118 px** at rest and **172 px** when selected, so the selected ribbon pokes further out. Animate the width over 200 ms ease-out (respect `prefers-reduced-motion`). Hover adds 8 px.
- **Colours:**

  | Ribbon | Colour |
  |---|---|
  | All quests | `--ribbon-all` |
  | Active | `--status-active` |
  | On hold | `--status-hold` |
  | Fulfilled | `--status-done` |
  | Archive | `--status-archive` |

- **Accessibility:** they're real `<button>`s in a `role="tablist"` with `aria-selected`, and arrow keys move between them.

### 9.6 Page furniture

- **Left page header:** the italic line "Being the true chronicle of the company", then **"Quest Log"** in Nodesto 64px `--ink-title`, then the **flourish divider**: a horizontal line with curls and a crimson diamond centre (copy the SVG from the mockup, recoloured with tokens). Below that, a row with the group or filter title on the left and **Inscribe a quest** on the right.
- **Wax seal:** an SVG blob with a ring and a star, from the mockup. Fill follows the status colour, and the label sits at the bottom in Mr Eaves. 88 px, rotated -8°.
- **Drop cap:** `.description > p:first-of-type::first-letter`:
  - `float: left`, `font-family: 'Solbera Imitation'`, `font-size: 4.1em`, `line-height: .9`
  - `color: var(--gold-bright)`, `background: var(--crimson-deep)`, `border: 3px double var(--gold)`
  - `padding: 6px 10px`, `margin: 6px 12px 0 0`
- **Ledger rows:** `label (Mr Eaves, --ink-label) · flex-1 dotted border-bottom (--ink-leader) · value (Bookinsanity)`.
- **Buttons:**
  - **Primary:** `--crimson-deep` fill, `--crimson-edge` border, `--on-crimson` text, Mr Eaves 17px, uppercase, 2–3px radius, inset 1px highlight `rgba(255,210,150,.25)`.
  - **Secondary:** transparent, 1px `#8a6436` border, `--ink-title` text, hover `--wash-hover`.
  - **Focus:** visible `outline: 2px solid var(--crimson); outline-offset: 2px`.
  - **Size:** at least 44 px tall in real screen pixels at typical scale, which means about 56 px in design space.
- **Icons:** inline stroke SVGs in `currentColor` (padlock, quill, chevron, tick and the toolbar icons). Copy the padlock, quill and chevron paths from the mockup. No emoji, no icon font.

### 9.7 Dialogs and toasts

- **Confirm dialog** (unsaved changes):
  - A parchment note (`--parchment`, torn edge via an SVG `feTurbulence` + `feDisplacementMap` filter on a background layer) centred over the book, with a crimson wax seal at its top edge.
  - The backdrop is `rgba(10,5,2,.55)`.
  - Title "Abandon your changes?" (Nodesto 40px). Body: "Your unsaved words will be lost to the ether."
  - Buttons: **Keep writing** (secondary, focused by default) and **Abandon them** (primary).
  - Esc means Keep writing. Use `<dialog>` with `showModal()` for focus trapping.
- **Toasts:** small parchment slips bottom-left (over the table, anchored to the bottom-left corner of the window, outside the stage, so they sit on the table and not on the book), each rotated ±1°. Text is Zatanna 22px in `--ink`, and a slip fades out after 5 s.

### 9.8 Wording (use these exact strings)

| Action / state | Text |
|---|---|
| New quest | Inscribe a quest |
| Edit | Amend |
| Save | Seal the entry |
| Cancel edit | Abandon changes |
| Complete | Mark fulfilled |
| Deactivate | Set aside |
| On hold → active | Take up again |
| Fulfilled → active | Reopen the quest |
| Archive | Archive |
| Unarchive | Return to the log |
| Log out | Close the book |
| Statuses | Active · On hold · Fulfilled · Archived |
| Lock note | {name} is penning changes… |
| Kicker | Quest the {ordinal} |
| Footer | Last amended by {name}, {relative time} |
| Login heading (right page) | Who goes there? |
| Login button | Open the book |
| Login left page | "Quest Log" + "Being the true chronicle of the company" |
| Field labels | Received · Session · Given by · Received at · Quest location |
| Title placeholder | Name this quest |
| Description placeholder | Write what the party learned… |

### 9.9 Motion and accessibility

- **Motion:** ribbon slide, button hover and toast fade only. No ambient animation, no candle. Honour `prefers-reduced-motion`.
- **Semantics:** real `<button>`, `<input>`, `<label for>`, landmark regions (`<nav>` for the ribbons, `<main>` for the book) and `aria-live="polite"` for toasts.
- **Contrast:** body ink `#2b1a0c` on parchment is well above 4.5:1. Don't use `--ink-leader` for text.

---

## 10. Build order and done criteria

Commit after each step. Status: step 1 is **done**; steps 2 to 8 are not started.

1. **Scaffold. (Done.)** Vite React TS app in `app/`, router, the table and book layers with scaling, fonts loaded, theme tokens. Dockerfile, nginx.conf, docker-compose.yml, `run.bat`, `stop.bat`.
   *Done when* `run.bat` opens the table filling the window with the book centred on it, correctly scaled at 1280×720, 1920×1080 and 2560×1440 (and an ultrawide such as 2560×1080).
   *As built:* the Docker image builds and serves the app (checked with `docker compose up`); the layout was checked at 1280×720, 1920×1080, 2560×1440, 2560×1080 and 1280×1024. `run.bat` itself has not yet been run end to end. See `AGENTS.md` for deviations from this plan (default port 47218 set in the root `.env`, latest major versions of all packages, `app/.env` still holds placeholders).
2. **Database.** `supabase/schema.sql`, the README setup checklist, `.env.example`, the keep-alive workflow.
   *Done when* the SQL runs cleanly on a fresh project, and an anon REST call to `quests` returns nothing while `rpc/ping` returns `"pong"`.
3. **Login.** The login page on the book, the auth guard, the name handling and "Close the book".
   *Done when* a wrong password shows the error, the right one lands on the log, and a reload stays logged in with the name kept.
4. **Read path.** Store, initial load, quest list with ribbons and grouping, quest view (ledger, drop cap, seal, footer), empty and sealed states.
5. **Write path.** Create, amend (Tiptap), status buttons, archive and unarchive, all via RPC.
6. **Locks.** Acquire, heartbeat, release, unload release, lock display in list and view, lock-lost handling, confirm dialog via `useBlocker`, `beforeunload`.
7. **Live sync.** Realtime subscription, refetch on (re)subscribe and visibility, toasts, the "wavering connection" banner.
8. **Polish.** Narrow fallback layout, keyboard navigation, reduced motion, `CREDITS.md`, README for players.

### Acceptance test (two browsers, e.g. Chrome and Edge, logged in as "A" and "B")

- [ ] A inscribes a quest. It appears in B's list within about 2 s, with a toast, and B's scroll position and selection don't change.
- [ ] A starts amending. B sees the padlock and "A is penning changes…", and B's Amend, status and archive buttons are disabled.
- [ ] B is half-way through typing in another quest's editor while A saves a change. B's draft, caret and focus are untouched.
- [ ] A presses Abandon changes with edits made: the dialog appears. "Keep writing" stays in the editor, "Abandon them" leaves, and B sees the lock vanish.
- [ ] A leaves the editor with no edits: no dialog, and the lock is released.
- [ ] A closes the tab mid-edit: the browser's own prompt appears. After confirming, B sees the lock released within a few seconds (or by expiry at the latest, about 2 min).
- [ ] A kills the browser process mid-edit: B sees the lock expire about 2 min later and can then amend.
- [ ] A's laptop sleeps for 3 min mid-edit, B takes the lock, then A wakes: A sees the lock-lost banner and can't save.
- [ ] Set aside, Take up again, Mark fulfilled, Reopen the quest, Archive and Return to the log all update both screens and the ribbons' groups.
- [ ] B is viewing a quest that A archives: B stays on it and sees the "archived by A" notice.
- [ ] B turns off the network for 30 s, A makes 2 changes, B reconnects: B shows both changes.
- [ ] Order is oldest first: session, then date received, then creation.
- [ ] A fresh clone plus `run.bat` on a PC with only Docker Desktop installed works.
- [ ] Running the keep-alive workflow manually (`workflow_dispatch`) succeeds.

---

## 11. Sources, licences and credits

| Item | Source | Licence / notes |
|---|---|---|
| Fonts: Nodesto Caps Condensed, Bookinsanity, Mr Eaves Small Caps, Solbera Imitation, Zatanna Misdirection | Solbera's fonts, mirrored at <https://github.com/jonathonf/solbera-dnd-fonts> | **CC BY-SA 4.0.** Credit "Fonts by Solbera, CC BY-SA 4.0" in `CREDITS.md` with a link to the licence (<https://creativecommons.org/licenses/by-sa/4.0/>). If we ever modify the font files, the modified fonts must be shared under the same licence. Using them unmodified in the app is fine |
| Table and book art `tome-table.webp`, `tome-book.webp` | Generated by the repo owner with ChatGPT from a layout reference, then upscaled | Owned by the repo owner. Credit as "Table and book art generated with ChatGPT" |
| Supabase | <https://supabase.com>, free tier | Free projects pause after about 7 days without activity, hence the keep-alive. Docs: Auth <https://supabase.com/docs/guides/auth>, RLS <https://supabase.com/docs/guides/database/postgres/row-level-security>, Realtime Postgres Changes <https://supabase.com/docs/guides/realtime/postgres-changes>, API keys <https://supabase.com/docs/guides/api/api-keys> |
| Tiptap | <https://tiptap.dev/docs/editor/getting-started/install/react> | MIT |
| DOMPurify | <https://github.com/cure53/DOMPurify> | Apache-2.0 / MPL-2.0 |
| React Router (`createHashRouter`, `useBlocker`) | <https://reactrouter.com> | MIT |
| zustand | <https://github.com/pmndrs/zustand> | MIT |
| GitHub Actions schedules | <https://docs.github.com/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows#schedule> | Free for public repos; scheduled workflows are disabled after 60 days without repo activity |

---

## 12. Things the owner must do by hand

1. Create the Supabase project and follow section 5 (run SQL, create user, disable sign-ups, fill in `app/.env`).
2. Push the repo to GitHub (public) so the keep-alive workflow runs. Run it once from the Actions tab to check it.
3. Tell the party:
   - Install Docker Desktop.
   - Clone the repo.
   - Double-click `run.bat`.
   - Log in with their name and the party password.
