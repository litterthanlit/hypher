"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import Anthropic from "@anthropic-ai/sdk";

/* ── GitHub API helpers ─────────────────────────────────────────── */

interface GitHubRepo {
  full_name: string;
  description: string | null;
  language: string | null;
  default_branch: string;
  open_issues_count: number;
  pushed_at: string;
}

interface GitHubTreeItem {
  path: string;
  type: string;
}

interface GitHubCommit {
  sha: string;
  commit: { message: string; author: { date: string } };
}

interface GitHubIssue {
  number: number;
  title: string;
  state: string;
  labels: Array<{ name: string }>;
  pull_request?: unknown;
  created_at: string;
  updated_at: string;
  user: { login: string };
}

interface GitHubPR {
  number: number;
  title: string;
  state: string;
  merged_at: string | null;
  created_at: string;
  updated_at: string;
  user: { login: string };
  head: { ref: string };
  draft: boolean;
}

interface GitHubCheck {
  conclusion: string | null;
  status: string;
  name: string;
}

async function ghFetch<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

/* ── Validate repo + token ──────────────────────────────────────── */

export const validateRepo = internalAction({
  args: { repo: v.string(), token: v.string() },
  handler: async (_ctx, { repo, token }): Promise<{ valid: boolean; name?: string; description?: string; error?: string }> => {
    try {
      const data = await ghFetch<GitHubRepo>(`/repos/${repo}`, token);
      return { valid: true, name: data.full_name, description: data.description ?? undefined };
    } catch (e) {
      return { valid: false, error: e instanceof Error ? e.message : "Unknown error" };
    }
  },
});

export const validateRepoInternal = internalAction({
  args: { repo: v.string(), token: v.string() },
  handler: async (
    _ctx,
    { repo, token }
  ): Promise<
    | { valid: true; name: string; description?: string }
    | { valid: false; error: string }
  > => {
    try {
      const data = await ghFetch<GitHubRepo>(`/repos/${repo}`, token);
      return { valid: true, name: data.full_name, description: data.description ?? undefined };
    } catch (e) {
      return { valid: false, error: e instanceof Error ? e.message : "Unknown error" };
    }
  },
});

/* ── Fetch repo context for doc generation ──────────────────────── */

async function fetchRepoContext(repo: string, token: string) {
  const [repoData, tree, commits, issues, prs] = await Promise.all([
    ghFetch<GitHubRepo>(`/repos/${repo}`, token),
    ghFetch<{ tree: GitHubTreeItem[] }>(`/repos/${repo}/git/trees/${encodeURIComponent("HEAD")}?recursive=1`, token)
      .catch(() => ({ tree: [] as GitHubTreeItem[] })),
    ghFetch<GitHubCommit[]>(`/repos/${repo}/commits?per_page=20`, token)
      .catch(() => [] as GitHubCommit[]),
    ghFetch<GitHubIssue[]>(`/repos/${repo}/issues?state=open&per_page=30`, token)
      .catch(() => [] as GitHubIssue[]),
    ghFetch<GitHubPR[]>(`/repos/${repo}/pulls?state=all&per_page=20&sort=updated`, token)
      .catch(() => [] as GitHubPR[]),
  ]);

  // Fetch README
  let readme = "";
  try {
    const readmeRes = await fetch(`https://api.github.com/repos/${repo}/readme`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.raw+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (readmeRes.ok) readme = (await readmeRes.text()).slice(0, 4000);
  } catch { /* no readme */ }

  // Build file tree summary (top-level + key directories)
  const filePaths = tree.tree
    .filter((f: GitHubTreeItem) => f.type === "blob")
    .map((f: GitHubTreeItem) => f.path)
    .slice(0, 200);

  const commitSummary = commits
    .slice(0, 15)
    .map((c: GitHubCommit) => `- ${c.commit.message.split("\n")[0]} (${c.commit.author.date.slice(0, 10)})`)
    .join("\n");

  const openIssues = issues
    .filter((i: GitHubIssue) => !i.pull_request)
    .map((i: GitHubIssue) => `- #${i.number}: ${i.title} [${i.labels.map((l) => l.name).join(", ")}]`)
    .join("\n");

  const prSummary = prs
    .slice(0, 15)
    .map((p: GitHubPR) => {
      const status = p.merged_at ? "merged" : p.state;
      return `- #${p.number}: ${p.title} (${status}, ${p.updated_at.slice(0, 10)})`;
    })
    .join("\n");

  return {
    name: repoData.full_name,
    description: repoData.description || "No description",
    language: repoData.language || "Unknown",
    defaultBranch: repoData.default_branch,
    filePaths,
    readme,
    commitSummary,
    openIssues,
    prSummary,
    openIssueCount: repoData.open_issues_count,
  };
}

/* ── Generate docs ──────────────────────────────────────────────── */

export const generateDocs = internalAction({
  args: { repo: v.string(), token: v.string() },
  handler: async (_ctx, { repo, token }): Promise<{ claude: string; roadmap: string; handoff: string }> => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

    const ctx = await fetchRepoContext(repo, token);
    const anthropic = new Anthropic({ apiKey });

    const systemPrompt = `You are a technical documentation generator. You analyze GitHub repositories and produce clean, accurate documentation. Be concise and practical. Use markdown formatting.`;

    // Generate all three docs in a single call for efficiency
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{
        role: "user",
        content: `Analyze this GitHub repository and generate three documentation files.

**Repository:** ${ctx.name}
**Description:** ${ctx.description}
**Language:** ${ctx.language}
**Default branch:** ${ctx.defaultBranch}

**README (first 4000 chars):**
${ctx.readme || "(none)"}

**File structure (up to 200 files):**
${ctx.filePaths.join("\n")}

**Recent commits:**
${ctx.commitSummary}

**Open issues:**
${ctx.openIssues || "(none)"}

**Recent PRs:**
${ctx.prSummary || "(none)"}

Generate exactly three sections, separated by "---SECTION---":

**Section 1: CLAUDE.md** — Tech stack, architecture overview, code style conventions, build/dev commands. Focus on what an AI coding assistant needs to know to work in this repo.

**Section 2: ROADMAP.md** — Features shipped (from merged PRs/commits) vs. planned (from open issues/PRs). Organized by theme or area.

**Section 3: HANDOFF.md** — File structure explanation, key technical decisions visible from the code, current state of the project, and what someone new should know.

Keep each section under 800 words. Be specific to this repo, not generic.`,
      }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const sections = text.split("---SECTION---").map((s: string) => s.trim());

    return {
      claude: sections[0] || "Could not generate CLAUDE.md",
      roadmap: sections[1] || "Could not generate ROADMAP.md",
      handoff: sections[2] || "Could not generate HANDOFF.md",
    };
  },
});

/* ── Sync GitHub activity ───────────────────────────────────────── */

export const syncRepo = internalAction({
  args: { repo: v.string(), token: v.string(), projectId: v.string(), projectName: v.string() },
  handler: async (ctx, { repo, token, projectId, projectName }) => {
    const [prs, issues, commits] = await Promise.all([
      ghFetch<GitHubPR[]>(`/repos/${repo}/pulls?state=open&per_page=10&sort=updated`, token)
        .catch(() => [] as GitHubPR[]),
      ghFetch<GitHubIssue[]>(`/repos/${repo}/issues?state=open&per_page=20`, token)
        .catch(() => [] as GitHubIssue[]),
      ghFetch<GitHubCommit[]>(`/repos/${repo}/commits?per_page=5`, token)
        .catch(() => [] as GitHubCommit[]),
    ]);

    // Detect blockers
    const blockers: string[] = [];
    const now = Date.now();
    const sevenDays = 7 * 86400000;
    const twoWeeks = 14 * 86400000;

    for (const pr of prs) {
      const age = now - new Date(pr.updated_at).getTime();

      // Check CI status on open PRs
      try {
        const checks = await ghFetch<{ check_runs: GitHubCheck[] }>(
          `/repos/${repo}/commits/${pr.head.ref}/check-runs?per_page=5`, token
        );
        const failing = checks.check_runs.filter((c) => c.conclusion === "failure");
        if (failing.length > 0) {
          blockers.push(`PR #${pr.number} "${pr.title}" has failing CI (${failing.map((c) => c.name).join(", ")})`);
        }
      } catch { /* skip CI check */ }

      // Stale PR
      if (age > sevenDays && !pr.draft) {
        blockers.push(`PR #${pr.number} "${pr.title}" has had no activity for ${Math.floor(age / 86400000)} days`);
      }
    }

    // Critical/blocker issues
    for (const issue of issues) {
      if (issue.pull_request) continue;
      const labelNames = issue.labels.map((l) => l.name.toLowerCase());
      if (labelNames.some((l) => l === "blocker" || l === "critical" || l === "bug")) {
        blockers.push(`Issue #${issue.number} "${issue.title}" [${issue.labels.map((l) => l.name).join(", ")}]`);
      }
    }

    // Build activity summary
    const recentPRs = prs.slice(0, 5).map((p) => ({
      number: p.number,
      title: p.title,
      state: p.state,
      draft: p.draft,
      updatedAt: p.updated_at,
    }));

    const latestCommitDate = commits[0]
      ? new Date(commits[0].commit.author.date).getTime()
      : undefined;

    return {
      blockers,
      openPRCount: prs.length,
      openIssueCount: issues.filter((i) => !i.pull_request).length,
      recentPRs,
      latestCommitDate,
      commitMessages: commits.slice(0, 5).map((c) => c.commit.message.split("\n")[0]),
    };
  },
});

/* ── Sync all repos (called by cron) ────────────────────────────── */

export const syncAllRepos = internalAction({
  handler: async (ctx) => {
    const token = process.env.GITHUB_TOKEN;
    if (!token) return;

    // Query all projects with GitHub repos
    // We use runQuery for read access from actions
    const allObjects = await ctx.runQuery(internal.githubInternal.listGitHubProjects);

    for (const project of allObjects) {
      if (!project.githubRepo) continue;
      try {
        const result = await ctx.runAction(internal.github.syncRepoInternal, {
          repo: project.githubRepo,
          token,
          projectId: project._id,
          projectName: project.name ?? "Unknown",
        });

        // Update lastActivity if we got new commits
        if (result.latestCommitDate) {
          await ctx.runMutation(internal.githubInternal.touchSync, {
            projectId: project._id,
            timestamp: result.latestCommitDate,
            blockers: result.blockers,
          });
        }

        // Log activity
        if (result.blockers.length > 0) {
          await ctx.runMutation(internal.githubInternal.logGitHubActivity, {
            projectId: project._id,
            projectName: project.name ?? "Unknown",
            summary: `GitHub sync: ${result.openPRCount} open PRs, ${result.openIssueCount} open issues, ${result.blockers.length} blockers`,
          });
        }
      } catch (e) {
        console.error(`GitHub sync failed for ${project.githubRepo}:`, e);
      }
    }
  },
});

/* Internal versions for cron use */

export const syncRepoInternal = internalAction({
  args: { repo: v.string(), token: v.string(), projectId: v.string(), projectName: v.string() },
  handler: async (_ctx, args) => {
    const [prs, issues, commits] = await Promise.all([
      ghFetch<GitHubPR[]>(`/repos/${args.repo}/pulls?state=open&per_page=10&sort=updated`, args.token)
        .catch(() => [] as GitHubPR[]),
      ghFetch<GitHubIssue[]>(`/repos/${args.repo}/issues?state=open&per_page=20`, args.token)
        .catch(() => [] as GitHubIssue[]),
      ghFetch<GitHubCommit[]>(`/repos/${args.repo}/commits?per_page=5`, args.token)
        .catch(() => [] as GitHubCommit[]),
    ]);

    const blockers: string[] = [];
    const now = Date.now();
    const sevenDays = 7 * 86400000;

    for (const pr of prs) {
      const age = now - new Date(pr.updated_at).getTime();
      try {
        const checks = await ghFetch<{ check_runs: GitHubCheck[] }>(
          `/repos/${args.repo}/commits/${pr.head.ref}/check-runs?per_page=5`, args.token
        );
        const failing = checks.check_runs.filter((c) => c.conclusion === "failure");
        if (failing.length > 0) {
          blockers.push(`PR #${pr.number} "${pr.title}" has failing CI`);
        }
      } catch { /* skip */ }

      if (age > sevenDays && !pr.draft) {
        blockers.push(`PR #${pr.number} "${pr.title}" stale (${Math.floor(age / 86400000)}d)`);
      }
    }

    for (const issue of issues) {
      if (issue.pull_request) continue;
      const labelNames = issue.labels.map((l) => l.name.toLowerCase());
      if (labelNames.some((l) => l === "blocker" || l === "critical" || l === "bug")) {
        blockers.push(`Issue #${issue.number} "${issue.title}"`);
      }
    }

    return {
      blockers,
      openPRCount: prs.length,
      openIssueCount: issues.filter((i) => !i.pull_request).length,
      recentPRs: prs.slice(0, 5).map((p) => ({ number: p.number, title: p.title, state: p.state, draft: p.draft, updatedAt: p.updated_at })),
      latestCommitDate: commits[0] ? new Date(commits[0].commit.author.date).getTime() : undefined,
      commitMessages: commits.slice(0, 5).map((c) => c.commit.message.split("\n")[0]),
    };
  },
});
