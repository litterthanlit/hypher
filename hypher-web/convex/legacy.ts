import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { isAdminUserId, requireUserId } from "./lib/auth";

const LEGACY_USER_ID = "default";
const GLOBAL_LEGACY_MIGRATION_LOCK_USER_ID = "__legacy_migration_global__";

export function isLegacyScopedUserId(userId: string | undefined | null): boolean {
  return userId == null || userId === LEGACY_USER_ID;
}

export function isGlobalLegacyMigrationLock(userId: string): boolean {
  return userId === GLOBAL_LEGACY_MIGRATION_LOCK_USER_ID;
}

export const getLegacyStatus = query({
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const meta = await ctx.db
      .query("userMeta")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const global = await ctx.db
      .query("userMeta")
      .withIndex("by_user", (q) => q.eq("userId", GLOBAL_LEGACY_MIGRATION_LOCK_USER_ID))
      .first();
    return { legacyClaimed: meta?.legacyClaimed ?? false, globalLegacyClaimed: global?.legacyClaimed ?? false };
  },
});

/**
 * Internal one-time migration: assigns legacy-scoped rows to an explicit target user.
 * It is globally idempotent, admin-gated by env, and writes an activity audit row.
 */
export const claimLegacyData = internalMutation({
  args: {
    requestedBy: v.string(),
    targetUserId: v.string(),
  },
  handler: async (ctx, { requestedBy, targetUserId }) => {
    if (!isAdminUserId(requestedBy)) {
      throw new Error("Admin access required");
    }
    if (!targetUserId || isLegacyScopedUserId(targetUserId) || isGlobalLegacyMigrationLock(targetUserId)) {
      throw new Error("Invalid migration target");
    }

    const lock = await ctx.db
      .query("userMeta")
      .withIndex("by_user", (q) => q.eq("userId", GLOBAL_LEGACY_MIGRATION_LOCK_USER_ID))
      .first();
    if (lock?.legacyClaimed) {
      return { claimed: false as const, reason: "already_claimed" as const };
    }

    const counts = {
      objects: 0,
      connections: 0,
      activity: 0,
      tags: 0,
      apiKeys: 0,
      githubTokens: 0,
    };

    const objects = await ctx.db.query("objects").collect();
    for (const o of objects) {
      if (isLegacyScopedUserId(o.userId)) {
        await ctx.db.patch(o._id, { userId: targetUserId });
        counts.objects++;
      }
    }

    const connections = await ctx.db.query("connections").collect();
    for (const c of connections) {
      if (isLegacyScopedUserId(c.userId)) {
        await ctx.db.patch(c._id, { userId: targetUserId });
        counts.connections++;
      }
    }

    const activity = await ctx.db.query("activity").collect();
    for (const a of activity) {
      if (isLegacyScopedUserId(a.userId)) {
        await ctx.db.patch(a._id, { userId: targetUserId });
        counts.activity++;
      }
    }

    const tags = await ctx.db.query("tags").collect();
    for (const t of tags) {
      if (t.userId === LEGACY_USER_ID) {
        await ctx.db.patch(t._id, { userId: targetUserId });
        counts.tags++;
      }
    }

    const keys = await ctx.db.query("apiKeys").collect();
    for (const k of keys) {
      if (k.userId === LEGACY_USER_ID) {
        await ctx.db.patch(k._id, { userId: targetUserId });
        counts.apiKeys++;
      }
    }

    const gh = await ctx.db.query("githubTokens").collect();
    for (const g of gh) {
      if (g.userId === LEGACY_USER_ID) {
        await ctx.db.patch(g._id, { userId: targetUserId });
        counts.githubTokens++;
      }
    }

    if (lock) {
      await ctx.db.patch(lock._id, { legacyClaimed: true });
    } else {
      await ctx.db.insert("userMeta", {
        userId: GLOBAL_LEGACY_MIGRATION_LOCK_USER_ID,
        legacyClaimed: true,
      });
    }

    const targetMeta = await ctx.db
      .query("userMeta")
      .withIndex("by_user", (q) => q.eq("userId", targetUserId))
      .first();
    if (targetMeta) {
      await ctx.db.patch(targetMeta._id, { legacyClaimed: true });
    } else {
      await ctx.db.insert("userMeta", { userId: targetUserId, legacyClaimed: true });
    }

    await ctx.db.insert("activity", {
      userId: requestedBy,
      action: "legacy_migration_claimed",
      objectId: targetUserId,
      objectKind: "legacy_migration",
      objectName: JSON.stringify(counts),
      timestamp: Date.now(),
    });
    console.info("[hypher/legacy] migration claimed", {
      requestedBy,
      targetUserId,
      counts,
    });

    return { claimed: true as const, counts };
  },
});
