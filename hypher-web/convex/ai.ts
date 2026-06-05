"use node";

import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import Anthropic from "@anthropic-ai/sdk";
import { requireActionBetaAccess } from "./lib/actionAuth";
import { ratelimitConvex } from "./lib/rateLimit";

const MAX_DIGEST_PROJECTS = 50;
const MAX_TAG_CONTENT_LEN = 2000;
const MAX_TAGS = 5;

/* MIRROR of the other copy — keep in sync. See .specs/week-2-04-streaming-ai-tokens.md
 * The canonical source is hypher-web/src/app/api/digest/formatPrompt.ts
 * Convex cannot import files outside the convex/ directory at runtime,
 * so this is an intentional inline duplicate.
 */
function truncate(value: string | undefined, limit: number): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, limit) : undefined;
}

function normalizeProjects(
  projects: Array<{
    name: string;
    status?: string;
    priority?: number;
    blockers?: string;
    lastActivity?: number;
    itemCount: number;
    githubRepo?: string;
    githubSummary?: string;
  }>
) {
  return projects.slice(0, MAX_DIGEST_PROJECTS).map((project) => ({
    ...project,
    name: truncate(project.name, 80) ?? "Untitled",
    status: truncate(project.status, 40),
    blockers: truncate(project.blockers, 500),
    githubRepo: truncate(project.githubRepo, 120),
    githubSummary: truncate(project.githubSummary, 500),
  }));
}

function formatProjects(
  projects: Array<{
    name: string;
    status?: string;
    priority?: number;
    blockers?: string;
    lastActivity?: number;
    itemCount: number;
    githubRepo?: string;
    githubSummary?: string;
  }>
): string {
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

export const generateDigest = internalAction({
  args: {
    projects: v.array(
      v.object({
        name: v.string(),
        status: v.optional(v.string()),
        priority: v.optional(v.number()),
        blockers: v.optional(v.string()),
        lastActivity: v.optional(v.number()),
        itemCount: v.number(),
        githubRepo: v.optional(v.string()),
        githubSummary: v.optional(v.string()),
      })
    ),
  },
  handler: async (_ctx, { projects }) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return "Add ANTHROPIC_API_KEY to your Vercel environment to enable AI digests.";
    }

    const anthropic = new Anthropic({ apiKey });

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system:
        "You are a project assistant helping a solo builder prioritize their work. Be concise and actionable. Use plain text, no markdown headers.",
      messages: [
        {
          role: "user",
          content: `Here are my active projects:\n\n${formatProjects(normalizeProjects(projects))}\n\nGenerate a brief daily digest with:\n1. What's ready to ship or close to done\n2. What needs attention (blockers, stale high-priority, GitHub issues)\n3. Suggested focus for today (1-2 items max)\n4. Any GitHub blockers that need immediate action (failing CI, stale PRs)\n\nKeep it under 200 words.`,
        },
      ],
    });

    const block = response.content[0];
    return block.type === "text" ? block.text : "Could not generate digest.";
  },
});

export const generateTags = action({
  args: { content: v.string() },
  handler: async (ctx, { content }) => {
    const userId = await requireActionBetaAccess(ctx);
    const allowed = await ratelimitConvex(userId, "ai-generate-tags", {
      requests: 60,
      window: "1h",
    }).catch(() => false);
    if (!allowed) return [];

    const boundedContent = content.trim().slice(0, MAX_TAG_CONTENT_LEN);
    if (boundedContent.length < 10) return [];

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return [];

    const anthropic = new Anthropic({ apiKey });

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 100,
      system:
        'Generate 2-5 tags for the following content. Return ONLY a JSON array of lowercase strings, no explanation. Tags should be specific and useful for organization. Examples: ["ui-pattern", "react", "animation"] or ["meeting-notes", "q2-planning"]',
      messages: [{ role: "user", content: boundedContent }],
    });

    try {
      const text = response.content[0].type === "text" ? response.content[0].text : "[]";
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((t: unknown) => typeof t === "string")
          .map((t: string) => t.trim().slice(0, 40).toLowerCase())
          .filter(Boolean)
          .slice(0, MAX_TAGS);
      }
      return [];
    } catch {
      return [];
    }
  },
});
