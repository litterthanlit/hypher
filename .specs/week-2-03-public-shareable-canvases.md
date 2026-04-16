# Spec: Public, shareable, read-only canvases

**Owner:** unassigned
**PR target branch:** `cursor/week-2-3-public-shareable-canvases-XXXX`
**Depends on:**
- Week 1 Clerk auth PR (owners must be signed in to toggle sharing; public viewers must *not* be; `auth()` must return `null` on public routes).
- Week 1 "app moves to `/app`" PR so that `/c/<slug>` can live at the root and not collide with the authenticated app shell.
- Spec 01 (demo project) — not a hard dependency, but the demo project will be a tempting first public canvas and needs to be shareable too.

**Conflicts with:**
- Any concurrent edits to `hypher-web/convex/schema.ts`, `hypher-web/src/components/SpatialCanvas.tsx`, `hypher-web/src/components/ProjectSettings.tsx`.
- Any PR introducing a separate routing layer at `/c/*`.

---

## Why

Every shared canvas becomes a landing page. Figma, Excalidraw, and tldraw all grew on this mechanic: one-click "public read-only link" with a subtle watermark CTA. For Hypher specifically, it also gives power users a low-friction way to show a collaborator what they've been thinking about — a capability Notion and Linear fundamentally can't match because they don't own the spatial + AI-reasoning layer. Cost to build: one day. Return: a viral vector baked into the product.

## Scope

### In scope

- A new per-project "Share publicly" toggle in project settings that:
  - Flips an `isPublic: boolean` field on the project.
  - On first enable, generates and stores a short `publicSlug: string` (8 chars, unique) on the project.
  - On disable, leaves the slug intact (so re-enabling re-uses the same link) but the public route returns 404 while `isPublic === false`.
  - Shows a "Copy link" button that writes `https://hypher.app/c/<slug>` (or `process.env.NEXT_PUBLIC_APP_URL`) to the clipboard.
- A public, unauthenticated route at `/c/<slug>` that:
  - Renders a read-only variant of the project canvas (existing `SpatialCanvas` component in read-only mode, no drag, no edit, no connection approval).
  - Shows the project name, description, note and artifact cards with their positions, and **confirmed** connections only.
  - Overlays a "Made with Hypher — Start yours free" watermark pill in the bottom-right and a muted "Start your own" CTA that links to the marketing site `/` (or `/sign-up` if already on `/`).
  - Is fully crawlable (HTML response includes the canvas text in the initial payload; see "Rendering" below) so the URL works as a mini landing page.
- A Convex query `api.sharing.getByPublicSlug` that returns a sanitized `{ project, items, connections }` payload (see "Sanitization" below).
- A per-item `visibility` opt-out: a `privateOnShare: boolean` on notes and artifacts, default `false`. When `true`, the item is stripped from the public payload and its connections are dropped.
- 404 behavior when the slug does not exist, the project is not public, or the project is archived.
- A small "Public" pill in the project header when `isPublic === true` so the owner always knows the canvas is live.

### Out of scope

- Password-protected or expiring share links.
- Editable-by-viewer share links (that's "async multiplayer" — a separate item in the playbook, bucket 2).
- Commenting on shared canvases.
- Embeds / oEmbed / Open Graph preview images for the shared URL. A flat meta tag set is fine for v1 (project name + description). Full OG image rendering is a follow-up.
- Share analytics (`view_count`, etc.).
- Team-level sharing controls.
- Custom slugs chosen by the user.

## Technical approach

### Schema changes (`hypher-web/convex/schema.ts`)

Add to the `objects` table:

```ts
isPublic: v.optional(v.boolean()),
publicSlug: v.optional(v.string()),
publicSharedAt: v.optional(v.number()),
privateOnShare: v.optional(v.boolean()),
```

`isPublic` / `publicSlug` / `publicSharedAt` are only meaningful on rows where `kind === "project"`. `privateOnShare` is only meaningful on `kind === "note"` or `kind === "artifact"`. Nothing in this spec cares about that distinction at the Convex type layer — document it in `hypher-web/src/types/index.ts` and enforce in the mutation/query layer.

Add one index:

```ts
.index("by_publicSlug", ["publicSlug"])
```

Slug lookups happen once per public page load and must be O(log n).

### New file: `hypher-web/convex/sharing.ts`

Three exports:

```ts
export const togglePublic = mutation({
  args: { projectId: v.id("objects") },
  handler: async (ctx, { projectId }) => { ... }
});

export const setItemPrivateOnShare = mutation({
  args: { id: v.id("objects"), privateOnShare: v.boolean() },
  handler: async (ctx, { id, privateOnShare }) => { ... }
});

export const getByPublicSlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => { ... }
});
```

**`togglePublic` behavior:**

1. Fetch the project. Confirm the caller is the owner (compare Clerk `userId` from `ctx.auth.getUserIdentity()` or from the `userId` field on the row post Week 1). Reject otherwise.
2. If `isPublic === true` → set to `false`, touch `modifiedAt`, leave `publicSlug` untouched.
3. If `isPublic === false` (or undefined):
   - If `publicSlug` is unset, generate one via `generateSlug()` (8 lowercase alphanumeric chars; collision-retry up to 5 times against the `by_publicSlug` index before throwing).
   - Set `isPublic: true`, `publicSharedAt: Date.now()`, `modifiedAt: Date.now()`.
4. Return `{ isPublic, publicSlug }`.

**`setItemPrivateOnShare` behavior:**

1. Fetch the item. Confirm the caller owns it.
2. Patch `privateOnShare`.
3. Return void.

**`getByPublicSlug` behavior:** This is the critical function. It is called from an *unauthenticated* route, so ownership is not checked — instead it enforces a strict allowlist of fields.

1. Lookup project by `by_publicSlug`. If missing, or `isPublic !== true`, or `status === "archived"`, throw `ConvexError("Not found")`.
2. Fetch all items (`objects` rows) with `projectId === project._id`. Drop any with `privateOnShare === true`.
3. Fetch all confirmed connections (`type === "ai_confirmed"` or `type === "manual"`) whose both endpoints exist in the filtered items list. Drop anything referencing a dropped item.
4. Return a **sanitized** payload using an explicit allowlist of fields (see next section). **Never** spread the Convex doc — always pick.

### Sanitization rules — explicit, exhaustive allowlist

This is the most security-sensitive part of the spec. The implementer must **copy the allowlist below verbatim**, field by field, and never use object spread or `Object.assign` on a Convex doc inside `sharing.ts`. Every field the public payload returns is explicitly picked — no exceptions.

#### `PublicProject` — allowlist (exactly these 5 fields):

| Field | Source | Why safe |
|---|---|---|
| `id` | Convex `_id` | Opaque identifier, already exposed by the slug path. |
| `name` | `name` | The user-chosen project name — the thing they're sharing. |
| `description` | `description` | User-chosen project description. |
| `createdAt` | `createdAt` | Timestamp only, no PII. |
| `modifiedAt` | `modifiedAt` | Timestamp only, no PII. |

#### `PublicNote` — allowlist (exactly these 8 fields):

| Field | Source | Why safe |
|---|---|---|
| `id` | `_id` | Opaque. |
| `kind` | Literal `"note"` | Type discriminator. |
| `content` | `content` | User-written note body — the point of sharing. |
| `maturity` | `maturity` | UI hint (`fleeting`/`developing`/etc.), no PII. |
| `tags` | `tags` | User-chosen tags. Tag *names* only; never the `tags` table rows, which carry `userId`. |
| `canvasPosition` | `canvasPosition` | Coordinates on the canvas. |
| `canvasColor` | `canvasColor` | Styling. |
| `canvasSize` | `canvasSize` | Styling. |

#### `PublicArtifact` — allowlist (exactly these 7 fields):

| Field | Source | Why safe |
|---|---|---|
| `id` | `_id` | Opaque. |
| `kind` | Literal `"artifact"` | Type discriminator. |
| `name` | `name` | User-chosen filename / display name. |
| `type` | `type` | Media kind (`image`/`code`/etc.). |
| `thumbnailDataUrl` | `thumbnailDataUrl` | Base64 data URL stored inline. Safe because it's self-contained and already user-intended content. **Never** expose `fileReference`. |
| `tags` | `tags` | Same reasoning as notes. |
| `canvasPosition` | `canvasPosition` | Coordinates. |
| `canvasColor` | `canvasColor` | Styling. |

#### `PublicConnection` — allowlist (exactly these 5 fields):

| Field | Source | Why safe |
|---|---|---|
| `id` | `_id` | Opaque. |
| `sourceId` | `sourceId` | References an item already in the public payload. |
| `targetId` | `targetId` | References an item already in the public payload. |
| `type` | `type` | One of `"manual"` or `"ai_confirmed"` only — filter out everything else before projecting. |
| `reason` | `reason` | AI-generated explanation string, safe to show. |

#### Fields that **must never** leave via the public query (exhaustive denylist):

**On `objects` rows:**
- `userId` — PII link to Clerk identity.
- `embedding`, `embeddingText` — semantic fingerprints of the full content; large, and could leak information about neighbouring private items.
- `githubRepo`, `githubLastSync` — reveals private repo names, potential for enumeration attacks against GitHub.
- `blockers`, `priority`, `status` — internal workflow metadata the owner never intended to share.
- `lastActivity`, `lastSurfacedAt` — usage fingerprint.
- `isDemo`, `isPublic`, `publicSlug`, `publicSharedAt`, `privateOnShare` — internal sharing state. Returning `publicSlug` would be a trivial enumeration surface.
- `fileReference` — server-side file path; exposure could aid directory traversal or bucket probing.

**On `connections` rows:**
- Anything with `type === "dismissed"` or `type === "ai_suggested"` — filtered out before the shape step.
- `confidence` — an AI score the owner has not chosen to publish.
- `createdAt` — unused downstream.

**Entire tables the public query must never read from** (structural guarantee — add a comment at the top of `sharing.ts` asserting this):
- `apiKeys` — contains hashed API keys.
- `githubTokens` — contains GitHub OAuth/PATs.
- `tags` — tag-index rows are keyed by `userId`; the tag *names* are already surfaced in the `objects.tags` array.
- `activity` — per-user audit log.

If a future change wants to surface any of the above (e.g., "show public view-count"), it must introduce a **new** sanitized query; it must not modify the allowlist in `getByPublicSlug` to grow.

### Slug generation — random, never sequential

**Must be random, not sequential.** A sequential slug (`/c/1`, `/c/2`, …) lets anyone enumerate every public canvas in the system. A random, high-entropy slug makes the URL itself the capability — you need the link to load the canvas.

New file `hypher-web/convex/lib/slug.ts` (tiny module):

```ts
// base36 alphabet — URL-safe, no ambiguous chars, no underscores/hyphens
const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

export function generateSlug(): string {
  // Use crypto.getRandomValues for cryptographic randomness.
  // Math.random() is banned here — it's predictable enough for an attacker
  // to narrow the search space if they observe a handful of issued slugs.
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let s = "";
  for (let i = 0; i < 8; i++) {
    s += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return s;
}
```

8-char base36 slugs give ~2.8 trillion combinations. Collision is effectively impossible for the projected user base; the retry loop in `togglePublic` (5 attempts against the `by_publicSlug` index) handles any edge case. If slug length needs changing later, bump the loop constant; do not replace the entropy source.

### New route: `hypher-web/src/app/c/[slug]/page.tsx`

Next.js 16 App Router Server Component. Uses `generateMetadata` for OG title/description and the page renders the canvas via a client component.

```tsx
// page.tsx (server component)
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import { notFound } from "next/navigation";
import { PublicCanvas } from "@/components/PublicCanvas";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  try {
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    const data = await convex.query(api.sharing.getByPublicSlug, { slug });
    return {
      title: `${data.project.name} · Hypher`,
      description: data.project.description?.slice(0, 160) ?? "A project on Hypher",
    };
  } catch {
    return { title: "Not found · Hypher" };
  }
}

export default async function Page({ params }) {
  const { slug } = await params;
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  let data;
  try {
    data = await convex.query(api.sharing.getByPublicSlug, { slug });
  } catch {
    notFound();
  }
  // Watermark is rendered as a sibling of PublicCanvas — NOT inside it.
  // This is a server component tree; the watermark lands in the initial
  // HTML and cannot be removed by toggling a client React state.
  return (
    <>
      <PublicCanvas data={data} />
      <ShareWatermark />
    </>
  );
}
```

Notes:

- In Next.js 16, `params` is a Promise — `await` it before destructuring.
- The page is dynamic (not `use cache`) because the sanitized payload depends on query args and may change any time the owner adds/edits a note. Revisit later if we want to cache (see tradeoffs).
- `notFound()` renders the default 404; add a project-level `app/c/[slug]/not-found.tsx` for the branded version ("This canvas isn't public yet").

### New client component: `hypher-web/src/components/PublicCanvas.tsx`

Thin wrapper that:

1. Accepts the sanitized `{ project, items, connections }` payload.
2. Renders the existing `SpatialCanvas` with `readOnly: true` (new prop — see below).
3. Renders the project title + description in a header strip.

**The watermark is not rendered from this client component.** It is server-rendered in `page.tsx` (see below) so it cannot be trivially stripped via DevTools by toggling React state or deleting a component from the tree.

### Modify: `hypher-web/src/components/SpatialCanvas.tsx`

Add a `readOnly?: boolean` prop. When true:

- Disable drag handlers on cards.
- Disable right-click "create note at position" menu.
- Disable keyboard shortcuts for this canvas (but let global shortcuts like `⌘K` still work).
- Never render the AI-suggested connection approval UI (`ConnectionPopover`).
- Still allow pan + zoom (purely view-side).

Keep the prop narrow — everything else flows through the same render tree. Do not fork the component.

### New component: `hypher-web/src/components/ShareWatermark.tsx` — server component

```tsx
// NOTE: no "use client" directive — this is a Server Component so the
// watermark renders into the initial HTML before any JavaScript executes.
// Stripping it in DevTools requires editing the live DOM by hand every
// load, which is substantially more friction than deleting a React
// component from the tree.
export function ShareWatermark() {
  return (
    <a href="https://hypher.app/" className="share-watermark" rel="noreferrer">
      <span>Made with Hypher</span>
      <span className="share-watermark-cta">Start yours free →</span>
    </a>
  );
}
```

**Rendered by `app/c/[slug]/page.tsx` (a Server Component) as a sibling of `<PublicCanvas />`, not as a child of it.** This matters: a client-side `<PublicCanvas />` that renders the watermark inside its own tree can be nuked by a DevTools "Delete node" click. Rendering it from the server route, outside the client island, means it survives as long as the page's initial HTML is intact. Users *can* still remove it by editing the DOM each visit, which is acceptable — the goal is to make stripping it a conscious effort, not a one-toggle React state change.

Styles added to `hypher-web/src/app/globals.css` under `.share-watermark` — bottom-right, ~36px tall, translucent background, subtle shadow, never covers important UI (z-index below toasts). Use `position: fixed` so it stays in the viewport during canvas pan/zoom.

### Modify: `hypher-web/src/components/ProjectSettings.tsx`

Add a "Sharing" section:

- Toggle: "Share publicly" (disabled ↔ enabled).
- When enabled: show the URL (`hypher.app/c/<slug>`), a "Copy link" button, and a muted line "Anyone with this link can view this canvas — no sign-in required."
- Underneath: a collapsible "Advanced" section listing each note/artifact with a "Hide from public view" toggle that calls `api.sharing.setItemPrivateOnShare`.

Do not delete the existing toggle-less state; additive only.

### Modify: project header / Sidebar

When `project.isPublic === true`, render a small "Public" pill (muted green, 10px font, 1px border). Tooltip: "This canvas is shared at hypher.app/c/<slug>. Click to copy link." Clicking copies to clipboard.

### Rendering: dynamic vs. cached

Server render on every request for v1. The public route is dynamic. If/when we want better performance:

- Add `export const revalidate = 60;` to cache the page for 60s at the edge.
- Or, use Next.js 16's `'use cache'` with `cacheLife` tuned to revalidate when the project is updated.

Do not add caching in this PR — it complicates invalidation. Measure first.

### Files changed summary

| File | Change |
|---|---|
| `hypher-web/convex/schema.ts` | Add `isPublic`, `publicSlug`, `publicSharedAt`, `privateOnShare`; add `by_publicSlug` index. |
| `hypher-web/convex/sharing.ts` | **NEW** — three functions. |
| `hypher-web/convex/lib/slug.ts` | **NEW** — slug generator. |
| `hypher-web/src/app/c/[slug]/page.tsx` | **NEW** — public route, Server Component. |
| `hypher-web/src/app/c/[slug]/not-found.tsx` | **NEW** — branded 404. |
| `hypher-web/src/components/PublicCanvas.tsx` | **NEW** — public wrapper. |
| `hypher-web/src/components/ShareWatermark.tsx` | **NEW** — watermark CTA. |
| `hypher-web/src/components/SpatialCanvas.tsx` | Add `readOnly` prop; gate drag/edit behavior. |
| `hypher-web/src/components/ProjectSettings.tsx` | Add Sharing section. |
| `hypher-web/src/components/Sidebar.tsx` | Render "Public" pill on projects with `isPublic`. |
| `hypher-web/src/types/index.ts` | Add `isPublic`, `publicSlug`, `publicSharedAt` to `Project`; add `privateOnShare` to `Note` and `Artifact`. |
| `hypher-web/src/app/globals.css` | Add `.share-watermark` + Sharing section styles. |

### External dependencies

None. Everything uses existing Convex + Clerk + React.

## Acceptance criteria

- Signed-in owner toggles "Share publicly" on a project → a slug is generated and persisted; the URL `hypher.app/c/<slug>` is shown and copyable.
- Visiting `hypher.app/c/<slug>` in an **incognito window** (no Clerk cookie) renders the canvas with project title, description, notes, artifacts, and confirmed connections — no sign-in prompt.
- The same incognito visit shows "Made with Hypher — Start yours free" in the bottom-right with a link to the marketing site.
- The public page is interactable only as view/pan/zoom — cards cannot be dragged, edited, deleted, or connected.
- AI-suggested (unconfirmed) connections and dismissed connections never appear in the public view.
- A note with `privateOnShare: true` is absent from the public view and any connection touching it is dropped.
- The public page returns 404 when the slug doesn't exist, when `isPublic === false`, or when the project's status is `archived`.
- The public payload contains zero `userId`, `embedding`, `embeddingText`, `githubRepo`, `blockers`, `priority`, `status`, `fileReference`, or sharing-state fields (verify via devtools network inspection: the JSON response must be sanitized).
- `apiKeys`, `githubTokens`, `tags`, and `activity` tables are never queried by the public route.
- Toggling "Share publicly" off makes the same URL 404 immediately. Toggling it back on reuses the same slug (no new slug generated).
- The "Public" pill appears in the sidebar and project header when `isPublic === true` and is hidden otherwise.
- `tsc --noEmit` in `hypher-web/` passes with zero errors.
- `next build` in `hypher-web/` passes with zero errors and the route `/c/[slug]` appears in the route manifest.
- `npx convex dev --once` in `hypher-web/` validates the schema with the new index.

## How to test

1. Pull the branch. `bun install`. `npx convex dev`. `bun dev`.
2. Sign in as a Clerk test user. Open any project with at least 5 notes and 1 confirmed connection.
3. Open Project Settings → Sharing. Toggle on. Confirm a slug appears, URL is copyable, and a "Public" pill appears next to the project name.
4. Open the URL in an **incognito** browser window. Confirm:
   - Canvas renders with all non-private notes and confirmed connections.
   - Positions match the owner's view.
   - No "Sign in" prompt fires.
   - "Made with Hypher — Start yours free" pill is visible in the bottom-right and links to the marketing site.
5. Drag a card. Confirm it does not move.
6. Right-click the canvas. Confirm no "Add note here" appears (or it's disabled).
7. Try to approve / dismiss a connection. Confirm the UI is absent.
8. Go back to the signed-in tab. Mark one note as `privateOnShare: true` via the settings. Refresh the incognito tab and confirm that note and any of its connections are gone.
9. Toggle sharing off. Refresh incognito → 404 (the branded not-found page). Toggle back on → URL works again with the same slug.
10. Archive the project (existing flow). Refresh incognito → 404.
11. Inspect the JSON response in DevTools Network for the `getByPublicSlug` query. Confirm the fields above (userId, embedding, etc.) are absent.
12. Run `next build`. Confirm zero new warnings. Confirm `/c/[slug]` is listed as a dynamic route.

## Security & privacy notes

- **Field-level allowlist.** The public query builds its return payload field-by-field; it never spreads the Convex document. Review the diff carefully in PR — this is the single most important defensive layer. Drift here is a privacy leak.
- **Table-level allowlist.** The public query only reads from `objects` and `connections`. Any future change that reads from `apiKeys`, `githubTokens`, `tags`, or `activity` in `sharing.ts` must be caught in code review. Consider adding a comment at the top of the file: `// This file is the only entry point for unauthenticated data. Do not import from admin tables.`
- **No ownership check on the read path.** The public query is unauthenticated by design. The `isPublic` flag is the sole authorization gate. A user who regrets sharing disables the toggle and the URL returns 404 within one Convex query TTL (effectively immediate).
- **Slug entropy.** 8 lowercase alphanumeric chars ≈ 36^8 ≈ 2.8 trillion. Collision is not a risk; guessing is. 2.8T random guesses at 10k/sec takes years. No rate limiting needed on `getByPublicSlug` in v1, but Cloudflare / Vercel edge rate limits should cover it; revisit if we see abuse.
- **Tokens are in a separate table.** `githubTokens` lives in a dedicated table, never on `objects`. The sanitization allowlist would catch a mistaken leak anyway. Anthropic keys live only in env; they never touch the DB.
- **`thumbnailDataUrl` is a data URL, not a server path.** Safe to expose. `fileReference` is a server-side path and is excluded.
- **Fail closed.** Any exception in `getByPublicSlug` (including malformed slug input) results in a 404. Never fall back to showing data.
- **SEO:** public pages are indexable by default. If Nick wants to control crawling per canvas, add a `noindex: boolean` field in a follow-up and respect it via `generateMetadata`.
- **Rate limit:** relies on Vercel/Cloudflare edge defaults. If abuse appears (many slugs being probed), add an IP-level limiter on the route. Out of scope for v1.

## Known tradeoffs

- **Slug is reused after re-sharing.** If a user shares, decides to un-share, and then re-shares, the same URL goes live again. Pro: zero surprise, links keep working for good-faith recipients. Con: a user who toggled off *to revoke access* from one specific person gets that access back the next time they share. Document in UI copy ("Toggle off to hide this canvas. The same link reactivates if you toggle on again."). **Sunset:** if users report this as a privacy gotcha, add a "Revoke and regenerate" explicit action.
- **No password protection / expiring links.** Playbook v1 says "one button". Adding auth on top is a separate product decision. **Sunset:** revisit if paid-tier customers request it.
- **No edge caching.** Every public page load hits Convex. For a canvas that's linked from a tweet and gets 10k visits in an hour, this could cost real money and be slow. Acceptable risk in v1; mitigate by adding `revalidate: 60` or `'use cache'` after measuring. **Sunset:** benchmark under load before public launch.
- **No OG image.** Shared links will look plain in Slack / Twitter. A proper OG image would require either a headless rendering pipeline (Vercel OG) or a screenshot service — both meaningful work. v1 ships with metadata tags only. **Sunset:** before launch week if possible.
- **`readOnly` flag on `SpatialCanvas`.** Cleaner would be to fork into `ReadOnlyCanvas` but it duplicates ~600 lines of layout logic that are genuinely identical. The `readOnly` flag is surgical and easier to keep in sync. Accept the conditional branches; document them with a single comment in `SpatialCanvas.tsx`.
- **Dismissing AI-suggested connections is irreversible for public view.** Public viewers only see `manual` and `ai_confirmed` connections. If the owner has a 90% confidence AI suggestion they haven't acted on, it won't appear publicly. Intentional: half-confidence state is internal thinking, not part of the shareable artifact.
- **Archived projects 404 publicly.** Feels right — an archived project shouldn't be a permanent URL. If this surprises users, flip to "archive hides from sidebar but keeps public URL" with an explicit opt-out. **Sunset:** revisit if a user complains within 30 days of launch.
