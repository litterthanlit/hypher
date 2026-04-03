import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  handler: async (ctx) => {
    return await ctx.db.query("connections").collect();
  },
});

export const put = mutation({
  args: {
    id: v.optional(v.id("connections")),
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
  },
  handler: async (ctx, args) => {
    const { id, ...data } = args;
    if (id) {
      await ctx.db.patch(id, data);
      return id;
    }
    return await ctx.db.insert("connections", data);
  },
});

export const remove = mutation({
  args: { id: v.id("connections") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});
