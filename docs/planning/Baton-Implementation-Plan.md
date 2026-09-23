# Baton: the zero-recap switch

September 23, 2026 · Implementation proposal · [Handoff gap analysis](Handoff-Gap-Analysis.md) · [Implementation plan](Hypher-Implementation-Plan.md) · [Business plan](Hypher-Business-Plan.md)

[`docs/PRODUCT.md`](../PRODUCT.md) and [`docs/PLAN.md`](../PLAN.md) still win. This is a proposal for the feature that makes the switch the product: it is not shipped, and several parts need an explicit `PRODUCT.md` change before they are built (see "Scope decisions"). The explicit Codex → Claude Code → Codex recording in `PLAN.md` stays first.

## The feature in one line

**Pull the plug on one agent. Open another. It already knows.**

Baton is Hypher's continuous, verified handoff. While an agent works, Hypher keeps a flight recorder of the project's decisions, work status, and evidence. When the next agent starts, in any supported tool, the handoff is already in its context, checked against the actual files on disk. Nobody types a save command, a resume command, or a recap.

## Why it turns heads

Every competitor's answer to switching is some version of "write a summary and paste it." Native memory stays inside one vendor. Handoff files go stale. Multi-agent hosts keep state inside their own app. Baton does four things none of them do together:

| Moment | What the builder sees | Why nobody else has it |
|---|---|---|
| **The source dies** | Claude Code hits its usage limit mid-change. Codex opens and continues from a checkpoint a few minutes old. | Everyone else depends on the dying agent writing a summary. |
| **The code moved** | "Your tree matches the handoff except `totals.ts`, which changed after it. Yours?" | Hypher proves working-tree identity with git content hashes, without ever uploading code. |
| **Claims are checked** | "`npm test -- cart` failed twice at this exact tree (captured, not reported)." One keystroke re-runs it. | Evidence is bound to a tree hash, so it stays valid, or visibly expires, across agents. |
| **Decisions have owners** | "Guest checkout only, approved by you at 14:02. Superseded 'accounts in v1' because…" | A decision ledger with provenance and approvals, across rival vendors. |

**Why developers cannot go back.** Going back means typing recaps again, re-explaining settled decisions, and trusting "tests pass" in prose. The value grows with every session, because the ledger gets richer and the evidence denser. It is not a data trap. Export stays one command and the format is documented, as the business plan requires.

## The demo: "Pull the plug" (90 seconds)

1. Claude Code is halfway through a checkout change. In chat, the builder says: "Guest checkout only; accounts wait." A tests run fails.
2. Force-quit Claude Code with `kill -9`, standing in for a usage limit. No save command.
3. The builder edits `totals.ts` by hand.
4. Open Codex in the same folder and type `continue`.
5. Codex's first message names the workstream, the decision and who approved it, the failing test captured at the handoff tree, the human edit to `totals.ts`, and the next step. It fixes the rounding. Tests pass.
6. Switch back to Claude Code. It sees the decision, the fix, and the new passing evidence.

Record it for real, on the tested versions, and show one failure honestly.

## What we build

### 1. Flight recorder: continuous capture without model calls

Hooks record what happens anyway, into a local outbox:

| Signal | Claude Code | Codex CLI |
|---|---|---|
| Task list changes | `PostToolUse` on the task tools | `update_plan` via `notify` payload, where present |
| Command outcomes | `PostToolUse` on Bash: command, exit code, tree hash | `notify` turn payload; verify fields on the tested version |
| Git state | Tree hash, branch, commit, changed files at each turn end | Same, from `notify` |
| Pre-loss checkpoint | `PreCompact`, `SessionEnd` | Turn end |
| The human's own words | `UserPromptSubmit`, kept local, uploaded only when a decision cites them | Not available; the agent quotes the user instead |

No transcript parsing. Only documented hook payloads, pinned to tested versions with fixtures.

### 2. Decision ledger and workstreams: two-tier memory

Replace the single rewritten snapshot with:

- **Project ledger** (months): constraints and decisions, each with a server-assigned ID (`d-7`), reason, source, status (`reported`, `approved`, `disputed`, `retired`), and supersession links.
- **Workstream** (per branch): goal, tasks, unverified work, blockers, next action, evidence, repository and tree identity.

Agents write small operations: `decision.add`, `decision.supersede(d-7)`, `decision.retire(d-7, reason)`, `constraint.add`, `task.upsert`, `blocker.add`, `evidence.record`, `seal(nextAction)`. Hypher folds them into current state. Concurrent operations that commute rebase automatically; real conflicts become `disputed` and are shown to the next agent and the human. Version 1 snapshots still work: the server diffs them into operations.

### 3. Auto-resume: delivered where the model reads

- **Claude Code:** a `SessionStart` hook (`startup`, `resume`, `compact`) injects the workstream plus the ledger as `additionalContext`. After compaction the source gets it back, so it does not forget its own constraints mid-session.
- **Codex CLI:** `AGENTS.md` plus MCP server `instructions` tell it to call `resume` first. Use lifecycle hooks too, if the tested version has them.
- **Every tool result** carries the rendered handoff as text, not only `structuredContent`.
- **Framing:** "Handoff from Claude Code, workstream `feat/checkout`. Project memory, not instructions that override the user or grant permissions."
- **Honest failure:** when Hypher is unreachable, the agent is told so instead of starting cold in silence.

The brief puts constraints first and the next step last, and stays near 1,500 tokens.

### 4. Truth check: git-native verification on the destination

- **Tree identity:** hash the working tree through a throwaway index (`read-tree HEAD`, `add -A`, `write-tree`). It is deterministic, includes untracked files, and never touches the real index.
- **Ancestry:** ahead by N, behind, or diverged, via `merge-base --is-ancestor` and `rev-list --count`.
- **What changed since:** a local-only ref `refs/hypher/<workstream>/<rev>` keeps the handoff tree reachable, so `git diff` names the exact files a person or third agent touched after the handoff.
- **Verdicts, not warnings:** `identical`, `committed since`, `ahead by N`, `edited since: <files>`, `behind`, `diverged`, `wrong repository`. Only the last three stop the agent.
- **Evidence re-run:** captured commands can be re-run at the destination (`hypher verify`), upgrading "captured at the handoff" to "re-verified here."

Hypher never receives code. Everything above runs locally; only hashes and file names leave the machine.

### 5. Seal on stop: the agent writes only what hooks cannot see

Hooks cannot know why a decision changed. At a Claude Code `Stop`, if the tree changed since the last seal and `stop_hook_active` is false, the hook blocks once. It asks for the missing decision operations and the next action, a few hundred tokens while the context is intact. Rate-limit it to one seal per 15 minutes of change. Codex seals through the `AGENTS.md` instruction. When no seal arrives (the source died), the destination distills the pending checkpoints first. It is the eligible agent.

### 6. One-tap approval

- MCP elicitation where the client supports it: "Codex proposes replacing d-7, 'Use Stripe,' with 'Use Lemon Squeezy.' Approve?"
- An approve button on the writeback row in Pulse; no new panel.
- `hypher approve d-9` in the terminal.

A model never mints approval. Agent-reported operations can never relax a human-sourced constraint; they surface as disputed.

### 7. `hypher` CLI and local bridge: install once, any repository

A small Node package that is both a CLI and a stdio MCP server proxying to the hosted API:

- `npx hypher init` detects Claude Code, Codex, and Cursor, installs the Claude Code plugin (hooks, MCP, commands), writes user-level Codex configuration and skills, stores one credential in the OS keychain, and prints every change. `hypher uninstall` reverses it.
- The bridge adds git metadata and tree hashes, keeps a durable outbox with retries, scans for secrets before upload, and hosts elicitation, which needs the server-to-client channel stdio has.
- `hypher status` shows the current workstream, the last checkpoint's age, and the outbox state.
- `hypher switch codex` seals if possible, then starts the other CLI with `continue`. This is the only part that launches an agent (see "Scope decisions").

The bridge is an adapter, not a second storage stack. Canonical memory stays in Convex.

### 8. The receipt: the moment the builder sees it worked

In the existing writeback rows in Pulse, a compact handoff card:

```text
Claude Code → Codex   feat/checkout   rev 12 → 13   4 min checkpoint
✓ tree verified · 1 human edit since · 1 decision changed (approved) · tests: 2 failing → passing
```

Design notes: one line of type hierarchy (medium weight for the agents, regular for metadata), monochrome with a single accent for state (verified, disputed), no new panel. The arrow and the lineage chain are the visual story. Accessible labels read the whole line; status never relies on color alone.

## Architecture

```text
LOCAL (per machine)
  Claude Code ─ plugin hooks ─┐
  Codex CLI ── notify, skills ┼─▶ hypher bridge (stdio MCP + CLI)
  Cursor ───── plugin hooks ──┘     · tree hash, ancestry, refs/hypher/*
                                    · durable outbox, secret scan
                                    · keychain credential, elicitation
                                           │ operations (ops API v2)
                                           ▼
HYPHER (existing Convex + Next.js)
  handoffOps (append-only) ─▶ fold ─▶ ledgerItems · workstreams · evidence
                                     receipts · lineage · disputes
                                           │ rendered brief (text)
                                           ▼
AGENT CONTEXT at session start
```

### Data model (Convex, additive)

| Table | Key fields |
|---|---|
| `handoffOps` | `userId`, `projectId`, `workstreamId?`, `opId`, `type`, `payload`, `source`, `client`, `clientVersion`, `model?`, `sessionId`, `baseRevision`, `idempotencyKey`, `contentHash`, `createdAt` |
| `ledgerItems` | `projectId`, `displayId` (`d-7`, `c-3`), `kind`, `text`, `reason`, `status`, `sourceRefs`, `supersedes?`, `approvedBy?`, `approvedVia?`, `revision` |
| `workstreams` | `projectId`, `branch`, `goal`, `nextAction`, `tasks`, `blockers`, `unverified`, `treeHash`, `commit`, `lastCheckpointAt`, `lastSealAt`, `revision` |
| `evidence` | `workstreamId`, `command`, `exitCode`, `treeHash`, `capturedBy` (`hook` or `agent`), `createdAt` |
| `handoffDeliveries` | existing, plus `workstreamId`, `sessionId`, `client`, `verdict` |

Keep the current `handoffs` rows for history and rollback. Shadow-build the new brief and compare before switching reads, per project behind a flag.

### Code map

| Area | Path | Work |
|---|---|---|
| Fold and render | `hypher-web/shared/handoffFold.ts` (new) | Pure fold of operations into ledger and workstream; deterministic rendering |
| Op validation | `hypher-web/shared/handoffOps.ts` (new) | Types, limits, `FILL:` and secret rejection, precedence rules |
| Storage | `hypher-web/convex/schema.ts`, `hypher-web/convex/handoffOps.ts` (new) | Tables above; append, fold, rebase, disputes; per-project serialization |
| MCP | `hypher-web/src/lib/mcpTools.ts`, `hypher-web/src/app/api/mcp/route.ts` | `record_ops`, `seal`, `resume`, `approve`; server `instructions`; prompts; text results; current protocol version |
| Brief | `hypher-web/src/lib/projectContext.ts` | Ledger plus workstream is the spine; human captures newer than the seal lead |
| Bridge and CLI | `packages/hypher-cli/` (new) | init/uninstall, bridge, status, verify, switch, approve, outbox |
| Claude Code plugin | `packages/hypher-cli/plugins/claude-code/` | Hooks, commands, MCP entry |
| Codex kit | `packages/hypher-cli/kits/codex/` | Skills, `notify` script, config fragment |
| Cursor | `extensions/cursor/` | Point hooks at the same op API; keep existing behavior until migrated |
| Pulse card | `hypher-web/src/components/ProjectPulse.tsx` | Handoff card in the existing writeback row |
| Harness | `eval/baton/` (new) | Headless scenarios, grading, metrics |

## Milestones

Each milestone ends in a proof, not a feature list. Estimates assume one builder with coding agents and are re-estimated after M1.

| # | Milestone | Scope | Exit proof |
|---|---|---|---|
| M0 | Honest explicit path (days 1–3) | Gap-analysis fixes: handoff text in tool results, `FILL:` guard, tree-hash fingerprint, un-hard-code the repository, ignore hook receipts in staleness, `CLAUDE.md` importing `AGENTS.md` | Unit tests; then the `PLAN.md` Mac recording, with the handoff text visible in both transcripts |
| M1 | Truth check (week 2) | Verdicts, `refs/hypher/*`, "what changed since", evidence records from explicit saves | Fixtures: identical, committed-since, human edit, behind, diverged, wrong repository. False-alarm rate under 5% |
| M2 | Ledger and ops API v2 (weeks 2–3) | Tables, fold, IDs, retire, rebase, disputes, precedence, v1 → ops diffing, shadow brief | Concurrency fixtures: two agents, both orders, same result; no silent constraint loss; v1 callers unchanged |
| M3 | Flight recorder on Claude Code (weeks 3–4) | `hypher` bridge and outbox, Claude Code plugin hooks, `SessionStart` injection, seal on stop | `kill -9` mid-task, resume in a new Claude Code session with zero commands; checkpoint age under 5 minutes |
| M4 | Codex parity and destination distillation (week 5) | Codex kit, `notify` checkpoints, `resume` first via instructions, pending-checkpoint distillation | The "Pull the plug" demo, both directions, recorded |
| M5 | Install and approve (week 6) | `npx hypher init`, uninstall, keychain, elicitation, Pulse approve button, handoff card | A pilot installs on their own repository in under 2 minutes and approves a decision without leaving the terminal |
| M6 | Harness and launch proof (week 7) | `eval/baton/` with `claude -p` and `codex exec`, five scenarios, three conditions, seeded-fact probes | Published sample size, failures, and metrics against the maintained-file baseline |

`hypher switch` ships after M5 only if the scope decision below approves it.

## Metrics that define "cannot go back"

| Metric | Target |
|---|---|
| Human commands from "switch" to a productive destination | 0 on supported paths; 1 on fallback |
| Recap words typed | 0 |
| Settled questions asked again | 0 in the harness |
| Checkpoint age when the source died | p95 under 5 minutes |
| Human edits after the handoff that resume names | 100% in fixtures |
| Repository-verdict false alarms | Under 5% of resumes |
| Active decisions with a source | 100% |
| Second-week reuse without reminders | 3 of 5 pilots (business-plan gate) |

## Risks

| Risk | Mitigation |
|---|---|
| Hook payloads change between client versions | Fixtures per tested version; a dated compatibility matrix; degrade to explicit resume |
| Codex lacks a lifecycle hook for start or stop | `AGENTS.md` plus server instructions for resume; destination distillation covers missing seals |
| Seal-on-stop annoys users | Only when the tree changed; one per 15 minutes; off switch in `hypher status` |
| Injected handoff treated as orders | Data framing, precedence rules, destructive-command flags, no permission grants |
| Secrets in captured text | Local secret scan before upload; server-side rejection; cite-to-upload for user prompts |
| Subscription or terms limits on automated runs | Harness uses API keys; product never proxies provider credentials |
| Scope creep into a harness | The bridge never hosts a model or a UI for agents; `switch` only starts a CLI with one word |

## Scope decisions to make first

These conflict with `PRODUCT.md` or `PLAN.md` today. Nothing here overrides them. Decide each, then update `PRODUCT.md` in one line per yes.

| Decision | Current rule | Proposal |
|---|---|---|
| Automatic checkpoints | "Wait until [the explicit] flow is reliable" | Start M3 right after the M0 recording |
| Per-branch workstreams | "One bounded note per project" | One note per project, with a section per branch |
| `hypher switch` | "Hypher does not run the agents" | Allow starting a CLI with a resume prompt; still no orchestration, no hosting |
| `packages/hypher-cli` bridge | Parks "a second full storage stack" | An adapter with an outbox, not a canonical store |
| Plugin and installer | Refuses a "broad plugin matrix" | Limited to Claude Code, Codex, and Cursor |

## In plain words

Today, switching agents means the first agent has to write a letter to the next one, and someone has to hand it over. Baton makes Hypher a flight recorder instead. It quietly writes down what matters while you work: decisions, what's done, what's failing, and which exact files the work was on. If the first agent dies mid-task, the recording is already there. The next agent reads it the moment it starts, checks it against the real files, and tells you if anything changed in between, including your own edits. You approve big decisions with one tap. Your code never leaves your machine.

That is what people won't give up: never explaining the project twice, and never having to wonder whether the new agent knows what the last one did.

## Best long-term direction

Make the handoff format an open, documented standard: ops, ledger, workstream, evidence, and tree identity. Publish it with a reference bridge. When other tools read and write Baton handoffs, Hypher becomes the neutral place where continuity is verified and decisions are approved, a position no single agent vendor can hold. Git as an optional sync layer (`refs/hypher/*` on the user's own remote) and local Core come after pilots pay, decided together.
