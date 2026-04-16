import { mutation, query } from "./_generated/server";
import { requireUserId } from "./lib/auth";

const LEGACY_USER_ID = "default";

function isLegacyScopedUserId(userId: string | undefined | null): boolean {
  return userId == null || userId === LEGACY_USER_ID;
}

export const getLegacyStatus = query({
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const meta = await ctx.db
      .query("userMeta")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    return { legacyClaimed: meta?.legacyClaimed ?? false };
  },
});

/**
 * One-time migration per user: assigns legacy-scoped rows to the signed-in user.
 * Idempotent via userMeta.legacyClaimed. userId is always from auth, never from args.
 */
export const claimLegacyData = mutation({
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);

    const meta = await ctx.db
      .query("userMeta")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (meta?.legacyClaimed) {
      return { claimed: false as const, reason: "already_claimed" as const };
    }

    const objects = await ctx.db.query("objects").collect();
    for (const o of objects) {
      if (isLegacyScopedUserId(o.userId)) {
        await ctx.db.patch(o._id, { userId });
      }
    }

    const connections = await ctx.db.query("connections").collect();
    for (const c of connections) {
      if (isLegacyScopedUserId(c.userId)) {
        await ctx.db.patch(c._id, { userId });
      }
    }

    const activity = await ctx.db.query("activity").collect();
    for (const a of activity) {
      if (isLegacyScopedUserId(a.userId)) {
        await ctx.db.patch(a._id, { userId });
      }
    }

    const tags = await ctx.db.query("tags").collect();
    for (const t of tags) {
      if (t.userId === LEGACY_USER_ID) {
        await ctx.db.patch(t._id, { userId });
      }
    }

    const keys = await ctx.db.query("apiKeys").collect();
    for (const k of keys) {
      if (k.userId === LEGACY_USER_ID) {
        await ctx.db.patch(k._id, { userId });
      }
    }

    const gh = await ctx.db.query("githubTokens").collect();
    for (const g of gh) {
      if (g.userId === LEGACY_USER_ID) {
        await ctx.db.patch(g._id, { userId });
      }
    }

    if (meta) {
      await ctx.db.patch(meta._id, { legacyClaimed: true });
    } else {
      await ctx.db.insert("userMeta", { userId, legacyClaimed: true });
    }

    return { claimed: true as const };
  },
});
