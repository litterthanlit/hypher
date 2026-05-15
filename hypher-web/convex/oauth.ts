import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireUserId } from "./lib/auth";

const CODE_TTL_MS = 10 * 60 * 1000;
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const createAuthorizationCode = mutation({
  args: {
    codeHash: v.string(),
    clientId: v.string(),
    redirectUri: v.string(),
    codeChallenge: v.string(),
    resource: v.string(),
    scope: v.string(),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await ctx.db.insert("oauthAuthorizationCodes", {
      ...args,
      userId,
      createdAt: args.now,
      expiresAt: args.now + CODE_TTL_MS,
    });
  },
});

export const exchangeAuthorizationCode = mutation({
  args: {
    codeHash: v.string(),
    clientId: v.string(),
    redirectUri: v.string(),
    codeChallenge: v.string(),
    resource: v.string(),
    accessTokenHash: v.string(),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const code = await ctx.db
      .query("oauthAuthorizationCodes")
      .withIndex("by_codeHash", (q) => q.eq("codeHash", args.codeHash))
      .unique();

    if (!code || code.consumedAt !== undefined || code.expiresAt <= args.now) {
      return null;
    }
    if (
      code.clientId !== args.clientId ||
      code.redirectUri !== args.redirectUri ||
      code.codeChallenge !== args.codeChallenge ||
      code.resource !== args.resource
    ) {
      return null;
    }

    await ctx.db.patch(code._id, { consumedAt: args.now });
    await ctx.db.insert("oauthAccessTokens", {
      tokenHash: args.accessTokenHash,
      userId: code.userId,
      clientId: code.clientId,
      resource: code.resource,
      scope: code.scope,
      createdAt: args.now,
      expiresAt: args.now + TOKEN_TTL_MS,
    });

    return {
      userId: code.userId,
      scope: code.scope,
      expiresIn: Math.floor(TOKEN_TTL_MS / 1000),
    };
  },
});

export const validateAccessToken = mutation({
  args: {
    tokenHash: v.string(),
    resource: v.string(),
    scope: v.string(),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const token = await ctx.db
      .query("oauthAccessTokens")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", args.tokenHash))
      .unique();

    if (!token || token.revokedAt !== undefined || token.expiresAt <= args.now) {
      return null;
    }
    if (token.resource !== args.resource || !token.scope.split(/\s+/).includes(args.scope)) {
      return null;
    }

    await ctx.db.patch(token._id, { lastUsedAt: args.now });
    return {
      userId: token.userId,
      clientId: token.clientId,
      scope: token.scope,
      expiresAt: token.expiresAt,
    };
  },
});

export const listConnections = query({
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const rows = await ctx.db.query("oauthAccessTokens").collect();

    return rows
      .filter((row) => row.userId === userId)
      .map((row) => ({
        id: row._id,
        clientId: row.clientId,
        scope: row.scope,
        createdAt: row.createdAt,
        expiresAt: row.expiresAt,
        revokedAt: row.revokedAt,
        lastUsedAt: row.lastUsedAt,
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});
