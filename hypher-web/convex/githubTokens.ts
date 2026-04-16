import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { requireUserId } from "./lib/auth";

export const getStatus = query({
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const row = await ctx.db
      .query("githubTokens")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    return { connected: !!row?.accessToken };
  },
});

export const upsertEncryptedToken = internalMutation({
  args: { userId: v.string(), ciphertext: v.string() },
  handler: async (ctx, { userId, ciphertext }) => {
    const existing = await ctx.db
      .query("githubTokens")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { accessToken: ciphertext });
      return existing._id;
    }
    return await ctx.db.insert("githubTokens", { userId, accessToken: ciphertext });
  },
});

export const getEncryptedTokenRow = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("githubTokens")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
  },
});
