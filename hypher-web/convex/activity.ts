import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireBetaAccess } from "./lib/auth";

function toClientActivity(doc: any) {
  const { _id, _creationTime, userId, ...rest } = doc;
  return { ...rest, id: String(_id) };
}

export function selectRecentActivityForProject(
  rows: any[],
  userId: string,
  projectId: string,
  limit = 5
) {
  return rows
    .filter((row) => row.userId === userId && row.projectId === projectId)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit)
    .map(toClientActivity);
}

export const list = query({
  handler: async (ctx) => {
    const userId = await requireBetaAccess(ctx);
    return await ctx.db
      .query("activity")
      .withIndex("by_user_time", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const recentForProject = query({
  args: { projectId: v.id("objects"), limit: v.optional(v.number()) },
  handler: async (ctx, { projectId, limit }) => {
    const userId = await requireBetaAccess(ctx);
    const rows = await ctx.db
      .query("activity")
      .withIndex("by_project", (q) => q.eq("projectId", String(projectId)))
      .order("desc")
      .collect();
    return selectRecentActivityForProject(rows, userId, String(projectId), limit ?? 5);
  },
});

export const listByProject = query({
  args: { projectId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { projectId, limit }) => {
    const userId = await requireBetaAccess(ctx);
    const results = await ctx.db
      .query("activity")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .order("desc")
      .collect();
    const scoped = results.filter((a) => a.userId === userId);
    return limit ? scoped.slice(0, limit) : scoped;
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
    const userId = await requireBetaAccess(ctx);
    return await ctx.db.insert("activity", { ...args, userId });
  },
});
