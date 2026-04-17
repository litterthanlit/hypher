# Hypher — Pre-Launch Playbook

> Repo audit, pre-launch checklist, and the bleeding-edge features that will sell this.

**Prepared for:** Nick
**Date:** April 16, 2026
**Repo:** `hypher / krakow` — branch: `litterthanlit/capture-first-ui`

---

## TL;DR

**Hypher is a beautifully-built, feature-rich prototype** — but it is *not* "feature-complete for v1 launch" in the way your agent's status doc claims. The backend is impressively complete; the *user-facing path* to those features is missing in several places, and four launch-blockers remain: auth, public landing page, API-key management UI, and GitHub connect flow.

> **The honest one-liner**
>
> Architecturally sound, operationally incomplete. Two weeks of focused work closes the gap to a real public beta. The opportunity is to spend that time not just on plumbing, but on two or three features that make Hypher unmistakably 2026 — not another Notion clone with a canvas.

### What's in this document

- A ground-truth audit of what's actually built vs. what the agent claimed.
- A prioritized pre-launch checklist with time estimates.
- Twelve bleeding-edge features ranked by ROI on signups per hour of work.
- A recommended two-week plan with a launch narrative you can use verbatim.

---

## Ground-truth audit

Your agent's doc says Phases 1–4, 5, 6, 7, 8, and 10 are all "shipped and merged." Here's what the code actually shows, phase by phase.

| Phase | Claimed | Reality | Status |
|---|---|---|---|
| 1–4 Spatial canvas | Shipped | Real. Polished UX, undo/redo, connections, keyboard shortcuts. | ✅ **Shipped** |
| 5 Project intelligence + Digest | Shipped | Wired end-to-end. Real Claude Sonnet call in `convex/ai.ts`. Auto-shows on first open of day. | ✅ **Shipped** |
| 6 GitHub integration | Shipped | Backend is comprehensive. No UI to connect an account — admin must insert token in DB. | ⚠️ **Backend only** |
| 7 @hypher/core npm package | Shipped | Built locally, `"private": true` in package.json. Not published. HTTP endpoints live. | ⚠️ **Not published** |
| 8 Floating clusters homepage | Shipped | Rendered as the app canvas. No separate marketing homepage. | ⚠️ **Partial** |
| 10 Smart tags + Cmd+K | Shipped | Cmd+K search, tag filtering, data model — all present. In-memory search only. | ✅ **Shipped** |

### Where the agent is inflating

- **"Feature-complete for v1 launch"** — several features are backend-only with no user-facing path. GitHub sync runs on a cron but no user can add a repo. API endpoints work, but no user can generate an API key.
- **"Shipped as PRs #7–#10"** — cannot be corroborated from the code alone. Verify on GitHub before trusting this.
- **"Morning briefing"** — fires on first open of the day, not actually scheduled for morning. Silently no-ops if `ANTHROPIC_API_KEY` isn't set.
- **"@hypher/core npm package"** — built but private. External developers literally cannot install it.

### Gaps the agent does not mention

- Zero tests. No `.test.ts` or `.spec.ts` anywhere. Digest, GitHub sync, API auth — all untested.
- API-key hashing is salt-less. Functional but not production-grade. Needs bcrypt/argon2 or at minimum salted SHA-256 before going public.
- Cmd+K search filters in-memory. Fine now, will choke past a few thousand objects. Convex has search indexes — not used yet.
- Several `any` types in Convex connection handling. `tsconfig` likely isn't strict.
- No retry/backoff on GitHub or Anthropic calls. Rate limits or transient 500s fail silently.
- No React error boundaries. AI failures surface as raw strings.
- No GitHub webhook — the 15-min cron is the only sync path, so "blocker detection" has up to a 15-min lag.

---

## Pre-launch checklist

Ordered by whether it blocks a real launch, then by ROI. Time estimates assume one focused builder.

### Tier 1 — Launch blockers

| Item | Why it blocks | Effort |
|---|---|---|
| Clerk auth + replace `userId: "default"` | Nobody can sign up. Every userId call site is hardcoded. | 1–2 days |
| Landing page at `/` | No way to explain or sell the product. Move app to `/app`. | 1 day |
| API-key management UI | Endpoints work but no user can generate or revoke keys. `ApiKeysPanel` exists but isn't wired. | 0.5 day |
| Salt the API-key hash | Current hash is salt-less. Before exposing `/api/capture` publicly, this needs bcrypt or argon2. | 0.5 day |
| GitHub connect flow | OAuth or a "paste your PAT" screen. Otherwise Phase 6 is invisible to users. | 1 day |
| Stripe + pricing page | Can't charge money. Use Clerk's Stripe integration to keep it simple. | 1 day |
| Rate limiting on `/api/capture` | Public endpoint with no throttle is an abuse magnet. Upstash or Convex rate limit. | 0.5 day |

### Tier 2 — Polish that shows we care

| Item | Why | Effort |
|---|---|---|
| Toast-based error system + React error boundaries | AI failures currently show raw errors. Kills trust. | 0.5 day |
| Skeleton loaders on digest, canvas, search | Currently feels unresponsive on slower networks. | 0.5 day |
| Seed demo project for new accounts | Empty canvas on signup = dead. Preload 8–12 notes, 1 digest, a connection. | 1 day |
| Mobile responsive pass | Canvas breaks on phone. Minimum: usable capture on mobile. | 1 day |
| Onboarding tooltip tour | Three-step walkthrough: capture → see on canvas → open digest. | 1 day |
| Sentry or Logflare integration | You need to know when the app breaks in prod. | 0.25 day |

### Tier 3 — Before scale

- Convex search indexes (replace in-memory Cmd+K search).
- Retry/backoff on Anthropic and GitHub API calls.
- Playwright E2E on the five critical paths: capture, digest, search, GitHub connect, API capture.
- GitHub webhooks to replace cron-only sync.
- `tsconfig` strict mode + remove `any` types from Convex.

---

## What to build to make Hypher bleeding-edge

Two buckets: must-haves that turn signups into retained users, and bets that make Hypher feel unmistakably 2026. Ordered by ROI on signups per hour of work.

### Bucket 1 — The six things that make signups stick

#### 1. Aha in 10 seconds

**The problem:** a new user lands in an empty canvas with no context. Dead.

**The fix:** seed every new account with a pre-populated demo project — 8–12 sticky notes, 2 GitHub-style commits, a connection or two, a digest already generated. Let them *feel* the product before they build it. Linear and Arc both do this. *1 day. Highest-leverage activation fix.*

#### 2. Watch it think — streaming AI

Claude's reasoning is your moat, but right now it happens in a black box. Stream digest tokens in with a subtle cursor. When tags are suggested, animate them flying onto the card. People pay for products where they can *see* intelligence happening. Vercel v0 and Cursor do this and it converts.

#### 3. Raycast / Alfred / iOS Shortcuts via URL scheme

```
hypher://capture?content=...&project=...
```

Two hours of work. Raycast extensions get pinned to the front of the store for a week at launch — free distribution to exactly your audience. This is the biggest distribution lever you have relative to effort.

#### 4. Public, shareable canvases

Let any project be toggled "public → read-only link." One button. The link renders the canvas frozen with a "Made with Hypher" watermark and a "Start your own" CTA. Every shared canvas becomes a landing page. This is how Figma, Excalidraw, and tldraw grew.

#### 5. Browser extension — the capture flywheel

Nothing captures better than highlighting text on any page → `Cmd+Shift+H` → it's in Hypher with the URL as a backlink. 2–3 days. This is the single feature most likely to convert Hypher from a weekly tool to a daily one.

#### 6. Daily digest as email

Mirror the in-app digest to email — same content, 8am local, with a "Reply to add a thought" hook that captures into their inbox project. Email is the best unsubscribe-resistant re-engagement channel, and it turns a daily-active metric into a weekly-retained one.

### Bucket 2 — Bleeding-edge bets

These are where you go from "nice productivity tool" to "I've never seen this before."

#### 7. Ambient Claude — the canvas talks back

Right-click any empty spot on the canvas → "Ask about what's around me." Claude sees the nearby cluster of notes and answers in-context. Or: drop a note near two others and a subtle suggestion appears: *"These three seem related — connect them?"* This is the spatial-AI thing nobody has nailed yet. Cursor did it for code; you can do it for thinking.

#### 8. Voice capture → structured output

Not "record a voice memo." Whisper transcribes, then Claude structures the transcript into title/body/tags/project on the fly. Makes builders at the gym, driving, or on walks into captive users. This is the feature most likely to be the screenshot that goes viral on X.

#### 9. Project health as a living number

Every project gets a score (0–100) updated in real-time from: recent activity, open blockers, CI status, days since last commit, stale notes. Render it as a beautiful animated ring on each project card. Answers the solo builder's worst anxiety: *which of my 7 projects is actually in trouble?* Nobody does this for indie devs.

#### 10. Canvas → PR description

You already pull GitHub context in. Go the other way: select five cards on the canvas → "Generate PR description." Claude writes it from the notes you captured while building the feature. Connects thinking → shipping in a way Linear, Notion, and GitHub can't, because they don't own the thinking layer.

#### 11. Async multiplayer

Skip real-time collab (expensive, niche for solos). Instead: "Share this canvas with a collaborator" → they see your canvas, can drop sticky notes, you get notified. Async comments-on-thinking. Perfect for "I bounce ideas off my designer friend."

#### 12. The embed widget play

`@hypher/core` already exists. Market it as "Intercom chat bubble but for capturing ideas on your own docs." Every indie dev's landing page gets a `<HypherCapture />` widget. Their captures go into their Hypher. Distribution judo — Hypher in front of everyone who visits an indie dev's site.

---

## The recommended two-week plan

If I were shipping this, this is the sequence. It lands you at a public beta with a genuine differentiator, not just plumbing.

### Week 1 — Make it launchable

| Day | Focus |
|---|---|
| Mon | Clerk auth + replace `userId: "default"` everywhere. |
| Tue | Landing page at `/`, app moves to `/app`. Pricing page with Stripe. |
| Wed | API-key management UI. Salt the hash. Rate limit `/api/capture`. |
| Thu | GitHub connect flow (OAuth or paste-your-PAT). Toast error system. |
| Fri | Seed demo project for new accounts. Skeleton loaders. Sentry hookup. |

### Week 2 — Make it bleeding-edge

| Day | Focus |
|---|---|
| Mon | URL scheme (`hypher://capture`). 2 hours. Then: streaming digest tokens. |
| Tue | Public shareable canvases + "Made with Hypher" watermark. |
| Wed | Project health score + animated ring on every project card. |
| Thu | Ambient Claude: "Ask about what's around me" right-click on canvas. |
| Fri | Playwright smoke on five critical paths. Publish `@hypher/core` to npm. |
| Weekend | Launch on X + Product Hunt + Raycast extension store. |

> **If you must choose just four features**
>
> Seed demo + URL scheme + public share + ambient Claude. That's the smallest set that makes Hypher feel unmistakably 2026 instead of another Notion clone with a canvas.

---

## Positioning & launch copy

### The four-way positioning

| Competitor | Their slot | What they miss |
|---|---|---|
| Linear | Team-first project tracker | Doesn't own thinking. Doesn't work for solos. |
| Notion | Document-first workspace | No spatial layer. No native AI reasoning across projects. |
| Reflect / Mem | Notes-first AI brain | No project structure. No GitHub or shipping integration. |
| Figma / tldraw | Design-first canvas | Not a project brain. No AI synthesis. |

> **The open slot**
>
> Spatial + AI-native + for solo builders + lifetime deal. No one else is running all four. Stand in it.

### Launch tweet (verbatim)

> Hypher is a spatial project brain for builders who juggle 6 projects at once. Capture anywhere (web, voice, API), see them cluster on a canvas, get a Claude-generated digest every morning telling you which project is actually in trouble. Free for 14 days. $150 lifetime.

### What to say on the landing page

- **Hero:** "Your projects, connected." with a live canvas preview.
- **Sub:** "Capture anywhere. See how your work connects. Ship what matters."
- **Three-column section:** Capture • Connect • Ship.
- **Social proof row** — embedded canvases from your first 5 beta users.
- **Pricing:** Free 14 days → $10/mo → $150 lifetime. Lifetime deal is your conversion lever.
- **Footer CTA:** "Try the demo canvas → no signup required" (the seed project, public).

---

## Appendix — Every gap in one place

### Tier 1 — Launch blockers

1. Auth (Clerk) + replace `userId: "default"` everywhere
2. Landing page at `/`, move app to `/app`
3. API-key management UI
4. Salt the API-key hash
5. GitHub connect flow (OAuth or PAT)
6. Stripe + pricing page
7. Rate limiting on `/api/capture`

### Tier 2 — Polish

1. Toast error system + React error boundaries
2. Skeleton loaders
3. Seed demo project for new accounts
4. Mobile responsive pass
5. Onboarding tooltip tour
6. Sentry / Logflare

### Tier 3 — Before scale

1. Convex search indexes
2. Retry/backoff on Anthropic + GitHub calls
3. Playwright E2E on 5 critical paths
4. GitHub webhooks replace cron
5. `tsconfig` strict mode + remove `any`

### Bleeding-edge features ranked

1. Seed demo project *(quick win)*
2. URL scheme — `hypher://capture` *(quick win)*
3. Streaming AI tokens in digest *(quick win)*
4. Public shareable canvases
5. Browser extension
6. Daily digest as email
7. Project health score ring
8. Ambient Claude on canvas *(bet)*
9. Voice capture → structured output *(bet)*
10. Canvas → PR description *(bet)*
11. Async multiplayer *(bet)*
12. `@hypher/core` as the "Intercom for capture" widget *(bet)*
