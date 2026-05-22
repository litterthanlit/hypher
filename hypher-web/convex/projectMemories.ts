import { query, mutation } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { requireUserId } from "./lib/auth";

const nextActionValidator = v.object({
  id: v.string(),
  title: v.string(),
  rationale: v.string(),
  requiredContext: v.optional(v.array(v.string())),
  suggestedTargetTool: v.optional(v.union(
    v.literal("ChatGPT"),
    v.literal("Claude"),
    v.literal("Cursor"),
    v.literal("Windsurf"),
    v.literal("Linear"),
    v.literal("GitHub"),
    v.literal("GitHub Copilot"),
    v.literal("MCP tool"),
    v.literal("Manual")
  )),
  confidence: v.optional(v.number()),
  sourceCaptureIds: v.optional(v.array(v.string())),
  status: v.union(v.literal("suggested"), v.literal("accepted"), v.literal("dismissed")),
  createdAt: v.number(),
  updatedAt: v.number(),
});

const acceptedCrystallizedSuggestionValidator = v.object({
  kind: v.union(
    v.literal("decision"),
    v.literal("constraint"),
    v.literal("do_not_do"),
    v.literal("current_task"),
    v.literal("open_action"),
    v.literal("acceptance_criterion"),
    v.literal("agent_warning"),
    v.literal("handoff_note")
  ),
  text: v.string(),
  sourceType: v.union(
    v.literal("capture"),
    v.literal("handoff"),
    v.literal("returned_agent_output"),
    v.literal("user_note")
  ),
  sourceId: v.optional(v.string()),
  suggestionId: v.optional(v.string()),
  createdAt: v.number(),
  status: v.optional(v.union(
    v.literal("active"),
    v.literal("stale"),
    v.literal("excluded")
  )),
  updatedAt: v.optional(v.number()),
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

function stripUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined)
  ) as Partial<T>;
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
    currentGoal: v.optional(v.string()),
    currentDirection: v.string(),
    recentChanges: v.array(v.string()),
    importantDecisions: v.optional(v.array(v.string())),
    constraints: v.optional(v.array(v.string())),
    openQuestions: v.array(v.string()),
    activeTasks: v.optional(v.array(v.string())),
    blockers: v.optional(v.array(v.string())),
    staleAssumptions: v.optional(v.array(v.string())),
    nextActions: v.array(nextActionValidator),
    generatedAt: v.number(),
    sourceUpdatedAt: v.number(),
    lastUpdatedAt: v.optional(v.number()),
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
      lastUpdatedAt: args.lastUpdatedAt ?? args.generatedAt,
      model: args.model,
      ...(args.currentGoal !== undefined ? { currentGoal: args.currentGoal } : {}),
      ...(args.importantDecisions !== undefined ? { importantDecisions: args.importantDecisions } : {}),
      ...(args.constraints !== undefined ? { constraints: args.constraints } : {}),
      ...(args.activeTasks !== undefined ? { activeTasks: args.activeTasks } : {}),
      ...(args.blockers !== undefined ? { blockers: args.blockers } : {}),
      ...(args.staleAssumptions !== undefined ? { staleAssumptions: args.staleAssumptions } : {}),
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

export const updateManual = mutation({
  args: {
    projectId: v.id("objects"),
    summary: v.optional(v.string()),
    currentGoal: v.optional(v.string()),
    currentDirection: v.optional(v.string()),
    importantDecisions: v.optional(v.array(v.string())),
    constraints: v.optional(v.array(v.string())),
    openQuestions: v.optional(v.array(v.string())),
    activeTasks: v.optional(v.array(v.string())),
    blockers: v.optional(v.array(v.string())),
    staleAssumptions: v.optional(v.array(v.string())),
    acceptanceCriteria: v.optional(v.array(v.string())),
    agentWarnings: v.optional(v.array(v.string())),
    handoffNotes: v.optional(v.array(v.string())),
    acceptedCrystallizedSuggestions: v.optional(v.array(acceptedCrystallizedSuggestionValidator)),
    updatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireProject(ctx, userId, args.projectId);

    const memory = await ctx.db
      .query("projectMemories")
      .withIndex("by_user_project", (q) => q.eq("userId", userId).eq("projectId", args.projectId))
      .unique();

    if (!memory) throw new Error("Memory not found");

    const { projectId, updatedAt, ...patch } = args;
    await ctx.db.patch(memory._id, stripUndefined({
      ...patch,
      lastUpdatedAt: updatedAt,
      generatedAt: updatedAt,
      model: memory.model === "manual" ? "manual" : `${memory.model}+manual`,
    }));
    const updated = await ctx.db.get(memory._id);
    return updated ? mapMemory(updated) : null;
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
