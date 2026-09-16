"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import Anthropic from "@anthropic-ai/sdk";
import { requireActionBetaAccess } from "./lib/actionAuth";
import { ratelimitConvex } from "./lib/rateLimit";

const MAX_TAG_CONTENT_LEN = 2000;
const MAX_TAGS = 5;

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
