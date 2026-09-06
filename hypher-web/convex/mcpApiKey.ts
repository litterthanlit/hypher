import { query } from "./_generated/server";
import { v } from "convex/values";
import { validateApiKey } from "./apiKeys";
import { buildMcpContextForUser } from "./lib/mcpContext";

/**
 * Read-side MCP context for a plaintext `hyp_` API key.
 *
 * Lets a headless caller (Cursor cloud agents, CI, other tools) load the same
 * Builder Brief / project context over `/api/mcp` with a single API key instead
 * of the browser OAuth flow. Writes still go through
 * `agentEvents.createFromApiRequest`. Returns null for unknown/revoked/non-beta
 * keys so the route replies with the standard MCP auth challenge.
 */
export const dataForApiKey = query({
  args: {
    key: v.string(),
    projectId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const validated = await validateApiKey(ctx, args.key);
    if (!validated) return null;
    return await buildMcpContextForUser(ctx, validated.userId, args.projectId);
  },
});
