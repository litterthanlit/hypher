import { mutation, query, type MutationCtx } from "./_generated/server";
import { requireBetaAccess } from "./lib/auth";

type OnboardingPatch = {
  onboardingWelcomeSeenAt?: number;
  onboardingTourCompletedAt?: number;
};

async function patchUserMeta(
  ctx: MutationCtx,
  userId: string,
  patch: OnboardingPatch
) {
  const existing = await ctx.db
    .query("userMeta")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();

  if (existing) {
    await ctx.db.patch(existing._id, patch);
    return existing._id;
  }

  return await ctx.db.insert("userMeta", {
    userId,
    legacyClaimed: false,
    ...patch,
  });
}

export const getState = query({
  handler: async (ctx) => {
    const userId = await requireBetaAccess(ctx);
    const meta = await ctx.db
      .query("userMeta")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    return {
      demoSeeded: meta?.demoSeeded ?? false,
      onboardingWelcomeSeenAt: meta?.onboardingWelcomeSeenAt,
      onboardingTourCompletedAt: meta?.onboardingTourCompletedAt,
    };
  },
});

export const markWelcomeSeen = mutation({
  handler: async (ctx) => {
    const userId = await requireBetaAccess(ctx);
    const now = Date.now();
    await patchUserMeta(ctx, userId, { onboardingWelcomeSeenAt: now });
    return { onboardingWelcomeSeenAt: now };
  },
});

export const markTourCompleted = mutation({
  handler: async (ctx) => {
    const userId = await requireBetaAccess(ctx);
    const now = Date.now();
    await patchUserMeta(ctx, userId, {
      onboardingWelcomeSeenAt: now,
      onboardingTourCompletedAt: now,
    });
    return {
      onboardingWelcomeSeenAt: now,
      onboardingTourCompletedAt: now,
    };
  },
});
