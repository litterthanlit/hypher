import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { requireUserId } from "./lib/auth";

const objectFields = {
  kind: v.union(v.literal("project"), v.literal("note"), v.literal("artifact")),
  createdAt: v.number(),
  modifiedAt: v.number(),
  name: v.optional(v.string()),
  description: v.optional(v.string()),
  status: v.optional(v.string()),
  priority: v.optional(v.number()),
  blockers: v.optional(v.string()),
  lastActivity: v.optional(v.number()),
  githubRepo: v.optional(v.string()),
  githubLastSync: v.optional(v.number()),
  content: v.optional(v.string()),
  maturity: v.optional(v.string()),
  type: v.optional(v.string()),
  fileReference: v.optional(v.string()),
  thumbnailDataUrl: v.optional(v.string()),
  embedding: v.optional(v.array(v.float64())),
  embeddingText: v.optional(v.string()),
  tags: v.optional(v.array(v.string())),
  projectId: v.optional(v.union(v.string(), v.null())),
  lastSurfacedAt: v.optional(v.number()),
  canvasPosition: v.optional(v.object({ x: v.number(), y: v.number() })),
  canvasColor: v.optional(v.string()),
  canvasSize: v.optional(v.object({ w: v.number(), h: v.number() })),
};

export const list = query({
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    return await ctx.db
      .query("objects")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const listByProject = query({
  args: { projectId: v.string() },
  handler: async (ctx, { projectId }) => {
    const userId = await requireUserId(ctx);
    const rows = await ctx.db
      .query("objects")
      .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
      .collect();
    return rows.filter((o) => o.userId === userId);
  },
});

export const get = query({
  args: { id: v.id("objects") },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const doc = await ctx.db.get(id);
    if (!doc || doc.userId !== userId) return null;
    return doc;
  },
});

/** Resolve an object by id when it belongs to the current user (for capture / HTTP). */
export const getIfOwner = query({
  args: { id: v.id("objects") },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const doc = await ctx.db.get(id);
    if (!doc || doc.userId !== userId) return null;
    return doc;
  },
});

export const put = mutation({
  args: {
    id: v.optional(v.id("objects")),
    ...objectFields,
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const { id, ...data } = args;
    if (id) {
      const existing = await ctx.db.get(id);
      if (!existing || existing.userId !== userId) {
        throw new Error("Unauthorized");
      }
      await ctx.db.patch(id, data);
      return id;
    }
    return await ctx.db.insert("objects", { ...data, userId });
  },
});

export const touchLastActivity = mutation({
  args: { id: v.id("objects"), timestamp: v.number() },
  handler: async (ctx, { id, timestamp }) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db.get(id);
    if (!existing || existing.userId !== userId) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(id, { lastActivity: timestamp });
  },
});

export const remove = mutation({
  args: { id: v.id("objects") },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db.get(id);
    if (!existing || existing.userId !== userId) {
      throw new Error("Unauthorized");
    }
    await ctx.db.delete(id);
  },
});

/** HTTP routes: scoped by API key owner */
export const putForApiUser = internalMutation({
  args: {
    userId: v.string(),
    ...objectFields,
  },
  handler: async (ctx, args) => {
    const { userId, ...data } = args;
    return await ctx.db.insert("objects", { ...data, userId });
  },
});

export const listForApiUser = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("objects")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const getProjectForUser = internalQuery({
  args: { projectId: v.id("objects"), userId: v.string() },
  handler: async (ctx, { projectId, userId }) => {
    const doc = await ctx.db.get(projectId);
    if (!doc || doc.userId !== userId || doc.kind !== "project") return null;
    return {
      name: doc.name ?? "Project",
      githubRepo: doc.githubRepo,
      blockers: doc.blockers,
    };
  },
});

export const patchGithubFields = internalMutation({
  args: {
    projectId: v.id("objects"),
    userId: v.string(),
    githubRepo: v.string(),
    githubLastSync: v.optional(v.number()),
  },
  handler: async (ctx, { projectId, userId, githubRepo, githubLastSync }) => {
    const doc = await ctx.db.get(projectId);
    if (!doc || doc.userId !== userId || doc.kind !== "project") {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(projectId, {
      githubRepo,
      githubLastSync: githubLastSync ?? Date.now(),
      modifiedAt: Date.now(),
    });
  },
});

export const applyGithubSyncToProject = internalMutation({
  args: {
    projectId: v.id("objects"),
    userId: v.string(),
    githubLastSync: v.number(),
    lastActivity: v.optional(v.number()),
    syncBlockers: v.array(v.string()),
  },
  handler: async (ctx, { projectId, userId, githubLastSync, lastActivity, syncBlockers }) => {
    const doc = await ctx.db.get(projectId);
    if (!doc || doc.userId !== userId || doc.kind !== "project") {
      throw new Error("Unauthorized");
    }
    const patch: Record<string, unknown> = {
      githubLastSync,
      modifiedAt: Date.now(),
    };
    if (lastActivity) patch.lastActivity = lastActivity;
    if (syncBlockers.length > 0) {
      const manualBlockers = (doc.blockers ?? "").replace(/\[GitHub\][\s\S]*$/, "").trim();
      const ghSection = `[GitHub] ${syncBlockers.join("; ")}`;
      patch.blockers = manualBlockers ? `${manualBlockers}\n${ghSection}` : ghSection;
    }
    await ctx.db.patch(projectId, patch);
  },
});
