# Hypher Loops Gameplan
**Date:** 2026-07-10  
**Owner:** Nick (with Fable audit as north star)  
**Status:** Draft for alignment + execution  
**Goal:** Make building with agents *dramatically simpler* for engineers while turning Hypher into the indispensable memory-orchestration layer.

---

## Executive Summary

Hypher has built the **correct nouns** (memory, briefs, handoffs, agent events, actions, capture contracts). It is missing almost all the **verbs** that close the loop.

Fable's June 9 audit was accurate then and remains directionally correct now (one month later). We are at roughly **45-50%** of the agentic OS vision. Recent work (unified capture enrichment, brief refinements, adaptive workspace, PAT groundwork, marketing alignment) is good polish on the foundation.

**User intent (you):** "Hypher to help engineers build with agents — make the process so simple."

**Answer on loops:** **Yes. Implement them.** But do it in the exact phased, trust-first way the audit recommends. The moat is *not* another executor. The moat is reliable intent capture → fresh context → agent results integrated → learning over time.

If we ship the loops right, an engineer can:
1. Capture a half-baked thought or drop a handoff in one step.
2. Get a rich, fresh Builder Brief (no manual "generate" dance).
3. Hand it to Cursor/Claude/Codex (or via MCP/script) with zero re-explaining.
4. Have the agent output auto-triage + integrated (or one-tap).
5. Wake up to "Hypher noticed X, here's what changed."

That's the simplicity bar.

---

## Current State Audit (Codebase + Site)

### Codebase — Strong Foundation, Manual Joints Everywhere

**Strengths (the contracts that make loops possible):**
- Schema is excellent: `objects`, `projectMemories` (with `acceptedCrystallizedSuggestions`), `handoffs` (with `packetContent` + `requestedTask`), `agentEvents` (typed kinds), `actions`, `github*` tables.
- `projectContext.ts` (compileProjectContext / Builder Brief) is a standout: deterministic, bounded sections, provenance, limits, labeled sources, fallback logic. This is production-grade context engineering.
- Multi-channel capture exists: web `/capture`, Chrome extension, voice transcription, capture tokens/API keys, Notion seed, GitHub polling.
- Agent writeback path: `/api/agent/events`, `agentEvents.createFromApiRequest`, handoff script (`tools/hypher-handoff.mjs`), structured suggestedActions.
- Read-only MCP solid (list_projects, get_project_context, get_current_state, etc.) + OAuth scaffolding.
- Project Pulse + crystallized suggestions + action queue + Agent Inbox + health ring exist as surfaces.
- Some PAT progress (githubPat, per-user decrypt in actions) — better than pure global token.
- Recent unification of capture enrichment flow; brief QA fixes; adaptive layout.
- Fallbacks and rate limiting in place for memory gen.

**Gaps (directly from audit + verified):**
- **Crystallization is still regex** (`crystallizeRecentActivity.ts` — RULES array with brittle patterns). No LLM extraction. This is the single biggest mismatch with "turns messy context into durable memory."
- **Memory is manual + last-N + overwrite-only.** Generation is a button that calls `/api/project-memory/generate` (Sonnet + fallback). No auto on new captures/handoffs. No append-only `memoryEvents` ledger. Stale memory is still served.
- **No retrieval.** Embeddings are client-side only (`@huggingface/transformers` Xenova model in browser for suggestions/connections). Briefs use recency slicing (last 5-12 items). No Convex vector search. Information loss guaranteed on long projects.
- **MCP is read-only.** Agents cannot write back through the best integration surface.
- **Agent events do almost nothing.** They land; user manually reviews/dismisses/moves/saves-as-note. No auto memory patch, no brief refresh, no action creation from inbox in all places.
- **No evaluation.** `acceptanceCriteria` fields exist but are prompt decoration only. Zero automated scoring of agent output.
- **No orchestration primitives.** Only two 15-min crons (GitHub syncAllRepos + digest). No `agentRuns`, no step scheduler, no run records, no central AI client with retry/cost.
- **Enrichment is inconsistent.** Web capture path calls `enrichCapture` + tags + embeddings + suggestions. API token captures, email?, direct agent posts often skip full pipeline (no `captureType`, embeddings, project suggestions).
- **GitHub tenancy still risky.** Per-user PATs in progress, but syncAllRepos pattern + cron is global-ish in spirit; webhooks not in.
- **UX seams at every joint:**
  - No single "What matters now / Today" surface (Pulse per-project, fragmented inboxes, digest, toasts).
  - Agent Inbox invisible when empty; suggested actions not consistently savable.
  - Manual "generate memory" + accept crystallized.
  - Brief copy is the primary handoff (good but not automatic freshness).
  - Orphaned views (StreamView, GardenView, etc.).
- **AI infrastructure scattered.** No central client, token accounting, model routing (Haiku for cheap triage vs Sonnet), idempotency on writes.
- **Mac app + extension** exist as capture surfaces but not deeply looped into memory/proactive yet.
- **No learning loop.** Accept/dismiss signals collected but not fed back into prompts or autonomy dials.

**Architecture readiness (updated from audit):**
- Data model for memory: 7/10 (crystallized ledger helps; still no versioning/events)
- Context assembly: 8/10 (compiler is great; degrades at scale)
- AI infra: 4.5/10
- Background/orchestration: 2.5/10
- Integrations (write path): 5/10 (HTTP + script good; MCP missing writes)
- Production: 6.5/10 (auth/rate/Sentry solid; as any casts, cron patterns, deploy issues)

**AI usage today:** Sonnet for memory/digests, Haiku for tags (via Convex actions), gpt-4o-transcribe for voice, client embeddings. No central router.

**Summary of the loop today:**
```
capture (partial enrich) → manual "Generate Memory" → static brief compile → copy-paste or script → agent works → manual or API writeback → human triage → (nothing auto-updates memory/brief)
```
Every arrow is a human click or copy.

### Site / Marketing / Launch Readiness

**Positioning (code + docs):** Excellent and consistent.
- One-liner: "Project context layer for builders and agents."
- "Capture the messy work. Keep the project memory. Hand your agents the context."
- Loop diagram in landing + Agent Brief + roadmap all aligned.
- Marketing components clean; beta CTA prominent.

**Live site (https://hypher.app):** **Critical blocker.** Root and /app both return 500 "MIDDLEWARE_INVOCATION_FAILED". This must be fixed before any video or beta push. Likely Clerk auth, Convex env, or middleware config in prod. Vercel.json is minimal.

**Launch assets:**
- Detailed launch/ folder: env punchlist, tech debt, staggered timeline, voice capture, onboarding, controlled beta kit, mockups.
- LaunchReadinessPanel + checklist in app.
- Remotion showcase video (HypherShowcaseIntro) + frames in out/.
- Pre-launch playbook, superpowers plans/specs (many UX phases done or in flight).
- Beta request flow, feedback, invites all built.

**Current reality:** Still controlled private beta. Founder video is the key missing piece you've been postponing. No public launch pressure yet — good.

**Where the "site" experience stands for an engineer:** Once inside, the value (brief + memory) is visible per project, but the *simplicity* of handing context to agents is still gated by manual steps and risk of staleness.

---

## Should We Implement Loops?

**Yes — this is the product.**

The audit's core insight is perfect: Hypher should own the **memory-orchestrated loop**, not execution. Cursor, Codex, Claude Code, OpenClaw, etc. are (and will be) better at running code. Hypher's job is to make every one of them start smarter and return value without the builder doing glue labor.

Implementing loops directly serves your goal:
- Engineers hate context reconstruction.
- They hate stale briefs.
- They hate manually triaging agent output back into their system.
- They will love a system that makes "tell my agent about this project" and "what did the agent do?" automatic and trustworthy.

**The dividing line (from audit):**
- **Fully autonomous (safe):** capture triage, memory compaction/freshness (with reviewable diffs), drift reminders, learning.
- **Approval-based (one-tap, low friction):** crystallization into durable memory, writeback patches, dispatch to executors.
- **Permanently human:** curating core decisions, setting the autonomy dial.

**Do not:**
- Become an executor.
- Turn on noisy autonomous writes without diffs + graduation.
- Skip the unglamorous memory infrastructure.

---

## Gameplan — Three Phases (Front-load Memory & Loop Closure)

### Phase 1: Close the Existing Loop (Make Agent Building Simple) — 4-6 weeks
**North star:** A builder (or their agent via MCP/script) can pull a fresh brief and have agent output meaningfully update the project with minimal or zero manual steps. "Generate memory" button becomes rare.

**Key work:**
1. **Replace regex crystallization with LLM (L2)** — Sonnet-class extraction into typed suggestions (decision/constraint/task/question/do_not_do/acceptance_criterion etc.). Schema validation + novelty check vs existing. One-tap apply that actually mutates memory.
2. **Auto memory freshness + brief-time regeneration (L3/L4)** — On capture, handoff return, or agent event: cheap check for staleness → auto or background regenerate if needed. Brief always carries "freshness" + provenance. Make `/api/project-memory/generate` callable internally with guards.
3. **Server-side enrichment for *all* paths** — Move embeddings + tagging to Convex actions (or dedicated). Fix API capture tokens, email, direct agent events to get `embedding`, `tags`, `captureType`, project suggestions. Close the "some captures are second-class" hole.
4. **MCP write tools + HTTP write improvements (L5 start)** — Add `report_progress`, `add_capture`, `complete_action`, `apply_crystallization` (idempotency keys required). Make the handoff script even dumber (or deprecate in favor of MCP).
5. **Agent events do real work** — On accept (or high-confidence auto for safe kinds): create/update actions, patch memory via crystallized path, touch project, invalidate brief cache. Unify "save as action" across Pulse + global Agent Inbox.
6. **Unified "What matters now" surface** — Evolve Project Pulse + global dashboard into a true Today view: actions + agent events + stale memory flags + blockers + suggested next brief tasks. Kill fragmentation. Make Agent Inbox always visible or promoted when relevant.
7. **Central AI client + basic hardening** — `lib/ai/client.ts` (or equivalent) with model routing (Haiku triage, Sonnet synthesis), retry/backoff, per-project token budgets. Idempotency on key writebacks.
8. **Brief always fresh guarantee** — When copying or serving via MCP/API, if memory is stale > threshold, regenerate inline (cheap path) or note "regenerating...".
9. **Fix remaining launch debt** — Deploy 500s, GitHub sync tenancy (finish per-user), tag search, command palette actions, email routing, etc.

**Exit criteria (measurable):**
- A new capture or agent event on a project updates the brief without manual "Generate".
- An agent can use MCP or script to post a handoff and see it reflected in Pulse/memory within minutes.
- Brief pulled for a project is never silently stale.
- Engineer can go from "idea in chat" → capture → brief in agent → result written back in < 2 minutes of human time.
- All capture entry points produce enriched objects.

**Parallel launch work:** Nail the 60-90s founder demo video showing exactly this simple agent loop. Get 5-10 real engineer beta users dogfooding it.

### Phase 2: Memory Infrastructure + Evaluation (6-8 weeks)
**North star:** Long-running projects (hundreds of captures) produce *better* briefs than young ones. Evaluation exists.

**Key work:**
- Append-only `memoryEvents` ledger (decisions, constraints, direction changes as immutable events). `projectMemories` becomes a materialized/compacted view.
- Server-side vector index + retrieval (Convex or side store). Brief assembly = recency + pinned + top-k semantic to the requested task.
- Hierarchical memory (working set → compacted project memory → archive).
- Versioned briefs (store memory version + source IDs used).
- First-class `acceptanceCriteria` on handoffs (authored by user, not boilerplate). L6 judge model: score output vs criteria with evidence → met / unmet / unverifiable.
- GitHub webhooks + reliable per-user sync.
- Drift detection (L7) — safe notifications only at first.
- Start L9 signals (accept/dismiss rates per kind per project).

**Exit criteria:**
- 6-month-old project with 400+ captures yields a tighter brief than a 2-week project.
- Agent handoff specifies acceptance criteria; Hypher later shows a verdict with citations.
- Memory has history/replay/contradiction detection.

### Phase 3: Dispatch + Full Orchestration (8-12 weeks)
**North star:** Hypher notices, proposes, user approves (or dials autonomy), executor runs, results flow back, memory updates, evaluation runs.

**Key work:**
- `agentRuns` table + scheduler step chains (Convex `runAfter`).
- Dispatch to external executors (start with Cursor background agents API — best overlap).
- Full circuit with per-project autonomy dial + graduation (L9): high historical accept rate for a category → offer auto.
- Proactive L7 surfaces that are high-signal only.
- Learning profile ("taste") fed back into prompts.

**Exit criteria:**
- "Hypher dispatched the fix you approved; 3/3 criteria met; memory updated" experience.
- Builders trust leaving work with Hypher overnight.

---

## Quick Wins That Make "Building With Agents Simple" Today (Do These First)

These deliver disproportionate simplicity before full loops:

1. **LLM crystallize (even if manual apply initially)** — Replace regex this week. Huge perceived intelligence jump.
2. **One-tap "Brief this for Cursor/Claude"** that guarantees freshness (or triggers light regen).
3. **Make the handoff script + MCP the hero path** in docs and video. Add a "Copy as handoff command" button.
4. **Agent Inbox → Actions bridge everywhere.** If an event suggests actions, one click creates real `actions` records visible in Pulse.
5. **Auto-apply safe crystallized kinds** after a few accepts (per project, reversible).
6. **Staleness badge + "Refresh brief"** prominent in project header / before copy.
7. **Fix the deploy 500** and verify production health end-to-end (use launch-readiness checklist).
8. **Server enrichment for API capture tokens** — at least embeddings + tags.
9. **Global command palette (⌘K)** that can "Capture", "Brief project X", "Show what needs attention".
10. **Dogfood script + MCP** on real Hypher development sessions. Record the friction.

---

## Risks & Guardrails (Straight from the Audit)

- **Executor trap** — Resist. Dispatch only.
- **Autonomy before trust** — Diffs + receipts everywhere for L3/L5. Graduation earned.
- **Noise** — Quality bars + "not useful" feedback → L9. Default to batched (digest).
- **Evaluation theater** — Criteria must be specific + authored. "Unverifiable" is a valid verdict.
- **Cost** — Central client + routing + budgets *before* turning on frequent LLM crystallize.
- **Convex action limits** — Use checkpointed scheduling, not giant actions.
- **Two-homes IA** — Consolidate around Today/Pulse before adding more loop surfaces.
- **Technical debt** — Fix `as any` casts and add idempotency *now*, before autonomous code writes.

---

## Immediate Next 7-10 Days (Prioritized)

1. Fix production 500 (middleware/Clerk/Convex env) — unblock everything.
2. Implement LLM crystallization (replace or augment regex). Wire into Pulse + memory gen.
3. Make memory generation callable on capture/handoff return (background or cheap path). Remove the need for the button in normal flow.
4. Add basic MCP write tool (start with `add_capture` or `report_handoff_result` with idempotency).
5. Unify Agent Inbox action creation with Pulse path.
6. Add freshness indicator + auto-refresh on brief copy/MCP.
7. Record the launch video using the current (improving) loop. Show an engineer flow: capture → brief → agent (Cursor/Claude) → writeback.
8. Get 3-5 engineer beta users on the improved loop this week. Watch them.
9. Audit & close enrichment gaps for token/API captures.
10. Update launch kit + beta request copy to emphasize "context for your agents — zero re-explaining."

---

## Success Metrics (for the loops project)

- Time from raw capture to usable brief in agent: < 30 seconds of human effort.
- % of agent events that result in memory/action update with 0 or 1 tap.
- Brief staleness incidents per week (target near zero for active projects).
- Engineer NPS / "would be painful to lose" quote after 1 week of use.
- Long projects ( >3 months context) produce measurably better briefs (qual + user report).
- Cost per loop execution tracked and under budget.

---

## References

- Fable Deep Audit: `docs/product/hypher-agentic-loops-audit.md`
- Canonical Roadmap: `docs/product/hypher-product-build-roadmap.md`
- Agent Brief: `hypher-web/docs/Hypher Agent Brief.md`
- Build Summary & Launch docs in `docs/launch/` and `docs/product/`
- Core contracts: `convex/schema.ts`, `src/lib/projectContext.ts`, `src/lib/crystallizeRecentActivity.ts`, `convex/agentEvents.ts`, `convex/projectMemories.ts`, `src/lib/mcpTools.ts`

---

**Bottom line:** The nouns are shipped. The verbs are the product. Implementing the loops (phased, memory-first, trust-earning) is exactly how you make "engineers building with agents" simple enough that they can't live without Hypher.

This gameplan is ready to be turned into a superpowers plan + tickets. Let's pick the first 1-2 items from Phase 1 and ship them this week.

Ready when you are.
