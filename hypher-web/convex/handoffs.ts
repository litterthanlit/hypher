import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireBetaAccess } from "./lib/auth";

const targetTool = v.union(
  v.literal("ChatGPT"),
  v.literal("Claude"),
  v.literal("Cursor"),
  v.literal("Windsurf"),
  v.literal("Linear"),
  v.literal("GitHub"),
  v.literal("GitHub Copilot"),
  v.literal("MCP tool"),
  v.literal("Manual")
);

const handoffStatus = v.union(
  v.literal("pending"),
  v.literal("used"),
  v.literal("completed"),
  v.literal("discarded")
);

function toClientHandoff(handoff: any) {
  const { _id, _creationTime, ...rest } = handoff;
  return { ...rest, id: String(_id) };
}

function stripUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined)
  ) as Partial<T>;
}

async function requireProject(ctx: any, projectId: any, userId: string) {
  const project = await ctx.db.get(projectId);
  if (!project || project.userId !== userId || project.kind !== "project") {
    throw new Error("Invalid project");
  }
}

export const listForProject = query({
  args: { projectId: v.id("objects"), limit: v.optional(v.number()) },
  handler: async (ctx, { projectId, limit }) => {
    const userId = await requireBetaAccess(ctx);
    await requireProject(ctx, projectId, userId);
    const rows = await ctx.db
      .query("handoffs")
      .withIndex("by_user_project", (q) => q.eq("userId", userId).eq("projectId", projectId))
      .collect();
    return rows
      .sort((a, b) => b.generatedAt - a.generatedAt)
      .slice(0, limit ?? 10)
      .map(toClientHandoff);
  },
});

export const create = mutation({
  args: {
    projectId: v.id("objects"),
    generatedAt: v.number(),
    targetTool,
    packetContent: v.string(),
    sourceCaptures: v.array(v.string()),
    requestedTask: v.string(),
    status: handoffStatus,
    userNotes: v.optional(v.string()),
    returnedAgentOutput: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireBetaAccess(ctx);
    await requireProject(ctx, args.projectId, userId);
    return await ctx.db.insert("handoffs", { ...args, userId });
  },
});

export const updateStatus = mutation({
  args: {
    handoffId: v.id("handoffs"),
    status: handoffStatus,
  },
  handler: async (ctx, { handoffId, status }) => {
    const userId = await requireBetaAccess(ctx);
    const handoff = await ctx.db.get(handoffId);
    if (!handoff || handoff.userId !== userId) throw new Error("Unauthorized");
    await ctx.db.patch(handoffId, { status });
  },
});

export const updateNotes = mutation({
  args: {
    handoffId: v.id("handoffs"),
    userNotes: v.optional(v.string()),
    returnedAgentOutput: v.optional(v.string()),
  },
  handler: async (ctx, { handoffId, userNotes, returnedAgentOutput }) => {
    const userId = await requireBetaAccess(ctx);
    const handoff = await ctx.db.get(handoffId);
    if (!handoff || handoff.userId !== userId) throw new Error("Unauthorized");
    await ctx.db.patch(handoffId, stripUndefined({ userNotes, returnedAgentOutput }));
  },
});
