# Hypher

> Switch agents without starting over.

This is the only product document. If another doc disagrees with this one, this one wins. `docs/planning/` records the bet in detail. It does not override this file, and it is not evidence that a spike has shipped.

---

## What Hypher is

Hypher is the **project memory under your coding agents**.

You dump the project as it actually is — rants, screenshots, chat exports, half-finished threads, “don’t do X.” Hypher turns that mess into **one note**. The next agent reads that note and continues. While it works, Hypher records what matters. When it stops, it writes back.

The working promise is the product: a builder switches agents on the same project and does not start over.

**Baton** is how the promise ships: pull the plug on one agent, open another, and it already knows. Hypher records decisions, work status, and evidence while an agent works, delivers them to the next agent at session start, and checks them against the files on disk. Nobody types a recap.

Not an IDE. Not a second GitHub. Not a canvas. Not a notes app. Not a task manager. Not attn. Not an agent host.

| They own | Hypher owns |
|---|---|
| The code, the files, the working tree | The goal, the constraints, the decisions and why |
| This session | The handoff into the next session or the next agent |
| Uncommitted edits | A fingerprint proving which edits exist, and which changed since |

Memory does not transfer code or uncommitted files. Only hashes, file names, and commit identity leave the machine. The destination verifies the working tree before it treats the note as ready. On a mismatch, say what differs.

Cursor already has the code. Hypher has what never landed in the files.

---

## The loop

```
dump / capture  →  one note  →  writeback
```

1. **Dump / capture.** One field. Paste, file, anything. No filing tax. Messy is the correct input. An agent checkpoint is the same kind of capture.
2. **The note.** One bounded note per project. The live product and MCP still call it the Builder Brief. Same object. It has two tiers:
   - **Decision ledger** — constraints, decisions with reasons, supersession, and who approved them, deferred ideas. Lives for months. Every item has a stable ID.
   - **Workstreams** — one section per branch: goal, tasks, unverified work, blockers, next action, evidence, and tree identity. Lives for hours to days.
3. **Writeback.** When an agent stops, it seals what hooks cannot see: why a decision changed, and the next action. That is how the next session knows what the last one did.

**Handoff is continuous.** The agent's work is checkpointed as it happens, sealed when it stops, and verified against the working tree on resume. If the source agent dies — a usage limit, a crash, a compaction — the last checkpoint still stands, and the next eligible agent finishes the job.

A handoff carries:

- current goal
- constraints
- decisions and the reasons, with provenance
- completed work versus unverified work
- evidence: commands, exit codes, and the tree they ran against
- blockers
- next action
- source references
- repository, branch, commit, and tree identity, plus dirty state as metadata

Ideas stay separate from approved decisions. A reported test pass is not a captured test result. A claim with no source is labeled an agent report. Agents propose changes as small operations; Hypher merges them. An agent report can never relax a human-sourced constraint. Ambiguous contradictions stay visible as disputed. A model never approves a decision; a human does, in one tap.

What Hypher passes on is not the transcript. It is a bounded brief — constraints first, next action last — built from the ledger and the workstream. It never carries hidden reasoning, code, diffs, or secrets.

Session 2 starting warm and a switch from Codex to Claude Code are the same product. Both mean the next reader already has the note.

A project is a **name + a GitHub repo**, bound by a human. Unmatched repos do not mint projects. An agent door is a way into the note, not a sync of the repository.

**Home** is dump. **Pulse** shows the loop and nothing else: latest captures, the note, writebacks. Handoff cards, approvals, and verdicts live inside those three.

---

## First proof

The first proof is one repository and the same local working tree:

> Codex CLI → Claude Code → Codex, with a changed decision and unfinished work, and no manually written recap.

The receiving agent continues from the note. It can see why a decision changed, what is done, what is only claimed, and what to do next. It checks the working tree itself.

Explicit handoff and resume are enough for this proof. Baton's automatic checkpoints start right after it is recorded, on the tested versions.

**This proof has not been run.** Codex CLI and Claude Code adapters are the next integration spike. Do not claim they work. Do not claim a benchmark win. Do not advertise arbitrary desktop, browser, or cloud session compatibility.

Cursor hooks and MCP already exist and stay supported. They are the working door for Cursor. They are not a stand-in for the Codex ↔ Claude Code proof.

## The Baton proof

After the first proof, the proof that matters:

> Claude Code is mid-change. Kill it — no save command. Edit a file by hand. Open Codex and type “continue.” Codex names the workstream, the changed decision and who approved it, the failing test captured at the handoff tree, and your hand edit. It finishes the work. Reverse the direction.

The same proof must hold inside one tool: Claude Code → Claude Code after a quit or `/clear`, Codex → Codex, a session across its own compaction, and two parallel sessions of one tool that do not overwrite each other. `docs/PLAN.md` lists the checks.

Not run. Do not claim it until it is recorded on named versions, with one honest failure shown.

---

## What already works

The Cursor loop exists. Do not rebuild it to start the spike.

- Dump and a matched `handoff` / `build_log` compile the note. No Generate button. Receipts update memory without an Accept click.
- The Cursor plugin ships local `sessionStart` / `sessionEnd` hooks. Automatic inject and hook writeback still need a Hypher token in the hook process. Cursor does not give shell hooks the MCP OAuth token. Hooks do not run on Cursor cloud agents.
- Sessions that never run those hooks load the note once through MCP: `resolve_project_for_repo`, then `get_project_context`. They post one `handoff` at the end. `/hypher-brief` and `/hypher-handoff` stay manual overrides.
- Revisioned structured save and resume (`post_agent_event` with `proposal`, `prepare_handoff`, `acknowledge_handoff`) are in the tree. The live CLI round trip is not recorded.
- Accept stays for **questions and suggestions**.
- GitHub can surface CI failures, stale PRs, and labeled blockers. It does not ingest the repo as product memory.

A note that only restates this file is skippable. It has to carry the last writeback, the current next action, and constraints that are not already in the files.

If the note is still a skeleton after a real dump, Hypher has failed the job.

---

## Cold start

Empty Hypher is an empty note. That is honest.

Hypher does not fill the hole by reading the repository. The valuable context is what is not in git.

1. **One dump.** Messy is enough. “Shipped the gate. Empty state still broken. Don’t widen OAuth.”
2. **Or the first session writes the seed.** Link the repo, work, hand off at the end. The next session is the first warm one.
3. **Four questions, once, only if they dump nothing:** goal, current task, do-not-do, definition of done. Then stop asking.

No dump and no first handoff means no invented status. Unmatched repo means link it.

---

## What Baton may add

These are in scope for Baton. They are sequenced in `docs/PLAN.md`. None of them is shipped.

- **Flight recorder.** Hooks record task lists, command outcomes, and git state from documented payloads, into a local outbox. No model calls. No transcript parsing.
- **Seal on stop.** When the tree changed since the last seal, the agent is asked once for the missing decision operations and next action.
- **Auto-resume.** The note is delivered at session start, and again after compaction, in text the model reads, framed as memory and not as orders.
- **Truth check.** Tree hash, ancestry, and “what changed since” verdicts, computed locally with git. Only a wrong repository, a behind tree, or a diverged tree stops the agent.
- **One-tap approval** in the terminal or on a Pulse writeback row.
- **`hypher` CLI and local bridge.** One install per machine for Claude Code, Codex, and Cursor. The bridge is an adapter with an outbox and a keychain credential. It is not a store; canonical memory stays in the existing Convex app.
- **`hypher switch <agent>`.** Seals the current workstream and starts the other supported CLI with a resume prompt. That is all it does. Hypher still does not orchestrate, host, or supervise agents.

---

## What we refuse

Parked for this milestone. Older specs will ask. Say no.

- Spatial canvas, moodboard, list tab, public share canvases, demo canvas
- Daily digest, email digest, health rings, ambient ask
- Generate-memory buttons, activation checklists, Notion import
- Auto-creating projects from unmatched repos
- Generic assistant chat, suggestion popups, personal workflow learning
- Agent orchestration inside Hypher: running, scheduling, supervising, or routing between agents. Starting one CLI with a resume prompt is not orchestration.
- A replacement coding harness, or a UI that hosts two agents
- Uploading code, diffs, or full transcripts
- Full task manager, native workspace rewrite, MCP marketplace
- Plugins or installers beyond Claude Code, Codex CLI, and Cursor
- New Pulse panels
- Pricing changes
- Local SQLite Core, and any second canonical storage implementation. The Baton bridge is an outbox, not a store.
- Impact-analysis dashboards
- Launch theater (Raycast store, Product Hunt weekend)

Attn is a daily attention surface. Hypher is project memory across agent sessions. Do not compete with attn by piping Slack and mail into Hypher.

A visual board is a later view of memory people already trust. It is not this milestone.

Prices in `docs/planning/` are hypotheses. Leave billing alone. Honor existing paid commitments.

---

## How we know it works

> Can the next agent continue without the builder writing a recap?

First gate: the Codex → Claude Code → Codex proof, with source references and a delivery receipt, stored through the existing Convex and MCP path.

Second gate: the Baton proof — a killed source, a hand edit, zero commands — in both directions.

The with/without comparison — native context, a maintained handoff file, and Hypher — waits until those exist. No sample has been run. Publish the sample size and the failures when there is a run. Do not publish a percentage ahead of one.

Baton targets to instrument, not advertise: zero recap words typed; zero human commands on supported paths; checkpoint age under five minutes when a source dies; every hand edit after a handoff named on resume; repository false alarms under five percent.

When the proof exists, the line is:

> Switch agents without starting over.

The loop people already know stays:

> dump your project. they read one note. they write back.

---

## How agents working on Hypher should behave

1. Read this file first. Only this file for product direction.
2. Keep dump fast. Keep the note bounded. Keep Pulse to captures, the note, and writebacks.
3. Load the note once. Write one handoff at the end, in the shape above. Do not claim code was synced.
4. Structured writeback (`handoff`, `build_log`, `question`, `suggestion`, `artifact`, `next_action`). Not a chat room for agents.
5. Cursor stays supported. Codex and Claude adapters, and every Baton piece, are unproven until a recording says otherwise.
6. Never claim a feature complete if only the backend is wired. There must be a path a builder or an agent actually takes.
7. When stuck between more product and the round trip, build the round trip.

---

## Where the loop lives in code

| Piece | Place |
|---|---|
| Note compiler | `hypher-web/src/lib/projectContext.ts` |
| Pulse | `hypher-web/src/components/ProjectPulse.tsx` |
| Dump | `hypher-web/src/components/CaptureHome.tsx` |
| Memory | `hypher-web/convex/projectMemories.ts`, `hypher-web/src/app/api/project-memory/generate/route.ts` |
| Writeback | `hypher-web/convex/agentEvents.ts`, `hypher-web/src/app/api/agent/events/route.ts` |
| Structured handoff | `hypher-web/shared/structuredHandoff.ts`, `hypher-web/convex/structuredHandoffs.ts` |
| MCP | `hypher-web/src/lib/mcpTools.ts`, `hypher-web/src/app/api/mcp/route.ts` |
| Cursor plugin | `extensions/cursor/` |
| Handoff CLI | `hypher-web/tools/hypher-handoff.mjs`, `hypher-web/tools/codex-claude-handoff.mjs` |

Plugin how-to: `extensions/cursor/README.md`. Event payload shape: `hypher-web/docs/agent-handoff.md`. UI tokens: `hypher-web/STYLING.md`. Baton design: `docs/planning/Baton-Implementation-Plan.md`.

CEO voice for Grok (not a second product): `docs/bots/hypher-ceo.md`.
Sequence: `docs/PLAN.md`.
Planning detail: `docs/planning/`.

Do not treat those as product direction. They are how.
