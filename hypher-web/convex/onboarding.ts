import { mutation, query } from "./_generated/server";
import { requireUserId } from "./lib/auth";

export const getOnboardingStatus = query({
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const meta = await ctx.db
      .query("userMeta")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    return { onboardingComplete: meta?.onboardingComplete ?? false };
  },
});

export const setOnboardingComplete = mutation({
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const meta = await ctx.db
      .query("userMeta")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (meta) {
      if (!meta.onboardingComplete) {
        await ctx.db.patch(meta._id, { onboardingComplete: true });
      }
    } else {
      await ctx.db.insert("userMeta", {
        userId,
        legacyClaimed: false,
        onboardingComplete: true,
      });
    }
    return { ok: true };
  },
});
