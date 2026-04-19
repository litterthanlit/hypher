import { query, mutation } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { requireUserId } from "./lib/auth";

const nextActionValidator = v.object({
  id: v.string(),
  title: v.string(),
  rationale: v.string(),
  status: v.union(v.literal("suggested"), v.literal("accepted"), v.literal("dismissed")),
  createdAt: v.number(),
  updatedAt: v.number(),
});

async function requireProject(ctx: QueryCtx | MutationCtx, userId: string, projectId: Id<"objects">) {
  const project = await ctx.db.get(projectId);
  if (!project || project.userId !== userId || project.kind !== "project") {
    throw new Error("Invalid project");
  }
  return project;
}

function mapMemory(doc: any) {
  const { _id, _creationTime, userId, ...rest } = doc;
  return { ...rest, id: _id };
}

export const listForDashboard = query({
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const rows = await ctx.db
      .query("projectMemories")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return rows.map(mapMemory);
  },
});

export const generationInput = query({
  args: { projectId: v.id("objects") },
  handler: async (ctx, { projectId }) => {
    const userId = await requireUserId(ctx);
    const project = await requireProject(ctx, userId, projectId);

    const objects = await ctx.db
      .query("objects")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const items = objects
      .filter((obj) => obj.projectId === projectId && obj.kind !== "project")
      .sort((a, b) => (b.modifiedAt ?? 0) - (a.modifiedAt ?? 0))
      .slice(0, 24)
      .map((obj) => {
        const { _id, _creationTime, userId: _userId, ...rest } = obj;
        return { ...rest, id: _id };
      });

    const activities = await ctx.db
      .query("activity")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .order("desc")
      .collect();

    const scopedActivities = activities
      .filter((entry) => entry.userId === userId)
      .slice(0, 24)
      .map((entry) => {
        const { _id, _creationTime, userId: _userId, ...rest } = entry;
        return { ...rest, id: _id };
      });

    const { _id, _creationTime, userId: _userId, ...projectRest } = project;
    return {
      project: { ...projectRest, id: _id },
      items,
      activities: scopedActivities,
      githubSummary: project.githubRepo
        ? [
            `Repository: ${project.githubRepo}`,
            project.githubLastSync ? `Last synced: ${new Date(project.githubLastSync).toISOString()}` : "Never synced",
            project.blockers?.includes("[GitHub]") ? project.blockers : "",
          ].filter(Boolean).join("\n")
        : undefined,
    };
  },
});

export const upsertGenerated = mutation({
  args: {
    projectId: v.id("objects"),
    summary: v.string(),
    currentDirection: v.string(),
    recentChanges: v.array(v.string()),
    openQuestions: v.array(v.string()),
    nextActions: v.array(nextActionValidator),
    generatedAt: v.number(),
    sourceUpdatedAt: v.number(),
    model: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireProject(ctx, userId, args.projectId);

    const existing = await ctx.db
      .query("projectMemories")
      .withIndex("by_user_project", (q) => q.eq("userId", userId).eq("projectId", args.projectId))
      .unique();

    const data = {
      projectId: args.projectId,
      summary: args.summary,
      currentDirection: args.currentDirection,
      recentChanges: args.recentChanges,
      openQuestions: args.openQuestions,
      nextActions: args.nextActions,
      generatedAt: args.generatedAt,
      sourceUpdatedAt: args.sourceUpdatedAt,
      model: args.model,
    };

    if (existing) {
      await ctx.db.patch(existing._id, data);
      return mapMemory({ ...existing, ...data });
    }

    const id = await ctx.db.insert("projectMemories", { ...data, userId });
    const inserted = await ctx.db.get(id);
    return inserted ? mapMemory(inserted) : null;
  },
});

export const updateNextActionStatus = mutation({
  args: {
    projectId: v.id("objects"),
    actionId: v.string(),
    status: v.union(v.literal("accepted"), v.literal("dismissed")),
    updatedAt: v.number(),
  },
  handler: async (ctx, { projectId, actionId, status, updatedAt }) => {
    const userId = await requireUserId(ctx);
    await requireProject(ctx, userId, projectId);

    const memory = await ctx.db
      .query("projectMemories")
      .withIndex("by_user_project", (q) => q.eq("userId", userId).eq("projectId", projectId))
      .unique();

    if (!memory) throw new Error("Memory not found");

    const nextActions = memory.nextActions.map((action) => (
      action.id === actionId ? { ...action, status, updatedAt } : action
    ));

    await ctx.db.patch(memory._id, { nextActions });
    return mapMemory({ ...memory, nextActions });
  },
});
