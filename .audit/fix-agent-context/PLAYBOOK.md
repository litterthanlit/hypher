# About making Hypher the tool agents cannot skip

[`docs/PRODUCT.md`](../../docs/PRODUCT.md) is the product. This file is a sequenced playbook for one question: how Hypher becomes the context layer a developer cannot work without, without becoming a second IDE.

The answer is not more product. The answer is a Builder Brief that is already in the agent's context, that is strictly more useful than the repo docs, and that updates when the session ends.

If the brief is a truncated echo of a dump, Hypher is optional. Diligent agents will keep reading `docs/PRODUCT.md` and ignore Hypher. That is the current state, measured on 2026-09-06.

This file is an audit artifact for one run. [`docs/PLAN.md`](../../docs/PLAN.md) is still the order file. [`docs/PRODUCT.md`](../../docs/PRODUCT.md) is still the only product source of truth. Do not treat this playbook as a second product document.

---

## Definition of done

Falsifiable. Not "feels indispensable."

A new agent on `litterthanlit/hypher`, same model, same prompt, no pasted context, run at least three times:

1. Loads a Builder Brief without a slash command.
2. The brief contains at least one dumped constraint or last-session fact that is not already in a file the agent was told to read.
3. The agent does not violate that constraint and does not rebuild a cut surface.
4. The session posts one `handoff`.
5. A second new agent sees that handoff in the brief.

Surfaces that must pass: a local Cursor chat with the plugin, and a Cursor cloud agent. Cloud is not optional. That is where this investigation ran, and the brief was not injected.

Control: the same prompt against the repo only (no Hypher). Score constraint violations, reopened decisions, and rebuilt cut surfaces. If with-Hypher does not win, do not launch. Fix the packet.

If with-Hypher loses to "read `docs/PRODUCT.md`" alone, the packet also failed. Hypher's job is what never made it into the files. Restating the files is not that job.

---

## Scope of this run

This run designs the playbook, grounds it in the live loop, and lands one structural unit: agent-facing docs stop sending the next session to rebuild shipped Phase 1a and Phase 1b, and they tell cloud agents to load the brief once with `PRODUCT.md` still winning conflicts.

Out of this PR: packet compiler changes, hook token plumbing, cold-start UX, launch video, reminders, canvas.

Rough size of the remaining program after this PR:

- Packet quality: compiler and synthesis in `hypher-web/shared/projectMemoryGenerate.ts` and `hypher-web/src/lib/projectContext.ts`. A few functions, high blast radius because the brief is the product.
- Cloud delivery: `AGENTS.md` plus later environment/start if text is not enough.
- Writeback: `extensions/cursor/scripts/hypher-session.mjs` session-end path and receipt filtering.
- Benchmark: a committed with/without harness. No new UI.

Blockers already visible:

- Cursor cloud agents do not run `sessionStart` / `sessionEnd` hooks.
- Shell hooks cannot see Cursor's stored MCP OAuth token.
- The live brief truncates constraints at 180 characters and uses the dump as the goal.
- Free-plan agent packets use smaller list limits than the compiler default, which flips compact mode on.
- `AGENTS.md`, `PRODUCT.md` hole 2, and `PLAN.md` still described unshipped hooks after `#58` landed them.

---

## Rigor

High on packet quality and on whether the brief actually arrives. Those are one-way for trust. A wrong brief is worse than a cold start.

Low on new surfaces. Product identity is already locked. Running a design bakeoff to turn Hypher into an orchestrator or a notes app would fight `PRODUCT.md`.

Skip a second architecture arena on "what Hypher is." That shape is dump, one note, writeback.

---

## What we refuse

These are how you fail to become indispensable while looking busy:

- Agent orchestration inside Hypher
- A spatial canvas, digest, health rings, extra Pulse panels
- Ingesting GitHub as memory
- Auto-minting projects from remotes
- Generic chat
- Competing with Cursor as an IDE

Thickness is a warmer session 2. Not a thicker app.

---

## Why agents still start cold

Four failures, in the order they showed up in this cloud session.

### 1. The brief never arrives

This session is a Cursor cloud agent. Hypher MCP tools were connected. `resolve_project_for_repo` mapped `litterthanlit/hypher` to project `hypher`. Plugin hooks did not run. The plugin always-on rule did not apply. `AGENTS.md` said read `PRODUCT.md` and that Phase 1a was next. Nobody told the agent to call `get_project_context`.

Local IDE hooks exist (`extensions/cursor/hooks/hooks.json`, shipped in `#58`). They inject `additional_context` only when `HYPHER_ACCESS_TOKEN` is in the hook process. Otherwise they print "go call MCP." `sessionEnd` skips writeback with `no-credential` if neither an API key nor an access token is in the environment. Cursor does not give that token to shell hooks.

Cloud agents are the path that most needs project memory. They are also the path with no hooks.

### 2. The brief is worse than the repo docs

When this run loaded the live brief, it contained:

- Summary, goal, and direction all restating "Dogfood dump on the real hypher project."
- Next move `Continue: Dogfood dump on the real hypher project.`
- One truncated constraint, cut mid-word (`no toke...`)
- No pinned decisions
- Compact mode on
- Memory marked stale

Keep those two causes separate. Missing PLAN constraints are a dump gap (they were never in the capture). Mid-word `...` and `Continue: <dump>` are compiler bugs.

That shape is not a mystery. `compileHeuristicMemory` takes the first dump sentence as summary, the first non-constraint sentence as both goal and direction, and if it cannot find a next move it emits `Continue: ${directionParts[0]}`. Synthesis also truncates constraint lines at 180 characters (`LINE_LIMIT` in `projectMemoryGenerate.ts`). The compiler truncates labeled lines again at 180 to 220 characters.

A diligent agent that follows `AGENTS.md` already has a better packet in `docs/PRODUCT.md`. Until the brief beats that, Hypher is skippable.

### 3. Writeback is still a hope

Matched receipts thicken memory without Accept. That shipped. The default `sessionEnd` body is git status plus "No product status inferred." If that event is treated as a work receipt, it can become the summary. The useful handoff is still the agent's `post_agent_event` call. Cloud sessions never hit the hook. Local sessions often hit `no-credential`.

### 4. Agent-facing docs contradict the code

`#58` landed session hooks. `PRODUCT.md` still said there were no hooks. `PLAN.md` still said do 1b next. `AGENTS.md` still said Phase 1a. The next agent was being sent to rebuild shipped work. That is Hypher failing its own job inside this repo.

---

## Designed units

Riskiest unknown first. Verification before features. Each unit ends in a check. Do not start the next unit until the current one is green.

### Unit 0. Stop sending agents to rebuild shipped work

Align `AGENTS.md`, `PRODUCT.md` hole 2, `PLAN.md`, and the CEO bot with `#58`.

Check: `.audit/fix-agent-context/check-docs.sh`.

This unit lands in the same PR as this playbook.

### Unit 1. Cloud agents load the brief once, with PRODUCT.md winning conflicts

Repo files that already always apply (`AGENTS.md`) tell the agent: if Hypher MCP is connected, `resolve_project_for_repo` then `get_project_context` once. Use the brief for last handoff, current next move, and constraints that are not already in `PRODUCT.md`. If they disagree, `PRODUCT.md` wins.

Check: a new cloud session transcript contains a `get_project_context` call before implementation. This PR can only install the instruction. The next cloud run is the proof.

### Unit 2. Capture the packet baseline before changing the compiler

Save the live brief. Write a committed with/without fixture that already exists in spirit (`hypher-web/src/lib/devLoopFixture.test.ts`) plus a live snapshot test:

- Constraint lines are not cut with `...` inside a do-not.
- Goal is not a prefix of the dump.
- Next move is not `Continue:` plus the dump.

Check: the snapshot of 2026-09-06 fails those assertions. That red is the baseline.

### Unit 3. Compile identity, do not echo the dump

Change `compileHeuristicMemory` and the line limits so constraints stay whole, goal is not the first dump sentence, and `Continue: <dump>` is not a next move. Split `Do not: A, B, C` into separate constraints.

Do not paywall list width in a way that turns the product off. `getAgentContextLimits` currently sets free packets to 3 items and pro to 8. The compiler then reports compact mode on for free. The brief is the product. Charge for something else.

Check: dump `Don't widen OAuth. Pulse stays three panels. Do not rebuild the canvas.` produces three intact constraint lines and a goal that is not that paragraph. The Unit 2 snapshot assertions go green.

Also in this unit, because they drop dumped constraints even when synthesis ran:

- Align the two `looksLikeDoNotDo` matchers. Heuristic accepts a mid-sentence don't. The packet only keeps lines that start with don't.
- `ARRAY_LIMIT` 8 is existing-first. A ninth constraint never enters durable memory.
- Home dump stays unsorted until assign. Inbox notes do not compile.
- Heuristic persist then async Claude can rewrite summary and next move after session 2 already loaded.

### Unit 4. Writeback without a second secret, without polluting memory

Session-end git-status receipts must not become summary or direction. Prefer one agent `handoff` with what changed, decisions, and next move. If the hook cannot post, the always-on instruction must.

Desktop hooks have the same hole as cloud, just quieter. Without `HYPHER_ACCESS_TOKEN` in the hook process, start only prints "call the tools." End skips `no-credential`. Settings → Add to Cursor installs MCP, not hooks.

Also in this unit:

- `transcriptHasHandoff` is a regex for `post_agent_event` and `handoff`. Session-start instructions contain both strings. A false skip means no writeback.
- A start-hook `matched=0` marker suppresses the whole session's end write, even if the repo is linked later.
- Free-plan 3 event slots plus Pulse-ranked GitHub questions can hide the handoff line. Warmth then depends only on durable `handoffNotes`.
- `artifact` and `next_action` neither receipt nor Accept. Inbox Save as note does not ingest. Mark reviewed orphans the row.

Check: post a hook-shaped receipt in a test. Memory summary does not become "Cursor session-end receipt." A real `handoff` body does land in the next brief. A transcript that only contains the start instruction still posts.

### Unit 5. Every agent surface, same packet

Local plugin hooks, cloud MCP, handoff CLI. Same brief. Unmatched repo still does not invent status. OAuth MCP currently omits activity that Clerk MCP includes. Pulse "latest brief" is a stored handoff row, not the live compile agents get.

Check: local plugin test suite already in `extensions/cursor/scripts/hypher-session.test.mjs`, plus one cloud transcript that shows brief load and one handoff. Pulse preview and `get_project_context` must not disagree on current next move.

### Unit 6. With/without on product context, then launch

Do not start this until Units 3 to 5 are green on Hypher itself. This is [`PLAN.md`](../../docs/PLAN.md) Phase 3. Film the with path. If Hypher loses, fix the packet. Do not add panels.

### After the loop is trusted

Reminders, native capture, later a spatial view of the same objects. Chat last, if ever. Same refusals as `PRODUCT.md`.

---

## Phase C loop

Each unit is an experiment.

1. State the hypothesis.
2. Make the smallest change.
3. Measure against the Unit check on the real artifact (brief text, transcript, test output). Not a self-report.
4. Keep it if it advanced the predicate. Revert it if it did not.

Verdicts are VERIFIED, NOT VERIFIED, or INCONCLUSIVE. Inconclusive is not a pass.

---

## What this run verified

| Claim | Verdict | Evidence |
|---|---|---|
| Cloud session did not receive a Builder Brief at start | INFERRED | No `additional_context` in this session. Plugin rule did not apply. README says hooks skip cloud. No hook transcript file |
| `litterthanlit/hypher` resolves to project `hypher` | VERIFIED | `resolve_project_for_repo` matched `ks77z49bnqhyz7pmagvtjq3dh98dvk0q` |
| Live brief is a truncated dump echo | VERIFIED | `.audit/fix-agent-context/evidence/live-brief-2026-09-06.md` |
| IDE session hooks exist in tree | VERIFIED | `extensions/cursor/hooks/hooks.json`, commit `13405a0` |
| Agent-facing docs still said hooks did not exist | VERIFIED | pre-change `docs/PRODUCT.md` hole 2, `docs/PLAN.md` "Do 1b next", `AGENTS.md` Phase 1a |
| Next cloud agent loads the brief without being asked | INCONCLUSIVE | instruction lands in this PR; needs a later session transcript |
| Unit 2 snapshot test that goes red on this brief | open | evidence file saved; no committed failing test in this PR |
| Packet compiler fix | open | not in this PR |
| With/without benchmark | open | not in this PR |

---

## Decision trail

[`.audit/fix-agent-context/decisions.tsv`](./decisions.tsv)
