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

`litterthanlit/hypher` resolves to the real **hypher** project. A dump exists. The live brief is still a truncated echo of that dump, and Cursor cloud agents still start without it. Do not treat that as dogfood done.

Do this in parallel with Phase 1c:

1. Keep the GitHub bind on the **hypher** project. Do not write back to **Try Hypher**.
2. Dump the actual constraints if they are still missing from the brief. Include: Pulse stays three panels. Do not widen OAuth. Do not rebuild the canvas. GitHub is a signal, not memory. `docs/PRODUCT.md` wins.
3. Every real coding session: load the brief at start (plugin hook locally, MCP once on cloud), one `handoff` at end, Accept only questions and suggestions.
4. Session 2 should be obviously better than session 1. If it is not, fix the packet before adding product.

Done when: a new Cursor cloud agent on this repo loads a brief that is not a dump echo, and Pulse shows that session’s handoff.

Diagnosis and remaining sequence: [`.audit/fix-agent-context/PLAYBOOK.md`](../.audit/fix-agent-context/PLAYBOOK.md).

---

## Phase 1 — Loop without ceremony

This is the “runs in the background” slice. **1a and 1b are done.** Do **1c** next. Then fix the packet before Phase 2.

### 1a. Silent synthesis + receipt memory — done

After a dump is assigned to a project, and after a matched `handoff` / `build_log`, Hypher updates summary, direction, decisions, constraints, next move, handoff notes.

- Same guts as `/api/project-memory/generate`. No Generate button. No new panel.
- Receipts thicken identity without Accept. Pulse still lists the event.
- Accept stays for `question` and `suggestion`.
- GitHub `build_log`s are signals, not receipts.

Done when: dump “don’t widen OAuth” → brief contains it as a constraint without a click. Post a handoff → next brief includes what changed and the next move without Accept.

### 1b. Session hooks — done in the IDE plugin

Shipped in `#58`. `extensions/cursor/hooks/hooks.json` runs `session-start.mjs` and `session-end.mjs`.

Caveats that are not Phase 1b work:

- Automatic inject and hook writeback need `HYPHER_ACCESS_TOKEN` or `HYPHER_API_KEY` in the hook process. Cursor does not expose MCP OAuth to shell hooks.
- Hooks do not run on Cursor cloud agents.

`/hypher-brief` and `/hypher-handoff` stay as manual overrides. Unmatched repo: do not invent status.

### 1c. Agents that never get IDE hooks

Cloud agents, background agents, and any session where the plugin hooks do not fire still have Hypher MCP. They must load the brief once (`resolve_project_for_repo`, then `get_project_context`) and post one `handoff` at the end.

`AGENTS.md` carries that instruction because it already always applies in this repo. `docs/PRODUCT.md` still wins if the brief disagrees.

Done when: a new Cursor cloud agent on this repo calls `get_project_context` once without the user asking, and a handoff lands in Pulse.

Until 1c is true, dogfood with MCP load plus `/hypher-handoff`. Do not wait to dump. Do not skip to Phase 2 while cloud sessions start cold.

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
| [`product/cursor-plugin-v1-spec.md`](./product/cursor-plugin-v1-spec.md) | Plugin contract for IDE hooks |
| [`.audit/fix-agent-context/PLAYBOOK.md`](../.audit/fix-agent-context/PLAYBOOK.md) | Why cloud sessions stay cold, and the packet-quality sequence |

Next coding session: **Phase 1c**. Cloud and other non-hook agents load the brief once. Then fix the packet so it beats `docs/PRODUCT.md` instead of echoing a dump.
