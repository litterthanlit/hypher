# Spec: Onboarding Flow — First-Run Experience

**Owner:** Orchestrator (Opus) → delegates to Sonnet, 2 PRs
**Status:** Queued, dispatch after tech-debt cleanup lands
**Timeline:** 1.5–2 days across both PRs
**Blocks:** Beta launch readiness
**Playbook reference:** "Onboarding tooltip tour (capture → canvas → digest, three steps)" + empty-canvas killer problem

---

## Problem

New users hitting `/app` for the first time see an empty state. They don't know:
- What Hypher is (capture home vs canvas vs project)
- How to get data in
- Where the differentiators live (Ambient Ask, digest, health ring)

Empty-canvas is the #1 new-product killer. Users leave within 60 seconds if they don't see value fast. The existing seed demo project (Spec #01) partially solves this but isn't framed — it just appears without context.

## Solution

Two-stage onboarding flow, shipped as two separate PRs.

---

# PR 1 — Welcome Dialog + Demo Data Seeding

## Scope

Single modal dialog that appears on first sign-in. Two CTAs. Writes completion state to Convex.

## User flow

```
Sign up → Land on /app → WelcomeDialog opens automatically
                                    ↓
              ┌─────────────────────┴──────────────────────┐
              ▼                                            ▼
   Click "Start with demo data"                 Click "Start fresh"
              ↓                                            ↓
   Existing generateSeedData() runs              Canvas is empty
              ↓                                            ↓
   Canvas populated with demo project          onboardingComplete = true
              ↓                                            ↓
   onboardingComplete = true                    Dialog dismisses
              ↓
   Dialog dismisses, user sees canvas
              ↓
           (Later: PR 2 inline tour auto-starts)
```

## Components to build

### `WelcomeDialog.tsx`

**Location:** `hypher-web/src/components/WelcomeDialog.tsx`

**Props:** None (self-contained; reads user state from Convex)

**Behavior:**
- Renders only when `user.onboardingComplete !== true` AND `user.clerkLoaded === true`
- Full-screen backdrop (not dismissible by clicking outside — forces a choice)
- Esc key does NOT dismiss — we want a conscious action
- Two primary actions only (no "skip for now" escape hatch — user can always sign out)

**Visual structure:**
```
┌─────────────────────────────────────────────┐
│                                             │
│              hypher                         │  ← lowercase wordmark, centered
│                                             │
│     your spatial project brain              │  ← tagline, medium weight
│                                             │
│  Capture anything, anywhere. See            │  ← 2-sentence subhead, gray
│  everything at once.                        │
│                                             │
│   ┌───────────────────────────────────┐     │
│   │   Start with demo data            │     │  ← primary CTA, green bg
│   └───────────────────────────────────┘     │
│                                             │
│   ┌───────────────────────────────────┐     │
│   │   Start fresh                     │     │  ← secondary, outline style
│   └───────────────────────────────────┘     │
│                                             │
│         (footer text: "takes 10 seconds")   │
│                                             │
└─────────────────────────────────────────────┘
```

**Design spec:**
- Background: `#fafafa` (matches existing capture home)
- Text: `#444` body, `#1a1a1a` headings
- Accent: `#2d9d6a` (existing green)
- Typography: Geist (existing)
- Max-width: 420px for the content column, centered vertically + horizontally
- Generous whitespace — don't crowd it
- Micro-animation: fade-in + 8px slide-up on mount (Framer Motion)
- `prefers-reduced-motion`: skip animations, just appear

## Convex changes

### Schema migration (`convex/schema.ts`)

Add to existing `users` table:
```typescript
users: defineTable({
  // ...existing fields
  onboardingComplete: v.optional(v.boolean()),
  tourComplete: v.optional(v.boolean()),
})
```

**Migration note:** Existing users get `undefined` → component treats as falsy → they will see the dialog on next visit. This is acceptable for a beta with small user count. If you want to backfill: add a one-time migration script that sets `onboardingComplete: true` for all existing users before merging.

### New mutation (`convex/users.ts` or new file)

```typescript
export const completeOnboarding = mutation({
  args: {
    withDemoData: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const user = await ctx.db.query("users")
      .withIndex("byClerkId", q => q.eq("clerkId", identity.subject))
      .unique();
    
    if (!user) throw new Error("User not found");
    
    await ctx.db.patch(user._id, { onboardingComplete: true });
    
    if (args.withDemoData) {
      // Call existing generateSeedData() logic
      await seedDemoProjectForUser(ctx, user._id);
    }
  },
});
```

## UX specifics

- **Primary CTA label:** `"Start with demo data"` (NOT `"Import from Notion"` — the data is fake, don't mislead)
- **Secondary CTA label:** `"Start fresh"`
- **Loading state:** After clicking primary, show brief spinner (~1s) while seed data is generated. Then dialog fades out and canvas reveals.
- **Error state:** If mutation fails, show inline error below buttons: `"Something went wrong. Try again."` — do NOT dismiss the dialog
- **Back to marketing site:** Small `← hypher.app` link top-left as escape hatch for accidentally-signed-up users

## Acceptance criteria

- [ ] New user sign-up → WelcomeDialog appears on first visit to `/app`
- [ ] Click "Start with demo data" → seed project appears on canvas, dialog dismisses, `onboardingComplete === true` in Convex
- [ ] Click "Start fresh" → canvas is empty (except for any data they imported via capture before), dialog dismisses, `onboardingComplete === true`
- [ ] Refresh page → dialog does NOT reappear
- [ ] Sign out and sign back in → dialog does NOT reappear
- [ ] Escape key does NOT dismiss the dialog
- [ ] Click outside the dialog does NOT dismiss
- [ ] Respects `prefers-reduced-motion`
- [ ] Mobile: dialog is full-screen, buttons stack vertically, tap targets >= 44px
- [ ] Vitest unit tests cover: rendering when `onboardingComplete` is undefined/false, hiding when true, mutation calls with correct args
- [ ] Build green, tests green, no new `(api as any)` casts

## Files expected to change

- `convex/schema.ts` — add 2 fields
- `convex/users.ts` — new `completeOnboarding` mutation + helper
- `hypher-web/src/components/WelcomeDialog.tsx` — new
- `hypher-web/src/app/app/page.tsx` — mount WelcomeDialog conditionally
- `hypher-web/src/components/__tests__/WelcomeDialog.test.tsx` — new

## Out of scope for PR 1

- Real Notion OAuth (explicitly deferred to Week 3)
- GitHub connect CTA in the dialog (deferred — trust-deepening action, belongs later)
- Tooltip tour (that's PR 2)
- Replay access via "?" button (that's PR 2)
- Multi-step wizard (we're intentionally keeping this single-screen)

---

# PR 2 — Inline Tooltip Tour

## Scope

After WelcomeDialog completes, a 3-step inline tour runs. Points at real UI elements. Tracks completion separately from dialog.

## User flow

```
WelcomeDialog completes → 500ms delay → OnboardingTour auto-starts
                                                    ↓
                        ┌───────────────────────────┼───────────────────────────┐
                        ▼                           ▼                           ▼
              Tooltip 1 (capture card)    Tooltip 2 (Ambient Ask)     Tooltip 3 (digest)
                        ↓                           ↓                           ↓
                   User clicks Next →       User clicks Next →           User clicks Done
                                                                                ↓
                                                                tourComplete = true
                                                                                ↓
                                                          "?" icon visible top-right for replay
```

## Components to build

### `OnboardingTour.tsx`

**Location:** `hypher-web/src/components/OnboardingTour.tsx`

**Props:** None (self-contained, reads/writes Convex state)

**Behavior:**
- Renders only when `user.onboardingComplete === true` AND `user.tourComplete !== true`
- Uses a portal to render tooltip overlays above the canvas
- Dims the rest of the UI with a subtle `rgba(0,0,0,0.3)` overlay
- Spotlights the target element by leaving it un-dimmed (cutout mask via SVG or inset box-shadow trick)
- Each tooltip auto-positions relative to its target (use react-popper or floating-ui; avoid hand-rolling positioning)

### Tour steps

**Step 1 — Capture card**
- **Target:** First visible capture/note element on the canvas (use `data-onboarding-target="capture"` attribute on the component)
- **Tooltip copy:** 
  - Title: "This is a capture"
  - Body: "Anything you save lands here. Drag to arrange, double-click to expand."
  - Buttons: `Skip tour` (ghost) | `Next →` (primary)

**Step 2 — Ambient Ask trigger**
- **Target:** The Ambient Ask button/panel trigger (`data-onboarding-target="ambient-ask"`)
- **Tooltip copy:**
  - Title: "Ask Claude about your canvas"
  - Body: "Hit this to ask anything about what you've captured. Claude sees everything on the canvas."
  - Buttons: `← Back` | `Skip tour` | `Next →`

**Step 3 — Digest button**
- **Target:** The daily digest button/indicator (`data-onboarding-target="digest"`)
- **Tooltip copy:**
  - Title: "Daily morning digest"
  - Body: "Every morning, Claude writes a 2-paragraph summary of what's new. Reply to the email to add new captures."
  - Buttons: `← Back` | `Done ✓` (primary)

### Convex changes

Add to `convex/users.ts`:
```typescript
export const completeTour = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const user = await ctx.db.query("users")
      .withIndex("byClerkId", q => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");
    await ctx.db.patch(user._id, { tourComplete: true });
  },
});

export const resetTour = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const user = await ctx.db.query("users")
      .withIndex("byClerkId", q => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");
    await ctx.db.patch(user._id, { tourComplete: false });
  },
});
```

### Replay "?" button

**Location:** Top-right of the app chrome, next to the UserButton

**Icon:** `?` in a circle or `Lightbulb` from lucide-react

**Behavior:**
- On click: calls `resetTour` mutation → sets `tourComplete: false` → OnboardingTour component re-mounts and starts again

## Data attributes to add

PR 2 needs the app's canvas components to expose target attributes. These are additive — they don't change existing behavior:

| Component | Attribute needed |
|-----------|-----------------|
| Note/capture card component | `data-onboarding-target="capture"` on first rendered card |
| AmbientAskPanel trigger | `data-onboarding-target="ambient-ask"` on the button/panel wrapper |
| Daily digest button | `data-onboarding-target="digest"` |

**Fallback:** If any target is missing (e.g., user chose "Start fresh" so there are no captures yet), skip that step gracefully — don't crash. Show a `setTourComplete` call and move on, with a toast: `"Tour will resume when you have content."`

## Visual design

**Tooltip card:**
- White background, subtle shadow (`0 4px 16px rgba(0,0,0,0.1)`)
- Rounded corners (8px)
- Max-width: 320px
- Padding: 16px 20px
- Typography: Geist, 14px body, 15px title (semibold)
- Arrow pointing at target (triangle, same bg as card)
- Green accent on primary buttons only

**Progress indicator:**
- Three small dots at bottom of tooltip card: `● ○ ○`, `○ ● ○`, `○ ○ ●`
- Or a minimal `Step 1 of 3` label — pick one, not both

**Animation:**
- Tooltip fade + 4px slide-up on mount
- 200ms transition between steps
- `prefers-reduced-motion`: no transitions, just snap

## Acceptance criteria

- [ ] User completes WelcomeDialog → after 500ms, Tooltip 1 appears
- [ ] Next button advances through all 3 steps
- [ ] Back button returns to previous step (except from step 1)
- [ ] Skip button exits tour, sets `tourComplete: true`
- [ ] Done button on step 3 exits tour, sets `tourComplete: true`
- [ ] After tour completes, "?" icon visible top-right
- [ ] Click "?" icon → tour replays from step 1
- [ ] Refresh page mid-tour → tour resumes at step 1 (don't over-engineer per-step resume)
- [ ] If target element is missing, step is skipped cleanly, no crash
- [ ] Escape key skips the tour (records `tourComplete: true`)
- [ ] Mobile: tooltips reposition sensibly, buttons remain tappable
- [ ] Respects `prefers-reduced-motion`
- [ ] Vitest tests cover: step advance, skip, replay, missing target fallback
- [ ] Accessibility: tour is keyboard-navigable, focus is trapped in current tooltip, screen reader announces each step

## Files expected to change

- `convex/users.ts` — add 2 mutations
- `hypher-web/src/components/OnboardingTour.tsx` — new
- `hypher-web/src/components/HelpReplayButton.tsx` — new (the `?` icon)
- `hypher-web/src/app/app/page.tsx` — mount OnboardingTour and HelpReplayButton
- Various card/panel components — add `data-onboarding-target` attributes (~5 files, 1-line changes each)
- `hypher-web/src/components/__tests__/OnboardingTour.test.tsx` — new

## Out of scope for PR 2

- Analytics on tour drop-off (valuable but separate; add PostHog in Week 3)
- A/B testing different copy (launch first, optimize later)
- Multi-language (beta is English-only)
- GitHub connect as a step (deferred to Week 3)
- Video walkthroughs or GIFs embedded in tooltips

---

# Dispatch checklist (for Nick)

Before you paste this into Opus:

- [ ] PR #30 (Chrome extension) merged
- [ ] Env vars Sections 1–3 complete (Clerk, Convex, Anthropic)
- [ ] Tech-debt cleanup PR merged (`(api as any)` casts removed)
- [ ] Main is clean (`git status` shows no uncommitted changes)
- [ ] Pulled latest

---

# Briefing for Opus (paste this into fresh orchestrator session)

> **Spec: Onboarding Flow — dispatch as 2 PRs**
>
> Full spec lives at `docs/launch/05-onboarding-flow-spec.md` in the repo. Read it before planning.
>
> **Two ambiguities Nick has pre-answered:**
> 1. **Notion import:** Ship mock/seed-based for PR 1. Wire the primary CTA to `generateSeedData()`. Label the CTA `"Start with demo data"`, NOT `"Import from Notion"`. Real OAuth is explicitly Week 3 work — do not spec it here.
> 2. **Persistence:** Add `onboardingComplete` and `tourComplete` as optional booleans on the existing `users` table in Convex. Don't create a new `userPreferences` table.
>
> **PR 1 (Welcome Dialog)** — dispatch first. Smaller, unblocks testing PR 2.
>
> **PR 2 (Tooltip Tour)** — dispatch after PR 1 merges. Depends on user flow that PR 1 establishes.
>
> **Both PRs:**
> - Must pass `npm run build` and `npm run test` before opening
> - Must NOT introduce any `(api as any)` casts (tech-debt cleanup already shipped)
> - Must enumerate all deviations in the PR description
> - Must include Vitest coverage for the new components
>
> **Rules of Hooks reminder:** If you're adding hooks to `app/page.tsx`, place them ABOVE any conditional return. The `clerkLoaded` gate pattern is the one that crashed before.
>
> **Dispatch Sonnet on PR 1 now. Hold PR 2 until PR 1 merges.**

---

## Why this spec is structured this way

**Two PRs not one:** PR 1 is gated on Convex schema changes + existing `generateSeedData()` integration. PR 2 is gated on adding `data-onboarding-target` attributes across the app and building a new portal-based overlay system. Different code paths, different review concerns. Shipping together doubles review surface area and makes rollback harder if one half is buggy.

**No GitHub connect in the flow:** GitHub OAuth adds trust friction. Don't ask for it at minute zero. Better: expose "Connect GitHub" as a checklist item in a post-onboarding settings panel. Users who want it will find it.

**No multi-step wizard:** Research on onboarding wizards is consistent — >2 pre-value steps kills conversion. Welcome → Canvas is two steps. Adding "choose your role," "invite your team," "pick your templates" gates value delivery. Don't.

**Tour is 3 steps not 5:** Above 3, drop-off accelerates. The 3 we've picked are your actual differentiators: spatial capture, Ambient Ask, digest-and-reply. Don't add tooltips for features that aren't Hypher's hook.

**Skip button available always:** Users who resent being told how to use software will quit. Giving them the exit keeps the ones who want the tour without alienating the ones who don't.
