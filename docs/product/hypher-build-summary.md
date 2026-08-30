# Hypher Build Summary

Last updated: May 25, 2026.

## What Hypher Is

Hypher is a private-beta **project context layer for builders and their agents**.

The original product idea was an agentic assistant that remembers projects, tracks work, and reminds the user what matters. The current build focuses on the foundation for that vision:

> Capture anything -> build project memory -> brief agents -> receive writeback -> remind/resume better.

Capture is still important, but it is no longer the whole positioning. Capture feeds memory. Memory powers context. Context makes the assistant useful.

## Current Stage

Hypher is in controlled private beta prep.

The app is functional and has a real context loop:

- core capture and sorting loop is shipped
- Project Pulse is shipped as the human resume surface
- project memory and crystallized suggestions are shipped
- action queue/source labels are shipped
- agent events and Agent Inbox are shipped
- Builder Brief/context packet generation is shipped
- protected agent context API is shipped
- read-only MCP route is shipped
- Cursor plugin v1 package is shipped (OAuth Connect, repo resolve, session writeback)
- agent handoff/writeback path is shipped
- returned agent output loop is shipped
- beta invite gate and feedback collection are shipped
- launch-readiness tooling is shipped
- API key management, capture tokens, Stripe, GitHub PAT flow, and settings pages exist

Current validation is not "can we build more features?" It is:

> Can Hypher become the trusted source of project context for both the builder and their agents?

## Stack

Primary app:

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS
- Framer Motion

Backend and data:

- Convex for schema, queries, mutations, scheduled jobs, and auth-aware backend functions
- Clerk for authentication

AI and integrations:

- Anthropic for project memory and AI routes
- Stripe for billing
- Resend for email/digest delivery
- Upstash for rate limiting
- Sentry for observability
- GitHub integration through PAT and repo connection

Testing:

- Vitest

Latest local verification from May 25, 2026:

- `npm run build`: passed
- `npm test`: passed, 35 files / 194 tests

## What Is Shipped

### 1. Self-Sorting Capture Loop

Hypher can:

- capture a note into inbox
- generate project suggestions with reasons
- let the user assign it to a suggested project
- create a new project from the capture
- keep the capture in inbox
- review later

Important product behavior:

- Hypher suggests first, it does not silently auto-sort
- review state is tracked
- unreviewed inbox items form the review queue

Key implementation areas:

- `hypher-web/src/components/CaptureHome.tsx`
- `hypher-web/src/components/InboxReviewPanel.tsx`
- `hypher-web/src/lib/useStore.ts`
- `hypher-web/src/lib/engine.ts`
- `hypher-web/convex/objects.ts`

### 2. Project Memory And Crystallized Context

Projects can hold generated and accepted memory:

- summary
- current direction
- recent changes
- important decisions
- constraints
- open questions
- active tasks
- blockers
- agent warnings
- handoff notes
- accepted crystallized suggestions
- suggested next actions

This is the memory layer behind Builder Briefs and future reminders.

Key implementation areas:

- `hypher-web/convex/projectMemories.ts`
- `hypher-web/src/app/api/project-memory/generate/route.ts`
- `hypher-web/src/lib/projectMemory.ts`
- `hypher-web/src/lib/crystallizeRecentActivity.ts`
- `hypher-web/src/components/ProjectPulse.tsx`

### 3. Project Pulse

Project Pulse is the human-facing resume surface.

It brings together:

- current state
- next move
- needs review
- action queue
- recent captures
- recent agent updates
- memory freshness
- handoff history

Key implementation areas:

- `hypher-web/src/components/ProjectPulse.tsx`
- `hypher-web/src/lib/projectPulse.ts`
- `hypher-web/src/lib/projectContext.ts`

### 4. Builder Brief And Agent Context API

Hypher can compile bounded project context for agents.

Available surfaces:

- copy Builder Brief from Project Pulse
- `GET /api/projects/[projectId]/agent-context`
- read-only MCP tools through `/api/mcp`
- Cursor plugin at `extensions/cursor` with `resolve_project_for_repo` and OAuth `post_agent_event`
- Connect Cursor CTA on Settings → Integrations

The brief includes project direction, decisions, constraints, open questions, actions, captures, agent events, and handoff notes.

Key implementation areas:

- `hypher-web/src/lib/projectContext.ts`
- `hypher-web/src/lib/agentContextApi.ts`
- `hypher-web/src/lib/mcpTools.ts`
- `hypher-web/src/app/api/projects/[projectId]/agent-context/route.ts`
- `hypher-web/src/app/api/mcp/route.ts`
- `extensions/cursor/`
- `docs/product/cursor-plugin-v1-spec.md`

### 5. Agent Events And Writeback

Agents can write structured updates back into Hypher.

Supported event types:

- handoff
- build log
- question
- suggestion
- artifact
- next action

Hypher can match events to projects, show them in Agent Inbox/Project Pulse, save them as notes, convert suggested actions, and include them in future context.

Key implementation areas:

- `hypher-web/convex/agentEvents.ts`
- `hypher-web/src/lib/agentEvents.ts`
- `hypher-web/src/app/api/agent/events/route.ts`
- `hypher-web/src/components/AgentInboxPanel.tsx`
- `hypher-web/tools/hypher-handoff.mjs`

### 6. Beta, Settings, And Launch Readiness

Shipped:

- Clerk sign-in
- beta invite gate
- beta request/admin flow
- in-app feedback
- API key management
- daily digest settings
- GitHub integrations page
- launch readiness panel
- Stripe checkout/webhook route

Key implementation areas:

- `hypher-web/convex/beta.ts`
- `hypher-web/src/components/BetaInviteGate.tsx`
- `hypher-web/src/components/BetaAdminPanel.tsx`
- `hypher-web/src/components/ApiKeysPanel.tsx`
- `hypher-web/src/app/app/settings/integrations/page.tsx`
- `hypher-web/src/lib/launchReadiness.ts`

## What Still Needs Work

### Immediate Product Work

- Dogfood Builder Briefs and agent writeback on real build sessions.
- Decide which landing message wins for controlled beta: context-first with capture as input.
- Tighten Project Pulse so it clearly answers "what changed, what matters, what next?"
- Make agent writeback useful without becoming noisy.
- Run production smoke tests for matched/unmatched agent events, API keys, capture, GitHub, and Stripe.

### Missing Assistant Layer

The original assistant vision is not abandoned, but it is not fully built yet.

Still missing:

- proactive reminders for stale projects
- "you missed this agent result" notifications
- stronger daily/weekly project digest behavior
- project watch rules
- Mac hotkey/menu bar capture
- iOS share sheet/action button capture
- native inbox review
- GitHub build overseer behavior
- full project assistant chat

## Recommended Next Steps

1. Keep product/docs/landing aligned around context-first positioning.
2. Use Hypher on real work for several agent handoff cycles.
3. Fix anything that makes Builder Briefs noisy or incomplete.
4. Improve Project Pulse as the resume surface.
5. Add practical reminders only after Pulse and memory are trusted.
6. Start native work with Mac/iOS capture companions, not a full rewrite.

## Useful Repo Areas For A Fresh Agent

Start here:

- `hypher-web/docs/Hypher Agent Brief.md`
- `docs/product/hypher-product-build-roadmap.md`
- `hypher-web/src/lib/projectContext.ts`
- `hypher-web/src/components/ProjectPulse.tsx`
- `hypher-web/convex/schema.ts`
- `hypher-web/convex/projectMemories.ts`
- `hypher-web/convex/agentEvents.ts`
- `hypher-web/src/lib/mcpTools.ts`
- `hypher-web/src/app/api/agent/events/route.ts`
- `hypher-web/src/app/api/projects/[projectId]/agent-context/route.ts`
- `hypher-web/tools/hypher-handoff.mjs`

## Short Version

Hypher is no longer just "capture-first notes."

The current build is a real context/memory system:

- capture feeds memory
- memory powers Project Pulse
- Project Pulse helps humans resume
- Builder Briefs help agents start with context
- agent writeback keeps the project current

The next chapter is proving that loop with real work, then adding reminders and native capture around it.
