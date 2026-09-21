# Hypher implementation plan

September 21, 2026 · Proposed build sequence · [Business plan](Hypher-Business-Plan.md) · [Astra strategy](Astra-Plan.md)

## Outcome and evidence boundary

Deliver one reliable workflow: a builder hands a project from Codex to Claude Code, or back, and the receiving agent continues without a manually written recap. Start with the same local working tree. Do not build a full replacement coding harness yet.

Repository inspected: `648c6cb80f9a5bce513d8c7614bdbf93ce38334b`. Existing foundations include Next.js, Convex, Clerk, Stripe, MCP tools, brief compilation, memory writes, and Cursor hooks. The earlier review passed 21 Cursor hook tests. Neither the new adapter pair nor handoff quality has been proven. No application changes or live benchmark runs were performed for this plan.

Before implementation, reconcile `docs/PRODUCT.md` and `docs/PLAN.md` with the agreed scope. These external planning documents do not silently override repository instructions.

## 1. Architecture to build first

**Active agent → structured proposal → Hypher validation and revision → durable memory → destination brief → delivery receipt.**

The active agent already has conversation context. Ask it to propose the handoff using a narrow schema. Hypher owns persistence, source links, deduplication, revision checks, reconciliation rules, and delivery. This avoids a compulsory independent model call on every switch.

Use the existing Convex application for the bounded pilot. Introduce a storage interface so the paid local product can use SQLite later. Do not maintain two full implementations before validating demand. Existing `packages/core` includes React-facing SDK code; create a framework-free `packages/memory-core` or an explicitly isolated submodule rather than assuming the current package is already a pure memory engine.

No always-running reasoning agent is required. Checkpoints should be event-driven, incremental, debounced, and limited by a budget. A background process may move data without continuously calling a model.

### Canonical records

| Record | Required information |
|---|---|
| Project | Stable project ID, normalized repository identity, local workspace association |
| Source event | Session, adapter, timestamp, source reference, content hash, capture status |
| Memory item | Kind, content, source IDs, project/branch scope, active/proposed/superseded status |
| Handoff snapshot | Revision, goal, constraints, decisions/reasons, work status, blockers, next action |
| Repository snapshot | Branch, commit, dirty state, capture time; no implication that code was synced |
| Delivery receipt | Destination session/project, delivered revision, result, timestamp |

Store ideas separately from approved decisions. Distinguish a reported test pass from a captured test result. Keep source events and revision history; repeatedly summarizing summaries loses evidence. Bound retention and allow deletion to cascade through derived records.

### State and failure handling

Expose **captured → processed → ready → delivered**, with separate failed or needs-review states. A file-change receipt is not evidence that conversation decisions were captured. A tool-name match in a transcript is not proof that a write succeeded.

Every write has an idempotency key and an expected base revision. A stale write must reconcile against the current revision, not overwrite it. Explicit sourced decision changes can supersede old items; ambiguous contradictions remain unresolved and visible. A more expensive model can suggest a resolution, but cannot manufacture user approval.

Capture failures and quota exhaustion preserve the last valid handoff with a stale warning. Use a durable retry queue, bounded retries, and a clear last-success time. Never silently switch to billable hosted inference.

## 2. Choose models by responsibility

These are starting candidates, not benchmark winners. Keep model IDs, prompt versions, and effort settings configurable.

| Job | Starting choice | Why / boundary |
|---|---|---|
| Default handoff extraction | The user's active coding agent | Already has context; no separate Hypher-funded inference call |
| Optional independent extraction | GPT-5.6 Luna, low effort; test Haiku 4.5 alongside it | Narrow structured extraction needs an inexpensive candidate, measured for omissions and invented claims |
| Difficult extraction or contradictory evidence | Sonnet 5 as a candidate escalation model | Run only when enabled and within budget; leave unresolved intent for review |
| Storage, deduplication, revisions, Git checks, rendering | Ordinary code | These should be deterministic |
| Retrieval for the first release | Project/session/branch filters and keyword search | Small handoffs do not justify a vector database yet |
| Implementing Hypher day to day | GPT-5.6 Sol or Sonnet 5 | Start with one primary coding model and concrete acceptance tests |
| Hard architecture decisions or stubborn bugs | GPT-6 Astra or Opus 5, selectively | Reserve stronger reasoning for work where it changes the outcome |

Luna supports structured outputs and is positioned for cost-sensitive workloads. The OpenAI model comparison describes Sol and Astra's relative roles. Anthropic lists Sonnet 5, Opus 5, and Haiku 4.5 in its current lineup. These vendor descriptions inform the candidates; Hypher-specific performance still needs measurement. [Luna](https://developers.openai.com/api/docs/models/gpt-5.6-luna) · [OpenAI comparison](https://developers.openai.com/api/docs/models/compare) · [Claude models](https://platform.claude.com/docs/en/models/overview)

Do not confuse the models used to build Hypher with those its customers choose to code with. The product should not require everyone to use your preferred model. Subscription access, API billing, and permission to automate a runtime are separate issues. Use supported authentication; do not collect or proxy users' provider session credentials. Verify current provider conditions before distributing runtime integrations.

### Optional inference economics

Illustration: 5,000 input tokens and 800 total billable output tokens per checkpoint, 200 checkpoints per user per month. USD, standard uncached token rates checked September 21, 2026.

| API candidate | Input / output per million tokens | One checkpoint | 200 checkpoints |
|---|---:|---:|---:|
| GPT-5.6 Luna | $0.20 / $1.20 | $0.00196 | $0.392 |
| Claude Haiku 4.5 | $1 / $5 | $0.009 | $1.80 |
| Claude Sonnet 5 | $2 / $10 | $0.018 | $3.60 |

Rates: [OpenAI Luna pricing](https://developers.openai.com/api/docs/models/gpt-5.6-luna) and [Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing).

A hypothetical 200 Luna jobs plus 20 additional Sonnet jobs costs about $0.752 in model tokens. This excludes retries, extra reasoning tokens beyond the assumption, tools, hosting, storage, taxes, and support. It is a calculation, not an observed bill. Full transcript reprocessing can multiply costs. Measure real token usage and latency before setting hosted allowances. Agent-powered mode has no separate Hypher API charge, but still consumes customer quota and time.

## 3. Integration spike: first two days

Start with Codex CLI and Claude Code on one macOS workspace. Record exact tested versions. Prove three capabilities on each: obtaining a useful checkpoint, storing it, and delivering it to a new session. Only then choose the public support promise.

Claude Code has documented lifecycle hooks. Codex has SDK and app-server integration surfaces, plus MCP consumption. Their existence does not establish access to every existing desktop or cloud conversation. Use only the capabilities demonstrated in the spike; do not build around undocumented private transcript formats. [Claude hooks](https://code.claude.com/docs/en/hooks) · [Codex SDK](https://learn.chatgpt.com/docs/codex-sdk) · [App server](https://learn.chatgpt.com/docs/app-server) · [Codex MCP](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)

Begin with explicit handoff and resume actions through supported tools. This still removes manual recap writing. Add automatic checkpoints where lifecycle support is verified. Treat launching an agent, injecting context, and controlling approvals as separate capabilities. A shared UI is optional later; it should not block the handoff proof.

Spike acceptance: one real switch in each direction, including a changed decision and an unfinished task, with visible source evidence and correct destination project. If a surface cannot support this, narrow compatibility immediately.

## 4. Repository work, in order

| Priority | Existing area | Change and proof |
|---|---|---|
| P0 | `docs/PRODUCT.md`, `docs/PLAN.md` | Lock handoff scope, supported surfaces, excluded work, and acceptance criteria |
| P0 | New framework-free memory module | Define event/proposal/snapshot schemas and deterministic rendering; invalid source references fail validation |
| P0 | `hypher-web/src/lib/mcpTools.ts` | Add versioned proposal and handoff contracts while preserving existing callers; prove idempotency |
| P0 | `hypher-web/convex/lib/projectMemoryWrite.ts`, `projectMemories.ts` | Atomic revision checks, source records, supersession, and explicit processing states; concurrent write tests |
| P0 | `hypher-web/convex/projectMemoryActions.ts` | Make synthesis ownership/configuration explicit; replace hardcoded model routing; heuristic fallback cannot masquerade as full understanding |
| P0 | `hypher-web/src/lib/projectContext.ts` | Compile bounded briefs from active sourced records; label inferred/unverified statements and include version metadata |
| P0 | New Codex and Claude Code adapters | Complete both directions on tested local surfaces, including delivery acknowledgment |
| P1 | Existing Cursor hook implementation | Fix success detection, transcript input handling, end-state Git metadata, and retry persistence before claiming reliable Cursor support |
| P1 | Status/review UI | Show last capture, processing result, unresolved conflicts, delivered revision, export/delete |
| Conditional | Local storage and distribution | SQLite adapter, migrations, install/uninstall, update delivery, license entitlement; required before selling local Core |

Read the applicable Convex skill before editing Convex code. Add migrations rather than silently reinterpreting old memory. Preserve existing users' records and billing obligations.

The core API can expose `captureEvent`, `proposeMemoryUpdate`, `applyRevision`, `prepareHandoff`, and `recordDelivery`. Reuse existing MCP endpoints where possible instead of inventing a second parallel protocol.

## 5. Safety and correctness built into the workflow

Scope every read/write to the authorized project and user. Treat captured conversations and repository text as evidence, not executable instructions. Validate source IDs against accessible records; never accept arbitrary model-invented references. Keep secrets out of routine captures, store user API keys in appropriate secret storage if that option ships, and require explicit opt-in for cloud processing.

At resume, compare current repository identity and state with the snapshot. On a mismatch, explain what is missing before claiming readiness. Never automatically checkout, overwrite, or transfer code merely because a handoff requests it. If evidence cannot be independently inspected, label it as agent-reported.

## 6. Evaluation before marketing claims

First create 30 small, permissioned or synthetic labeled cases: 20 for prompt development, 10 held out. Include changed decisions, rejected ideas, partial work, test failures, stale branches, and malicious instructions embedded in source text. Compare active-agent extraction with the optional API candidates. Human review establishes the expected facts; model judgments alone are insufficient.

Measure constraint recall, unsupported claims, idea/decision confusion, supersession accuracy, latency, and cost. A schema-valid answer can still be wrong. Select the cheapest candidate that meets the quality gate; do not ship it merely because its token price is attractive.

Then run 45 continuation trials: five scenarios × three conditions × three repeats. Conditions: native context alone, a maintained handoff file, and Hypher. Hold task, initial code state, destination model/settings, and available tools fixed within each comparison. Reset state and randomize order. Report setup and recap effort, constraint violations, task completion, latency, and token cost. The sample is exploratory, not universal proof.

Proposed release gates: no cross-project leakage; no silent overwrite in concurrency fixtures; no critical invented decisions in held-out cases; recoverable interrupted writes; both directions work; meaningful recap reduction without worse task quality. Publish the sample size and failures rather than a sweeping percentage claim.

## 7. Milestones and go/no-go checks

| When | Deliverable | Exit condition |
|---|---|---|
| Days 1–2 | Scope update and adapter capability spike | Real round trip in both directions |
| Days 3–5 | Thin end-to-end handoff with revisioned storage | Source-backed snapshot and verified delivery on a real task |
| Week 2 | Five assisted pilots, failure instrumentation, extraction evaluation | Repeat use and clear demand; first payment evidence when a working offer exists |
| Weeks 3–4, if gate passes | Reliability, local storage if pursuing license, regression trials | Installable supported workflow survives retries, stale state, and conflicts |
| Weeks 5–6, if ready | Paid beta, onboarding, export/delete, support and release process | Honest compatibility list, working purchase/license flow, repeat use |

These are planning estimates, not delivery promises. If the adapter spike fails, stop and resolve access rather than building UI around an unproven integration. If pilots do not return, investigate before adding integrations or a canvas.

## First implementation ticket

**Build a source-backed Codex → Claude Code → Codex handoff on the same repository.**

Update repository product docs; add the minimum proposal schema and revisioned persistence; wire explicit save/resume actions; show a small handoff receipt. Use the existing cloud storage for this proof. Add only tests for meaningful failure cases: duplicate submission, stale revision, changed decision, wrong project, and failed delivery.

Proof to attach: exact client versions, one short recording in each direction, stored handoff JSON with source references, and test output. No billing overhaul, broad plugin framework, canvas, independent AI service, or full replacement harness belongs in this ticket.
