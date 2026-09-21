# Build order

[`PRODUCT.md`](./PRODUCT.md) is what Hypher is. This file is **order**.

Working promise: **Switch agents without starting over.**

This milestone is reliable continuation between two agents on the same local working tree. First pair: Codex CLI and Claude Code. Explicit handoff and resume are enough. The loop stays dump / capture → one note → writeback. A warmer session 2 and a switch to another agent are the same job.

`docs/planning/` is the detail behind this sequence. If it disagrees with [`PRODUCT.md`](./PRODUCT.md) or this file about what to build next, those two win.

---

## Already in the product

Do not rebuild these to start the spike.

- **Phase 1a — done.** After a dump is assigned, and after a matched `handoff` / `build_log`, Hypher updates the note: summary, direction, decisions, constraints, next action. Same guts as `/api/project-memory/generate`. No Generate button. Receipts thicken the note without Accept. Accept stays for `question` and `suggestion`. GitHub `build_log`s stay signals.
- **Phase 1b — in the Cursor plugin.** `extensions/cursor/hooks/hooks.json` runs `session-start.mjs` and `session-end.mjs`. Automatic inject and hook writeback need `HYPHER_ACCESS_TOKEN` or `HYPHER_API_KEY` in the hook process. Hooks do not run on Cursor cloud agents. `/hypher-brief` and `/hypher-handoff` stay manual overrides.
- **MCP load — keep using it.** Cloud agents and any session the hooks miss call `resolve_project_for_repo`, then `get_project_context` once, and post one `handoff` at the end. [`AGENTS.md`](../AGENTS.md) carries that. Skipping it makes the next session cold.
- GitHub stays a signal. Unmatched repos do not mint projects. Pulse stays three things: latest captures, the note, writebacks.

Packet quality still matters. It is not the next coding slice.

---

## This milestone

### P0. Doc lock

This change. [`PRODUCT.md`](./PRODUCT.md), this file, and [`AGENTS.md`](../AGENTS.md) name the promise, the handoff contents, the first proof, what already works, and what is parked.

Done when: those three files tell one story, and they do not describe Codex or Claude adapters as shipped.

### Next. Integration spike

Codex CLI and Claude Code on one workspace. Same local working tree.

On each side, show three things: a useful checkpoint, storage, and delivery into a new session. Explicit save and resume are the path. Add automatic checkpoints only where lifecycle support is verified on the recorded version. Use supported tools. Do not build on private transcript formats.

Record the exact client versions.

Acceptance: one real switch in each direction, including a changed decision and unfinished work, with source references and the correct destination project. The destination verifies branch, commit, and dirty state. Memory does not move code.

If a surface cannot do this, narrow the support list immediately. Do not wrap an unproven integration in UI.

Not done. Do not claim it.

### Then. Smallest round trip

Reuse the existing Convex app and MCP tools. Do not add a second database for this proof.

Active agent → structured proposal → Hypher validation and revision → durable memory → destination note → delivery receipt.

- The active agent proposes the handoff. It already has the conversation. No compulsory second model call on every switch.
- Every write has an idempotency key and an expected base revision. A stale write reconciles against the current revision.
- The proposal matches the handoff in [`PRODUCT.md`](./PRODUCT.md): goal, constraints, decisions and reasons, completed versus unverified work, blockers, next action, sources, repository / branch / commit, dirty state as metadata.
- Preparation records the destination and revision. A separate destination acknowledgment records that the agent reports reading the handoff; useful continuation still needs a real observed run.
- Reuse current MCP endpoints. Do not invent a second protocol beside them.

Tests that belong on this ticket: duplicate submission, stale revision, changed decision, wrong project, failed delivery.

The revisioned save and resume path lives on the existing Convex `handoffs` table and MCP (`post_agent_event` to save, `prepare_handoff` to prepare, `acknowledge_handoff` after the destination reads it). The latest structured snapshot is the Builder Brief; old note entries remain history. A simulated round trip covers failure cases. That is not the live proof.

Done when: Codex → Claude Code → Codex on one repo leaves a stored handoff with sources and a receipt, and the return trip carries the changed decision, without a manually written recap. The live recording still needs a Mac with both CLIs. See [`hypher-web/docs/codex-claude-handoff.md`](../hypher-web/docs/codex-claude-handoff.md).

### After the round trip. Evaluation

With/without stays secondary until that proof exists.

Compare native context, a maintained handoff file, and Hypher. Hold the task, the starting tree, the destination settings, and the tools fixed inside each comparison. Report the sample size and the failures. A schema-valid note can still be wrong. Do not treat an unrun benchmark as a launch.

---

## Out of scope

Not this milestone:

- Canvas, moodboard, list tab, public or demo canvases
- Daily digest, email digest, health rings, ambient ask, extra Pulse panels
- Notion import, Generate-memory buttons, activation checklists
- Auto-minting projects from unmatched repos
- Pricing changes and new checkout offers
- Local SQLite Core, `packages/memory-core`, or a second full storage stack
- Broad plugin matrix beyond Cursor (already supported) and the Codex / Claude spike
- Replacement coding harness or a host UI for two agents
- Agent orchestration inside Hypher
- An always-on reasoning service
- Native Mac or iOS rewrite
- Slack or mail ingestion

---

## How to use this

| Read | For |
|---|---|
| [`PRODUCT.md`](./PRODUCT.md) | What Hypher is |
| This file | What to build next |
| [`planning/Hypher-Implementation-Plan.md`](./planning/Hypher-Implementation-Plan.md) | Spike, storage, and evaluation detail |
| [`planning/Hypher-Business-Plan.md`](./planning/Hypher-Business-Plan.md) | Who it is for, and pricing hypotheses to leave alone |
| [`planning/Astra-Plan.md`](./planning/Astra-Plan.md) | Strategy history |
| [`bots/hypher-ceo.md`](./bots/hypher-ceo.md) | Ship-or-cut judgment after this file |

Next: run the live Codex CLI → Claude Code → Codex recording on a Mac. The in-repo slice is explicit save and resume on existing Convex and MCP storage. Do not treat that slice as the recording.
