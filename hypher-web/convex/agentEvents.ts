import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { requireBetaAccess } from "./lib/auth";
import { requireActionBetaAccess } from "./lib/actionAuth";
import { ratelimitConvex } from "./lib/rateLimit";
import { apiKeyProbeRateLimitKey } from "./apiKeys";
import type { Id } from "./_generated/dataModel";
import { GITHUB_LOOP_SOURCE, planGithubLoopWrites } from "./lib/githubAgentEvents";
import { normalizeGitHubRepo } from "../shared/githubRepo";
import { isProductWorkReceipt } from "../shared/projectMemoryGenerate";
import { applyReceiptForEvent } from "./lib/projectMemoryWrite";

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
  externalKey: 200,
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
  reviewedAt: v.optional(v.number()),
  externalKey: v.optional(v.string()),
  autoResolved: v.optional(v.boolean()),
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
  const repo = lower(normalizeGitHubRepo(event.repo) ?? event.repo);
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

function prioritizeForPulse<T extends { status: string; kind: string; createdAt: number }>(
  events: T[],
  limit: number
): T[] {
  const rank = (event: T): number => {
    if (event.status === "new" && event.kind === "question") return 0;
    if (event.status === "new" && event.kind === "next_action") return 1;
    if (event.status === "new") return 2;
    if (event.kind === "question") return 3;
    return 4;
  };
  return events
    .filter((event) => event.status !== "dismissed")
    .slice()
    .sort((a, b) => {
      const delta = rank(a) - rank(b);
      if (delta !== 0) return delta;
      return b.createdAt - a.createdAt;
    })
    .slice(0, limit);
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

const writeResultValidator = v.object({
  ok: v.boolean(),
  status: v.optional(v.number()),
  error: v.optional(v.string()),
  eventId: v.optional(v.string()),
  matchedProjectId: v.optional(v.union(v.string(), v.null())),
  matchedProjectName: v.optional(v.string()),
  needsReview: v.optional(v.boolean()),
});

type WriteResult =
  | {
      ok: true;
      status: number;
      eventId: string;
      matchedProjectId: string | null;
      matchedProjectName?: string;
      needsReview: boolean;
    }
  | { ok: false; status: number; error: string };

const mcpEventPayloadValidator = v.object({
  source: v.string(),
  project: v.optional(v.string()),
  kind: eventKind,
  title: v.string(),
  body: v.string(),
  suggestedActions: v.optional(v.array(v.string())),
  repo: v.optional(v.string()),
  branch: v.optional(v.string()),
  commitSha: v.optional(v.string()),
  artifactUrl: v.optional(v.string()),
});

async function persistAgentEventForUser(
  ctx: any,
  userId: string,
  payload: unknown,
  projectId?: string
): Promise<WriteResult> {
  const parsed = validateAgentEventPayload(payload);
  if (!parsed.ok) {
    return { ok: false, status: 400, error: parsed.error };
  }

  const projects = await ctx.runQuery(_internal.agentEvents.listProjectsForApiUser, {
    userId,
  }) as Array<{ id: string; name?: string; githubRepo?: string }>;

  let matched: { id: string; name: string } | null = null;
  if (projectId) {
    const byId = projects.find((project) => project.id === projectId);
    if (!byId) {
      return { ok: false, status: 400, error: "project-not-found" };
    }
    matched = { id: byId.id, name: byId.name ?? "Project" };
  } else {
    matched = matchProject(projects, parsed.value);
  }

  const now = Date.now();
  const receipt = Boolean(matched && isProductWorkReceipt(parsed.value));
  const eventId = await ctx.runMutation(_internal.agentEvents.createForApiUser, {
    userId,
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
    status: receipt ? "reviewed" : "new",
    createdAt: now,
    reviewedAt: receipt ? now : undefined,
  });

  if (receipt && matched) {
    await ctx.runMutation(_internal.projectMemories.applyReceipt, {
      userId,
      projectId: matched.id,
      eventId: String(eventId),
      kind: parsed.value.kind,
      source: parsed.value.source,
      title: parsed.value.title,
      body: parsed.value.body,
      suggestedActions: parsed.value.suggestedActions,
      now,
    });
  }

  return {
    ok: true,
    status: 200,
    eventId: String(eventId),
    matchedProjectId: matched?.id ?? null,
    matchedProjectName: matched?.name,
    needsReview: !matched,
  };
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

    const persisted = await persistAgentEventForUser(ctx, validatedKey.userId, parsed.value);
    if (!persisted.ok) return persisted;

    await ctx.runMutation(_internal.apiKeys.touch, { keyId: validatedKey.keyId });

    return persisted;
  },
});

export const createFromOAuthRequest = action({
  args: {
    tokenHash: v.string(),
    resource: v.string(),
    scope: v.string(),
    now: v.number(),
    payload: mcpEventPayloadValidator,
    projectId: v.optional(v.string()),
  },
  returns: writeResultValidator,
  handler: async (ctx, args): Promise<WriteResult> => {
    const allowed = await ratelimitConvex(args.tokenHash, "agent-events-oauth", {
      requests: 120,
      window: "1h",
    });
    if (!allowed) {
      return { ok: false, status: 429, error: "Rate limited" };
    }

    const validated = await ctx.runQuery(_internal.oauth.userIdForAccessToken, {
      tokenHash: args.tokenHash,
      resource: args.resource,
      scope: args.scope,
      now: args.now,
    }) as { userId: string } | null;
    if (!validated) {
      return { ok: false, status: 401, error: "Unauthorized" };
    }

    return await persistAgentEventForUser(ctx, validated.userId, args.payload, args.projectId);
  },
});

export const createFromSession = action({
  args: {
    payload: mcpEventPayloadValidator,
    projectId: v.optional(v.string()),
  },
  returns: writeResultValidator,
  handler: async (ctx, args): Promise<WriteResult> => {
    const userId = await requireActionBetaAccess(ctx);
    const allowed = await ratelimitConvex(userId, "agent-events", {
      requests: 120,
      window: "1h",
    });
    if (!allowed) {
      return { ok: false, status: 429, error: "Rate limited" };
    }
    return await persistAgentEventForUser(ctx, userId, args.payload, args.projectId);
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
    return prioritizeForPulse(rows, limit ?? 8).map(toClientEvent);
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
    const event = await requireEvent(ctx, eventId, userId);
    const project = await ctx.db.get(projectId);
    if (!project || project.userId !== userId || project.kind !== "project") {
      throw new Error("Invalid project");
    }
    await ctx.db.patch(eventId, { projectId });
    if (isProductWorkReceipt(event)) {
      const now = Date.now();
      await applyReceiptForEvent(ctx, {
        userId,
        projectId,
        eventId: String(eventId),
        kind: event.kind,
        source: event.source,
        title: event.title,
        body: event.body,
        suggestedActions: event.suggestedActions,
        now,
      });
      await ctx.db.patch(eventId, { status: "reviewed", reviewedAt: now });
    }
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

function normalizeTitle(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const cleaned = normalizeTitle(value);
    const key = cleaned.toLowerCase();
    if (!cleaned || seen.has(key)) continue;
    seen.add(key);
    result.push(cleaned);
  }
  return result;
}

function summarizeEvent(title: string, body: string): string {
  const heading = normalizeTitle(title);
  const details = normalizeTitle(body);
  if (!details || details === heading) return heading.slice(0, 180);
  const combined = `${heading}. ${details}`;
  return combined.length <= 180 ? combined : `${combined.slice(0, 179).trimEnd()}...`;
}

export const accept = mutation({
  args: {
    eventId: v.id("agentEvents"),
    projectId: v.id("objects"),
    acceptedAt: v.number(),
  },
  returns: v.object({
    actionCount: v.number(),
    memoryUpdated: v.boolean(),
    handoffUpdated: v.boolean(),
  }),
  handler: async (ctx, { eventId, projectId, acceptedAt }) => {
    const userId = await requireBetaAccess(ctx);
    const event = await requireEvent(ctx, eventId, userId);
    const project = await ctx.db.get(projectId);
    if (!project || project.userId !== userId || project.kind !== "project") {
      throw new Error("Invalid project");
    }

    const suggested = uniqueStrings(event.suggestedActions ?? []);
    const actionTitles = suggested.length > 0
      ? suggested
      : (event.kind === "next_action" || event.kind === "suggestion")
        ? uniqueStrings([event.title])
        : [];

    const existingActions = await ctx.db
      .query("actions")
      .withIndex("by_user_project", (q) => q.eq("userId", userId).eq("projectId", projectId))
      .collect();
    let actionCount = 0;
    for (const title of actionTitles) {
      const key = title.toLowerCase();
      const duplicate = existingActions.find((action) => (
        action.status !== "completed"
        && action.status !== "dismissed"
        && normalizeTitle(action.title).toLowerCase() === key
      ));
      if (duplicate) continue;
      const inserted = await ctx.db.insert("actions", {
        userId,
        projectId,
        title,
        status: "suggested",
        sourceType: "agent_event",
        sourceId: String(eventId),
        createdAt: acceptedAt,
        updatedAt: acceptedAt,
      });
      existingActions.push({
        _id: inserted,
        userId,
        projectId,
        title,
        status: "suggested",
        sourceType: "agent_event",
        sourceId: String(eventId),
        createdAt: acceptedAt,
        updatedAt: acceptedAt,
      } as typeof existingActions[number]);
      actionCount += 1;
    }

    const summary = summarizeEvent(event.title, event.body);
    const memory = await ctx.db
      .query("projectMemories")
      .withIndex("by_user_project", (q) => q.eq("userId", userId).eq("projectId", projectId))
      .unique();

    let memoryUpdated = false;
    const memoryPatch: Record<string, unknown> = {
      lastUpdatedAt: acceptedAt,
      generatedAt: acceptedAt,
    };

    if (event.kind === "question" && summary) {
      const openQuestions = [...(memory?.openQuestions ?? [])];
      if (!openQuestions.some((item) => normalizeTitle(item).toLowerCase() === summary.toLowerCase())) {
        openQuestions.push(summary);
        memoryPatch.openQuestions = openQuestions;
        memoryUpdated = true;
      }
    }

    if (
      (event.kind === "handoff" || event.kind === "build_log" || event.kind === "artifact")
      && summary
    ) {
      const handoffNotes = [...(memory?.handoffNotes ?? [])];
      if (!handoffNotes.some((item) => normalizeTitle(item).toLowerCase() === summary.toLowerCase())) {
        handoffNotes.push(summary);
        memoryPatch.handoffNotes = handoffNotes;
        memoryUpdated = true;
      }
      const accepted = [...(memory?.acceptedCrystallizedSuggestions ?? [])];
      const already = accepted.some((item) => item.sourceId === String(eventId) && item.kind === "handoff_note");
      if (!already) {
        accepted.push({
          kind: "handoff_note",
          text: summary,
          sourceType: "handoff",
          sourceId: String(eventId),
          suggestionId: `accept-${String(eventId)}`,
          createdAt: acceptedAt,
          status: "active",
          updatedAt: acceptedAt,
        });
        memoryPatch.acceptedCrystallizedSuggestions = accepted;
        memoryUpdated = true;
      }
    }

    if (memoryUpdated) {
      if (memory) {
        await ctx.db.patch(memory._id, {
          ...memoryPatch,
          model: memory.model === "manual" ? "manual" : `${memory.model}+manual`,
        });
      } else {
        await ctx.db.insert("projectMemories", {
          userId,
          projectId,
          summary: "Accepted from agent writeback.",
          currentDirection: "",
          recentChanges: [],
          openQuestions: (memoryPatch.openQuestions as string[] | undefined) ?? [],
          ...(memoryPatch.handoffNotes ? { handoffNotes: memoryPatch.handoffNotes as string[] } : {}),
          ...(memoryPatch.acceptedCrystallizedSuggestions
            ? { acceptedCrystallizedSuggestions: memoryPatch.acceptedCrystallizedSuggestions as NonNullable<typeof memory>["acceptedCrystallizedSuggestions"] }
            : {}),
          nextActions: [],
          generatedAt: acceptedAt,
          sourceUpdatedAt: acceptedAt,
          lastUpdatedAt: acceptedAt,
          model: "manual",
        });
      }
    }

    const handoffs = await ctx.db
      .query("handoffs")
      .withIndex("by_user_project", (q) => q.eq("userId", userId).eq("projectId", projectId))
      .collect();
    const pending = handoffs
      .filter((row) => row.status === "pending")
      .sort((a, b) => b.generatedAt - a.generatedAt)[0];
    let handoffUpdated = false;
    if (pending && summary) {
      await ctx.db.patch(pending._id, {
        returnedAgentOutput: summary,
        ...(event.kind === "handoff" ? { status: "used" as const } : {}),
      });
      handoffUpdated = true;
    }

    await ctx.db.patch(eventId, {
      status: "accepted",
      reviewedAt: acceptedAt,
      projectId,
    });

    return { actionCount, memoryUpdated, handoffUpdated };
  },
});

const githubSignalValidator = v.object({
  externalKey: v.string(),
  kind: v.union(v.literal("question"), v.literal("build_log")),
  title: v.string(),
  body: v.string(),
});

export const upsertGithubLoopEvents = internalMutation({
  args: {
    userId: v.string(),
    projectId: v.id("objects"),
    repo: v.string(),
    createdAt: v.number(),
    signals: v.array(githubSignalValidator),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== args.userId || project.kind !== "project") {
      throw new Error("Invalid project");
    }
    const rows = await ctx.db
      .query("agentEvents")
      .withIndex("by_user_project", (q) => q.eq("userId", args.userId).eq("projectId", args.projectId))
      .collect();
    const existing = rows.filter((row) => row.source === GITHUB_LOOP_SOURCE && row.externalKey);
    const writes = planGithubLoopWrites({
      signals: args.signals,
      existing: existing.map((row) => ({
        externalKey: row.externalKey,
        status: row.status,
        autoResolved: row.autoResolved,
        title: row.title,
        body: row.body,
      })),
    });

    for (const write of writes) {
      if (write.op === "insert") {
        await ctx.db.insert("agentEvents", {
          userId: args.userId,
          projectId: args.projectId,
          source: GITHUB_LOOP_SOURCE,
          kind: write.signal.kind,
          title: write.signal.title,
          body: write.signal.body,
          repo: args.repo,
          externalKey: write.signal.externalKey,
          autoResolved: false,
          status: "new",
          createdAt: args.createdAt,
        });
        continue;
      }
      const row = existing.find((item) => item.externalKey === write.externalKey);
      if (!row) continue;
      const patch: Record<string, unknown> = {};
      if (write.status) patch.status = write.status;
      if (write.autoResolved !== undefined) patch.autoResolved = write.autoResolved;
      if (write.title) patch.title = write.title;
      if (write.body) patch.body = write.body;
      if (write.status === "dismissed") patch.reviewedAt = args.createdAt;
      await ctx.db.patch(row._id, patch);
    }
  },
});
