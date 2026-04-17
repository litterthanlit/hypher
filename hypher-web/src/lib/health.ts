/* Hand-tuned against a few sample projects. See .specs/week-2-05-project-health-score.md §Known tradeoffs. */

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
  /* O(n) where n = user's project count. If projects > 50, consider memoization. */
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
