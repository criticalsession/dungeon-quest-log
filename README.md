# Dungeon Quest Log

A shared quest tracker for one D&D party, drawn as an old leather-bound journal on a tavern table. Every player runs it on their own PC in Docker; everyone shares one Supabase database, so changes appear live for the whole party.

## For players

You need a Windows PC with [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed. Nothing else.

1. Start Docker Desktop and wait until it says it is running.
2. Clone this repo (or download it as a ZIP and unpack it).
3. Double-click **`run.bat`**. The first run builds the app and takes a few minutes; later runs are quick. Your browser opens the quest log.
4. Enter your character's name and the party password (ask the person who set this up), then press **Open the book**.

To stop it, double-click **`stop.bat`**. To leave the log, press **Close the book**.

**Using it**

- Pick a quest on the left page to read it on the right. The ribbons on the right edge filter the list by status.
- **Inscribe a quest** adds one. **Amend** edits one; while you do, others see a padlock and can't change it, and it frees up when you finish or leave.
- Changes by other players appear on their own, with a small note in the bottom-left corner.
- On a phone or a narrow window the book becomes one scrolling page. The keyboard works throughout: Tab between buttons, and the arrow keys move between ribbons.

**If something goes wrong**

- *"Docker is not running"*: start Docker Desktop, then run `run.bat` again.
- *"Port is already allocated"*: change `QUESTLOG_PORT` in the `.env` file at the top of the repo (default 47218), then run `run.bat` again.
- *"The archive is sealed" or a connection warning*: the shared database is paused or your connection dropped. The log reconnects by itself; if the database is paused, tell the person who set it up.

Credits for the fonts and artwork are in [CREDITS.md](CREDITS.md).

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
