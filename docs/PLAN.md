# Future plan

[`PRODUCT.md`](./PRODUCT.md) is what Hypher is. This file is **order**.

Build the proof. Not more product.

> Dump once. Then Hypher keeps the project warm without anyone thinking about Hypher.

Until the loop runs without ceremony, Hypher is a very good paste buffer with an API. Do not launch that. Do not dress it up with panels.

Start at the first phase that is not done. Do not skip ahead to launch, reminders, or a spatial board.

---

## The proof

A new agent continues this project without Nick re-explaining it.

Not: more surfaces, a seeded demo canvas, Chrome store, Raycast, digest email.

The launch *is* a 90-second with/without. One tweet. One landing. Controlled beta with people who already drown in agent sessions.

---

## Now

Dogfood is already possible. It is still manual. The MCP account has been seen with only **Try Hypher**. `litterthanlit/hypher` was unmatched — link it in Settings → Integrations or writebacks land on the wrong project.

Do this immediately, in parallel with Phase 1. If it does not happen, nothing else matters.

1. Create or open a real Hypher project for this repo. Bind `litterthanlit/hypher`. Not “Try Hypher.”
2. Dump the actual constraints once. Messy is enough. Include: Pulse stays three panels. Do not widen OAuth. Do not rebuild the canvas. GitHub is a signal, not memory. `docs/PRODUCT.md` wins.
3. Every real coding session: load the brief at start (`/hypher-brief` until hooks exist), one `handoff` at end, Accept only questions and suggestions.
4. Session 2 should be obviously better than session 1. If it is not, fix the packet before adding product.

Done when: this repo resolves, Pulse shows Hypher’s own handoffs, and a new Cursor chat can read a brief that is not a skeleton of “nothing captured yet.”

---

## Phase 1 — Loop without ceremony

This is the “runs in the background” slice. Do **1a and 1b**. Memory writes first, then hooks.

### 1a. Silent synthesis + receipt memory — next

After a dump is assigned to a project, and after a matched `handoff` / `build_log`, update summary, direction, decisions, constraints, next move, handoff notes.

- Same guts as `/api/project-memory/generate`. No Generate button. No new panel.
- Receipts thicken identity without Accept. Pulse still lists the event.
- Keep Accept for `question` and `suggestion`. Humans review judgment, not receipt of work.
- After writeback, the next `get_project_context` is warmer without a buried API call from the builder.
- GitHub `build_log`s are signals, not receipts.

Where: `hypher-web/convex/agentEvents.ts`, `hypher-web/convex/projectMemories.ts`, `hypher-web/src/app/api/project-memory/generate/route.ts`, dump/assign path in `hypher-web/src/lib/useStore.ts`.

Done when: dump “don’t widen OAuth” → brief contains it as a constraint without a click. Post a handoff → next brief includes what changed and the next move without Accept.

### 1b. Session hooks

When the Cursor plugin is connected and the repo is linked:

- `sessionStart` loads the Builder Brief once (`additional_context`). Not every turn.
- `sessionEnd` posts **one** `handoff`. Not a firehose of `build_log`.
- `/hypher-brief` and `/hypher-handoff` stay as manual overrides.
- Unmatched repo: do not invent status. Point at Integrations.

Where: `extensions/cursor/` — `hooks/hooks.json`, plugin manifest, skills as fallback. Contract: `docs/product/cursor-plugin-v1-spec.md`.

Done when: opening this repo in Cursor with the plugin on loads the brief without a slash command, and stopping the session writes one event Hypher can see.

Until 1a and 1b ship, dogfood with `/hypher-brief` and `/hypher-handoff`. Do not wait to dump.

---

## Phase 2 — Empty without becoming GitHub

Cold start is honest emptiness, then fill. Not a fake canvas.

On first link:

> Dump the current goal, or start a session and we’ll capture the first handoff.

Show a skeleton brief that is embarrassing on purpose. Then show it fill. That is the aha.

- One dump, or the first handoff is the seed.
- Four questions once if they dump nothing: goal, current task, do-not-do, done. Then stop asking.
- Never ingest the repo as product memory. Cursor already has the code.
- Never auto-mint a project from an unmatched remote.

Done when: a new linked repo with no notes still has a path to a real brief by the end of session 1, and session 2 is warm.

---

## Phase 3 — Benchmark is the launch

Do not start this until Phase 1 is true on Hypher itself and dogfood is happening on this repo.

Pick a task where **product context**, not missing files, is why the agent fails. Example: continue a half-finished feature with “don’t widen OAuth” and “Pulse stays three panels.” The repo will not contain those.

- Same repo, same model, same prompt.
- Without Hypher: score violations (reopened decisions, rebuilt cut surfaces).
- With Hypher: one dump, a prior handoff, then the brief. Same rubric.
- Run more than once. If with-Hypher does not win, do not launch. Fix the packet.

Film 90 seconds: dump → brief in Cursor → agent respects a do-not-do → one writeback → new chat is warmer.

Launch that video. One tweet. Landing stays:

> dump your project. they read one note. they write back.

Stakes: **Stop re-explaining the project every session.**

Controlled beta: builders who already drown in agent sessions. Ignore Chrome store, Raycast, canvas screenshots, digest email. Those sell a different app.

Done when: the recording exists, the landing matches it, and a handful of real users run the same loop on their own repos.

---

## Phase 4 — Only after the loop is trusted

Do not start this phase because it is interesting. Start it because session 2 is already obviously better.

**Assistant (attn-shaped, project-scoped):**

- This project went stale.
- The agent left a question.
- Native capture companions: Mac hotkey, iOS share sheet.

**Then visual:** a spatial board of the **same** objects. Freeform / Obsidian feeling as a view of trusted memory. Not a new product.

**Last, if ever:** generic chat.

---

## Never

- More Pulse panels
- Notion import
- Health rings
- Agent orchestration inside Hypher (Hypher does not run the agents)
- Native workspace rewrite
- Marketplace MCP catalog
- Canvas, list tab, public/demo canvases
- Daily digest / email digest / ambient ask
- Generate-memory buttons
- Auto-creating projects from unmatched repos
- Competing with attn by piping Slack and mail into Hypher

GitHub stays a signal (CI, stale PRs, labeled blockers). That is a lock, not a later phase.

---

## How to use this

| Read | For |
|---|---|
| [`PRODUCT.md`](./PRODUCT.md) | What Hypher is |
| This file | What to build next |
| [`bots/hypher-ceo.md`](./bots/hypher-ceo.md) | Ship-or-cut judgment |
| [`product/cursor-plugin-v1-spec.md`](./product/cursor-plugin-v1-spec.md) | Plugin contract for Phase 1b |

Next coding session: **Phase 1a**. Silent synthesis + receipt memory. No new UI.
