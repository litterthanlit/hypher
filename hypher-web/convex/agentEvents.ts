import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { requireBetaAccess } from "./lib/auth";
import { ratelimitConvex } from "./lib/rateLimit";
import { apiKeyProbeRateLimitKey } from "./apiKeys";
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

const STRING_LIMITS = {
  source: 120,
  project: 200,
  title: 200,
  body: 10_000,
  repo: 200,
  branch: 200,
  commitSha: 80,
  artifactUrl: 2_000,
  suggestedAction: 500,
} as const;
const MAX_SUGGESTED_ACTIONS = 10;

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

function cleanString(
  value: unknown,
  field: keyof typeof STRING_LIMITS
): { ok: true; value?: string } | { ok: false; error: string } {
  if (typeof value !== "string") return { ok: true, value: undefined };
  const cleaned = value.trim();
  if (!cleaned) return { ok: true, value: undefined };
  if (cleaned.length > STRING_LIMITS[field]) {
    return { ok: false, error: `${field} is too long` };
  }
  return { ok: true, value: cleaned };
}

function cleanStringArray(value: unknown):
  | { ok: true; value?: string[] }
  | { ok: false; error: string } {
  if (!Array.isArray(value)) return { ok: true, value: undefined };
  if (value.length > MAX_SUGGESTED_ACTIONS) {
    return { ok: false, error: "suggestedActions has too many items" };
  }
  const cleaned = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
  if (cleaned.some((item) => item.length > STRING_LIMITS.suggestedAction)) {
    return { ok: false, error: "suggestedActions item is too long" };
  }
  return { ok: true, value: cleaned.length > 0 ? cleaned : undefined };
}

export function validateAgentEventPayload(payload: unknown):
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
  const source = cleanString(data.source, "source");
  if (!source.ok) return source;
  if (!source.value) return { ok: false, error: "source is required" };
  const title = cleanString(data.title, "title");
  if (!title.ok) return title;
  if (!title.value) return { ok: false, error: "title is required" };
  const body = cleanString(data.body, "body");
  if (!body.ok) return body;
  if (!body.value) return { ok: false, error: "body is required" };
  const kind = typeof data.kind === "string" ? data.kind.trim() : undefined;
  if (!kind || !eventKinds.includes(kind as EventKind)) {
    return { ok: false, error: `kind must be one of ${eventKinds.join(", ")}` };
  }
  const project = cleanString(data.project, "project");
  if (!project.ok) return project;
  const suggestedActions = cleanStringArray(data.suggestedActions);
  if (!suggestedActions.ok) return suggestedActions;
  const repo = cleanString(data.repo, "repo");
  if (!repo.ok) return repo;
  const branch = cleanString(data.branch, "branch");
  if (!branch.ok) return branch;
  const commitSha = cleanString(data.commitSha, "commitSha");
  if (!commitSha.ok) return commitSha;
  const artifactUrl = cleanString(data.artifactUrl, "artifactUrl");
  if (!artifactUrl.ok) return artifactUrl;
  return {
    ok: true,
    value: {
      source: source.value,
      project: project.value,
      kind: kind as EventKind,
      title: title.value,
      body: body.value,
      suggestedActions: suggestedActions.value,
      repo: repo.value,
      branch: branch.value,
      commitSha: commitSha.value,
      artifactUrl: artifactUrl.value,
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
    const probeAllowed = await ratelimitConvex(
      apiKeyProbeRateLimitKey(apiKey),
      "api-key-validation",
      { requests: 30, window: "1m" }
    );
    if (!probeAllowed) {
      return { ok: false, status: 429, error: "Rate limited" };
    }

    const validatedKey = await ctx.runQuery(_internal.apiKeys.validate, { key: apiKey });
    if (!validatedKey) {
      return { ok: false, status: 401, error: "Unauthorized" };
    }
    const allowed = await ratelimitConvex(validatedKey.rateLimitKey, "agent-events", {
      requests: 120,
      window: "1h",
    });
    if (!allowed) {
      return { ok: false, status: 429, error: "Rate limited" };
    }

    const parsed = validateAgentEventPayload(payload);
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
    const userId = await requireBetaAccess(ctx);
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
    const userId = await requireBetaAccess(ctx);
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
    const userId = await requireBetaAccess(ctx);
    await requireEvent(ctx, eventId, userId);
    await ctx.db.patch(eventId, { status: "reviewed", reviewedAt });
  },
});

export const dismiss = mutation({
  args: { eventId: v.id("agentEvents"), reviewedAt: v.number() },
  handler: async (ctx, { eventId, reviewedAt }) => {
    const userId = await requireBetaAccess(ctx);
    await requireEvent(ctx, eventId, userId);
    await ctx.db.patch(eventId, { status: "dismissed", reviewedAt });
  },
});

export const moveToProject = mutation({
  args: { eventId: v.id("agentEvents"), projectId: v.id("objects") },
  handler: async (ctx, { eventId, projectId }) => {
    const userId = await requireBetaAccess(ctx);
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
    const userId = await requireBetaAccess(ctx);
    const event = await requireEvent(ctx, eventId, userId);
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
      source: event.source,
      captureType: "agent_output",
      captureStatus: "sorted",
      confirmedProjectId: String(projectId),
      projectId: String(projectId),
      reviewedAt: createdAt,
      createdAt,
      modifiedAt: createdAt,
    });
    await ctx.db.patch(eventId, { status: "accepted", reviewedAt: createdAt, projectId });
    return noteId;
  },
});
