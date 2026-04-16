# Spec: Seed demo project on sign-up ("Try Hypher")

**Owner:** unassigned
**PR target branch:** `cursor/week-2-1-seed-demo-project-XXXX`
**Depends on:**
- Week 1 Clerk auth PR (adds `@clerk/nextjs`, middleware, replaces hardcoded `userId: "default"` with Clerk `userId` across `hypher-web/convex/**` and `hypher-web/src/components/**`, and — critically — adds a `userId: v.string()` field to the `objects` and `connections` tables in `hypher-web/convex/schema.ts` with a `by_user` index).
- Week 1 GitHub connect flow PR (optional — only if the demo's commit cards render the GitHub-style UI component; the seed itself does not require a real connected repo).

**Conflicts with:** Anything editing `hypher-web/convex/http.ts`, `hypher-web/convex/schema.ts`, or introducing a `convex/seed.ts` / `convex/users.ts` module concurrently.

---

## Why

A brand-new account today lands on an empty canvas with no digest, no connections, nothing to click. The playbook calls this the single highest-leverage activation fix ("Aha in 10 seconds"). Seeding every new user with a pre-populated "Try Hypher" project that already has notes, commits, AI suggestions and a digest lets the user *feel* the product in ten seconds instead of reading docs. Linear and Arc both win onboarding this way.

## Scope

### In scope

- A Convex `internalMutation` that creates one demo project ("Try Hypher") for a given `userId`, populated with:
  - 10 sticky notes (hard-coded, project-themed — see "Demo content" below).
  - 2 artifact objects tagged as `type: "code"` with `canvasColor` set to the GitHub green used by existing commit-style cards (functional stand-ins for real commits — no GitHub repo required).
  - 3 manual connections (`type: "manual"`) between notes and between a note and a commit card.
  - 1 pre-generated digest stored as a regular note with `tags: ["digest"]` and `maturity: "structured"` so it renders in the sidebar's Recent strip and can be opened by the `DailyDigest` UI without a live Claude call.
  - All 13 objects placed at deterministic canvas coordinates so the layout "looks designed" on first load (no random positions).
- A Clerk webhook handler, implemented as a Convex `httpAction` at `POST /api/clerk-webhook` in `hypher-web/convex/http.ts`, that:
  - Verifies the Svix signature headers (`svix-id`, `svix-timestamp`, `svix-signature`) against `CLERK_WEBHOOK_SECRET`.
  - Handles only the `user.created` event.
  - Calls `internal.seed.createDemoProject({ userId, displayName })`.
  - Returns 200 on duplicate/idempotent replays.
- Idempotency: the internal mutation short-circuits if the user already has a project with `isDemo: true`.
- A new `isDemo: v.optional(v.boolean())` field on the `objects` table so the demo project and its items are identifiable. Used to show a "Demo" pill on the project card and enable the "Archive demo" shortcut.
- A small UI affordance in `hypher-web/src/components/Sidebar.tsx` or the project card: a muted "Demo" pill next to the project name, and a right-click / "⋯" menu item "Archive demo project". Archiving = setting `status: "archived"` (existing field). Deletion uses the existing `store.removeObject` flow.

### Out of scope

- Onboarding tour / tooltip walkthrough (Tier 2 item, separate spec).
- Running a real live Anthropic call to generate the digest at seed time. The seed digest is hard-coded text so seeding is fast (<100ms), deterministic, and does not burn tokens on every signup.
- GitHub OAuth or connecting a real repo. The two "commit cards" are stand-in artifacts; they do not hit `api.github.com`.
- Per-user settings UI to "reset demo" or "re-seed". v1 seeds exactly once.
- Backfilling existing users without a demo project — this spec only affects new signups going forward.
- The Tauri / native app sign-up path. Assumes all new users come through the web Clerk flow for now.

## Technical approach

### New file: `hypher-web/convex/seed.ts`

Export one `internalMutation`:

```ts
export const createDemoProject = internalMutation({
  args: { userId: v.string(), displayName: v.optional(v.string()) },
  handler: async (ctx, { userId, displayName }) => { ... }
});
```

Behavior:

1. Query `objects` by the `by_user` index (added in Week 1) + filter `kind === "project"` + `isDemo === true`. If one exists, return early with `{ skipped: true, projectId }`.
2. Insert the demo project with `kind: "project"`, `name: "Try Hypher"`, `description: "A tour of Hypher in one canvas. Delete me anytime."`, `status: "active"`, `priority: 3`, `isDemo: true`, `userId`, `createdAt: now`, `modifiedAt: now`, `lastActivity: now`.
3. Insert 10 notes and 2 artifact cards with `projectId` = the demo project's `_id`, each with an explicit `canvasPosition` laid out in a rough 3x5 grid centred at `(0, 0)` (see "Canvas layout" below). All items carry `userId`, `isDemo: true`.
4. Insert one additional note: the pre-generated digest. `content` = the hard-coded digest copy. `tags: ["digest"]`, `maturity: "structured"`, `canvasPosition` set just above the project title in the canvas.
5. Insert 3 connections in the `connections` table: all `type: "manual"`, `confidence: 1`, deterministic `reason` strings ("Both about onboarding", etc.), `userId` set.
6. Insert one `activity` row: `action: "created"`, `objectKind: "project"`, `objectName: "Try Hypher"`, `summary: "Seeded demo project"`.
7. Return `{ skipped: false, projectId }`.

Notes on implementation:

- Use `Date.now()` once at the top of the handler for `createdAt` / `modifiedAt` so all 14 inserts share a consistent timestamp.
- Do not compute embeddings here; embeddings are generated client-side in `hypher-web/src/lib/embeddings.ts` on first view. Leave `embedding` unset.
- Do not call `generateTags` (`convex/ai.ts`) — tags are hand-curated in the seed payload so the demo is identical for every user.

### New file: `hypher-web/convex/seedContent.ts`

Pure-TS module (no Convex imports) exporting the typed demo payload. Keeps `seed.ts` focused on the mutation and makes the copy easy to review in PR diffs.

```ts
export interface SeedNote { content: string; maturity: NoteMaturity; tags?: string[]; canvasPosition: { x: number; y: number }; canvasColor?: string; }
export interface SeedArtifact { name: string; type: ArtifactType; canvasPosition: { x: number; y: number }; canvasColor?: string; tags?: string[]; }
export interface SeedConnection { fromIndex: number; toIndex: number; reason: string; }
export const demoProject: { name: string; description: string; notes: SeedNote[]; artifacts: SeedArtifact[]; connections: SeedConnection[]; digest: string };
```

`fromIndex` / `toIndex` refer to the zero-based index in the concatenated `[...notes, ...artifacts]` list so the seed mutation can resolve them to real Convex IDs after insert.

### Demo content (curated — copy is locked in this spec)

**Project:** "Try Hypher" — `description: "A tour of Hypher in one canvas. Delete me anytime."`

**Notes (10):**

1. `"Welcome to Hypher. Press ⌘N anywhere to capture a thought."` (fleeting)
2. `"Every capture lands here first. Drag it into a project or let Hypher suggest one."` (fleeting)
3. `"Cards connected by a line mean Hypher thinks they're related. Confirm with ✓, dismiss with ✗."` (developing)
4. `"The digest above is generated every morning. It tells you which project is actually in trouble."` (developing)
5. `"Try ⌘K to search across every note, artifact, and project."` (fleeting)
6. `"Press Tab to swap between canvas and list view."` (fleeting)
7. `"Drop any file on the canvas — PDFs, images, code — and it becomes an artifact."` (developing)
8. `"Right-click a blank space to add a note exactly where you want it."` (fleeting)
9. `"Connect Hypher to GitHub from Settings → Integrations to see live commits and PRs."` (developing)
10. `"When you're done exploring, archive this project from the '⋯' menu."` (fleeting)

**Artifacts (2 — commit-style):**

1. `name: "feat: add spatial canvas"`, `type: "code"`, `canvasColor: "#238636"`, `tags: ["commit", "demo"]`
2. `name: "fix: keyboard shortcut conflict"`, `type: "code"`, `canvasColor: "#238636"`, `tags: ["commit", "demo"]`

**Connections (3):**

- Note 3 ↔ Note 4 — `"Both explain Hypher's AI layer"`
- Note 9 ↔ Artifact 1 — `"GitHub integration example"`
- Note 7 ↔ Note 8 — `"Both describe how to add items"`

**Digest note (pre-generated, hard-coded string, 180 words or fewer, matches tone of `convex/ai.ts:generateDigest`):**

> Good morning. You have one project active today — *Try Hypher*. It has 10 notes and 2 recent commits. Focus: explore one connection and one GitHub card to see how Hypher links thinking to shipping. Nothing blocking. When you're ready, create your first real project with ⌘N.

### Canvas layout

All positions are in logical canvas units (the same units used by `hypher-web/src/components/SpatialCanvas.tsx`). Approximate layout:

- Digest note: `(0, -400)` — top row, centred.
- Notes 1–5: row at `y = -180`, evenly spaced between `x = -640` and `x = 640` in steps of `320`.
- Notes 6–10: row at `y = 40`, same x spacing.
- Artifact 1: `(-320, 260)`.
- Artifact 2: `(320, 260)`.

Coordinates may be tuned in implementation but must be deterministic (no `Math.random()`).

### Schema changes (`hypher-web/convex/schema.ts`)

Add to `objects` table:

```ts
isDemo: v.optional(v.boolean()),
```

No new index needed — demo lookups happen by the existing `by_user` index (added in Week 1) + an in-memory `filter(o => o.isDemo && o.kind === "project")`. For a new user this is a tiny result set.

If Week 1 has not yet added `userId` to `objects` / `connections`, this spec must not ship — flag it up to Nick so Week 1 lands first.

### `hypher-web/convex/http.ts` (modify)

Add a new route:

```ts
http.route({
  path: "/api/clerk-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => { ... })
});
```

Inside the handler:

1. Read raw body (`await request.text()`) — needed for signature verification.
2. Pull headers `svix-id`, `svix-timestamp`, `svix-signature`.
3. Verify with the `svix` npm package (`new Webhook(secret).verify(body, headers)`). On failure return 401.
4. Parse JSON. If `type !== "user.created"` return 200 immediately (webhook delivery is idempotent from Clerk's side).
5. Extract `data.id` (Clerk user id) and `data.first_name`.
6. `await ctx.runMutation(internal.seed.createDemoProject, { userId: data.id, displayName: data.first_name })`.
7. Return `new Response(null, { status: 200 })`.

The `svix` package must be added to `hypher-web/package.json` as a dependency. It is Node-only — the `httpAction` file already uses Node via Convex runtime (no `"use node"` directive needed because `httpAction` runs in the standard Convex runtime, but the `svix` package works there). If Convex build fails on the Edge-style runtime, convert to `action` + `httpAction` proxy pattern: a lightweight HTTP action that forwards to an `action` with `"use node"` that actually verifies the signature. Prefer direct `httpAction` first, fall back if needed.

### Clerk dashboard configuration (out of code, documented in PR description)

- Webhook endpoint URL: `{NEXT_PUBLIC_CONVEX_URL}/api/clerk-webhook` (the Convex HTTP URL, not the Next.js URL).
- Events subscribed: `user.created`.
- Secret: written to Convex env var `CLERK_WEBHOOK_SECRET` via `npx convex env set CLERK_WEBHOOK_SECRET <value>`.
- Signing version: v1 (Svix default).

### External dependencies

- `svix` (new) — Svix webhook verification. Add to `hypher-web/package.json`.
- No other new dependencies. The existing Anthropic SDK is *not* invoked by the seed.

### Files changed summary

| File | Change |
|---|---|
| `hypher-web/convex/schema.ts` | Add `isDemo?: boolean` to `objects` table. |
| `hypher-web/convex/seed.ts` | **NEW** — `internalMutation` `createDemoProject`. |
| `hypher-web/convex/seedContent.ts` | **NEW** — typed demo payload, hard-coded. |
| `hypher-web/convex/http.ts` | Add `POST /api/clerk-webhook` route. |
| `hypher-web/package.json` | Add `svix` dep. |
| `hypher-web/src/components/Sidebar.tsx` | Render "Demo" pill when `project.isDemo === true`. |
| `hypher-web/src/components/ProjectSettings.tsx` | Add "Archive demo project" button when `project.isDemo`. |
| `hypher-web/src/types/index.ts` | Add `isDemo?: boolean` to `Project` interface. |

## Acceptance criteria

- Creating a brand-new account (via Clerk sign-up) triggers the webhook and within 3s the user sees a project named "Try Hypher" in the sidebar with 10 notes, 2 commit-style artifacts, 3 connections, and one digest note.
- Replaying the same `user.created` webhook payload a second time does not create a second demo project (idempotent).
- The demo project shows a "Demo" pill in the sidebar and the project card.
- Clicking "Archive demo project" sets its `status` to `"archived"` and it disappears from the active list; existing delete flow still works to fully remove it.
- Webhook requests with a missing or invalid Svix signature return 401 and create nothing.
- `CLERK_WEBHOOK_SECRET` absent → endpoint returns 500 with a safe error message, no seeding.
- `tsc --noEmit` in `hypher-web/` passes with zero errors.
- `next build` in `hypher-web/` passes with zero errors and no new warnings.
- `npx convex dev --once` in `hypher-web/` validates the schema without errors.

## How to test

1. Pull the branch, `bun install` in `hypher-web/`.
2. `npx convex dev` — confirm schema migration runs, `isDemo` column added.
3. In a second terminal: `bun dev`.
4. In the Clerk dashboard (dev instance): add the Convex HTTP URL as a webhook endpoint, subscribe `user.created`, copy the signing secret.
5. `npx convex env set CLERK_WEBHOOK_SECRET <secret>`.
6. Open the app in an incognito window. Sign up with a fresh email. Verify:
   - Within 3 seconds the "Try Hypher" project appears.
   - It has 10 notes + 2 commit cards + 3 connections + 1 digest note.
   - The "Demo" pill is visible.
   - Canvas layout matches the spec (deterministic positions).
7. In the Clerk dashboard, resend the same webhook event. Confirm no duplicate project.
8. From the project menu, click "Archive demo project". Confirm status changes to archived and it leaves the active list.
9. Sign out, delete the Clerk user from the dashboard, sign up again with a new email. Confirm a new demo project is seeded for the new Clerk user.
10. Send a malformed POST (`curl -X POST <url> -d 'garbage'`). Confirm 401 and no DB writes.

## Security & privacy notes

- `CLERK_WEBHOOK_SECRET` stored only in Convex env, never in client bundle. Never log it.
- Svix signature verification is mandatory before any DB write. The endpoint must not leak "user exists" information in its response (always return 200 for verified duplicate events, 401 for bad signatures, 500 for misconfig — nothing that distinguishes "already seeded" from "new user").
- Webhook handler is fail-closed: if verification fails for any reason (missing secret, bad signature, JSON parse error), no mutations run.
- Rate limiting: Clerk's own delivery is bounded; we do not add additional rate limits on this endpoint.
- No PII beyond the Clerk `userId` and first name is stored. First name is only used to tailor the digest copy if present; it is safe if missing.
- The demo content is hard-coded and reviewed in this spec; it contains no secrets, no test tokens, no internal URLs.

## Known tradeoffs

- **Hard-coded digest vs. live Claude call.** The digest is a fixed string. Pro: deterministic, fast, costs no tokens, works offline. Con: every user sees the same paragraph. Acceptable for v1; revisit if the demo project becomes a retention lever beyond onboarding. **Sunset:** reassess by 2026-07-01 once we have 500+ signups.
- **Webhook-only seeding.** If Clerk fails to deliver the webhook (rare but possible — Svix retries for 24h), a user signs up and sees an empty canvas. Acceptable risk in v1 because Clerk's retry is aggressive; we can add a client-side fallback ("if no demo project after 10s, call a fallback authed mutation") later. **Sunset:** revisit if we see >1% of signups without a seeded project.
- **No backfill.** Existing users (if any) without a demo project do not get one. Acceptable because the app has not launched publicly yet. If Nick wants a backfill before launch, that's a one-line admin script calling `internal.seed.createDemoProject` for each Clerk user.
- **`isDemo` is a single boolean.** We could instead add a richer `origin: "user" | "seed" | "import"` enum, but YAGNI for v1. If we later add multiple seed variants (team demo, blog demo), revisit.
- **Commit cards are fake artifacts, not real commits.** Users might be confused when they see "feat: add spatial canvas" and it has no link to a real PR. The card copy includes the `demo` tag to make this visible, and the note `"Connect Hypher to GitHub from Settings → Integrations to see live commits and PRs."` sits next to them as context. **Sunset:** once GitHub connect flow lands, replace with a screenshot/thumbnail to make the distinction clearer.
