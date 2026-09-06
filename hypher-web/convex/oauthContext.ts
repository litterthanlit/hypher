import { query } from "./_generated/server";
import { v } from "convex/values";
import { hasBetaAccess } from "./lib/auth";
import {
  buildMcpContextForUser,
  selectActivityForOAuthContext,
} from "./lib/mcpContext";
import { oauthResourcesEquivalent } from "../shared/oauthResources";

// Re-exported so the OAuth context activity behaviour stays covered by
// oauthContext.test.ts. Canonical implementation lives in lib/mcpContext.
export { selectActivityForOAuthContext };

async function validateToken(ctx: any, args: { tokenHash: string; resource: string; scope: string; now: number }) {
  const token = await ctx.db
    .query("oauthAccessTokens")
    .withIndex("by_tokenHash", (q: any) => q.eq("tokenHash", args.tokenHash))
    .unique();

  if (!token || token.revokedAt !== undefined || token.expiresAt <= args.now) return null;
  if (
    !oauthResourcesEquivalent(token.resource, args.resource) ||
    !token.scope.split(/\s+/).includes(args.scope)
  ) {
    return null;
  }
  if (!(await hasBetaAccess(ctx, token.userId))) return null;
  return token;
}

export const dataForToken = query({
  args: {
    tokenHash: v.string(),
    resource: v.string(),
    scope: v.string(),
    projectId: v.optional(v.string()),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const token = await validateToken(ctx, args);
    if (!token) return null;
    return await buildMcpContextForUser(ctx, token.userId, args.projectId);
  },
});
