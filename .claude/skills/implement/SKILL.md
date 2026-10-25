---
name: implement
description: Implement work on the Dungeon Quest Log. Takes a phase number (1-8), a path to a plan file, or nothing (then it implements what was just discussed in the conversation). Builds it, verifies it, updates the docs and commits locally. Use when the user says /implement, /implement N, /implement path/to/plan.md, or asks to build a numbered phase or what was just discussed.
argument-hint: <phase number 1-8 | plan file path | empty = this conversation>
disable-model-invocation: true
---

# /implement [phase number | plan file]

Build one piece of work on the quest log. The input is `$ARGUMENTS`.

## 1. Pick the source of work

Decide the mode from `$ARGUMENTS`:

- **Phase mode**: it is a number from 1 to 8. Take the row for that number in `docs/IMPLEMENTATION_PHASES.md`: its name, what it delivers and its status.
- **Plan-file mode**: it is a path to an existing file (also try it relative to `docs/`). Read the whole file; its steps are the work. If it has several independent steps or phases, say which you will do (all, unless the user named some).
- **Conversation mode**: it is empty and the conversation already holds a discussed change, design or plan. The work is what was agreed there. Restate it in a few lines (scope, files likely touched, what "done" means) and ask for a go-ahead only if the scope is unclear or the discussion left open choices. Do not add anything that was not discussed.
- If it is empty and there is nothing to build from the conversation, or it is neither a number 1-8 nor a readable file, read `docs/IMPLEMENTATION_PHASES.md`, show its table, and ask what to build. Do nothing else.

In the two non-phase modes, "the work" replaces "the phase" everywhere below. Skip the phase-only parts (the section map, the "earlier phases" and "already done" checks) and use the rules below for the branch and docs.

## 2. Gather context (read before writing any code)

1. `AGENTS.md`: commands, Windows gotchas, decisions that differ from the plan, rules to keep. These override the plan where they conflict.
2. `docs/IMPLEMENTATION_PLAN.md` **section 10**: the entry for this phase, its "Done when" line, and any "As built" note. Also the acceptance-test items that this phase can satisfy.
3. The plan sections for this phase, from the map below. Read them fully; the plan is the source of truth, and the mockup is only a visual reference. (Non-phase modes: read the plan sections that the work touches, found by searching the plan for its topics. If the work contradicts the plan, say so and ask which wins before building.)
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
- **Git:** run `git status` and `git branch --show-current`. If there are uncommitted changes that aren't yours, ask. Never push.
- **Branch:** never work on `main`. Create a new branch named `feat/phase-N-<short-name>` (for example `feat/phase-4-read-path`; in the non-phase modes `feat/<short-name>` or `fix/<short-name>`) with `git switch -c`, and do all the work and the commit on it. If the current branch is `main`, branch from it. If it is another branch, ask whether to branch from it or from `main`. If a branch for this phase already exists, ask whether to continue on it or start a fresh one.
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

- `docs/IMPLEMENTATION_PHASES.md`: set the phase's status ("Done", or "Partly done" with what's missing). Phase mode only.
- `docs/IMPLEMENTATION_PLAN.md` section 10: mark the step **(Done.)** and add an "*As built:*" line saying what was verified and what wasn't. Tick acceptance-test boxes only for items you actually tested. Phase mode only; in the other modes touch the plan only where the work changed or contradicted it, and if a plan file was given, mark the steps you finished in that file.
- `AGENTS.md`: update the Status section, add any new decisions, gotchas or commands, and fix anything that is now stale.

## 7. Commit

Commit locally, on the phase branch, once the phase builds and the docs are updated, with a message like `Phase N: <name>` (non-phase modes: a short summary of the work) and a short body. Use the commit trailer given in the session instructions. Do not push, and do not open a PR unless asked.

## 8. Report

End with a short report:
- The branch name the work is on.
- What was built.
- What was verified, and how.
- What was **not** verified, and why.
- Anything the owner must do by hand (plan section 12) before the next phase.
- The next phase number (phase mode), or any remaining steps of the plan file or open points from the conversation.
