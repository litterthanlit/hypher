# Hypher Build Summary

Last updated: May 6, 2026

## What Hypher Is

Hypher is a private-beta workspace for builders and creative people. The core promise is:

> Capture first. Projects stay aware.

The product is aiming to become an idea-capture-first project awareness layer: a place where raw ideas, project memory, actions, and agent handoffs converge so builders can resume faster.

Current thesis:

> Hypher helps builders capture ideas, shape them into projects, and give their agents the context they need to help build.

## Current Stage

Hypher is in controlled private beta prep.

The app is real and functional, but still early:

- core capture and sorting loop is shipped
- project memory and suggested next actions are shipped
- onboarding is shipped
- launch-readiness tooling is shipped
- beta invite gating and feedback collection are shipped
- the marketing site is live in-app, but the public request-access flow is still missing

As of this summary, `main` is synced with `origin/main` at commit `721af0b`.

## Stack

Primary app:

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS
- Framer Motion

Backend and data:

- Convex for data model, queries, mutations, scheduled jobs, and auth-aware backend functions
- Clerk for authentication

AI and integrations:

- Anthropic for project memory generation and AI routes
- Stripe for billing flows
- Resend for email/digest delivery
- Upstash for rate limiting
- Sentry for observability
- GitHub integration groundwork already exists and is partially wired

Testing:

- Vitest

## What Is Shipped

### 1. Self-Sorting Capture Loop

Hypher can now:

- capture a note into inbox
- generate project suggestions with reasons
- let the user assign it to a suggested project
- create a new project from the capture
- keep the capture in inbox
- leave it unreviewed and review later

Important product behavior:

- Hypher suggests first, it does not auto-sort yet
- review state is tracked
- unreviewed inbox items form the review queue

Key implementation areas:

- `hypher-web/src/components/CaptureHome.tsx`
- `hypher-web/src/components/InboxReviewPanel.tsx`
- `hypher-web/src/lib/useStore.ts`
- `hypher-web/src/lib/engine.ts`
- `hypher-web/convex/objects.ts`

### 2. Project Memory + Suggested Next Actions

Each project can have an AI-generated memory snapshot containing:

- summary
- current direction
- recent changes
- open questions
- 1-3 suggested next actions

Behavior:

- generation is manual or regenerate-first
- memory can be fresh, stale, empty, generating, or error
- dashboard cards surface the most important next action
- accepting a next action only changes its in-memory status for now; it does not create a full task record

Key implementation areas:

- `hypher-web/convex/projectMemories.ts`
- `hypher-web/src/app/api/project-memory/generate/route.ts`
- `hypher-web/src/lib/projectMemory.ts`
- `hypher-web/src/components/ProjectDashboard.tsx`

### 3. First-Run Onboarding

The app now explains the seeded demo workspace instead of just dropping users into it.

Shipped behavior:

- welcome overlay appears once after sign-in
- guided tour walks through:
  - capture
  - project memory
  - daily digest
- onboarding completion is persisted in `userMeta`

Key implementation areas:

- `hypher-web/src/components/WelcomeOverlay.tsx`
- `hypher-web/src/components/OnboardingTour.tsx`
- `hypher-web/convex/onboarding.ts`
- `hypher-web/src/lib/onboarding.ts`

### 4. Launch Readiness Cockpit

There is now a protected internal settings page for launch checks:

- `/app/settings/launch-readiness`

It reports grouped readiness for:

- auth/data
- AI
- rate limiting
- email/digest
- billing
- GitHub
- extension/public capture
- observability
- beta gate configuration

It also includes a manual smoke-test checklist stored in local storage.

Key implementation areas:

- `hypher-web/src/app/app/settings/launch-readiness/page.tsx`
- `hypher-web/src/app/api/launch-readiness/route.ts`
- `hypher-web/convex/launchReadiness.ts`
- `hypher-web/src/lib/launchReadiness.ts`

### 5. Beta Invite Gate + Feedback Loop

Hypher is now app-gated after sign-in.

Shipped behavior:

- signed-in users without access see an invite redemption screen
- admins can create and revoke invite codes
- admins bypass the gate
- beta users can submit in-app feedback
- admins can triage feedback in settings

Key implementation areas:

- `hypher-web/convex/beta.ts`
- `hypher-web/src/app/app/page.tsx`
- `hypher-web/src/components/BetaInviteGate.tsx`
- `hypher-web/src/components/BetaFeedbackModal.tsx`
- `hypher-web/src/components/BetaAdminPanel.tsx`
- `hypher-web/src/app/app/settings/beta/page.tsx`

### 6. Marketing Site Refresh

The landing site was updated to a more modern Vercel-like private-beta presentation with product-led visuals and beta-oriented CTAs.

Current stance:

- primary CTA is oriented around beta access
- secondary CTA supports existing invite holders
- positioning is calmer, sharper, and more founder/developer focused

Key implementation areas:

- `hypher-web/src/components/marketing/LandingPage.tsx`
- `hypher-web/src/components/marketing/MarketingProductVisual.tsx`

## What Still Needs To Be Built

### Immediate product gap

The next validation point is not more surface area. It is production dogfood:

- create a temporary production API key locally
- send a matched agent handoff
- send an unmatched agent handoff
- move unmatched into a real project
- convert suggested agent actions into project actions
- save one event as a note
- review or dismiss the event
- revoke the temporary key

The product test is:

> Can an agent send a useful handoff into Hypher, and can the user resume work faster from that handoff?

### Major capability gaps

The current app has the brain foundation, but not the full project-awareness loop yet. The major missing pillars are:

1. Project Pulse v1 resume surface
   - current state
   - one next move
   - needs review
   - action queue
   - recent pulse
   - agent updates

2. Copy Agent Context
   - markdown context packet for a project
   - summary, current state, decisions, questions, actions, recent ideas, handoffs, and agent instructions

3. OpenClaw handoff workflow
   - summarizes work
   - includes repo, branch, commit, tests, blockers, and suggested next actions
   - posts to Hypher

4. First-class action records
   - suggested, accepted, completed, dismissed
   - source labels such as Memory, Agent, Manual, GitHub

5. GitHub Build Overseer
   - later per-project GitHub understanding
   - repo state, PRs, checks, blockers, recommended next move

6. SDK / MCP
   - later, after handoff and context packet contracts are stable

7. Mac, browser, voice, graph, and broader capture surfaces
   - valuable, but after the core resume loop proves itself


## Recommended Next Steps

The best near-term sequence is:

1. Run production matched/unmatched handoff smoke.
2. Dogfood `hypher-handoff` for five real build sessions.
3. Tighten Project Pulse v1 as the resume surface.
4. Build Copy Agent Context v1.
5. Install and use one real OpenClaw handoff workflow.
6. Only then package stable APIs into `@hypher/core` or `@hypher/context`.

## Product Direction

The clearest long-term framing so far is:

### Capture Anywhere

Hypher should meet users where ideas happen:

- web
- browser extension
- Mac menu bar
- mobile/share sheet
- email/reply capture
- SMS or iMessage-like input
- AI coding agents and handoffs

### Understand Everything

Hypher should understand:

- projects
- notes
- captures
- artifacts
- repo activity
- stale work
- accepted next actions
- changing project direction

### Move Work Forward

Hypher should help with:

- next steps
- project plans
- PR descriptions
- launch checklists
- handoffs
- summaries
- agent coordination
- what to do next

## Useful Repo Areas For A Fresh Agent

If another agent needs to get oriented fast, these are the highest-signal files and folders:

- `hypher-web/src/app/app/page.tsx`
- `hypher-web/src/lib/useStore.ts`
- `hypher-web/src/lib/engine.ts`
- `hypher-web/src/lib/projectMemory.ts`
- `hypher-web/src/lib/beta.ts`
- `hypher-web/src/lib/launchReadiness.ts`
- `hypher-web/src/components/`
- `hypher-web/convex/schema.ts`
- `hypher-web/convex/objects.ts`
- `hypher-web/convex/projectMemories.ts`
- `hypher-web/convex/beta.ts`
- `hypher-web/convex/agentEvents.ts`
- `hypher-web/src/lib/agentEvents.ts`
- `hypher-web/src/lib/actions.ts`
- `hypher-web/tools/hypher-handoff.mjs`
- `hypher-web/docs/Hypher Agent Brief.md`
- `docs/product/hypher-product-build-roadmap.md`
- `docs/product/pre-launch-playbook.md`

## Short Version

Hypher already has a meaningful private-beta core:

- capture and review loop
- project memory
- onboarding
- launch readiness
- beta gate
- feedback loop
- updated marketing site

What it does not yet have is the fully proven resume loop:

- production handoff dogfood
- Project Pulse v1 as a clear resume surface
- Copy Agent Context
- one installed agent handoff workflow
- later SDK/MCP and GitHub build context

That is the next chapter.
