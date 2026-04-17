/**
 * Shared prompt formatter for the daily digest.
 * Used by both the Next.js streaming route handler and (if import resolves)
 * convex/ai.ts. Zero Convex or Next.js imports — pure TypeScript.
 *
 * IMPORTANT: Keep byte-identical output across both callers.
 * Do NOT alter phrasing, punctuation, or line breaks.
 */

export interface ProjectInput {
  name: string;
  status?: string;
  priority?: number;
  blockers?: string;
  lastActivity?: number;
  itemCount: number;
  githubRepo?: string;
  githubSummary?: string;
}

export function formatProjects(projects: ProjectInput[]): string {
  return projects
    .map((p) => {
      const lines = [`- **${p.name}**`];
      lines.push(`  Status: ${p.status ?? "active"}`);
      lines.push(`  Priority: P${p.priority ?? 3}`);
      lines.push(`  Items: ${p.itemCount}`);
      if (p.lastActivity) {
        const daysAgo = Math.floor(
          (Date.now() - p.lastActivity) / 86400000
        );
        lines.push(
          `  Last activity: ${daysAgo === 0 ? "today" : `${daysAgo} days ago`}`
        );
      }
      if (p.blockers) {
        lines.push(`  Blocker: ${p.blockers}`);
      }
      if (p.githubRepo) {
        lines.push(`  GitHub: ${p.githubRepo}`);
      }
      if (p.githubSummary) {
        lines.push(`  GitHub activity: ${p.githubSummary}`);
      }
      return lines.join("\n");
    })
    .join("\n\n");
}

export function buildDigestPrompt(projects: ProjectInput[]): string {
  return `Here are my active projects:\n\n${formatProjects(projects)}\n\nGenerate a brief daily digest with:\n1. What's ready to ship or close to done\n2. What needs attention (blockers, stale high-priority, GitHub issues)\n3. Suggested focus for today (1-2 items max)\n4. Any GitHub blockers that need immediate action (failing CI, stale PRs)\n\nKeep it under 200 words.`;
}
