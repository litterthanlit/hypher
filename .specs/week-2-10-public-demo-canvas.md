# Spec: Public demo canvas ("Try the demo — no signup required")

**Owner:** unassigned
**PR target branch:** `cursor/week-2-10-public-demo-canvas-XXXX`
**Depends on:**
- Spec 01 (seed demo project) — this spec **reuses the same seed content generator**. If Spec 01 has shipped, import the shared helper; if not, extract the hardcoded seed notes/commits/connections into `hypher-web/src/lib/demoSeed.ts` here and let Spec 01 call it too. The demo canvas needs identical content to the "Try Hypher" project every signed-in user gets — this is a feature, not a duplicate.
- Spec 03 (public share canvas, `/share/s/[slug]`) — the read-only canvas renderer already exists. This spec exposes it at a canonical `/demo` URL with a "fresh" seed snapshot that doesn't live in any user's Convex tenant.

**Conflicts with:**
- Any PR editing `src/app/share/s/[slug]/page.tsx` (Spec 03's surface).
- Any PR extracting/renaming the seed generator during the same sprint.

---

## Why

The playbook's footer CTA is *"Try the demo canvas → no signup required"* (see `docs/Hypher-Pre-Launch-Playbook.md:220`). Every friction point before a user feels the product burns activation. A pre-authenticated demo route lets a visitor from the landing page, an X post, or a Raycast extension listing see Hypher's canvas with real-looking content in **one click** — no Clerk modal, no Convex tenant, no empty state to overcome.

This is also the cheapest way to make the landing page's hero canvas preview *clickable* — the hero FloatingClusters preview currently animates but can't be explored; the demo route makes the promise deliverable.

## Scope

### In scope

- A new public route at `/demo` (Next.js Route Handler or Server Component — pick whichever renders faster for a first paint).
- Renders the same spatial canvas component used by the `/share/s/[slug]` public canvas view (from Spec 03 — `ShareCanvas` or equivalent read-only wrapper).
- Reads from a **hardcoded in-memory seed** via `src/lib/demoSeed.ts` — no Convex query, no auth, no database round-trip. The demo is literally a static snapshot of the "Try Hypher" project content + connections + one pre-generated digest blob.
- Interactive: pan, zoom, hover, click cards to see detail. **Read-only:** no edits persisted, no captures possible, no AI calls.
- A persistent footer bar at the bottom of the demo reading *"This is a read-only preview of Hypher. Start your own canvas →"* with a primary CTA linking to `/sign-up`.
- A small floating "Demo" watermark in the top-right (matches Spec 03's `ShareWatermark` pattern) so the experience is clearly non-destructive.
- Landing page's footer CTA (`LandingPage.tsx`) gains a *"Try the demo canvas — no signup required"* link pointing to `/demo`.
- Landing page's hero `MarketingCanvasPreview` becomes a clickable wrapper around `Link href="/demo"` (currently it's `aria-hidden` decorative) — single tap on the preview takes the user to the live demo.
- Metadata: `<title>Try Hypher — public demo canvas</title>`, OG image, Twitter card. Pull the OG image from the existing share-card generator if present; otherwise, a static `/public/demo-og.png` placeholder.

### Out of scope

- **Any write path** — captures, edits, connections, digest regeneration. Read-only is the entire point. A user wanting to interact must sign up.
- **Per-visitor state** — no cookies, no localStorage, no persistence. Two visitors see the identical canvas; one visitor refreshing sees the identical canvas. Deterministic.
- **Personalization** via URL params (`?project=...`, `?theme=...`). Not in v1. If a Raycast or X post wants a custom hero, they link to `/demo`; that's it.
- **Gated content** behind "Sign up to see more." The demo is the whole pitch.
- **AI on the demo** — no live Claude calls. The digest shown is the static string from the seed. If a visitor right-clicks to Ask (Spec 06a), the panel either doesn't render or renders with a "Sign up to ask Claude" upsell (pick one — see "Ambient ask on the demo" below).
- **Convex-backed demo data.** Any content lives in `src/lib/demoSeed.ts` as pure TypeScript literals. This keeps the route renderable even if Convex is degraded, and removes the demo from the auth/tenant model entirely.
- **Multiple demo slots** (e.g., `/demo/founder`, `/demo/engineer`). Tier 2. One demo, tuned.
- **Analytics click-tracking beyond a single "demo_viewed" event.** Tier 2.

## Technical approach

### Route file: `hypher-web/src/app/demo/page.tsx`

Server Component. Imports the shared read-only canvas renderer from Spec 03 (likely `@/components/share/ShareCanvas` or equivalent — grep to confirm the name). Passes in `demoSeed` as the canvas data prop.

```tsx
import { demoSeed } from "@/lib/demoSeed";
import { ShareCanvas } from "@/components/share/ShareCanvas"; // confirm name from Spec 03
import { DemoFooter } from "@/components/marketing/DemoFooter";
import { ShareWatermark } from "@/components/share/ShareWatermark";

export const metadata = {
  title: "Try Hypher — public demo canvas",
  description: "A read-only preview of Hypher's spatial project brain.",
};

export default function DemoPage() {
  return (
    <div className="demo-root">
      <ShareCanvas
        project={demoSeed.project}
        items={demoSeed.objects}
        connections={demoSeed.connections}
        readOnly
      />
      <ShareWatermark label="Demo" />
      <DemoFooter />
    </div>
  );
}
```

### Seed generator: `hypher-web/src/lib/demoSeed.ts`

Pure data module. Exports `demoSeed: { project, objects, connections, digest }` matching the types in `src/types/index.ts`. The content is the same hardcoded set used by Spec 01's `internal.seed.createDemoProject` — extract to this shared helper if Spec 01 has shipped; otherwise define here and let Spec 01 import on its next rev.

**Key constraint:** every `id` in the seed must be a deterministic static string (e.g., `"demo-note-1"`, `"demo-artifact-1"`). Never `crypto.randomUUID()` — the seed must be stable across renders and between cold and warm caches.

Every `canvasPosition` is also hardcoded so the layout looks designed.

Include at minimum:
- 1 project (`"Try Hypher"`, green canvasColor)
- 10 notes spanning different maturities (`fleeting`, `developing`, `structured`)
- 2 artifacts (commit-style, green accent — stand in for GitHub commits without a repo)
- 3 manual connections
- 1 note tagged `["digest"]` with the static digest text

### `DemoFooter.tsx` (new)

Fixed-bottom persistent bar, ~48px tall, dark theme:

- Left: *"This is a read-only preview of Hypher."*
- Right: *"Start your own canvas →"* as a primary button linking to `/sign-up`.
- Subtle backdrop blur; respects `prefers-reduced-motion`.
- Dismissible? No — persistent is the point.

### Ambient ask on the demo

The demo canvas includes notes. A visitor might right-click, see the "Ask about what's around me" menu entry (from Spec 06a), and click it. Two paths:

- **(a) Don't render the context menu entry on demo.** Pass a `readOnly` prop down that suppresses the Ask menu item entirely. Cleanest. **Use this.**
- (b) Render the entry but have the panel show an upsell modal. More clicks, more friction.

Implementation for (a): plumb a `readOnly?: boolean` flag through `ShareCanvas` → `SpatialCanvas` → `ContextMenu`. Where the context menu checks whether to render the Ask entry, add `&& !readOnly`. Same flag suppresses edit menus, capture triggers, and connection creation. The flag is likely already in place from Spec 03's read-only share canvas — confirm with a grep before adding a new one.

### Landing page wiring

Two-point change in `src/components/marketing/LandingPage.tsx`:

1. `MarketingCanvasPreview` gets wrapped in `<Link href="/demo">` (or the component itself accepts an `href` prop and becomes an anchor). Update the component's `aria-hidden` to be context-aware — the link itself gets proper accessible text (`aria-label="Try the live demo canvas"`).
2. Footer gains a prominent link: `<Link href="/demo" className="...">Try the demo canvas — no signup required</Link>`.

### Caching / CDN

Route is pure Server Component with static data → Next.js will statically optimize it by default. Add `export const dynamic = "force-static";` to be explicit. Page should serve in <50ms globally from the edge cache.

### Files changed summary

| File | Change |
|---|---|
| `hypher-web/src/app/demo/page.tsx` | **NEW** — public Server Component route. |
| `hypher-web/src/lib/demoSeed.ts` | **NEW** — hardcoded seed project/notes/artifacts/connections/digest. |
| `hypher-web/src/components/marketing/DemoFooter.tsx` | **NEW** — persistent CTA bar. |
| `hypher-web/src/components/share/ShareCanvas.tsx` (or equivalent) | If the read-only canvas doesn't already accept external seed data (not from Convex), add a `data` prop path. Exact name depends on Spec 03 — confirm with grep before editing. |
| `hypher-web/src/components/SpatialCanvas.tsx` | Plumb `readOnly` flag to suppress Ask/edit/capture menus. Likely a no-op if Spec 03 already did this. |
| `hypher-web/src/components/canvas/features/ContextMenu.tsx` | Respect `readOnly` flag — hide Ask entry, hide edit options. Possibly a no-op. |
| `hypher-web/src/components/marketing/LandingPage.tsx` | Wrap `MarketingCanvasPreview` in a link to `/demo`; add footer CTA. |
| `hypher-web/src/app/globals.css` | `.demo-root`, `.demo-footer`, related layout styles. |
| `hypher-web/public/demo-og.png` | **NEW** — 1200×630 OG image (placeholder PNG is fine for v1). |

### External dependencies

None. No new npm packages. No new env vars. Pure static route + hardcoded data.

## Acceptance criteria

- Visiting `/demo` cold (no auth, no cookies) renders a spatial canvas with the seeded "Try Hypher" content within 500ms first paint.
- All notes, artifacts, and connections are visible and positioned deterministically (refresh = identical layout).
- Right-click on an empty spot does **not** show the "Ask about what's around me" entry (or it shows a clear upsell).
- Attempting to drag a card, edit text, or create a connection has no persistent effect — either the action is blocked or the state resets on refresh.
- The `Demo` watermark is visible in the top-right corner throughout.
- The footer bar is visible at the bottom; clicking its CTA routes to `/sign-up`.
- Landing page's hero canvas preview, when clicked, routes to `/demo`.
- Landing page's footer has a visible *"Try the demo canvas — no signup required"* link that routes to `/demo`.
- `tsc --noEmit` in `hypher-web/` passes. `bun run build` completes.
- Lighthouse performance score ≥ 90 on the demo route (static content, should be easy).

## How to test

1. Pull the branch. `bun install`. `bun dev`.
2. Open an **incognito** window (no Clerk session). Visit `http://localhost:3000/demo`. Confirm canvas renders, 10-ish cards visible, no redirect to `/sign-in`.
3. Pan and zoom. Confirm behavior matches the in-app canvas.
4. Right-click empty canvas. Confirm no "Ask about what's around me" entry (or the upsell variant).
5. Click a note. Confirm detail opens but is read-only (no edit cursor, no delete option).
6. Try to drag a card. Confirm it visually snaps back or never drags.
7. Click the footer "Start your own canvas" button. Confirm redirect to `/sign-up`.
8. Visit `http://localhost:3000/`. Click the hero canvas preview. Confirm navigation to `/demo`.
9. Confirm the landing footer has the demo CTA link and it works.
10. Run `curl -I http://localhost:3000/demo`. Confirm `cache-control` headers indicate static cacheability.

## Security & privacy notes

- **No auth bypass.** This route is intentionally public and serves no user data. The only thing to protect is making sure it can't accidentally become a vector for real-data leakage: grep for `useQuery`, `useMutation`, `auth()`, and `requireUserId` in the demo route tree and confirm none are reachable. The `demoSeed.ts` module must have zero imports from `@/convex/**` or `@clerk/**`.
- **No state reaches the server.** Read-only by construction — no POST endpoints touched from `/demo`. The route serves a static HTML document + hydration bundle.
- **Watermark is visual, not enforcement.** Someone determined to export the demo can screenshot it, obviously. That's fine — the demo content is public by design.
- **OG image has no PII.** Hardcoded seed content only.

## Known tradeoffs

- **Seed content duplication risk.** If Spec 01 ships the seed in `convex/seed.ts` and this spec duplicates it in `src/lib/demoSeed.ts`, updates must happen in two places. Mitigated by making `src/lib/demoSeed.ts` the canonical source and having Spec 01 import from it. If Spec 01 has already merged with its own seed, do a dedupe PR as a follow-up.
- **Static seed can't showcase GitHub sync or real AI digest.** The digest shown is a hardcoded string; the commits are stylistic. A visitor who wires up GitHub in their own account will see more. Acceptable — the demo's job is "aha, I get it", not "this is the whole product."
- **No per-visit variation.** Every visitor sees the identical canvas. If we want A/B tests or different seed flavors, that's Tier 2. The small lift would be multiple demoSeed snapshots keyed by a query param.
- **Footer bar is persistent.** Some users find persistent footers annoying. Tradeoff: the footer is how the demo converts, and demo is the conversion surface. Keep it.
- **Ambient Ask isn't showcased.** Disabling the Ask menu means a key Hypher feature isn't in the demo. Tier 2: re-enable with a rate-limited, unauthenticated-allowed version of the ask endpoint (cached responses, tight prompt), so visitors can ask *one* question before being upsold.
- **Canvas layout is fixed.** Visitors can't personalize. For activation purposes that's fine; for serious evaluation they'll sign up.
- **Lighthouse SEO score.** A heavy canvas with WebGL-ish rendering can hurt SEO if not server-rendered well. Server Component + static data keeps SSR clean, but confirm the canvas component doesn't block rendering behind client-side hydration. If it does, accept the tradeoff or render a static SVG placeholder that gets hydrated into the live canvas (progressive enhancement).
