import { mutation } from "./_generated/server";
import { requireUserId } from "./lib/auth";

const LEGACY_USER_ID = "default";

/**
 * One-time migration: assigns unscoped rows to the signed-in user.
 * Safe to call multiple times — no-ops if this user already owns data.
 */
export const claimLegacyData = mutation({
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);

    const alreadyHasData = await ctx.db
      .query("objects")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (alreadyHasData) {
      return { claimed: false as const, reason: "already_initialized" as const };
    }

    const objects = await ctx.db.query("objects").collect();
    for (const o of objects) {
      if (o.userId === undefined) {
        await ctx.db.patch(o._id, { userId });
      }
    }

    const connections = await ctx.db.query("connections").collect();
    for (const c of connections) {
      if (c.userId === undefined) {
        await ctx.db.patch(c._id, { userId });
      }
    }

    const activity = await ctx.db.query("activity").collect();
    for (const a of activity) {
      if (a.userId === undefined) {
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

    return { claimed: true as const };
  },
});
