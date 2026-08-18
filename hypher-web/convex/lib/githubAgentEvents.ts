export const GITHUB_LOOP_SOURCE = "github";
export const GITHUB_STALE_PR_MS = 7 * 86400000;

export type GithubLoopKind = "question" | "build_log";

export interface GithubLoopPr {
  number: number;
  title: string;
  draft: boolean;
  updatedAtMs: number;
  failingChecks: string[];
}

export interface GithubLoopIssue {
  number: number;
  title: string;
  labels: string[];
}

export interface GithubLoopSignal {
  externalKey: string;
  kind: GithubLoopKind;
  title: string;
  body: string;
}

export function githubCiFailKey(prNumber: number): string {
  return `github:pr:${prNumber}:ci-fail`;
}

export function githubStalePrKey(prNumber: number): string {
  return `github:pr:${prNumber}:stale`;
}

export function githubIssueKey(issueNumber: number): string {
  return `github:issue:${issueNumber}:blocker`;
}

export function buildGithubLoopSignals(params: {
  repo: string;
  prs: GithubLoopPr[];
  issues?: GithubLoopIssue[];
  now: number;
}): GithubLoopSignal[] {
  const signals: GithubLoopSignal[] = [];
  const repo = params.repo.trim();

  for (const pr of params.prs) {
    if (pr.failingChecks.length > 0) {
      const checks = pr.failingChecks.join(", ");
      signals.push({
        externalKey: githubCiFailKey(pr.number),
        kind: "question",
        title: `PR #${pr.number} has failing CI`,
        body: `${repo} PR #${pr.number} "${pr.title}" has failing CI (${checks}).`,
      });
    }
    const age = params.now - pr.updatedAtMs;
    if (!pr.draft && age > GITHUB_STALE_PR_MS) {
      const days = Math.floor(age / 86400000);
      signals.push({
        externalKey: githubStalePrKey(pr.number),
        kind: "build_log",
        title: `PR #${pr.number} is stale`,
        body: `${repo} PR #${pr.number} "${pr.title}" has had no activity for ${days} days.`,
      });
    }
  }

  for (const issue of params.issues ?? []) {
    const labels = issue.labels.map((label) => label.toLowerCase());
    if (!labels.some((label) => label === "blocker" || label === "critical" || label === "bug")) {
      continue;
    }
    signals.push({
      externalKey: githubIssueKey(issue.number),
      kind: "question",
      title: `Issue #${issue.number} needs attention`,
      body: `${repo} issue #${issue.number} "${issue.title}" [${issue.labels.join(", ")}].`,
    });
  }

  return signals;
}

export type GithubLoopExisting = {
  externalKey?: string;
  status: "new" | "reviewed" | "accepted" | "dismissed";
  autoResolved?: boolean;
  title: string;
  body: string;
};

export type GithubLoopWrite =
  | { op: "insert"; signal: GithubLoopSignal }
  | { op: "patch"; externalKey: string; status?: "new" | "dismissed"; autoResolved?: boolean; title?: string; body?: string };

export function planGithubLoopWrites(params: {
  signals: GithubLoopSignal[];
  existing: GithubLoopExisting[];
}): GithubLoopWrite[] {
  const activeKeys = new Set(params.signals.map((signal) => signal.externalKey));
  const byKey = new Map(
    params.existing
      .filter((row) => row.externalKey)
      .map((row) => [row.externalKey as string, row])
  );
  const writes: GithubLoopWrite[] = [];

  for (const signal of params.signals) {
    const current = byKey.get(signal.externalKey);
    if (!current) {
      writes.push({ op: "insert", signal });
      continue;
    }
    if (current.status === "dismissed" && current.autoResolved) {
      writes.push({
        op: "patch",
        externalKey: signal.externalKey,
        status: "new",
        autoResolved: false,
        title: signal.title,
        body: signal.body,
      });
      continue;
    }
    if (current.status === "new" || current.status === "reviewed") {
      if (current.title !== signal.title || current.body !== signal.body) {
        writes.push({
          op: "patch",
          externalKey: signal.externalKey,
          title: signal.title,
          body: signal.body,
        });
      }
    }
  }

  for (const row of params.existing) {
    if (!row.externalKey || activeKeys.has(row.externalKey)) continue;
    if (row.status === "new" || row.status === "reviewed") {
      writes.push({
        op: "patch",
        externalKey: row.externalKey,
        status: "dismissed",
        autoResolved: true,
      });
    }
  }

  return writes;
}
