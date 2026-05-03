import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { requireUserId } from "./lib/auth";
import type { Id } from "./_generated/dataModel";

const eventKind = v.union(
  v.literal("handoff"),
  v.literal("build_log"),
  v.literal("question"),
  v.literal("suggestion"),
  v.literal("artifact"),
  v.literal("next_action")
);

const eventStatus = v.union(
  v.literal("new"),
  v.literal("reviewed"),
  v.literal("accepted"),
  v.literal("dismissed")
);

const _internal = internal as any;
const eventKinds = ["handoff", "build_log", "question", "suggestion", "artifact", "next_action"] as const;
type EventKind = (typeof eventKinds)[number];

const createFields = {
  userId: v.string(),
  projectId: v.optional(v.id("objects")),
  source: v.string(),
  kind: eventKind,
  title: v.string(),
  body: v.string(),
  suggestedActions: v.optional(v.array(v.string())),
  repo: v.optional(v.string()),
  branch: v.optional(v.string()),
  commitSha: v.optional(v.string()),
  artifactUrl: v.optional(v.string()),
  status: eventStatus,
  createdAt: v.number(),
};

function cleanString(value: unknown): string | undefined {
  return typeof value === "string" ? value.trim() : undefined;
}

function cleanStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const cleaned = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
  return cleaned.length > 0 ? cleaned : undefined;
}

function validatePayload(payload: unknown):
  | {
      ok: true;
      value: {
        source: string;
        project?: string;
        kind: EventKind;
        title: string;
        body: string;
        suggestedActions?: string[];
        repo?: string;
        branch?: string;
        commitSha?: string;
        artifactUrl?: string;
      };
    }
  | { ok: false; error: string } {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, error: "payload must be an object" };
  }
  const data = payload as Record<string, unknown>;
  const source = cleanString(data.source);
  if (!source) return { ok: false, error: "source is required" };
  const title = cleanString(data.title);
  if (!title) return { ok: false, error: "title is required" };
  const body = cleanString(data.body);
  if (!body) return { ok: false, error: "body is required" };
  const kind = cleanString(data.kind);
  if (!eventKinds.includes(kind as EventKind)) {
    return { ok: false, error: `kind must be one of ${eventKinds.join(", ")}` };
  }
  return {
    ok: true,
    value: {
      source,
      project: cleanString(data.project),
      kind: kind as EventKind,
      title,
      body,
      suggestedActions: cleanStringArray(data.suggestedActions),
      repo: cleanString(data.repo),
      branch: cleanString(data.branch),
      commitSha: cleanString(data.commitSha),
      artifactUrl: cleanString(data.artifactUrl),
    },
  };
}

function lower(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function matchProject(
  projects: Array<{ id: string; name?: string; githubRepo?: string }>,
  event: { repo?: string; project?: string }
) {
  const repo = lower(event.repo);
  if (repo) {
    const byRepo = projects.find((project) => lower(project.githubRepo) === repo);
    if (byRepo) return { id: byRepo.id, name: byRepo.name ?? "Project" };
  }
  const projectName = lower(event.project);
  if (!projectName) return null;
  const exact = projects.find((project) => lower(project.name) === projectName);
  if (exact) return { id: exact.id, name: exact.name ?? "Project" };
  const contains = projects.find((project) => {
    const name = lower(project.name);
    return name.length > 0 && (projectName.includes(name) || name.includes(projectName));
  });
  return contains ? { id: contains.id, name: contains.name ?? "Project" } : null;
}

function toClientEvent(event: any) {
  const { _id, _creationTime, ...rest } = event;
  return { ...rest, id: String(_id) };
}

async function requireEvent(ctx: any, eventId: Id<"agentEvents">, userId: string) {
  const event = await ctx.db.get(eventId);
  if (!event || event.userId !== userId) throw new Error("Unauthorized");
  return event;
}

export const createForApiUser = internalMutation({
  args: createFields,
  handler: async (ctx, args) => {
    return await ctx.db.insert("agentEvents", args);
  },
});

export const createFromApiRequest = action({
  args: { apiKey: v.string(), payload: v.any() },
  handler: async (ctx, { apiKey, payload }) => {
    const validatedKey = await ctx.runQuery(_internal.apiKeys.validate, { key: apiKey });
    if (!validatedKey) {
      return { ok: false, status: 401, error: "Invalid API key" };
    }

    const parsed = validatePayload(payload);
    if (!parsed.ok) {
      return { ok: false, status: 400, error: parsed.error };
    }

    const projects = await ctx.runQuery(_internal.agentEvents.listProjectsForApiUser, {
      userId: validatedKey.userId,
    });
    const matched = matchProject(projects, parsed.value);
    const now = Date.now();
    const eventId = await ctx.runMutation(_internal.agentEvents.createForApiUser, {
      userId: validatedKey.userId,
      projectId: matched?.id ? (matched.id as Id<"objects">) : undefined,
      source: parsed.value.source,
      kind: parsed.value.kind,
      title: parsed.value.title,
      body: parsed.value.body,
      suggestedActions: parsed.value.suggestedActions,
      repo: parsed.value.repo,
      branch: parsed.value.branch,
      commitSha: parsed.value.commitSha,
      artifactUrl: parsed.value.artifactUrl,
      status: "new",
      createdAt: now,
    });

    await ctx.runMutation(_internal.apiKeys.touch, { keyId: validatedKey.keyId });

    return {
      ok: true,
      status: 200,
      eventId: String(eventId),
      matchedProjectId: matched?.id ?? null,
      matchedProjectName: matched?.name,
      needsReview: !matched,
    };
  },
});

export const listProjectsForApiUser = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const rows = await ctx.db
      .query("objects")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return rows
      .filter((row) => row.kind === "project")
      .map((row) => ({
        id: String(row._id),
        name: row.name,
        githubRepo: row.githubRepo,
      }));
  },
});

export const listInbox = query({
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const rows = await ctx.db
      .query("agentEvents")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "new"))
      .collect();
    return rows
      .filter((event) => event.projectId === undefined)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(toClientEvent);
  },
});

export const listForProject = query({
  args: { projectId: v.id("objects"), limit: v.optional(v.number()) },
  handler: async (ctx, { projectId, limit }) => {
    const userId = await requireUserId(ctx);
    const rows = await ctx.db
      .query("agentEvents")
      .withIndex("by_user_project", (q) => q.eq("userId", userId).eq("projectId", projectId))
      .collect();
    return rows
      .filter((event) => event.status !== "dismissed")
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit ?? 5)
      .map(toClientEvent);
  },
});

export const markReviewed = mutation({
  args: { eventId: v.id("agentEvents"), reviewedAt: v.number() },
  handler: async (ctx, { eventId, reviewedAt }) => {
    const userId = await requireUserId(ctx);
    await requireEvent(ctx, eventId, userId);
    await ctx.db.patch(eventId, { status: "reviewed", reviewedAt });
  },
});

export const dismiss = mutation({
  args: { eventId: v.id("agentEvents"), reviewedAt: v.number() },
  handler: async (ctx, { eventId, reviewedAt }) => {
    const userId = await requireUserId(ctx);
    await requireEvent(ctx, eventId, userId);
    await ctx.db.patch(eventId, { status: "dismissed", reviewedAt });
  },
});

export const moveToProject = mutation({
  args: { eventId: v.id("agentEvents"), projectId: v.id("objects") },
  handler: async (ctx, { eventId, projectId }) => {
    const userId = await requireUserId(ctx);
    await requireEvent(ctx, eventId, userId);
    const project = await ctx.db.get(projectId);
    if (!project || project.userId !== userId || project.kind !== "project") {
      throw new Error("Invalid project");
    }
    await ctx.db.patch(eventId, { projectId });
  },
});

export const saveAsNote = mutation({
  args: {
    eventId: v.id("agentEvents"),
    projectId: v.id("objects"),
    content: v.string(),
    createdAt: v.number(),
  },
  handler: async (ctx, { eventId, projectId, content, createdAt }) => {
    const userId = await requireUserId(ctx);
    await requireEvent(ctx, eventId, userId);
    const project = await ctx.db.get(projectId);
    if (!project || project.userId !== userId || project.kind !== "project") {
      throw new Error("Invalid project");
    }
    const noteId = await ctx.db.insert("objects", {
      userId,
      kind: "note",
      content,
      maturity: "developing",
      tags: ["agent-update"],
      projectId: String(projectId),
      reviewedAt: createdAt,
      createdAt,
      modifiedAt: createdAt,
    });
    await ctx.db.patch(eventId, { status: "accepted", reviewedAt: createdAt, projectId });
    return noteId;
  },
});
