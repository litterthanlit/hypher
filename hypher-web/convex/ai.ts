"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import Anthropic from "@anthropic-ai/sdk";

function formatProjects(
  projects: Array<{
    name: string;
    status?: string;
    priority?: number;
    blockers?: string;
    lastActivity?: number;
    itemCount: number;
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
      return lines.join("\n");
    })
    .join("\n\n");
}

export const generateDigest = action({
  args: {
    projects: v.array(
      v.object({
        name: v.string(),
        status: v.optional(v.string()),
        priority: v.optional(v.number()),
        blockers: v.optional(v.string()),
        lastActivity: v.optional(v.number()),
        itemCount: v.number(),
      })
    ),
  },
  handler: async (_ctx, { projects }) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return "Daily digest unavailable — ANTHROPIC_API_KEY not configured.";
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
          content: `Here are my active projects:\n\n${formatProjects(projects)}\n\nGenerate a brief daily digest with:\n1. What's ready to ship or close to done\n2. What needs attention (blockers, stale high-priority)\n3. Suggested focus for today (1-2 items max)\n\nKeep it under 200 words.`,
        },
      ],
    });

    const block = response.content[0];
    return block.type === "text" ? block.text : "Could not generate digest.";
  },
});
