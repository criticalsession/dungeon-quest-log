---
name: implement
description: Implement one phase of the Dungeon Quest Log build plan. Takes a phase number (1-8), looks up the phase in docs/IMPLEMENTATION_PHASES.md, reads the matching parts of docs/IMPLEMENTATION_PLAN.md, builds it, verifies it, updates the docs and commits locally. Use when the user says /implement N or asks to build or continue a numbered phase.
argument-hint: <phase number 1-8>
disable-model-invocation: true
---

# /implement <phase number>

Build one phase of the quest log. The phase number is `$ARGUMENTS`.

## 1. Pick the phase

- If `$ARGUMENTS` is empty or not a number from 1 to 8, read `docs/IMPLEMENTATION_PHASES.md`, show its table, and ask which phase to build. Do nothing else.
- Otherwise take the row for that number: its name, what it delivers and its status.

## 2. Gather context (read before writing any code)

1. `AGENTS.md`: commands, Windows gotchas, decisions that differ from the plan, rules to keep. These override the plan where they conflict.
2. `docs/IMPLEMENTATION_PLAN.md` **section 10**: the entry for this phase, its "Done when" line, and any "As built" note. Also the acceptance-test items that this phase can satisfy.
3. The plan sections for this phase, from the map below. Read them fully; the plan is the source of truth, and the mockup is only a visual reference.
4. The current code under `app/src` (and `supabase/`, `.github/`) so new work matches what exists.

| Phase | Plan sections to read |
|---|---|
| 1 Scaffold | 3, 4, 8.6, 8.7, 9 |
| 2 Database | 5, 6, 8.8, 4 (layout), 12 |
| 3 Login | 7.1, 8.1, 9.6, 9.8 |
| 4 Read path | 7.2, 7.3, 7.4, 8.2, 8.4, 8.5, 9.5, 9.6, 9.8 |
| 5 Write path | 6 (RPC signatures), 7.5, 8.3, 9.8 |
| 6 Locks | 6 (lock functions), 7.6, 9.7 |
| 7 Live sync | 7.7, 7.8, 9.7 |
| 8 Polish | 9.2 (narrow fallback), 9.9, 11, 12, the whole acceptance test |

## 3. Check before starting

- **Already done?** If the status is "Done", say so and ask whether to redo or extend it. Don't redo it silently.
- **Earlier phases unfinished?** If a lower-numbered phase isn't Done, name it and ask whether to build that first or continue anyway. Phases build on each other (for example, 4 needs the schema from 2 and the login from 3).
- **Git:** run `git status` and `git branch --show-current`. If there are uncommitted changes that aren't yours, ask. If the current branch is `main`, ask which branch to use rather than committing to it. Never push.
- **Needs the owner?** Phases 2 onward depend on a real Supabase project (plan section 5 and 12). If `app/.env` still has placeholder values, build everything that doesn't need it, and list exactly what the owner must do to verify the rest. Never invent keys, passwords or project URLs, and never put secrets in the repo (it is public).

## 4. Implement

- Make a task list for the phase's deliverables and work through it.
- Follow the plan literally where it is specific: file names and locations (plan section 4), the SQL, exact UI strings (9.8), colour tokens (9.4, via CSS variables only), fonts (via the font variables), design-space coordinates (9.2) and component behaviour (section 7).
- Keep to the "don't revisit" decisions in plan section 2, and the out-of-scope list in section 1.
- If the plan is wrong, ambiguous or conflicts with reality, choose the smallest sensible fix, and record it in `AGENTS.md` under "Decisions made while building" and in the plan.
- Use the commands and workarounds in `AGENTS.md` (for example `--script-shell=cmd.exe` for the build on Windows, and the Write tool for multi-file creation).

## 5. Verify

Check against the phase's "Done when" line and the acceptance items it covers. Use real checks, not assumptions:

- `npm run build` must pass, and `npm test` too if tests exist.
- For anything visible, serve it and look at it in the browser at several window sizes (see "Verifying changes" in `AGENTS.md`). Rebuild the Docker image for Docker-related changes.
- For things you can't verify (no Supabase project, needs two browsers, needs the owner's PC), say so plainly. Don't tick a checkbox you didn't test.

## 6. Update the docs

- `docs/IMPLEMENTATION_PHASES.md`: set the phase's status ("Done", or "Partly done" with what's missing).
- `docs/IMPLEMENTATION_PLAN.md` section 10: mark the step **(Done.)** and add an "*As built:*" line saying what was verified and what wasn't. Tick acceptance-test boxes only for items you actually tested.
- `AGENTS.md`: update the Status section, add any new decisions, gotchas or commands, and fix anything that is now stale.

## 7. Commit

Commit locally once the phase builds and the docs are updated, with a message like `Phase N: <name>` and a short body. Use the commit trailer given in the session instructions. Do not push, and do not open a PR unless asked.

## 8. Report

End with a short report:
- What was built.
- What was verified, and how.
- What was **not** verified, and why.
- Anything the owner must do by hand (plan section 12) before the next phase.
- The next phase number.
