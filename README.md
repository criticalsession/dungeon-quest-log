# Dungeon Quest Log

A shared quest tracker for one D&D party, drawn as an old leather-bound journal on a tavern table. Every player runs it on their own PC in Docker; everyone shares one Supabase database, so changes appear live for the whole party.

> Status: under construction. The database and setup checklist are in place; the app pages are still being built. See `docs/IMPLEMENTATION_PHASES.md`.

## One-time setup (the repo owner, once per party)

1. Create a free project at <https://supabase.com/dashboard>.
2. **SQL Editor:** paste the contents of `supabase/schema.sql` and run it. Run it only once per project.
3. **Authentication → Sign In / Providers:**
   - Turn **off** "Allow new users to sign up".
   - Keep the Email provider enabled.
4. **Authentication → Users → Add user → Create new user:**
   - Email: any valid-looking address, e.g. `party@example.com`. It is never emailed.
   - Password: the party password. Use a long passphrase, since this repo is public.
   - Tick **Auto Confirm User**.
5. **Project Settings → API (or API Keys):** copy the Project URL and the **publishable** key (`sb_publishable_…`; the legacy `anon` key also works). Put them in `app/.env`, set `VITE_PARTY_EMAIL` to the email from step 4, then commit and push. Never put a secret key or the `service_role` key in this repo.
6. **Changing the password later:** Authentication → Users → the user → reset or update the password. Players use the new one at their next login.

`app/.env` looks like this (see `app/.env.example`):

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
VITE_PARTY_EMAIL=party@example.com
```

### Keep-alive

Free Supabase projects pause after about 7 days without activity. The workflow `.github/workflows/keep-supabase-awake.yml` pings the database every 3 days. It reads `app/.env`, so there is nothing to configure. After pushing, open the repo's **Actions** tab and run it once ("Run workflow") to check it succeeds.

GitHub disables scheduled workflows in a public repo after 60 days without commits. GitHub emails a warning; re-enabling it is one click on the **Actions** tab.

### Checking the database

With the project set up, these should hold (replace the URL and key with yours):

```bash
curl -s "$VITE_SUPABASE_URL/rest/v1/quests?select=*" -H "apikey: $VITE_SUPABASE_PUBLISHABLE_KEY"
curl -s -X POST "$VITE_SUPABASE_URL/rest/v1/rpc/ping" -H "apikey: $VITE_SUPABASE_PUBLISHABLE_KEY" -H "Content-Type: application/json" -d '{}'
```

The first returns `[]` (not logged in, so no quests visible); the second returns `"pong"`.
