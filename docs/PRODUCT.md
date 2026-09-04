# Hypher

> Cursor already has the code. Hypher has the decisions that never made it into the code. The next agent starts warm.

This is the only product document. If another doc disagrees with this one, this one wins. Do not reconstruct the product from older playbooks, roadmaps, canvas specs, or launch kits.

---

## What Hypher is

Hypher is the **project memory under your agents**.

You dump the project as it actually is — rants, screenshots, chat exports, half-finished threads, “don’t do X.” Hypher turns that mess into **one bounded Builder Brief**. Agents read that note, do the work in Cursor (or elsewhere), and **write back**. The next session starts warmer.

Not a notes app. Not a task manager. Not an IDE. Not a second GitHub. Not attn. Not a moodboard.

| They own | Hypher owns |
|---|---|
| The code | Intent, decisions, constraints, current goal |
| The files | What never landed in the files |
| This session | The handoff into the next session |

The long-term assistant (reminders, native capture, a visual board of the same memory) is a **view of this loop**. It is not a different product, and it is not the build target now.

---

## The product is three things

```
dump  →  one note  →  writeback
```

1. **Dump.** One field. Paste, file, anything. No filing tax. Messy is the correct input.
2. **The note.** One Builder Brief per project: direction, decisions, do-not-do, open questions, next move. Bounded. Deterministic. The thing an agent reads once at session start.
3. **Writeback.** When an agent stops, it posts what changed. That update is how session 2 knows what session 1 did.

A project is a **name + a GitHub repo**, bound by a human. Unmatched repos do not mint projects. Cursor is a door into the brief, not a sync of the repository.

**Home** is dump. **Pulse** is the packet: latest captures, the brief, agent updates. Nothing else on that screen.

---

## Any notes, coherent context

Hypher’s job is to turn **any kind of note** into a brief an agent can use:

- one-liners and rants
- screenshots and files
- chat exports and meeting notes
- agent output and build logs
- links, bugs, product thoughts
- “don’t widen OAuth”

The builder should not have to write a wiki. Synthesis is Hypher’s problem.

**How this should feel:** dump garbage in, get a clean packet out. Summary, current direction, decisions, constraints, open questions, next move — compiled, not copy-pasted.

**How this must not feel:** a “Generate memory” button on every project card. v2 cut that verb because it was dashboard theater. Synthesis happens **when something is dumped or written back**, as part of compiling the note. `/api/project-memory/generate` is an implementation detail, not a product surface.

If the brief is still a skeleton of “No summary captured yet” after a real dump, Hypher has failed the job.

---

## The loop

```
human dumps
    → Hypher compiles a Builder Brief
        → agent loads the brief at session start
            → agent works in the IDE
                → agent writes one handoff at session end
                    → Hypher thickens memory
                        → the next brief is warmer
```

Success is **session 2**. Not a prettier first screen.

Demo this, sell this, dogfood this: a new chat that already knows the decisions the last chat made.

---

## What is built vs what is still a hole

The loop exists in code. Holes 1 and 3 are closed: dump and matched receipts compile identity without a Generate button or Accept click. Session start/end still needs the agent to remember the tools (hole 2). GitHub stays a signal (hole 4).

### 1. Notes become a coherent identity after dump or writeback

The brief compiler includes raw captures and recent agent events. Durable identity — summary, direction, decisions — lives in project memory.

After a dump is assigned to a project, and after a matched `handoff` / `build_log`, Hypher compiles that identity using the same guts as `/api/project-memory/generate`. There is no Generate button. GitHub CI / stale-PR `build_log`s stay signals.

### 2. Hypher does not hear a session unless the agent remembers to call it

Session start/end is a skill plus an always-on rule. There are **no `sessionStart` / `sessionEnd` hooks**. If the agent does not call the tools, Hypher hears nothing and session 2 is cold again.

**Build:** when the Cursor plugin is connected and the repo is linked, load the brief once at session start. Post one `handoff` at session end. Default to one event, not a firehose. Commands `/hypher-brief` and `/hypher-handoff` stay as manual overrides.

### 3. Receipts thicken memory; Accept is for judgment

A matched `handoff` / `build_log` that is a receipt of work updates memory without a click (what changed, next move, handoff notes). Pulse still lists the event. Accept stays for **questions and suggestions**.

### 4. GitHub is a signal, not memory

GitHub sync can inject CI failures, stale PRs, labeled blockers. It does **not** ingest the repo as product memory. That is correct.

Do not auto-sync Cursor repos into Hypher. That is a Notion import with a nicer name. Cursor already has the code.

---

## Cold start

Empty Hypher is an empty brief. That is honest. It is also a dead first session.

Hypher does **not** fill the hole by sucking in the repository. The valuable context is exactly what is **not** in git.

Cold start, in this order:

1. **One dump.** Messy is enough. “Shipped the gate. Empty state still broken. Don’t widen OAuth.”
2. **Or the first session writes the seed.** Link the repo, work normally, force a handoff at the end. Session 2 is the first warm one.
3. **Four questions, once, only if they dump nothing:** goal, current task, do-not-do, definition of done. Then stop asking.

If there is no dump and no first handoff, refuse to invent status. Unmatched repo → link it. Do not guess.

Show a skeleton brief that is embarrassing on purpose, then show it fill. That is the aha.

---

## What Pulse is

Three things. Not eight.

- **Latest captures** — what was dumped
- **Builder Brief** — the note, copyable / fetchable
- **Agent updates** — what wrote back

Pulse answers: what changed, what matters, what is next. Interpretation, not a control panel.

---

## What we refuse

Do not build these. Older specs will ask. Say no.

- Spatial canvas, list tab, public share canvases, demo canvas
- Daily digest, email digest, health rings, ambient ask
- Generate-memory buttons, activation checklists, Notion import
- Auto-creating projects from unmatched repos
- Generic assistant chat before memory is trusted
- Agent orchestration inside Hypher (Hypher does not run the agents)
- Full task manager, native workspace rewrite, MCP marketplace
- New Pulse panels
- Launch theater (Raycast store, Product Hunt weekend, “Notion clone with a canvas”)

Attn is a **daily attention surface**. Hypher is **project memory across agent sessions**. Same calm feeling, different object. Do not compete with attn by piping Slack and mail into Hypher.

A visual moodboard (Notion × Freeform × Obsidian) is allowed **later as a view of trusted memory**. Building it first is how you get a pretty empty board.

---

## What to build, in order

Prove the loop. Then film it. Then maybe remind. Then maybe lay it out in space.

The sequence lives in [`PLAN.md`](./PLAN.md). Short version:

1. Dogfood Hypher on Hypher (link this repo, dump once, brief + handoff every session).
2. Remove ceremony (silent synthesis, receipt memory, session hooks).
3. Empty state without ingesting GitHub.
4. With/without benchmark — that recording is the launch.
5. Only then: reminders, native capture, later a spatial view. Chat last, if ever.

---

## How we know it works

Not “we shipped more surfaces.” This test:

> Can a new agent continue the project without the builder re-explaining it?

### Benchmark (this is the demo)

Pick a task where **product context**, not missing files, is why the agent fails. Example: continue a half-finished feature with three prior decisions and two constraints (“don’t widen OAuth,” “Pulse stays three panels”). The repo alone will not contain those.

- Same repo, same model, same prompt.
- **Without Hypher:** agent gets only the repo. Score: did it violate a decision, reopen a closed question, or rebuild a cut surface?
- **With Hypher:** one dump of the decisions, a prior handoff in Pulse, then the brief. Same rubric.
- Run it more than once. Film the with path: dump → brief in Cursor → agent respects a do-not-do → writeback → new chat is warmer.

If with-Hypher does not win, do not launch. Fix the packet.

Landing stays the loop, not a feature list:

> dump your project. they read one note. they write back.

Stakes, when needed: **Stop re-explaining the project every session.**

---

## How agents working on Hypher should behave

1. Read this file first. Only this file for product direction.
2. Keep dump fast. Keep Pulse to three things. Keep the brief bounded.
3. Prefer automatic synthesis and automatic start/end over new UI.
4. Structured writeback (`handoff`, `build_log`, `question`, `suggestion`, `artifact`, `next_action`). Not a chat room for agents.
5. Tool-neutral packets. Cursor is the first door, not the only one.
6. Never claim a feature complete if only the backend is wired. There must be a path a builder or an agent actually takes.
7. When stuck between “more product” and “close the loop,” close the loop.

---

## Where the loop lives in code

| Piece | Place |
|---|---|
| Brief compiler | `hypher-web/src/lib/projectContext.ts` |
| Pulse | `hypher-web/src/components/ProjectPulse.tsx` |
| Dump | `hypher-web/src/components/CaptureHome.tsx` |
| Memory | `hypher-web/convex/projectMemories.ts`, `hypher-web/src/app/api/project-memory/generate/route.ts` |
| Writeback | `hypher-web/convex/agentEvents.ts`, `hypher-web/src/app/api/agent/events/route.ts` |
| MCP | `hypher-web/src/lib/mcpTools.ts`, `hypher-web/src/app/api/mcp/route.ts` |
| Cursor plugin | `extensions/cursor/` (skills today; hooks are the next slice) |
| Handoff CLI | `hypher-web/tools/hypher-handoff.mjs` |

Plugin how-to: `extensions/cursor/README.md`. Event payload shape: `hypher-web/docs/agent-handoff.md`. UI tokens: `hypher-web/STYLING.md`.

CEO voice for Grok (not a second product): `docs/bots/hypher-ceo.md`.
Sequence: `docs/PLAN.md`.

Do not treat those as product direction. They are how.
