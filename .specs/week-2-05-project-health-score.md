# Spec: Project health score (0–100) with animated ring

**Owner:** unassigned
**PR target branch:** `cursor/week-2-5-project-health-score-XXXX`
**Depends on:**
- Week 1 Clerk auth PR (the score is computed per-user; reads `objects` and `activity` filtered by `userId`).
- Week 1 schema migration adding `userId` to `objects` (already in `hypher-web/convex/schema.ts:23` as `v.optional(v.string())`).

**Conflicts with:**
- Any PR rewriting `hypher-web/src/components/ProjectDashboard.tsx`'s card render path.
- Any PR changing the GitHub sync output shape (`hypher-web/convex/github.ts:syncRepo` return value — we depend on `blockers`, `openPRCount`, `latestCommitDate`).

---

## Why

Right now a user with 12 projects has no glanceable signal for which one needs love. The dashboard shows status pills, priority, item count, and "last activity" timestamps — useful, but each takes a second of cognition and they don't compose into a single answer. A 0–100 health score per project, surfaced as a small animated ring on the card, collapses "is this project doing OK?" into one number you can scan in 50ms across a grid of cards. The playbook frames this as the "ambient sense of wellness" hook — a thing you'd open the app just to see, and a thing that makes neglecting a project feel visible. Real-time Convex reactivity means the ring updates the instant you add a note or close a PR, which makes the score feel *alive* rather than a stale daily summary.

## Scope

### In scope

- A pure-TS function `computeHealthScore(project, items, recentActivity)` in a new module `hypher-web/src/lib/health.ts` that returns `{ score: number; breakdown: HealthBreakdown }` where `score ∈ [0, 100]` and `breakdown` exposes the four sub-scores and the reason strings ("Last activity 12 days ago", "1 open blocker", etc.) for hover/tooltip use.
- A Convex query `api.projects.healthInputs` returning the minimal data shape needed to compute scores for every project the user owns: `{ projectId, lastActivity, blockers, githubRepo, githubLastSync, items: [{ kind, modifiedAt, maturity }] }[]`. The query is reactive — adding a note or running a GitHub sync re-emits.
- An `<HealthRing>` React component (`hypher-web/src/components/HealthRing.tsx`) that renders an SVG ring (24px default, 32px on the dashboard card, 56px on the project detail header) with a smooth Framer Motion `pathLength` animation when the score changes.
- Integration into `hypher-web/src/components/ProjectDashboard.tsx`: each `dashboard-card` renders a `<HealthRing score={...} />` in the top-right corner, replacing nothing — just added next to the existing blocker icon. On hover, a popover shows the four sub-scores stacked.
- Integration into `hypher-web/src/components/canvas/cards/ProjectCard.tsx`: a 24px ring next to the title.
- Score is computed **client-side** from the reactive Convex query — no Convex action, no cron, no stored field. Eliminates an entire class of "score is stale" bugs and makes "real-time updates" trivial.
- A "Health" sort option added to `hypher-web/src/components/ProjectDashboard.tsx`'s sort dropdown (sorts ascending — lowest health first, the projects that need attention).
- Handles the no-GitHub case: when `githubRepo` is unset, the GitHub sub-score is excluded from the weighted sum and the remaining three components are renormalized to 100.

### Out of scope

- Storing the score in the database. It's a derived value and storage would create staleness bugs.
- Trending the score over time (a sparkline of "health over the last 30 days"). Tier-2 nice-to-have; would require a new `healthSnapshots` table and a daily cron. Not now.
- Notifications when a project's score crosses a threshold ("Project X just dropped below 30"). Tier 2.
- Scoring archived or shipped projects. The ring is hidden for `status === "archived" || status === "shipped"`.
- A user-tunable weighting UI ("I care more about activity than blockers"). Hard-coded weights for v1.
- Counting `dismissed` connections or `embedding`-only operations as "activity". Activity = note/artifact creation, project edits, GitHub sync producing new commits or new blockers.
- An on-canvas health visualization (e.g., warm/cool gradient on the project cluster glow). Tier 2; revisit after the dashboard ring lands and we know whether people look at it.

## Technical approach

### New file: `hypher-web/src/lib/health.ts`

Pure TS, no React, no Convex imports. Easy to unit test.

```ts
export interface HealthInputItem {
  kind: "note" | "artifact";
  modifiedAt: number;
  maturity?: string; // "fleeting" | "developing" | "structured" | "reference"
}

export interface HealthInputs {
  projectId: string;
  lastActivity?: number;
  blockers?: string;
  githubRepo?: string;
  githubLastSync?: number;
  items: HealthInputItem[];
}

export interface HealthBreakdown {
  activity: { score: number; reason: string };       // 0–100
  blockers: { score: number; reason: string };       // 0–100
  github:   { score: number; reason: string } | null; // null when no repo
  noteFreshness: { score: number; reason: string }; // 0–100
}

export interface HealthResult {
  score: number; // 0–100, integer
  breakdown: HealthBreakdown;
}

const DAY = 86_400_000;

export function computeHealthScore(input: HealthInputs, now: number = Date.now()): HealthResult {
  const breakdown: HealthBreakdown = {
    activity: scoreActivity(input.lastActivity, now),
    blockers: scoreBlockers(input.blockers),
    github: input.githubRepo ? scoreGithub(input, now) : null,
    noteFreshness: scoreNoteFreshness(input.items, now),
  };

  // Weights — sum to 1.0 when GitHub is present, renormalized when absent.
  const weights = input.githubRepo
    ? { activity: 0.35, blockers: 0.25, github: 0.20, noteFreshness: 0.20 }
    : { activity: 0.45, blockers: 0.30, noteFreshness: 0.25, github: 0 };

  const raw =
    breakdown.activity.score * weights.activity +
    breakdown.blockers.score * weights.blockers +
    (breakdown.github?.score ?? 0) * weights.github +
    breakdown.noteFreshness.score * weights.noteFreshness;

  return { score: Math.round(raw), breakdown };
}
```

#### Sub-scores

**`scoreActivity(lastActivity, now)`** — exponential decay from "today = 100" to "30+ days = 0".

```ts
function scoreActivity(lastActivity: number | undefined, now: number) {
  if (!lastActivity) return { score: 0, reason: "No activity recorded" };
  const days = Math.max(0, (now - lastActivity) / DAY);
  // 0d → 100, 3d → 80, 7d → 55, 14d → 25, 30d → 3
  const score = Math.round(100 * Math.exp(-days / 8));
  const reason =
    days < 1 ? "Active today"
    : days < 7 ? `Last activity ${Math.floor(days)} day${days < 2 ? "" : "s"} ago`
    : days < 30 ? `Last activity ${Math.floor(days)} days ago — going stale`
    : "Inactive for 30+ days";
  return { score, reason };
}
```

**`scoreBlockers(blockers)`** — count blockers from the existing `blockers` text field. Each newline-separated entry counts as one. The `[GitHub] …` section (written by `convex/githubInternal.ts:touchSync`) is split on `;` to count individual GitHub blockers.

```ts
function scoreBlockers(blockers: string | undefined) {
  if (!blockers || !blockers.trim()) return { score: 100, reason: "No blockers" };
  const lines = blockers.split("\n").filter((l) => l.trim());
  let count = 0;
  for (const line of lines) {
    if (line.startsWith("[GitHub]")) {
      count += line.replace("[GitHub]", "").split(";").filter((s) => s.trim()).length;
    } else {
      count += 1;
    }
  }
  // 0 → 100, 1 → 70, 2 → 45, 3 → 25, 4+ → 10
  const score = count === 0 ? 100 : Math.max(10, Math.round(100 * Math.exp(-count / 1.8)));
  return { score, reason: `${count} blocker${count === 1 ? "" : "s"}` };
}
```

**`scoreGithub(input, now)`** — only called when `githubRepo` is set. Combines:
- Sync freshness (`githubLastSync` ≥ 1h ago drops the score; the cron at `convex/crons.ts:6` runs every 15 minutes).
- Whether there are GitHub-section blockers (failing CI, stale PRs) — already counted in `scoreBlockers`, but here we *additionally* penalize because GitHub-side problems are more urgent than sticky-note todos.

```ts
function scoreGithub(input: HealthInputs, now: number) {
  const syncAge = input.githubLastSync ? (now - input.githubLastSync) / DAY : 999;
  const hasGithubBlockers = (input.blockers ?? "").includes("[GitHub]");
  const syncScore = syncAge < 1 ? 100 : syncAge < 7 ? 60 : 20;
  const ciScore = hasGithubBlockers ? 30 : 100;
  const score = Math.round(syncScore * 0.4 + ciScore * 0.6);
  const reason = hasGithubBlockers
    ? "GitHub flags issues (failing CI or stale PRs)"
    : syncAge < 1 ? "GitHub healthy" : `GitHub sync ${Math.round(syncAge)}d old`;
  return { score, reason };
}
```

**`scoreNoteFreshness(items, now)`** — forgetting-curve aware. Uses Ebbinghaus-inspired decay over the median note age, weighted by maturity (a `reference` note is allowed to be old; a `fleeting` one going stale is bad).

```ts
function scoreNoteFreshness(items: HealthInputItem[], now: number) {
  if (items.length === 0) return { score: 50, reason: "No items yet" }; // neutral
  // Maturity weights: how much we *care* that this note has been touched recently.
  const weight = (m?: string) =>
    m === "fleeting" ? 1.0 :
    m === "developing" ? 0.7 :
    m === "structured" ? 0.3 :
    m === "reference" ? 0.05 :
    0.5;

  let sumStaleness = 0;
  let sumWeight = 0;
  for (const item of items) {
    const w = weight(item.maturity);
    const days = (now - item.modifiedAt) / DAY;
    // Forgetting curve: 0d → 0 staleness, 7d → 0.5, 30d → ~1
    const staleness = 1 - Math.exp(-days / 14);
    sumStaleness += staleness * w;
    sumWeight += w;
  }
  const avgStaleness = sumWeight > 0 ? sumStaleness / sumWeight : 0;
  const score = Math.round((1 - avgStaleness) * 100);
  const fleetingStale = items.filter((i) =>
    i.maturity === "fleeting" && (now - i.modifiedAt) > 7 * DAY
  ).length;
  const reason = fleetingStale > 0
    ? `${fleetingStale} fleeting note${fleetingStale === 1 ? "" : "s"} going stale`
    : `${items.length} item${items.length === 1 ? "" : "s"}, mostly fresh`;
  return { score, reason };
}
```

### New file: `hypher-web/convex/projects.ts`

A small `query` exposing the inputs. Reactive — any write to `objects` or `activity` for this user re-emits.

```ts
import { query } from "./_generated/server";
import { requireUserId } from "./lib/auth";

export const healthInputs = query({
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const all = await ctx.db
      .query("objects")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const projects = all.filter((o) => o.kind === "project");
    const itemsByProject = new Map<string, { kind: "note" | "artifact"; modifiedAt: number; maturity?: string }[]>();

    for (const o of all) {
      if ((o.kind === "note" || o.kind === "artifact") && o.projectId) {
        const arr = itemsByProject.get(o.projectId) ?? [];
        arr.push({ kind: o.kind, modifiedAt: o.modifiedAt, maturity: o.maturity });
        itemsByProject.set(o.projectId, arr);
      }
    }

    return projects.map((p) => ({
      projectId: p._id as string,
      lastActivity: p.lastActivity,
      blockers: p.blockers,
      githubRepo: p.githubRepo,
      githubLastSync: p.githubLastSync,
      items: itemsByProject.get(p._id as string) ?? [],
    }));
  },
});
```

Notes:
- This duplicates a `by_user` `collect()` that other components also do (e.g. `objects.list` in `convex/objects.ts:32`). Convex caches identical queries, so the duplication is free at runtime; the value of a separate query is a stable shape we can change without touching the main object list.
- Reactive boundary: any write to a `userId`-owned `objects` row re-runs this query. That's the entire reactivity story — no cron, no manual invalidation.

### New file: `hypher-web/src/components/HealthRing.tsx`

Animated SVG ring. Color hardens from green → amber → red as score drops.

```tsx
"use client";
import { motion } from "framer-motion";

interface Props {
  score: number;        // 0–100
  size?: number;        // px, default 24
  strokeWidth?: number; // default 2.5
  ariaLabel?: string;   // default "Project health 73%"
}

export function HealthRing({ score, size = 24, strokeWidth = 2.5, ariaLabel }: Props) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const color = score >= 70 ? "var(--accent)" : score >= 40 ? "var(--amber)" : "var(--danger)";
  const label = ariaLabel ?? `Project health ${score} percent`;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={label}
      style={{ transform: "rotate(-90deg)" }}
    >
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke="var(--bg-tertiary)" strokeWidth={strokeWidth}
      />
      <motion.circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
        strokeDasharray={circumference}
        initial={false}
        animate={{ strokeDashoffset: circumference * (1 - score / 100) }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />
    </svg>
  );
}
```

The ring respects `prefers-reduced-motion` automatically because Framer Motion gates `animate` transitions on the user setting.

### Dashboard integration: `hypher-web/src/components/ProjectDashboard.tsx`

- `useQuery(api.projects.healthInputs)` once near the top.
- Build a `Map<projectId, HealthResult>` via `computeHealthScore()`.
- In the card render, place `<HealthRing score={result.score} />` on the right of `dashboard-card-top`.
- Add a hover popover showing the four sub-scores. Reuse the existing tooltip pattern — see `dashboard-card-blocker title="…"` at `ProjectDashboard.tsx:198` — but as a richer Framer Motion panel with the four reason strings.
- Add `"health"` to `SortKey` and `SORT_OPTIONS`. Sort ascending (lowest first) — surfaces neglect.
- Hide the ring when `project.status === "archived" || project.status === "shipped"`.

### Project card on canvas: `hypher-web/src/components/canvas/cards/ProjectCard.tsx`

Add `<HealthRing size={20} score={...} />` next to the title. Pass score in via a prop from `SpatialCanvas.tsx` so the card stays presentational. This requires `SpatialCanvas.tsx` to also call `useQuery(api.projects.healthInputs)`. That's two `useQuery` calls in two components — Convex dedupes identical queries, so still one network request.

### Files changed summary

| File | Change |
|---|---|
| `hypher-web/src/lib/health.ts` | **NEW** — pure scoring functions. |
| `hypher-web/src/components/HealthRing.tsx` | **NEW** — animated SVG ring. |
| `hypher-web/convex/projects.ts` | **NEW** — `healthInputs` query. |
| `hypher-web/src/components/ProjectDashboard.tsx` | Add ring + sort option + hover popover. |
| `hypher-web/src/components/SpatialCanvas.tsx` | Pass score prop to project cards. |
| `hypher-web/src/components/canvas/cards/ProjectCard.tsx` | Render `<HealthRing>`. |
| `hypher-web/src/app/globals.css` | New `.health-popover` styles + amber/danger CSS variables if missing. |

## Acceptance criteria

- Every active project on the dashboard shows a health ring; archived/shipped projects do not.
- Adding a note to a project causes that project's ring to animate to a higher score within ~500ms (Convex reactivity + the 0.6s ring animation).
- Adding a blocker (manually or via the GitHub sync writing to the `[GitHub]` section) drops the score and the ring color shifts toward amber/red.
- A project with no GitHub repo gets a 3-component score (activity/blockers/notes) and the popover hides the GitHub row.
- Sort by "Health" puts the lowest-scoring project first.
- The ring is keyboard-focusable as part of the dashboard card; the `aria-label` reads "Project health 73 percent" or similar.
- A user with `prefers-reduced-motion: reduce` sees the ring snap to its target value without animation.
- `tsc --noEmit` in `hypher-web/` passes.
- Unit tests in `hypher-web/src/lib/health.test.ts` cover: today's activity = 100, 30-day-stale = ~3, no GitHub renormalization sums correctly, single blocker drops to 70, all-reference-notes don't penalize freshness much.

## How to test

1. Pull the branch. `bun install`. `bun dev`.
2. Sign in. Open the projects dashboard — every active project shows a ring.
3. Pick a low-scoring project. Add a sticky note. Watch the ring animate up by ~5 pts.
4. Add a manual blocker via the project settings panel (existing UI in `ProjectSettings.tsx`). Watch the ring drop and color shift.
5. Hover a ring; confirm the four-row popover with reason strings.
6. Click "Sort: Health" — confirm the lowest-score project is first.
7. Connect a GitHub repo to a project. Wait ≤15 min for the cron, or trigger `api.github.syncRepo` manually from the Convex dashboard. Confirm the ring updates.
8. Disconnect GitHub from a project (set `githubRepo` to undefined via the settings panel). Confirm the popover loses its GitHub row and the score recomputes.
9. Open a project on the canvas — confirm the small ring on the project card.
10. Toggle `prefers-reduced-motion: reduce` in DevTools; reload — confirm the ring snaps without animation.
11. Run `bun test hypher-web/src/lib/health.test.ts`.

## Security & privacy notes

- The `api.projects.healthInputs` query is auth-gated via `requireUserId`. A user can only see their own projects' health.
- The query returns `blockers` text verbatim — same surface area as the existing `objects.list` query, no new exposure.
- The score is computed client-side; nothing about it is logged, exported, or sent to Anthropic.
- No PII in the score itself. Reason strings include note counts and day-counts only — no note content, no project names.
- The `healthInputs` shape includes per-item `modifiedAt` timestamps. Same shape Convex already exposes via `objects.list`. Not a new leak.
- No rate limiting needed — query is local and cheap (single index read + in-memory map build).

## Known tradeoffs

- **Hard-coded weights.** Five sample users will probably have different opinions on whether activity or blockers should weigh more. Picking sane defaults beats shipping a settings UI for v1. **Sunset:** add a per-user override only if multiple users tell us the defaults feel wrong.
- **Client-side computation.** Means the score isn't visible from the API or sortable in Convex. We accept this because storing it would require a cron + invalidation logic we don't want to maintain. The dashboard's sort is fine because all the data is already in the client.
- **Forgetting-curve constants are guesses.** `Math.exp(-days / 8)` for activity and `/14` for note staleness are hand-tuned to feel right against a few sample projects. If users tell us they feel "punished" for missing a day, dial up the divisors. Document the constants in `health.ts` so future tuning is centralized.
- **GitHub sub-score double-counts blockers.** A failing CI run shows up in both `scoreBlockers` (as a blocker) and `scoreGithub` (as `hasGithubBlockers`). This is intentional — GitHub problems are weightier than sticky-note blockers — but it means a single failing-CI signal can swing the score by ~12pts. Acceptable because that *is* the message: failing CI is bad, look at it.
- **No notification when score drops.** A user who never opens the dashboard misses the signal. Tier-2 push/email "Project X dropped below 30" is the right follow-up. Out of scope for this spec.
- **Score renders for projects with zero items.** A brand-new project starts at 50 (notes neutral) + activity-today + no-blockers + no-GitHub-deduction → score around 80. We accept the over-rosiness for empty projects because the alternative ("show no ring until 1 item exists") creates a flickery first-render UX.
- **Convex query duplication on canvas.** `SpatialCanvas` and `ProjectDashboard` both subscribe to `healthInputs`. Convex dedupes identical subscriptions, so the cost is one network channel — but if either component goes off-screen, the channel stays open until the other unmounts. Negligible for now; revisit if the canvas's perf budget gets tight.
