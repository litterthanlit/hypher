import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireUserId } from "./lib/auth";

const planValidator = v.union(v.literal("pro_monthly"), v.literal("lifetime"));

export const getMine = query({
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    return await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
  },
});

/**
 * Called from Next.js after Stripe webhook verification.
 * Secured with STRIPE_CONVEX_SHARED_SECRET (same value in Convex + Next).
 */
export const applyStripeSync = mutation({
  args: {
    serverSecret: v.string(),
    stripeCustomerId: v.string(),
    userId: v.string(),
    stripeSubscriptionId: v.optional(v.string()),
    status: v.string(),
    plan: v.optional(planValidator),
    currentPeriodEnd: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const expected = process.env.STRIPE_CONVEX_SHARED_SECRET;
    if (!expected || args.serverSecret !== expected) {
      throw new Error("Unauthorized");
    }

    const {
      serverSecret: _ignored,
      stripeCustomerId,
      userId,
      stripeSubscriptionId,
      status,
      plan,
      currentPeriodEnd,
    } = args;
    const now = Date.now();

    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_stripe_customer", (q) => q.eq("stripeCustomerId", stripeCustomerId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        userId,
        stripeSubscriptionId,
        status,
        plan,
        currentPeriodEnd,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("subscriptions", {
      userId,
      stripeCustomerId,
      stripeSubscriptionId,
      status,
      plan,
      currentPeriodEnd,
      updatedAt: now,
    });
  },
});
