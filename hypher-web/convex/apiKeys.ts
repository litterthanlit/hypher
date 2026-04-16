import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { requireUserId } from "./lib/auth";

function hashKey(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return `hk_${Math.abs(hash).toString(36)}`;
}

function generateKey(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let key = "hyp_";
  for (let i = 0; i < 32; i++) {
    key += chars[Math.floor(Math.random() * chars.length)];
  }
  return key;
}

export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const userId = await requireUserId(ctx);
    const plainKey = generateKey();
    const hashed = hashKey(plainKey);
    await ctx.db.insert("apiKeys", {
      userId,
      key: hashed,
      name,
      createdAt: Date.now(),
    });
    return plainKey;
  },
});

export const list = query({
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const keys = await ctx.db.query("apiKeys").collect();
    return keys
      .filter((k) => k.userId === userId)
      .map((k) => ({
        id: k._id,
        name: k.name,
        createdAt: k.createdAt,
        lastUsed: k.lastUsed,
      }));
  },
});

export const revoke = mutation({
  args: { keyId: v.id("apiKeys") },
  handler: async (ctx, { keyId }) => {
    const userId = await requireUserId(ctx);
    const row = await ctx.db.get(keyId);
    if (!row || row.userId !== userId) {
      throw new Error("Unauthorized");
    }
    await ctx.db.delete(keyId);
  },
});

export const validate = internalQuery({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const hashed = hashKey(key);
    const result = await ctx.db
      .query("apiKeys")
      .withIndex("by_key", (q) => q.eq("key", hashed))
      .first();
    return result?.userId ?? null;
  },
});

export const touch = internalMutation({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const hashed = hashKey(key);
    const result = await ctx.db
      .query("apiKeys")
      .withIndex("by_key", (q) => q.eq("key", hashed))
      .first();
    if (result) {
      await ctx.db.patch(result._id, { lastUsed: Date.now() });
    }
  },
});
