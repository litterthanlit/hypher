import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

export const syncObjectTags = mutation({
  args: {
    userId: v.string(),
    objectId: v.string(),
    oldTags: v.array(v.string()),
    newTags: v.array(v.string()),
  },
  handler: async (ctx, { userId, objectId, oldTags, newTags }) => {
    // Remove objectId from old tags no longer present
    for (const tag of oldTags) {
      if (!newTags.includes(tag)) {
        const existing = await ctx.db
          .query("tags")
          .withIndex("by_name", (q) => q.eq("userId", userId).eq("name", tag))
          .first();
        if (existing) {
          const updated = existing.objectIds.filter((id) => id !== objectId);
          if (updated.length === 0) {
            await ctx.db.delete(existing._id);
          } else {
            await ctx.db.patch(existing._id, { objectIds: updated });
          }
        }
      }
    }

    // Add objectId to new tags
    for (const tag of newTags) {
      if (!oldTags.includes(tag)) {
        const existing = await ctx.db
          .query("tags")
          .withIndex("by_name", (q) => q.eq("userId", userId).eq("name", tag))
          .first();
        if (existing) {
          if (!existing.objectIds.includes(objectId)) {
            await ctx.db.patch(existing._id, {
              objectIds: [...existing.objectIds, objectId],
            });
          }
        } else {
          await ctx.db.insert("tags", {
            userId,
            name: tag,
            objectIds: [objectId],
            createdAt: Date.now(),
          });
        }
      }
    }
  },
});

export const listWithCounts = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const tags = await ctx.db
      .query("tags")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    return tags
      .map((t) => ({
        name: t.name,
        count: t.objectIds.length,
      }))
      .sort((a, b) => b.count - a.count);
  },
});

export const getObjectsByTag = query({
  args: { userId: v.string(), tag: v.string() },
  handler: async (ctx, { userId, tag }) => {
    const tagDoc = await ctx.db
      .query("tags")
      .withIndex("by_name", (q) => q.eq("userId", userId).eq("name", tag))
      .first();

    if (!tagDoc) return [];

    const objects = await Promise.all(
      tagDoc.objectIds.map((id) => ctx.db.get(id as Id<"objects">))
    );

    return objects.filter(Boolean);
  },
});
