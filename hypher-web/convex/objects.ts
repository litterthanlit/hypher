import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  handler: async (ctx) => {
    return await ctx.db.query("objects").collect();
  },
});

export const listByProject = query({
  args: { projectId: v.string() },
  handler: async (ctx, { projectId }) => {
    return await ctx.db
      .query("objects")
      .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
      .collect();
  },
});

export const get = query({
  args: { id: v.id("objects") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

export const put = mutation({
  args: {
    id: v.optional(v.id("objects")),
    kind: v.union(v.literal("project"), v.literal("note"), v.literal("artifact")),
    createdAt: v.number(),
    modifiedAt: v.number(),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(v.string()),
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
  },
  handler: async (ctx, args) => {
    const { id, ...data } = args;
    if (id) {
      await ctx.db.patch(id, data);
      return id;
    }
    return await ctx.db.insert("objects", data);
  },
});

export const remove = mutation({
  args: { id: v.id("objects") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});
