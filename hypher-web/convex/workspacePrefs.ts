import { mutation, query, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { requireBetaAccess } from "./lib/auth";

const projectMode = v.union(
  v.literal("pulse"),
  v.literal("canvas"),
  v.literal("list")
);

type ProjectMode = "pulse" | "canvas" | "list";

const emptyProjectPrefs = {
  pinnedMode: null as ProjectMode | null,
  lastManualMode: null as ProjectMode | null,
  lastManualAt: null as number | null,
};

async function getGlobalRow(ctx: MutationCtx, userId: string) {
  const rows = await ctx.db
    .query("workspacePrefs")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  return rows.find((row) => row.projectId === undefined) ?? null;
}

export const getGlobal = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireBetaAccess(ctx);
    const rows = await ctx.db
      .query("workspacePrefs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const row = rows.find((r) => r.projectId === undefined);
    return {
      globalDefaultMode: row?.globalDefaultMode ?? ("pulse" as const),
    };
  },
});

export const getProject = query({
  args: { projectId: v.string() },
  handler: async (ctx, { projectId }) => {
    const userId = await requireBetaAccess(ctx);
    const row = await ctx.db
      .query("workspacePrefs")
      .withIndex("by_user_project", (q) =>
        q.eq("userId", userId).eq("projectId", projectId)
      )
      .first();
    if (!row) return emptyProjectPrefs;
    return {
      pinnedMode: row.pinnedMode ?? null,
      lastManualMode: row.lastManualMode ?? null,
      lastManualAt: row.lastManualAt ?? null,
    };
  },
});

async function upsertGlobalRow(ctx: MutationCtx, userId: string) {
  const existing = await getGlobalRow(ctx, userId);
  if (!existing) {
    await ctx.db.insert("workspacePrefs", {
      userId,
      globalDefaultMode: "pulse",
    });
  }
}

/** Idempotent bootstrap for global prefs row. */
export const ensureDefaults = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireBetaAccess(ctx);
    await upsertGlobalRow(ctx, userId);
  },
});

export const setLastManualMode = mutation({
  args: { projectId: v.string(), mode: projectMode },
  handler: async (ctx, { projectId, mode }) => {
    const userId = await requireBetaAccess(ctx);
    const now = Date.now();
    const existing = await ctx.db
      .query("workspacePrefs")
      .withIndex("by_user_project", (q) =>
        q.eq("userId", userId).eq("projectId", projectId)
      )
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { lastManualMode: mode, lastManualAt: now });
      return;
    }
    await ctx.db.insert("workspacePrefs", {
      userId,
      projectId,
      lastManualMode: mode,
      lastManualAt: now,
    });
  },
});

export const pinMode = mutation({
  args: { projectId: v.string(), mode: projectMode },
  handler: async (ctx, { projectId, mode }) => {
    const userId = await requireBetaAccess(ctx);
    const now = Date.now();
    const existing = await ctx.db
      .query("workspacePrefs")
      .withIndex("by_user_project", (q) =>
        q.eq("userId", userId).eq("projectId", projectId)
      )
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        pinnedMode: mode,
        lastManualMode: mode,
        lastManualAt: now,
      });
      return;
    }
    await ctx.db.insert("workspacePrefs", {
      userId,
      projectId,
      pinnedMode: mode,
      lastManualMode: mode,
      lastManualAt: now,
    });
  },
});

export const unpinMode = mutation({
  args: { projectId: v.string() },
  handler: async (ctx, { projectId }) => {
    const userId = await requireBetaAccess(ctx);
    const existing = await ctx.db
      .query("workspacePrefs")
      .withIndex("by_user_project", (q) =>
        q.eq("userId", userId).eq("projectId", projectId)
      )
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { pinnedMode: undefined });
    }
  },
});

export const setGlobalDefault = mutation({
  args: { mode: projectMode },
  handler: async (ctx, { mode }) => {
    const userId = await requireBetaAccess(ctx);
    const existing = await getGlobalRow(ctx, userId);
    if (existing) {
      await ctx.db.patch(existing._id, { globalDefaultMode: mode });
      return;
    }
    await ctx.db.insert("workspacePrefs", {
      userId,
      globalDefaultMode: mode,
    });
  },
});

/** One-time import from browser localStorage keys hypher-view-mode-*. */
export const migrateFromLocal = mutation({
  args: {
    entries: v.array(
      v.object({
        projectId: v.string(),
        mode: projectMode,
      })
    ),
  },
  handler: async (ctx, { entries }) => {
    const userId = await requireBetaAccess(ctx);
    await upsertGlobalRow(ctx, userId);
    const now = Date.now();
    for (const { projectId, mode } of entries) {
      const existing = await ctx.db
        .query("workspacePrefs")
        .withIndex("by_user_project", (q) =>
          q.eq("userId", userId).eq("projectId", projectId)
        )
        .first();
      if (existing) {
        if (!existing.lastManualMode) {
          await ctx.db.patch(existing._id, {
            lastManualMode: mode,
            lastManualAt: now,
          });
        }
        continue;
      }
      await ctx.db.insert("workspacePrefs", {
        userId,
        projectId,
        lastManualMode: mode,
        lastManualAt: now,
      });
    }
  },
});
