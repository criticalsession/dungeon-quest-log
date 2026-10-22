-- Dungeon Quest Log: database schema.
-- Run ONCE on a fresh Supabase project (SQL Editor -> paste -> Run).
-- It is not idempotent: on a project that already has these objects, start from a new project.
-- Error codes the client relies on: NOT_AUTHENTICATED, QUEST_LOCKED, LOCK_NOT_HELD.

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
