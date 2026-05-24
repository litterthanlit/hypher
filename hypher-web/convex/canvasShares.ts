import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { requireBetaAccess } from "./lib/auth";
import bcrypt from "bcryptjs";

const SLUG_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";

function randomSlug(length = 16): string {
  let s = "";
  for (let i = 0; i < length; i++) {
    s += SLUG_CHARS[Math.floor(Math.random() * SLUG_CHARS.length)];
  }
  return s;
}

function randomSecret(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const b64 = btoa(String.fromCharCode(...bytes));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function toClientObject(doc: Doc<"objects">) {
  const { _id, _creationTime, embedding: _e, embeddingText: _et, ...rest } = doc;
  return { ...rest, id: _id as string };
}

function toClientConnection(doc: Doc<"connections">) {
  const { _id, _creationTime, ...rest } = doc;
  return {
    id: _id as string,
    sourceId: rest.sourceId,
    targetId: rest.targetId,
    sourceKind: rest.sourceKind,
    targetKind: rest.targetKind,
    type: rest.type,
    confidence: rest.confidence,
    reason: rest.reason,
    createdAt: rest.createdAt,
  };
}

/** Owner: create a share link. Returns slug and secret token once (include in URL query). */
export const create = mutation({
  args: { projectId: v.string(), label: v.optional(v.string()) },
  handler: async (ctx, { projectId, label }) => {
    const userId = await requireBetaAccess(ctx);
    const project = await ctx.db.get(projectId as Id<"objects">);
    if (!project || project.userId !== userId || project.kind !== "project") {
      throw new Error("Project not found");
    }

    let publicSlug = randomSlug();
    for (let attempt = 0; attempt < 5; attempt++) {
      const clash = await ctx.db
        .query("canvasShares")
        .withIndex("by_publicSlug", (q) => q.eq("publicSlug", publicSlug))
        .first();
      if (!clash) break;
      publicSlug = randomSlug();
    }

    const secret = randomSecret();
    const tokenHash = await bcrypt.hash(secret, 10);

    await ctx.db.insert("canvasShares", {
      userId,
      projectId,
      publicSlug,
      tokenHash,
      label,
      createdAt: Date.now(),
    });

    return { publicSlug, secret, shareUrlQuery: `s=${publicSlug}&t=${encodeURIComponent(secret)}` };
  },
});

export const listForProject = query({
  args: { projectId: v.string() },
  handler: async (ctx, { projectId }) => {
    const userId = await requireBetaAccess(ctx);
    const rows = await ctx.db
      .query("canvasShares")
      .withIndex("by_user_project", (q) => q.eq("userId", userId).eq("projectId", projectId))
      .collect();
    return rows
      .filter((r) => !r.revokedAt)
      .map((r) => ({
        id: r._id,
        publicSlug: r.publicSlug,
        label: r.label,
        createdAt: r.createdAt,
        previewUrl: `/share/s/${r.publicSlug}`,
      }));
  },
});

export const revoke = mutation({
  args: { shareId: v.id("canvasShares") },
  handler: async (ctx, { shareId }) => {
    const userId = await requireBetaAccess(ctx);
    const row = await ctx.db.get(shareId);
    if (!row || row.userId !== userId) throw new Error("Unauthorized");
    await ctx.db.patch(shareId, { revokedAt: Date.now() });
  },
});

/**
 * Unauthenticated: validate slug + token and return canvas snapshot (no embeddings).
 */
export const getPublicSnapshot = query({
  args: { publicSlug: v.string(), token: v.string() },
  handler: async (ctx, { publicSlug, token }) => {
    const row = await ctx.db
      .query("canvasShares")
      .withIndex("by_publicSlug", (q) => q.eq("publicSlug", publicSlug))
      .first();
    if (!row || row.revokedAt) return null;

    const ok = await bcrypt.compare(token, row.tokenHash);
    if (!ok) return null;

    const project = await ctx.db.get(row.projectId as Id<"objects">);
    if (!project || project.kind !== "project" || project.userId !== row.userId) {
      return null;
    }

    const childObjects = await ctx.db
      .query("objects")
      .withIndex("by_projectId", (q) => q.eq("projectId", row.projectId))
      .collect();

    const userChildren = childObjects.filter((o) => o.userId === row.userId);
    const userObjects =
      project && project.userId === row.userId
        ? [project, ...userChildren.filter((o) => o._id !== project._id)]
        : userChildren;
    const connections = await ctx.db
      .query("connections")
      .withIndex("by_user", (q) => q.eq("userId", row.userId))
      .collect();

    const itemIds = new Set(userObjects.map((o) => o._id as string));
    const relevantConns = connections.filter(
      (c) =>
        (c.type === "manual" || c.type === "ai_confirmed") &&
        itemIds.has(c.sourceId) &&
        itemIds.has(c.targetId)
    );

    return {
      project: toClientObject(project),
      objects: userObjects.map(toClientObject),
      connections: relevantConns.map(toClientConnection),
    };
  },
});
