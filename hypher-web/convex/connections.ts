import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { requireBetaAccess } from "./lib/auth";

const connectionData = {
  sourceId: v.string(),
  targetId: v.string(),
  sourceKind: v.string(),
  targetKind: v.string(),
  type: v.union(
    v.literal("manual"),
    v.literal("ai_suggested"),
    v.literal("ai_confirmed"),
    v.literal("dismissed")
  ),
  confidence: v.number(),
  reason: v.string(),
  createdAt: v.number(),
};

export const list = query({
  handler: async (ctx) => {
    const userId = await requireBetaAccess(ctx);
    return await ctx.db
      .query("connections")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const put = mutation({
  args: {
    id: v.optional(v.id("connections")),
    ...connectionData,
  },
  handler: async (ctx, args) => {
    const userId = await requireBetaAccess(ctx);
    const { id, ...data } = args;
    if (id) {
      const existing = await ctx.db.get(id);
      if (!existing || existing.userId !== userId) {
        throw new Error("Unauthorized");
      }
      await ctx.db.patch(id, data);
      return id;
    }
    return await ctx.db.insert("connections", { ...data, userId });
  },
});

export const remove = mutation({
  args: { id: v.id("connections") },
  handler: async (ctx, { id }) => {
    const userId = await requireBetaAccess(ctx);
    const existing = await ctx.db.get(id);
    if (!existing || existing.userId !== userId) {
      throw new Error("Unauthorized");
    }
    await ctx.db.delete(id);
  },
});

/** Backfill userId on rows created before auth (e.g. suggested connections). */
export const patchUserId = internalMutation({
  args: { id: v.id("connections"), userId: v.string() },
  handler: async (ctx, { id, userId }) => {
    await ctx.db.patch(id, { userId });
  },
});
