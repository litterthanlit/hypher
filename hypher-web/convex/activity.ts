import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("activity")
      .withIndex("by_timestamp")
      .order("desc")
      .collect();
  },
});

export const listByProject = query({
  args: { projectId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { projectId, limit }) => {
    const results = await ctx.db
      .query("activity")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .order("desc")
      .collect();
    return limit ? results.slice(0, limit) : results;
  },
});

export const put = mutation({
  args: {
    action: v.string(),
    objectId: v.string(),
    objectKind: v.string(),
    objectName: v.string(),
    targetId: v.optional(v.string()),
    targetKind: v.optional(v.string()),
    targetName: v.optional(v.string()),
    timestamp: v.number(),
    projectId: v.optional(v.string()),
    activityType: v.optional(v.string()),
    summary: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("activity", args);
  },
});
