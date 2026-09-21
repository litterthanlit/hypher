# Astra Plan

**Hypher: switch agents without starting over**  
Prepared September 18, 2026 · Focus revised September 20, 2026: reliable agent-to-agent continuation

## Execution plans — September 21 update

The [business plan](Hypher-Business-Plan.md) and [implementation plan](Hypher-Implementation-Plan.md) turn this strategy into the current launch proposal. Start by validating Codex CLI ↔ Claude Code in one local workspace, using the active agent for extraction and the existing cloud app for a bounded pilot. Local Core at a proposed $79 is the preferred paid direction if repeat use and purchase intent justify it. The newer plans take precedence for execution sequencing and model candidates; older options below remain background, not parallel commitments.

## The decision

Spend two weeks proving demand and technical feasibility before committing to a broader build. If the evidence holds, spend the following four weeks making one dependable paid workflow.

Hypher should help a builder carry current decisions, constraints, unfinished work, and future ideas between two supported agent environments. Keep the interface small and make capture, memory updates, and delivery happen in the background where integrations allow it.

The committed product scope is agent-to-agent continuation. The visual workspace and broader assistant are parked ideas, not roadmap commitments.

**Working promise:** “Switch agents without starting over.”

### Scope lock: one job, exceptionally well

A builder switches from agent A to agent B on the same project, and B continues correctly without the builder reconstructing the conversation. Every first-release feature must improve the reliability, accuracy, or ease of that transition.

The handoff contains the current goal, approved decisions and reasons, constraints, completed versus unverified work, blockers, next step, source references, and repository/branch/commit identity where applicable. Pending changes and unavailable evidence must be visible. Memory does not transfer files or uncommitted edits: verify that the destination has the correct working state, and explain mismatches rather than implying the handoff synced code.

The smallest complete experience is capture → durable handoff → correct destination project → brief delivery → useful continuation → writeback. A “Continue with…” action is optional convenience once the transport is verified, not a prerequisite for building a new interface that hosts both agents.

Start with two supported environments. The previously inspected Cursor adapter is a starting point, not a commitment to broad coverage. If pilot users primarily switch between Claude Code and Codex, validate that pair's supported read/write and delivery mechanisms before selecting it. Do not promise automatic support until the real round trip works.

**Primary success measure:** proportion of evaluated switches where the destination agent completes the next agreed task without a manual recap, repeated settled questions, or violations of active decisions. Count missing captures and failed deliveries as failures. Record setup and maintenance time alongside task quality.

**First proof:** interrupt a real implementation after a decision and a partial change; start the second agent with the same authorized code state; have it finish correctly; reverse the direction on the return handoff. Repeat with changed decisions, network failures, and a quota-limited source agent.

**Parked:** moodboard/canvas, general idea assistant, suggestion popups, personal workflow learning, impact-analysis dashboards, agent orchestration, and broad plugin coverage. Capturing a future idea is allowed only to keep it from becoming an accidental current instruction. Revisit additional products only after repeat paid use of handoffs.

The technical and commercial options below support this one workflow. They are not separate features to ship all at once.

**Revised recommendation:** validate agent-powered memory first using the existing cloud application for a time-limited pilot. If it works and buyers prefer ownership, ship a local core for a one-time price. Keep hosted storage/sync and independent AI processing as optional services. Do not build two complete products before proving demand.

**What changed:** the original plan assumed Hypher-funded synthesis and $15/month. Those remain an option, not the default. Hypher should own validation, history, reconciliation rules, and delivery regardless of whose model performs extraction. Running the model and owning trustworthy memory are separate responsibilities.

**First customer:** an independent builder or small studio regularly using two or more AI tools on the same project, who can show a recent costly handoff. People satisfied inside one native Projects environment are unlikely early customers.

**Evidence boundary:** Reviewed current repository HEAD `648c6cb80f9a5bce513d8c7614bdbf93ce38334b`; the Cursor hook suite passed 21 tests during the review. Production credentials, authenticated UX, extraction quality, billing behavior, and benchmark outcomes have not been verified. Everything below labeled a target, price, or gate is a proposal—not a measured result. This document does not change the application or the repository’s product instructions.

## 1. Positioning after Claude and Cursor Projects

Native memory is now a strong baseline. Claude’s September 17 announcement explicitly describes shared memory of decisions and their reasons. Cursor’s September 10 announcement describes persistent shared context and background work. A generic “your next chat remembers” pitch overlaps directly with both. [Claude announcement](https://claude.com/blog/projects-redesigned) · [Cursor announcement](https://cursor.com/blog/projects)

Hypher’s hypothesis is narrower: some builders will keep using multiple environments, and need current project understanding to survive those transitions. Neither announcement establishes a universal transfer mechanism between competing platforms; that is an opportunity to investigate, not proof of defensibility.

Supermemory already markets shared memory across assistants. Hypher must win a particular building workflow through lower maintenance, reliable capture, useful decisions, and transparent corrections. A list of integrations will not be enough. [Supermemory MCP](https://supermemory.ai/docs/supermemory-mcp/mcp)

| Customer situation | Hypher’s proposed value |
|---|---|
| Planning in one agent, implementation in another | Carry approved intent and the reasoning behind it. |
| Returning after a week away | Deliver what changed, what remains blocked, and the next useful action. |
| Exploring future features during current work | Preserve ideas without accidentally promoting them into today’s scope. |
| Changing a previous decision | Retire the old instruction and show why it changed. |
| Staying entirely inside one effective Projects environment | Recommend native memory unless a specific remaining problem is demonstrated. |

Do not claim “solves context engineering,” “works everywhere,” “never forgets,” or “makes agents X% better” without specific evidence. Describe tested environments and actual workflow outcomes.

## 2. Market it through one recognizable moment

### Landing copy to use during the pilot

**Headline:** Switch agents without starting over.

**Subheading:** Hypher carries your project’s decisions, constraints, and next steps between supported AI tools—so you spend less time explaining what already happened.

**Primary action:** Join the pilot

**Secondary action:** Watch a real handoff

**Three supporting points:**

- Capture decisions as you work in connected tools.
- Give the next agent current context, with sources you can check.
- Keep future ideas separate from instructions to build now.

Show a support table directly below the demo: automatic capture, automatic delivery, manual fallback, tested versions, and known limits. Do not imply all those benefits already ship. Use “pilot” and explicitly identify which steps are manual until validated.

### The 90-second demo

| Time | Show |
|---|---|
| 0–15s | In tool A: “Keep checkout as a guest flow. Accounts can wait until later.” |
| 15–30s | Hypher saves a current constraint and a separate future idea, linked to the source. |
| 30–55s | Open tool B on the same linked project. The brief arrives through the verified integration. Ask it to continue checkout. |
| 55–75s | It preserves the guest flow and leaves accounts deferred. Show the actual implementation or tests. |
| 75–90s | The work is saved back; a fresh session sees what changed and what remains. |

Record an actual supported workflow. Disclose manual steps and speed-ups. Show a representative run, not only the best result. Link to benchmark methods and failures when publishing performance claims.

### Acquisition plan

Start with five observed pilots recruited from builders already discussing agent switching or repeated explanations. Publish one short demonstration, one technical explanation of a real failure, and one transparent results post. Offer hands-on installation in the pilot. Use your own Hypher development as one example, then repeat on unrelated projects.

Useful interview prompts: “Show me the last handoff you had to reconstruct,” “How often did that happen this week?”, “What do you already use to prevent it?”, and “Would you buy the local version for $79, or prefer a hosted version at $15/month—and why?” Observe behavior before asking hypothetical willingness to pay.

Do not buy ads or prioritize a broad launch until people return without reminders. Community posts should be useful, specific, and consistent with community rules. Outreach and publishing remain future actions; nothing has been sent or published by this plan.

## 3. Business options and ongoing costs

### Recommendation and alternatives

**Choose agent-powered Core as the first hypothesis.** This fits the preference for ownership and uses an agent that already has the conversation. It must prove that memory updates remain dependable when that agent forgets, stops, or hits its limits. Keep hosted extraction as an optional provider, not an automatic hidden expense.

| Option | Proposed commercial model | Advantage | Cost or limitation |
|---|---|---|---|
| A. Agent-powered local Core — preferred hypothesis | Test $79 once | Local memory, no mandatory Hypher subscription, no Hypher-funded model calls | User needs a supported agent/runtime and available usage; remote cloud agents cannot automatically reach a local-only store. |
| B. Fully hosted Hypher | Test $15/month with bounded processing/storage | Easier cross-device access and independent processing when the computer is off | Hypher pays infrastructure and model costs; recurring funding required. |
| C. Core plus optional services — possible destination | Core license, then optional sync or hosted processing | Users can choose convenience without losing local ownership | More packaging and synchronization complexity; build only services people request. |

A user-provided API key is another extraction provider: model billing goes to the user, while cloud hosting still costs whoever runs it. It is not equivalent to using a chat subscription and does not make processing free.

Start with a 14-day assisted pilot, disclosing the offers being tested. The existing hosted pilot is temporary and does not establish perpetual hosted access. A local license must not be sold as available until the local path works. Do not promise perpetual cloud sync to make a one-time offer sound better.

### Define the one-time offer precisely

Proposed Core license: one user; local projects, history, source inspection, corrections, export, and verified local integrations. Perpetual use of the purchased version, 12 months of compatibility updates and standard support, with optional paid major upgrades later. Basic local use and export must not require an always-online license server. Explain that future third-party changes may require newer adapters; perpetual use cannot guarantee perpetual compatibility with changing services.

AI usage is supplied by the user's supported agent plan/runtime or API account. Included allowance, additional charges, and authentication differ by provider. Do not advertise “unlimited AI” or “uses any subscription.”

Possible later cloud-sync offer: test $5–9/month with explicit storage/retention limits, excluding hosted AI. This is a hypothesis to interview on, not a committed launch tier. Keep the original $15/month fully hosted option as an alternative for people who value independent processing. Avoid launching a confusing pricing grid before observing demand.

Current reference points remain Cursor Pro at $20/month, Claude Pro at $20 on monthly billing, and Supermemory developer Pro at $19/month. Their products differ; these are context, not proof of Hypher pricing. [Cursor](https://cursor.com/pricing) · [Claude](https://claude.com/pricing) · [Supermemory](https://supermemory.ai/pricing/)

### What costs money after the sale?

| Cost | Local Core | Existing cloud app / hosted option | How to control it |
|---|---|---|---|
| Model interpretation | User's quota or API bill; Hypher pays only if it explicitly supplies processing | Hypher pays for extraction, reconciliation calls, retries, and evaluations | Process new material in batches; cap retries and budgets. |
| Database, search, and attachments | Uses the user's disk | Storage, reads/writes, indexing, data transfer, backups | Text first, bounded retention, deduplication, and measured usage. |
| App and MCP hosting | A small local process; website/download costs remain | Web/API requests, compute, background jobs, remote MCP | Event-driven jobs; no constant agent loop. |
| Accounts, email, and monitoring | Can be minimal; purchases and support still need handling | Account services, transactional email, error tracking, logs | Use included allowances and avoid storing full transcripts in logs. |
| Integration maintenance | Still needed | Still needed | Support two verified environments first; maintain compatibility tests. |
| Customer support and reliability work | Installation, operating systems, local recovery, updates | Sync incidents, account recovery, outages, security fixes | Measure time per customer and common failure causes. |
| Sales and distribution | Payment fees per purchase, refunds/disputes, downloads, possible signing costs | Payment fees per renewal plus the same business overhead | Price the actual support and distribution burden. |
| Business overhead | Domain renewals, bookkeeping, product development | Same | Budget separately from per-user infrastructure. |

Core's local storage does not mean the user's AI runs locally or stays private on-device. The selected agent/provider may still receive context for inference. Disclose that boundary.

Infrastructure can be modest at pilot scale. Current examples: Vercel Pro lists $20/month, and Convex Professional $25 per developer/month; Convex also has a free/Starter path. Buying both paid examples for one developer gives a $45/month base before overages, other services, and AI. That is an illustrative stack choice, not Hypher's actual bill or a minimum requirement. [Vercel pricing](https://vercel.com/pricing) · [Convex pricing](https://www.convex.dev/pricing)

At that illustrative $45 base, fixed hosting allocates to $0.45 per customer with 100 customers or $0.045 with 1,000, before variable use. Do not assume the latter scale fits the same allowances. Authentication can have included allowances too; check actual active-user counts and enabled features before estimating. [Clerk pricing](https://clerk.com/pricing)

The bigger lifetime risk may be ongoing support and adapter maintenance. Even with zero model bills, they do not disappear after a purchase. Track them rather than assuming cloud cost will dominate.

### One-time economics versus subscription economics

A $79 purchase spread across five years is about $1.32 per month before fees, support, development, or profit. That is an illustration of the service obligation, not an accounting revenue schedule. If ongoing service costs were $1/month, five years would consume $60; at $3/month, $180. These hypothetical costs explain why indefinite hosted service needs a reserve, a service term, or separate payment.

For Core, measure: net purchase receipts minus expected support/update cost, distribution/license-service cost, and any promised service reserve. Track cohorts across time; new purchases should not be the only way to fund old cloud obligations. Paid upgrades and optional services are possible revenue, not guaranteed assumptions.

For Hosted, retain the $15/month experiment: target median variable cost below $3 and investigate accounts above $5. Those are approximately 80% and 67% contribution margins before fixed overhead and support. Meter all model input/output including repeated context and retries, alongside storage, requests, payment fees, and support time.

If launching Hosted, an initial allowance to test is one million newly processed text tokens/month plus explicit storage and request-rate limits. New-content metering is customer-facing; internal costing must include all inference. At the cap, pause new synthesis visibly, preserve the last good memory and export, and avoid automatic overage charges. Core's agent-provider limits are separate and must be displayed as such.

The repository already has monthly and lifetime checkout paths. Inventory and honor existing purchases. Separate a versioned perpetual license from cloud-service entitlements; do not merely relabel the old lifetime plan. Before charging, test verified payment state, refunds/revocation, duplicate and out-of-order events, and cancellation where subscriptions exist. Do not enable both offers just because the payment routes exist.

## 4. Architecture: shared memory core, replaceable extraction

**Hypher owns the memory system. Extraction can run in the active agent, a supported user-authenticated runtime, or a hosted model API.** No option needs a continuously reasoning agent. Capture, storage, versioning, indexing, and brief assembly can run as ordinary software; model work is triggered by meaningful new input.

The earlier hosted-only proposal is superseded by this separation. Preserve the existing hosted action as a selectable, metered provider while first testing active-agent extraction. Do not silently call a paid provider if a user chose agent-powered mode.

```text
Capture → durable events → extraction job
                              ├─ active agent (first pilot)
                              ├─ supported user runtime / user API key (later if needed)
                              └─ hosted API (optional)
         → source-linked candidate facts
         → Hypher validation + revision checks + reconciliation
         → stored facts → bounded brief / task retrieval → agent
```

The common contract should carry event IDs, source references, expected revision, candidate facts, explicit supersession links, and extraction provider/version. Validate types and ownership in code. Structural validation cannot prove semantic truth: uncertain interpretations or conflicts remain candidates for another agent pass or human review. Never accept an agent summary as an unrestricted replacement of project history.

### Architectural differences

| Component | Agent-powered local Core | Hosted Hypher | Shared work |
|---|---|---|---|
| Canonical storage | Local SQLite or equivalent transactional store, migrations and backup/export | Existing Convex database and managed jobs | Same event/fact schema, revision rules, and exports. |
| Capture | Local hooks + durable local outbox | Local/cloud adapters submit to authenticated API | Deduplication, source references, explicit project binding. |
| Extraction | Active agent returns structured proposals; queue unprocessed inputs for its next eligible turn | Server worker calls model under quotas and budget | Same extraction schema and evaluation suite. |
| Scheduling | Runs while the device/runtime is available | Runs on server even when the laptop is off | Idempotent jobs, status, retries, cancellation. |
| Agent access | Local MCP process, initially stdio where supported | Authenticated remote MCP | Same memory operations and bounded responses. |
| Interface | Thin local web interface reusing portable components | Existing Next.js application | Same source/history/correction concepts. |
| Identity | Local project ownership and signed license; no cloud account needed for basic use | Existing account/project authorization | Clear scope and isolation. |
| Multi-device / remote cloud agents | Requires explicit export or optional authenticated sync/relay | Naturally accessible through the hosted account | Document support boundaries; do not expose an unauthenticated local port. |
| Updates | Installer/package releases, local schema migration and compatibility support | Server deployments and backwards-compatible clients | Versioned contracts and rollback. |

Local Core is additional engineering, not a switch on the current Convex application. Reuse pure logic through `packages/core` where appropriate, and add storage/provider interfaces. The UI's current cloud data hooks need adapters. Do not attempt local/cloud multi-master synchronization in the first pilot.

**Pilot sequence:** retain Next.js/Convex/account infrastructure temporarily, select agent-powered extraction, and prove a real handoff. This isolates extraction reliability from a storage rewrite. If demand favors ownership, implement the local store and local MCP adapter next, then sell Core. If cloud convenience dominates demand, choose Hosted instead. A local service with a small browser UI is sufficient; a native Mac/iOS rewrite remains deferred.

For later optional sync, use stable event IDs, upload/download cursors, tombstones for deletions, and project revisions. Choose one canonical reconciler per synced project initially; concurrent clients submit proposals rather than overwriting full snapshots. Define disconnect, reconnect, and local export behavior before selling sync. Select which capture destinations are enabled so turning cloud sync off stops new uploads.

### Subscription access and failure behavior

Anthropic's current support guidance says Agent SDK and `claude -p` usage still draw from subscription limits, while its authentication rules require users to use the supported sign-in/runtime path and prohibit third-party credential collection or credential proxying. This is provider-specific and can change; keep a dated compatibility matrix. A connected MCP server is not a general license to spend a user's subscription in the background. [Subscription guidance](https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan) · [Authentication rules](https://code.claude.com/docs/en/legal-and-compliance)

Default to structured extraction within the session the user is already running. A separate background runtime, if added, requires explicit enablement, supported authentication, bounded usage, and predictable stopping behavior. Do not launch a new full agent for each message.

If no eligible agent is available, preserve raw events and the last good brief, showing “Waiting for an agent.” At the next eligible session, process pending material before using it where feasible, or clearly mark the memory as stale. Test the delay and behavior when the host refuses, crashes, hits a quota, or cannot read the source transcript. Hosted processing can improve independent availability; it cannot repair source capture that never occurred.

### Performance and efficiency

Who pays does not itself change model quality. Active-session extraction can avoid rereading the full conversation, but adds instructions/output and may consume scarce coding quota or miss a checkpoint. Separate extraction gives consistent prompts and independent retries, but repeats some context and adds a request. Local retrieval can avoid network latency; hosted retrieval supports multiple devices. Model/version, source coverage, prompt design, batching, and validation determine the outcome.

Benchmark active-agent and hosted extraction on the same source transcripts. Compare decision/constraint accuracy, incorrect promotions of ideas, stale overrides, latency, model usage, and quota impact. Include startup/catch-up time. Treat model differences as a confound and disclose them. Prefer active-agent mode if it meets quality and reliability gates; add Hosted when measured gaps or paying users justify it.

### A. Capture and connection contract

Each adapter should normalize session ID, project binding, source message IDs, timestamps, conversation cursor, branch, and commit into the same event envelope. Preserve user/agent/tool roles. Collect relevant user-visible conversation and work evidence; do not collect hidden reasoning or indiscriminately upload every tool output.

Persist a local outbox before attempting upload where a local runtime exists. Acknowledge only after durable storage in the selected canonical backend; a local outbox receipt and a remote sync receipt are distinct states. Retry with bounded backoff and a stable idempotency key. For cloud integrations, provide an equivalent durable path and test worker termination. A fire-and-forget end hook alone is insufficient.

Use explicit project binding. Unmatched sessions should remain unassigned or prompt linking; do not guess a project. Branch work stays branch-scoped until merged or explicitly promoted. Never allow one user’s project lookup to access another user’s data.

Credentials need a supported installation path, revocation, and project-limited access. Local hooks cannot be assumed to inherit an MCP OAuth token. Keep credentials out of repositories and generated briefs; cloud workers need their own supported secret provisioning.

### B. Structured memory

Add source-linked memory facts alongside existing project summaries. Each fact needs: ID, project scope, kind, text, source references, source time, ingestion time, status, revision, and superseded-fact link. Track whether the statement was explicit or inferred. Confidence can help triage but must not be treated as calibrated certainty.

Kinds: decision, constraint, future idea, open question, current task, progress, and verification evidence. Statuses: candidate, active, deferred, disputed, superseded, resolved. Keep original source excerpts available within the retention policy.

Examples:

- “Maybe add accounts later” → deferred idea.
- “For this release, checkout must work without accounts” → active constraint.
- “I implemented checkout” → agent-reported progress.
- A passing checkout test → supporting evidence, scoped to the tested revision.

An explicit newer human decision can supersede an older one. Ambiguous conflicts become disputed and visible. Agent inference must not silently override an explicit human constraint. Project memory remains context, not an authority above the user or the host’s instructions.

### C. Reliable updates

Use a project revision and processed-event watermark. An extraction job reads revision N; if the project changes before commit, reject or rebase its write. Serialize reconciliation per project initially. Deduplicate inputs and repeated jobs. This prevents slower work from overwriting newer decisions.

Store facts independently from the brief. Rebuild the brief from source-linked facts rather than repeatedly summarizing the previous summary. Keep derived suggestions distinct from observed events; do not represent inferred recovery as an actual historical handoff.

Expose capture status in existing Pulse rows: **Saved → Processing → Ready**, with **Waiting for an agent**, **Needs review**, or **Retry needed** when appropriate. On extraction failure, preserve the last good brief and mark freshness. A heuristic result may support provisional display; it should not masquerade as successfully reconciled memory.

### D. Delivery at the right moment

Start with a compact project brief, targeting about 1,500 tokens, covering active constraints, current goal, last meaningful handoff, and unresolved blockers. Measure actual sizes; 48,000 characters is only a safety ceiling, not a useful token budget.

Add task-aware retrieval for supporting facts. Return sources, revision, freshness, and a clear indication when relevant constraints exceed the brief budget. Never silently truncate a critical constraint into a different meaning. Start with typed filters and keyword search; add semantic retrieval only when held-out evaluations demonstrate a need.

Load once at session start where supported. Refresh small changes at supported turn boundaries when newer relevant facts exist. Do not reload the full brief every turn. Repeated read/write loops should not manufacture new memory.

Record “delivered” separately from “used correctly.” Integration telemetry can prove injection or retrieval; only observed behavior/evaluation can establish adherence.

### E. Privacy that the product needs

Enable capture per project/integration with an understandable preview, pause control, and deletion/export. Use minimal source excerpts and redact likely secrets before upload where possible; redaction is not a guarantee. Do not log raw conversation text in analytics.

Proposed default: retain captured source excerpts for 30 days, keep active structured facts until removed, and clearly mark unavailable evidence after source expiry. Provide deletion that invalidates derived facts, cached briefs, and search entries; disclose backup deletion timing. Explain where the selected agent/model processes data and whether storage/sync is local or hosted. Do not claim end-to-end encryption or provider non-training guarantees without checking the actual configuration and contracts.

## 5. Integration rollout and a correction to the earlier review

Cursor cloud support is more nuanced than the repo’s current wording. Current docs list several supported cloud hooks, including response, stop, and compaction hooks. Standard cloud agents still lack the IDE `sessionStart`/`sessionEnd` pair, and hooks do not run during initial read-only exploration. [Cursor hook documentation](https://cursor.com/docs/hooks)

| Environment | Proposed path | Release condition |
|---|---|---|
| Cursor local | Start injection; incremental conversation checkpoints; end flush | Real installation works with supported credentials and actual hook payloads. |
| Claude Code local | Native start/turn/compaction hooks; same event and memory API | Complete a real Cursor ↔ Claude Code round trip. |
| Cursor cloud | Repository-installed supported hooks; initial MCP/instruction fallback | Verify first delivery, read-only limitations, credentials, and checkpoint persistence. |
| Browser assistants | Existing explicit selection capture first | Label manual capture accurately; automatic adapters come only after supported access is proven. |
| Other bots/harnesses | MCP and structured event adapter | Add only when a pilot’s recurring workflow requires it. |

Claude Code provides lifecycle hooks suitable for a second adapter. Validate its exact payloads and delivery behavior on the installed version. [Claude Code hooks](https://code.claude.com/docs/en/hooks)

Do not promise seamless capture of every chat. Maintain a dated compatibility matrix based on end-to-end tests, separate from “has an MCP connection.”

## 6. Fixes and implementation backlog

Paths below are relative to the reviewed GitHub repository. They identify starting points, not completed changes. [Reviewed source tree](https://github.com/litterthanlit/hypher/tree/648c6cb80f9a5bce513d8c7614bdbf93ce38334b)

| ID / priority | Change and starting point | Acceptance evidence |
|---|---|---|
| A1 / P0 | Update `docs/PRODUCT.md`, `docs/PLAN.md`, `AGENTS.md`, and MCP descriptions to one synthesis contract | Docs and runtime agree: Hypher owns memory validation; selected extraction provider owns model execution; no silent paid fallback. |
| A2 / P0 | Fix adapter payload handling in `extensions/cursor/scripts/hypher-session.mjs` | Use documented `input.transcript_path` and workspace roots when supplied; read ending Git identity rather than preferring starting commit metadata. Real payload fixtures pass. |
| A3 / P0 | Replace transcript-text handoff detection with acknowledged event IDs | A failed or merely proposed tool call cannot suppress a needed checkpoint; retries produce one event. |
| A4 / P0 | Add incremental checkpoints and durable upload retry to Cursor adapter | A forced termination and temporary network outage preserve acknowledged progress. |
| A5 / P0 | Extend `convex/schema.ts` and memory write path with source facts, revisions, and processing state | Two overlapping jobs preserve the newer human decision. Foreign-project IDs fail authorization. |
| A6 / P0 | Introduce a shared extraction contract across `projectMemoryActions.ts`, `projectMemoryWrite.ts`, and agent memory writes | Agent-powered mode makes no hosted model call; missing agent work stays pending; last good memory survives; successful jobs reconcile once. |
| A7 / P0 | Generalize `shared/projectMemoryGenerate.ts` and `src/lib/projectContext.ts` beyond special-case phrasing | Held-out project language works; derived suggestions are labeled; deferred ideas stay deferred. |
| A8 / P1 | Add second adapter, initially Claude Code | Two real tools capture and receive the same evolving project facts. |
| A9 / P1 | Improve existing Capture/Pulse/Integrations surfaces | User sees source, processing state, last delivery, corrections, and connection failures without a new dashboard. |
| A10 / P1 | Add bounded task retrieval and revision-aware refresh via MCP | Relevant older decisions remain retrievable amid newer noise; startup stays bounded. |
| A11 / P1 | Extend existing Stripe checkout/webhook/subscription code | Separate Core license from cloud entitlements; verify payment/refund state, cloud limits/cancellation if sold, and event recovery; existing purchases preserved. |
| A12 / P1 | Replace demonstration-only evaluation with recorded agent runs | Native baseline, maintained-file baseline, and Hypher results are reproducible. |
| A13 / conditional | Extract portable validation/brief logic into `packages/core`; add local transactional storage and local MCP | After ownership demand is validated, two local agents share memory without Convex or a cloud login; restart, migration, backup, and offline export work. |
| A14 / deferred | Optional authenticated sync and hosted extraction service | Only after paid demand: reconnect/deletion/conflict behavior is tested; charges and processing modes are explicit. |

Keep P0 scope to the smallest complete pilot workflow. P1 is not a demand to build everything before interviewing anyone.

### Documentation and migration

When implementation begins, integrate this proposal into the existing product and plan documents so agents do not receive competing instructions. Preserve the repo’s small UI, explicit project linking, and GitHub-as-signal approach.

Add new tables/fields without breaking existing briefs. Backfill legacy summaries as imported facts with unknown provenance; never invent sources. Shadow-build new briefs and compare before switching reads. Roll out per project behind a flag. Preserve old snapshots for rollback. Remove deprecated whole-memory replacement only after adapters have migrated.

## 7. Benchmark the additional value

Run the smallest feasibility test immediately; reserve a full marketing benchmark until the pipeline works. Include unrelated repositories because Hypher’s own compiler contains behavior tailored to its development history.

Five scenarios: continue unfinished work; reverse a decision; keep a future idea deferred; recover from interruption; retrieve an older constraint after substantial irrelevant activity. Separately test simultaneous updates and branch divergence at the integration level.

First run a small extraction comparison on identical transcripts to choose an execution mode. Then, for each scenario, use three conditions and three repeats: **45 end-to-end runs** for the selected mode. Do not double the entire benchmark until results justify it.

1. Native workflow with its normal Projects/memory enabled.
2. A strong maintained handoff file, with maintenance time recorded.
3. Hypher on top of the same native workflow.

Give every condition the same original conversation and evidence. Hold model/version, repository commit, task prompt, tools, and budget constant within each matched comparison. Reset persistent memory and worktrees between runs. Randomize run order. Use withheld acceptance tests and blinded scoring where practical. A raw “repo only” condition may be supplemental, not the headline baseline.

Measure completion quality, violated decisions, repeated questions, human corrections, memory maintenance time, latency, token/currency cost, and setup burden. Count failures and retries. Report per-scenario results and variability; three repetitions are pilot evidence, not a broad statistical claim.

If comparing whole native platforms, disclose that models and orchestration differ. Do not attribute those differences to memory. If native Projects access is unavailable, label that baseline untested and withhold superiority claims.

Hypher earns a win if it preserves quality while materially reducing repeated explanations and maintenance—or improves correctness enough to justify its added cost. Decide the rubric before seeing outcomes.

## 8. Plan of attack and decision gates

Timing assumes one focused builder with coding-agent help; re-estimate after the adapter spike. Calendar targets are subordinate to evidence.

| Window | Product work | Market work | Exit gate |
|---|---|---|---|
| Days 1–3 | Native baseline on Hypher; verify Cursor payloads, access, and second-adapter feasibility | Observe five qualified builders; collect real failure examples | At least three show recurring cross-tool pain. |
| Days 4–7 | Agent-powered capture → typed fact → delivery on existing cloud store; instrument quota and cost; compare a few hosted extractions | Demonstrate on their own project where possible | A real decision crosses two tools without a manual recap. |
| Days 8–14 | Minimum P0 reliability work; five assisted pilots; small matched comparisons | Show $79 Core and $15/month Hosted concepts with their different capabilities; observe repeat use | At least three pilots return without reminders; two select a concrete priced offer. Payment evidence counts only for a working, accurately described deliverable. |
| Weeks 3–4, only if gate passes | Complete P0 and selected path: A13 local Core if ownership wins, or hosted reliability/limits if convenience wins; re-estimate before billing | Publish methods and one verified case study | Dependable handoffs, working selected delivery model, and viable measured cost. |
| Weeks 5–6 | Address observed failures and onboarding friction | Small paid beta of the working offer; representative demo and truthful landing | Core: actual purchases plus continued use; Hosted: paid continuation plus continued use. |

If capture access is blocked, lower-friction explicit capture is a separate hypothesis; test whether users still value it. If people need the product but onboarding fails, fix installation before increasing promotion. If people use it only when reminded, stop feature expansion and revisit the problem. If native Projects or a shared file satisfies them, pause the generic memory product.

### Targets to instrument, not advertise yet

- Activation: a relevant fact captured in tool A and delivered to tool B within seven days, with the user reporting no need to repeat it.
- Reliability: at least 95% of eligible test sessions receive the expected brief; report the denominator, errors, and unsupported environments separately.
- Processing: measure mode-specific latency: target p95 under 60 seconds after extraction can start during normal service, and separately report capture-to-ready time including agent unavailability. An unavailable runtime cannot count as a fast successful update.
- Retrieval: target p95 cached brief response below one second, measured independently from model/host delays.
- Trust: every active extracted decision has a source; no critical silent overrides in the release evaluation set.
- Retention: observe second-week reuse without reminders; track Core purchases and continued use separately from Hosted paid continuation. Retrieval calls alone are not retention or proof of usefulness.

These small-sample gates help allocation decisions; they do not establish product-market fit.

## 9. What to defer

Defer a spatial canvas, native Mac/iOS rewrite, generic assistant chat, agent orchestration, dozens of integrations, Slack/email ingestion, team billing, enterprise certifications, and a new memory database. Each adds operating cost before the core purchase reason is established.

The visual workspace and ultimate-assistant ideas remain outside the committed roadmap. Reconsider only with separate evidence after the handoff product earns repeat paid use.

## 10. First implementation brief

Start with A1–A4 and a minimal A5/A6 path for one source-linked decision. Preserve current application behavior behind a pilot flag. Use real Cursor hook payloads, define the shared extraction contract, select active-agent processing with hosted calls disabled, capture incremental user-visible conversation, acknowledge durable events, and recover from failed upload or interrupted work. Keep Convex temporarily for the pilot; do not promise the local license until A13 works. Demonstrate a second agent continuing unfinished work with the correct code state, one current constraint, and one deferred idea preserved. The first implementation deliverable is this complete handoff, not a new dashboard.

Required checks: duplicate delivery, failed write acknowledgment, missing transcript, stale credentials, forced termination, overlapping synthesis, an explicit reversal, wrong-project access, quota exhaustion, no hosted call in agent-powered mode, and recovery when the next agent processes pending captures. Expand testing only when new risks or changes justify it.

Nick owns customer observation, positioning, pricing decisions, and pilot follow-up. Implementation agents receive bounded backlog items with acceptance evidence. Do not ask them to reinvent the product direction on every task.

**Investment rule:** continue when real builders repeatedly recover value beyond their native tools, at a cost and effort they accept. The current code is enough to test that proposition without committing to the entire long-term vision.
