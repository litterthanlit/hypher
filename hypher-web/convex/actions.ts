import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireBetaAccess } from "./lib/auth";

const actionStatus = v.union(
  v.literal("suggested"),
  v.literal("accepted"),
  v.literal("completed"),
  v.literal("dismissed")
);

const sourceType = v.union(
  v.literal("project_memory"),
  v.literal("agent_event"),
  v.literal("manual"),
  v.literal("github")
);

function toClientAction(action: any) {
  const { _id, _creationTime, ...rest } = action;
  return { ...rest, id: String(_id) };
}

function normalizedTitle(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

async function requireProject(ctx: any, projectId: any, userId: string) {
  const project = await ctx.db.get(projectId);
  if (!project || project.userId !== userId || project.kind !== "project") {
    throw new Error("Invalid project");
  }
}

async function findDuplicateAction(ctx: any, userId: string, projectId: any, title: string) {
  const key = normalizedTitle(title);
  if (!key) return null;
  const rows = await ctx.db
    .query("actions")
    .withIndex("by_user_project", (q: any) => q.eq("userId", userId).eq("projectId", projectId))
    .collect();
  return rows.find((action: any) => (
    action.status !== "completed"
    && action.status !== "dismissed"
    && normalizedTitle(action.title) === key
  )) ?? null;
}

export const listForProject = query({
  args: { projectId: v.id("objects") },
  handler: async (ctx, { projectId }) => {
    const userId = await requireBetaAccess(ctx);
    await requireProject(ctx, projectId, userId);
    const rows = await ctx.db
      .query("actions")
      .withIndex("by_user_project", (q) => q.eq("userId", userId).eq("projectId", projectId))
      .collect();
    return rows.sort((a, b) => b.updatedAt - a.updatedAt).map(toClientAction);
  },
});

export const create = mutation({
  args: {
    projectId: v.id("objects"),
    title: v.string(),
    status: actionStatus,
    sourceType,
    sourceId: v.optional(v.string()),
    rationale: v.optional(v.string()),
    createdAt: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await requireBetaAccess(ctx);
    await requireProject(ctx, args.projectId, userId);
    const duplicate = await findDuplicateAction(ctx, userId, args.projectId, args.title);
    if (duplicate) return duplicate._id;
    return await ctx.db.insert("actions", {
      userId,
      projectId: args.projectId,
      title: args.title,
      status: args.status,
      sourceType: args.sourceType,
      sourceId: args.sourceId,
      rationale: args.rationale,
      createdAt: args.createdAt,
      updatedAt: args.createdAt,
    });
  },
});

export const updateStatus = mutation({
  args: {
    actionId: v.id("actions"),
    status: actionStatus,
    updatedAt: v.number(),
  },
  handler: async (ctx, { actionId, status, updatedAt }) => {
    const userId = await requireBetaAccess(ctx);
    const action = await ctx.db.get(actionId);
    if (!action || action.userId !== userId) throw new Error("Unauthorized");
    await ctx.db.patch(actionId, {
      status,
      updatedAt,
      completedAt: status === "completed" ? updatedAt : action.completedAt,
    });
  },
});

export const createFromAgentSuggestion = mutation({
  args: {
    eventId: v.id("agentEvents"),
    projectId: v.id("objects"),
    title: v.string(),
    createdAt: v.number(),
  },
  handler: async (ctx, { eventId, projectId, title, createdAt }) => {
    const userId = await requireBetaAccess(ctx);
    await requireProject(ctx, projectId, userId);
    const event = await ctx.db.get(eventId);
    if (!event || event.userId !== userId) throw new Error("Invalid event");
    const duplicate = await findDuplicateAction(ctx, userId, projectId, title);
    if (duplicate) return duplicate._id;
    return await ctx.db.insert("actions", {
      userId,
      projectId,
      title,
      status: "suggested",
      sourceType: "agent_event",
      sourceId: String(eventId),
      createdAt,
      updatedAt: createdAt,
    });
  },
});

export const createFromMemoryAction = mutation({
  args: {
    projectId: v.id("objects"),
    memoryActionId: v.string(),
    title: v.string(),
    rationale: v.optional(v.string()),
    status: v.union(v.literal("suggested"), v.literal("accepted"), v.literal("dismissed")),
    createdAt: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await requireBetaAccess(ctx);
    await requireProject(ctx, args.projectId, userId);
    const duplicate = await findDuplicateAction(ctx, userId, args.projectId, args.title);
    if (duplicate) return duplicate._id;
    return await ctx.db.insert("actions", {
      userId,
      projectId: args.projectId,
      title: args.title,
      status: args.status,
      sourceType: "project_memory",
      sourceId: args.memoryActionId,
      rationale: args.rationale,
      createdAt: args.createdAt,
      updatedAt: args.createdAt,
    });
  },
});
