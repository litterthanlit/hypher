import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { requireUserId } from "./lib/auth";

export const syncObjectTags = mutation({
  args: {
    objectId: v.string(),
    oldTags: v.array(v.string()),
    newTags: v.array(v.string()),
  },
  handler: async (ctx, { objectId, oldTags, newTags }) => {
    const userId = await requireUserId(ctx);

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
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
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
  args: { tag: v.string() },
  handler: async (ctx, { tag }) => {
    const userId = await requireUserId(ctx);
    const tagDoc = await ctx.db
      .query("tags")
      .withIndex("by_name", (q) => q.eq("userId", userId).eq("name", tag))
      .first();

    if (!tagDoc) return [];

    const objects = await Promise.all(
      tagDoc.objectIds.map((id) => ctx.db.get(id as Id<"objects">))
    );

    return objects.filter((o) => o && o.userId === userId);
  },
});
