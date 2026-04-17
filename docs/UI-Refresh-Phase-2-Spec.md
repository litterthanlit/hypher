# Hypher — UI refresh phase 2 (spec)

**Status:** Implemented in codebase (April 2026 pass — see git history); verify acceptance criteria per release.  
**Depends on:** Neutral app shell + blue capture composer (shipped in shell pass)  
**Related:** [Hypher-Pre-Launch-Playbook.md](./Hypher-Pre-Launch-Playbook.md) — launch truth, mobile gaps, polish tier

This document turns the “what else needs a refresh?” list into **actionable work packages**: goals, touchpoints, acceptance criteria, and explicit **non-goals**. It does not claim features are complete without a user-facing path (per playbook).

---

## 1. Principles (apply to every package)

1. **Neutral chrome first** — Surfaces use `--bg-`*, `--border-*`, `--text-*`. Strong color = **state** (selection, focus, primary CTA) or **semantic** (danger, warning), not decorative washes.
2. **Accent zoning (decide and document)** — Today: **capture** uses `--capture-`* blue; **workspace/canvas** leans green (`--accent`, links); **inbox** uses amber. Either:
  - **A)** Keep intentional zones (document in §8), or  
  - **B)** Unify on one product accent + semantic-only secondaries.  
   Pick one before large canvas/marketing passes to avoid thrash.
3. **One interaction density** — Spacing, radii, and type ramps should feel like **one system** across canvas, lists, dialogs, and settings.
4. **CSS architecture** — App shell lives in `[hypher-web/src/app/globals.css](../hypher-web/src/app/globals.css)`. Prefer **tokens + shared classes** over one-off hex. Tailwind remains marketing-scoped per `[hypher-web/tailwind.config.ts](../hypher-web/tailwind.config.ts)` unless a deliberate migration is approved (§10).

---

## 2. Package: Workspace canvas chrome

### 2.1 Goal

Canvas should feel like a **continuation** of the refreshed shell: calmer cards, consistent focus/selection, less “default green glow” unless it encodes meaning (confirmed links, health, etc.).

### 2.2 Primary touchpoints


| Area                | Files / entry points                                                                                                                                                                                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Canvas root         | `[hypher-web/src/components/SpatialCanvas.tsx](../hypher-web/src/components/SpatialCanvas.tsx)`                                                                                                                                                                                       |
| Cards               | `[hypher-web/src/components/canvas/cards/StickyNote.tsx](../hypher-web/src/components/canvas/cards/StickyNote.tsx)`, `[ProjectCard.tsx](../hypher-web/src/components/canvas/cards/ProjectCard.tsx)`, `[ArtifactCard.tsx](../hypher-web/src/components/canvas/cards/ArtifactCard.tsx)` |
| Lines / suggestions | `[ConnectionLines.tsx](../hypher-web/src/components/canvas/features/ConnectionLines.tsx)`, `[SuggestionChip.tsx](../hypher-web/src/components/SuggestionChip.tsx)`                                                                                                                    |
| Overlays            | `[ConnectionPopover.tsx](../hypher-web/src/components/ConnectionPopover.tsx)`, `[AmbientAskPanel.tsx](../hypher-web/src/components/AmbientAskPanel.tsx)`                                                                                                                              |
| Menus               | `[canvas/features/ContextMenu.tsx](../hypher-web/src/components/canvas/features/ContextMenu.tsx)`                                                                                                                                                                                     |
| Tokens              | `globals.css` sections for canvas (`--canvas-`*, card colors)                                                                                                                                                                                                                         |


### 2.3 Scope

- **Visual:** Border weight, shadow, selected/hover states, typography on cards; connection line weights and “suggested vs confirmed” contrast; popover/panel spacing and radii aligned with shell (`--radius-`*).
- **Motion:** Keep existing Framer usage; reduce gratuitous scale/glow if it fights the neutral shell (optional polish).
- **Accessibility:** Focus rings visible on keyboard targets; don’t rely on color alone for connection state.

### 2.4 Acceptance criteria

- Selected card state is obvious in **both** light and dark (`prefers-color-scheme`).
- Suggested vs confirmed connections are distinguishable without raw green “noise.”
- Context menus and popovers use the same **border, radius, and shadow language** as the main toolbar / capture field.
- No regression: drag, resize, rubber-band, undo/redo, keyboard shortcuts still work (manual smoke).

### 2.5 Non-goals

- Rewriting spatial layout engine, Convex sync, or connection graph algorithms.
- New canvas modes (Garden/Focus/etc.) unless already product-approved.

---

## 3. Package: Search (⌘K)

### 3.1 Goal

**SearchDialog** should match shell quality: clear hierarchy, comfortable keyboard nav, honest empty states, tag rows that don’t look bolted on.

### 3.2 Primary touchpoints

- `[hypher-web/src/components/SearchDialog.tsx](../hypher-web/src/components/SearchDialog.tsx)`
- Related styles in `globals.css` (search dialog / overlay sections — grep `search-dialog`, `SearchDialog` class names).

### 3.3 Scope

- **Layout:** Modal width, padding, max height, scroll behavior; input field styling consistent with app (not a different border radius family).
- **Results:** Row height, title vs subtitle, kind icon alignment; **highlight** state for keyboard selection vs hover.
- **Tags:** Chip styling when tags appear in results; optional section labels (“Tags” vs “Items”) when both show.
- **Empty / loading:** Deferred query already exists — surface “Searching…” or subtle pending state; empty query copy if needed.

### 3.4 Acceptance criteria

- ⌘K opens with focus in the input; Escape closes; arrow keys move selection; Enter selects (current behavior preserved or improved).
- Reduced motion respected where animations exist.
- Dialog readable in dark mode; contrast meets baseline readability (no reliance on `--text-quaternary` for primary labels).

### 3.5 Non-goals

- Replacing in-memory search with Convex search indexes (product/perf track; see playbook Tier 3).

---

## 4. Package: Daily digest

### 4.1 Goal

Digest feels **light and skimmable**: typographic hierarchy, clear dismiss, no “wall of text” default. Aligns with toast/error posture in playbook (trust).

### 4.2 Primary touchpoints

- `[hypher-web/src/components/DailyDigest.tsx](../hypher-web/src/components/DailyDigest.tsx)`
- Entry: `[hypher-web/src/app/app/page.tsx](../hypher-web/src/app/app/page.tsx)` (`showDigest`, `AppErrorBoundary`)
- Styles: `globals.css` (digest-related classes — locate via component `className`s)

### 4.3 Scope

- **Structure:** Section titles, spacing, optional dividers; primary action (open project) vs secondary (dismiss).
- **Dismiss:** Clear affordance; persisted behavior unchanged (localStorage date).
- **Loading / demo:** `demoDigestText` path should not flash raw error strings; skeleton or short placeholder if needed (playbook: AI failures).

### 4.4 Acceptance criteria

- Digest is usable on laptop viewport height without clipping critical actions (scroll if needed).
- Dismiss and project navigation behaviors unchanged unless intentionally improved with QA notes.
- Wrapped in error boundary; failures don’t blank the whole app.

### 4.5 Non-goals

- Changing when digest fires (morning schedule vs first-open-of-day) unless product decides.

---

## 5. Package: List view + project dashboard

### 5.1 Goal

**ListView** and **ProjectDashboard** use the **same density and selection language** as the sidebar: rows feel like siblings, not a separate admin UI.

### 5.2 Primary touchpoints

- `[hypher-web/src/components/ListView.tsx](../hypher-web/src/components/ListView.tsx)`
- `[hypher-web/src/components/ProjectDashboard.tsx](../hypher-web/src/components/ProjectDashboard.tsx)`
- Sidebar reference: `[hypher-web/src/components/Sidebar.tsx](../hypher-web/src/components/Sidebar.tsx)`
- `globals.css`: list/dashboard classes

### 5.3 Scope

- **ListView:** Row padding, typography, connection or meta lines; empty state; selected row vs sidebar selection (if applicable).
- **Dashboard:** Card or table layout consistency; project stats legibility; CTAs don’t compete with canvas entry.

### 5.4 Acceptance criteria

- Tab toggle from canvas still makes sense visually (toolbar already unified in shell pass).
- Empty and sparse states have copy + next step (e.g. “Create a project” / Cmd+N).
- Dark mode parity.

### 5.5 Non-goals

- New analytics or dashboard metrics without product spec.

---

## 6. Package: Settings (API keys + integrations)

### 6.1 Goal

Settings pages feel **intentional**: shared page frame, clear sections, consistent form controls and danger actions.

### 6.2 Primary touchpoints

- `[hypher-web/src/app/app/settings/api-keys/page.tsx](../hypher-web/src/app/app/settings/api-keys/page.tsx)`
- `[hypher-web/src/app/app/settings/integrations/page.tsx](../hypher-web/src/app/app/settings/integrations/page.tsx)`
- `[hypher-web/src/components/ApiKeysPanel.tsx](../hypher-web/src/components/ApiKeysPanel.tsx)`
- Integrations-specific components (grep imports from integrations page)
- `globals.css`: `.settings-api-keys-page`, `.api-keys-`*, etc.

### 6.3 Scope

- **Layout:** Optional shared `SettingsLayout` wrapper: title, description, back link to `/app`, max-width, section spacing.
- **API keys:** List rows, create/revoke emphasis, copy buttons, warning copy for secrets.
- **Integrations:** Connection status, empty state, links to docs; align with shell link styles.

### 6.4 Acceptance criteria

- All settings routes reachable from existing chrome (`AppChromeNav`).
- Revoke/delete flows show confirmation where destructive.
- Mobile: readable without horizontal scroll at common phone widths.

### 6.5 Non-goals

- Implementing GitHub OAuth UI unless product prioritizes (playbook: connect flow gap).

---

## 7. Package: Marketing / landing

### 7.1 Goal

**Landing** and **pricing** feel like the same product as `/app`: typography, color temperature, and CTA hierarchy—not a separate marketing theme.

### 7.2 Primary touchpoints

- `[hypher-web/src/components/marketing/LandingPage.tsx](../hypher-web/src/components/marketing/LandingPage.tsx)`
- `[hypher-web/src/components/marketing/PricingCards.tsx](../hypher-web/src/components/marketing/PricingCards.tsx)`
- `[hypher-web/src/components/marketing/MarketingCanvasPreview.tsx](../hypher-web/src/components/marketing/MarketingCanvasPreview.tsx)`
- Routes: `[hypher-web/src/app/page.tsx](../hypher-web/src/app/page.tsx)`, `[hypher-web/src/app/pricing/page.tsx](../hypher-web/src/app/pricing/page.tsx)`
- Tailwind + `globals.css` `.marketing-`* (proof cards, hero)

### 7.3 Scope

- **Hero:** Align type scale with app; reduce competing gradients if shell is now neutral-first.
- **Proof / preview:** `[MarketingCanvasPreview](hypher-web/src/components/marketing/MarketingCanvasPreview.tsx)` opacity/mask tuned so it doesn’t overpower CTA.
- **Pricing:** Card borders, badge text, primary CTA color — match §8 accent decision.

### 7.4 Acceptance criteria

- Lighthouse isn’t required in spec, but no obvious layout break at 375px width for primary CTA.
- Sign-in/up entry points visible and consistent with Clerk theming (if themed).

### 7.5 Non-goals

- Full rebrand or new illustration set without design input.

---

## 8. Package: Accent & token story

### 8.1 Goal

Document and implement a **single source of truth** for when to use green, blue, amber, and semantic reds—so engineering doesn’t reintroduce drift.

### 8.2 Deliverables

1. **Short design note** (could live at top of `globals.css` or `docs/design-tokens.md` — optional file) listing:
  - `--accent` (green): workspace primary actions, confirmed links, sidebar selection bar, etc.
  - `--capture-`* (blue): capture composer only (input, cursor, drop hint, capture-adjacent focus).
  - `--amber`: inbox / unassigned semantic only.
  - `--danger` / `--red`: destructive and errors.
2. **Audit pass:** Grep for hardcoded greens/blues in JSX inline styles and `globals.css`; replace with tokens where trivial.

### 8.3 Acceptance criteria

- Decision A (zoned) or B (unified) is recorded in repo (this section updated with final choice).
- New UI uses tokens; no new raw hex in hot paths without justification.

---

## 9. Package: Mobile & responsive

### 9.1 Goal

Per playbook: **canvas is weak on phone**. Minimum credible story: **capture works**, **navigation doesn’t trap**, user understands desktop value for canvas.

### 9.2 Primary touchpoints

- `[hypher-web/src/app/app/page.tsx](../hypher-web/src/app/app/page.tsx)` (layout, modes)
- `SpatialCanvas`, `Sidebar`, `CaptureHome`, digest overlay
- `globals.css`: `.app-layout-simple` grid, sidebar width, toolbar overflow

### 9.3 Scope (phased)

**Phase A — Honest minimum**

- Sidebar: collapsible drawer or bottom nav **or** stack layout with reachable “Projects” / “Capture.”
- Toolbar: overflow menu for API keys / integrations / search on narrow widths.
- Capture: already full-screen friendly; verify tap targets and input zoom (iOS 16+ font-size ≥16px if needed to prevent zoom-on-focus).

**Phase B — Canvas usable**

- Read-only or simplified canvas on small screens **or** message + deep link to desktop (product copy).

### 9.4 Acceptance criteria

- User can complete **capture** and open **workspace** on a 390px-wide viewport without horizontal scroll on shell chrome.
- No obscured fixed nav (Clerk avatar, digest close, search).

### 9.5 Non-goals

- Full multitouch canvas gestures in v1 unless explicitly scoped.

---

## 10. Package: CSS / Tailwind architecture (engineering)

### 10.1 Goal

Avoid two styling systems fighting. Current state: **most app** = `globals.css` classes; **marketing** = Tailwind with `tw-` prefix.

### 10.2 Options (pick one in planning)


| Option                                       | Pros                               | Cons                                                  |
| -------------------------------------------- | ---------------------------------- | ----------------------------------------------------- |
| **Keep split**                               | Low churn; shell already tokenized | Duplication risk for marketing vs app                 |
| **Expand Tailwind content** to `src/**/`*    | Utilities everywhere               | Large migration; must reconcile with existing classes |
| **Extract CSS modules / layers** per feature | Encapsulation                      | Upfront refactor cost                                 |


### 10.3 Acceptance criteria (for this package)

- Document chosen approach in README or `CONTRIBUTING` snippet (one paragraph).
- No new marketing-only components using different radius scale than app without mapping to tokens.

---

## 11. Package: Capture home — floating clusters & empty state

### 11.1 Context

`[FloatingClusters.tsx](../hypher-web/src/components/FloatingClusters.tsx)` returns `null` when `projects.length === 0`, so the home screen can feel **empty** even when working as designed.

### 11.2 Goal

- With projects: clusters remain **subtle** but **noticeable** (opacity baseline may be too low on some displays).
- Without projects: **non-deceptive** empty illustration or copy (“Create a project to see clusters here”) + CTA to workspace or create project.

### 11.3 Acceptance criteria

- Zero-project state explains why the field is “alone” without implying a bug.
- Optional: single subtle decorative element that is **not** fake data.

### 11.4 Non-goals

- Seeding fake projects without user consent (playbook favors real demo seed for new accounts as separate initiative).

---

## 12. Recommended implementation order


| Order | Package                  | Rationale                                           |
| ----- | ------------------------ | --------------------------------------------------- |
| 1     | §8 Accent & tokens       | Prevents rework in canvas/marketing                 |
| 2     | §2 Canvas chrome         | Highest time-on-screen after capture                |
| 3     | §3 Search                | High frequency; validates shell patterns in overlay |
| 4     | §4 Digest                | Trust + first-run of day                            |
| 5     | §5 List + dashboard      | Unifies “secondary” views                           |
| 6     | §6 Settings              | Lower traffic but signals quality                   |
| 7     | §7 Marketing             | Conversion; depends on accent decision              |
| 8     | §11 Clusters empty state | Quick win; UX clarity                               |
| 9     | §9 Mobile                | Often parallel track; may split Phase A/B           |
| 10    | §10 CSS architecture     | When pain of duplication spikes                     |


---

## 13. Verification matrix (cross-cutting)


| Check          | Shell | Canvas | Dialogs | Settings | Marketing        |
| -------------- | ----- | ------ | ------- | -------- | ---------------- |
| Light / dark   | ✓     | ✓      | ✓       | ✓        | ✓                |
| Keyboard       | ✓     | ✓      | ✓       | ✓        | Where applicable |
| Reduced motion | ✓     | Prefer | Prefer  | —        | Prefer           |
| 390px width    | ✓     | See §9 | ✓       | ✓        | ✓                |


---

## 14. Open questions for product

1. **Accent:** Zoned (capture blue / workspace green) vs unified single accent?
2. **Mobile canvas:** Simplified interaction vs read-only vs “desktop recommended” messaging?
3. **Digest:** Any change to trigger (scheduled morning vs first open)?
4. **Demo data:** Ship playbook’s seeded demo project for new accounts in same phase as §11?

---

*End of spec.*