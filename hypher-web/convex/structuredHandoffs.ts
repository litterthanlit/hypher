import { action, internalMutation, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { requireActionBetaAccess } from "./lib/actionAuth";
import { ratelimitConvex } from "./lib/rateLimit";
import { apiKeyProbeRateLimitKey } from "./apiKeys";
import {
  handoffProposalValidator,
  repoSnapshotValidator,
  structuredHandoffWireValidator,
} from "./lib/structuredHandoffValidators";
import {
  commitStructuredHandoff,
  parseHandoffProposal,
  planHandoffDelivery,
  renderHandoffPacket,
  type HandoffProposalV1,
  type StructuredHandoffHead,
} from "../shared/structuredHandoff";

const _internal = internal as any;

const resumeArgs = {
  projectId: v.id("objects"),
  destinationProjectId: v.id("objects"),
  destination: v.string(),
  currentRepo: repoSnapshotValidator,
  result: v.union(v.literal("delivered"), v.literal("failed")),
  reason: v.optional(v.string()),
};

type Wire = {
  ok: boolean;
  status: number;
  code?: string;
  error?: string;
  eventId?: string;
  handoffId?: string;
  matchedProjectId?: string | null;
  matchedProjectName?: string;
  needsReview?: boolean;
  revision?: number;
  headRevision?: number;
  preservedRevision?: number;
  repoMatch?: boolean;
  warning?: string;
  transfersCode?: boolean;
  checksOut?: boolean;
  proposal?: HandoffProposalV1;
  repoSnapshot?: HandoffProposalV1["repo"];
  destination?: string;
  receiptId?: string;
};

function withoutEmpty(value: Wire): Wire {
  const entries = Object.entries(value).filter(([, item]) => item !== undefined);
  return Object.fromEntries(entries) as Wire;
}

function targetToolForSource(source: string) {
  const value = source.toLowerCase();
  if (value.includes("claude")) return "Claude" as const;
  if (value.includes("cursor")) return "Cursor" as const;
  return "MCP tool" as const;
}

function invalidId(error: unknown): Wire | null {
  const message = error instanceof Error ? error.message : String(error);
  if (
    message.includes("Expected ID")
    || message.includes("ArgumentValidationError")
    || message.includes("does not match validator")
  ) {
    return { ok: false, status: 400, code: "invalid", error: "Invalid project id" };
  }
  return null;
}

async function loadHead(
  ctx: MutationCtx,
  userId: string,
  projectId: Id<"objects">
): Promise<{ handoffId: Id<"handoffs">; head: StructuredHandoffHead } | null> {
  const rows = await ctx.db
    .query("handoffs")
    .withIndex("by_user_project_revision", (q) => q.eq("userId", userId).eq("projectId", projectId))
    .order("desc")
    .take(50);
  const row = rows.reduce<(typeof rows)[number] | null>((best, item) => {
    if (typeof item.revision !== "number") return best;
    if (!best || (best.revision ?? -1) < item.revision) return item;
    return best;
  }, null);
  if (!row?.proposal || typeof row.revision !== "number" || !row.idempotencyKey || !row.sourceAgent) {
    return null;
  }
  const parsed = parseHandoffProposal(row.proposal);
  if (!parsed.ok) return null;
  return {
    handoffId: row._id,
    head: {
      projectId: String(projectId),
      revision: row.revision,
      idempotencyKey: row.idempotencyKey,
      proposal: parsed.value,
      source: row.sourceAgent,
      savedAt: row.generatedAt,
    },
  };
}

export const commitForUser = internalMutation({
  args: {
    userId: v.string(),
    projectId: v.id("objects"),
    expectedBaseRevision: v.number(),
    idempotencyKey: v.string(),
    proposal: handoffProposalValidator,
    source: v.string(),
    title: v.string(),
    body: v.string(),
    repo: v.optional(v.string()),
    now: v.number(),
  },
  returns: structuredHandoffWireValidator,
  handler: async (ctx, args): Promise<Wire> => {
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== args.userId || project.kind !== "project") {
      return { ok: false, status: 400, code: "wrong-project", error: "project-not-found" };
    }
    const parsed = parseHandoffProposal(args.proposal);
    if (!parsed.ok) {
      return { ok: false, status: 400, code: "invalid", error: parsed.error };
    }
    const loaded = await loadHead(ctx, args.userId, args.projectId);
    const idempotencyKey = args.idempotencyKey.trim();
    const existing = await ctx.db
      .query("handoffs")
      .withIndex("by_user_project_idempotency", (q) =>
        q.eq("userId", args.userId).eq("projectId", args.projectId).eq("idempotencyKey", idempotencyKey)
      )
      .first();
    const planned = commitStructuredHandoff({
      projectId: String(args.projectId),
      headRevision: loaded?.head.revision ?? 0,
      existingKeyRevision: typeof existing?.revision === "number" ? existing.revision : null,
      expectedBaseRevision: args.expectedBaseRevision,
      idempotencyKey,
      proposal: parsed.value,
      source: args.source,
      savedAt: args.now,
    });
    if (!planned.ok) {
      return withoutEmpty({
        ok: false,
        status: planned.status,
        code: planned.code,
        error: planned.error,
        headRevision: planned.headRevision,
        revision: planned.revision,
        matchedProjectId: String(args.projectId),
        matchedProjectName: project.name ?? "Project",
      });
    }

    const handoffId = await ctx.db.insert("handoffs", {
      userId: args.userId,
      projectId: args.projectId,
      generatedAt: args.now,
      targetTool: targetToolForSource(args.source),
      packetContent: renderHandoffPacket(parsed.value),
      sourceCaptures: parsed.value.sources.map((item) => item.label ? `${item.label}: ${item.ref}` : item.ref),
      requestedTask: parsed.value.nextAction,
      status: "pending",
      schemaVersion: 1,
      revision: planned.head.revision,
      idempotencyKey: planned.head.idempotencyKey,
      sourceAgent: args.source,
      proposal: parsed.value,
    });
    const eventId = await ctx.db.insert("agentEvents", {
      userId: args.userId,
      projectId: args.projectId,
      source: args.source,
      kind: "handoff",
      title: args.title,
      body: args.body,
      suggestedActions: [parsed.value.nextAction],
      branch: parsed.value.repo.branch,
      commitSha: parsed.value.repo.commit,
      status: "reviewed",
      createdAt: args.now,
      reviewedAt: args.now,
      ...(args.repo ? { repo: args.repo } : {}),
    });
    return {
      ok: true,
      status: 200,
      code: "saved",
      eventId: String(eventId),
      handoffId: String(handoffId),
      matchedProjectId: String(args.projectId),
      matchedProjectName: project.name ?? "Project",
      needsReview: false,
      revision: planned.head.revision,
      headRevision: planned.head.revision,
      transfersCode: false,
      checksOut: false,
    };
  },
});

export const deliverForUser = internalMutation({
  args: {
    userId: v.string(),
    ...resumeArgs,
    now: v.number(),
  },
  returns: structuredHandoffWireValidator,
  handler: async (ctx, args): Promise<Wire> => {
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== args.userId || project.kind !== "project") {
      return { ok: false, status: 400, code: "wrong-project", error: "project-not-found" };
    }
    const destination = await ctx.db.get(args.destinationProjectId);
    if (!destination || destination.userId !== args.userId || destination.kind !== "project") {
      return {
        ok: false,
        status: 400,
        code: "wrong-project",
        error: "Destination project does not match the handoff project.",
      };
    }
    const loaded = await loadHead(ctx, args.userId, args.projectId);
    const planned = planHandoffDelivery({
      handoffProjectId: String(args.projectId),
      head: loaded?.head ?? null,
      destinationProjectId: String(args.destinationProjectId),
      destination: args.destination,
      currentRepo: args.currentRepo,
      result: args.result,
      reason: args.reason,
      createdAt: args.now,
    });
    if (!planned.receipt || !loaded) {
      return withoutEmpty({
        ok: false,
        status: planned.ok ? 400 : planned.status,
        code: planned.ok ? "invalid" : planned.code,
        error: planned.ok ? "Handoff delivery failed." : planned.error,
      });
    }
    const receiptId = await ctx.db.insert("handoffDeliveries", {
      userId: args.userId,
      projectId: args.projectId,
      handoffId: loaded.handoffId,
      revision: planned.receipt.revision,
      destination: planned.receipt.destination,
      result: planned.receipt.result,
      createdAt: args.now,
      ...(planned.receipt.reason ? { reason: planned.receipt.reason } : {}),
      ...(planned.receipt.repoWarning ? { repoWarning: planned.receipt.repoWarning } : {}),
    });
    return withoutEmpty({
      ok: planned.ok,
      status: planned.status,
      code: planned.code,
      error: planned.ok ? undefined : planned.error,
      handoffId: String(loaded.handoffId),
      matchedProjectId: String(args.projectId),
      matchedProjectName: project.name ?? "Project",
      revision: loaded.head.revision,
      preservedRevision: planned.ok ? undefined : planned.preservedRevision,
      repoMatch: planned.repoMatch,
      warning: planned.warning,
      transfersCode: false,
      checksOut: false,
      proposal: planned.proposal,
      repoSnapshot: planned.repoSnapshot,
      destination: planned.receipt.destination,
      receiptId: String(receiptId),
    });
  },
});

async function resumeForUser(
  ctx: { runMutation: (...args: any[]) => Promise<Wire> },
  userId: string,
  args: {
    projectId: string;
    destinationProjectId: string;
    destination: string;
    currentRepo: { branch: string; commit: string; dirty: boolean };
    result: "delivered" | "failed";
    reason?: string;
  }
): Promise<Wire> {
  try {
    return await ctx.runMutation(_internal.structuredHandoffs.deliverForUser, {
      userId,
      projectId: args.projectId,
      destinationProjectId: args.destinationProjectId,
      destination: args.destination,
      currentRepo: args.currentRepo,
      result: args.result,
      reason: args.reason,
      now: Date.now(),
    });
  } catch (error) {
    const invalid = invalidId(error);
    if (invalid) return invalid;
    throw error;
  }
}

export const resumeFromApiRequest = action({
  args: {
    apiKey: v.string(),
    projectId: v.string(),
    destinationProjectId: v.string(),
    destination: v.string(),
    currentRepo: repoSnapshotValidator,
    result: v.union(v.literal("delivered"), v.literal("failed")),
    reason: v.optional(v.string()),
  },
  returns: structuredHandoffWireValidator,
  handler: async (ctx, args): Promise<Wire> => {
    const probeAllowed = await ratelimitConvex(
      apiKeyProbeRateLimitKey(args.apiKey),
      "api-key-validation",
      { requests: 30, window: "1m" }
    );
    if (!probeAllowed) return { ok: false, status: 429, error: "Rate limited" };
    const validatedKey = await ctx.runQuery(_internal.apiKeys.validate, { key: args.apiKey }) as {
      userId: string;
      keyId: string;
      rateLimitKey: string;
    } | null;
    if (!validatedKey) return { ok: false, status: 401, error: "Unauthorized" };
    const allowed = await ratelimitConvex(validatedKey.rateLimitKey, "structured-handoff", {
      requests: 60,
      window: "1h",
    });
    if (!allowed) return { ok: false, status: 429, error: "Rate limited" };
    const result = await resumeForUser(ctx, validatedKey.userId, args);
    if (result.ok || result.code === "failed-delivery") {
      await ctx.runMutation(_internal.apiKeys.touch, { keyId: validatedKey.keyId });
    }
    return result;
  },
});

export const resumeFromOAuthRequest = action({
  args: {
    tokenHash: v.string(),
    resource: v.string(),
    scope: v.string(),
    now: v.number(),
    projectId: v.string(),
    destinationProjectId: v.string(),
    destination: v.string(),
    currentRepo: repoSnapshotValidator,
    result: v.union(v.literal("delivered"), v.literal("failed")),
    reason: v.optional(v.string()),
  },
  returns: structuredHandoffWireValidator,
  handler: async (ctx, args): Promise<Wire> => {
    const allowed = await ratelimitConvex(args.tokenHash, "structured-handoff-oauth", {
      requests: 60,
      window: "1h",
    });
    if (!allowed) return { ok: false, status: 429, error: "Rate limited" };
    const validated = await ctx.runQuery(_internal.oauth.userIdForAccessToken, {
      tokenHash: args.tokenHash,
      resource: args.resource,
      scope: args.scope,
      now: args.now,
    }) as { userId: string } | null;
    if (!validated) return { ok: false, status: 401, error: "Unauthorized" };
    return await resumeForUser(ctx, validated.userId, args);
  },
});

export const resumeFromSession = action({
  args: {
    projectId: v.string(),
    destinationProjectId: v.string(),
    destination: v.string(),
    currentRepo: repoSnapshotValidator,
    result: v.union(v.literal("delivered"), v.literal("failed")),
    reason: v.optional(v.string()),
  },
  returns: structuredHandoffWireValidator,
  handler: async (ctx, args): Promise<Wire> => {
    const userId = await requireActionBetaAccess(ctx);
    const allowed = await ratelimitConvex(userId, "structured-handoff", {
      requests: 60,
      window: "1h",
    });
    if (!allowed) return { ok: false, status: 429, error: "Rate limited" };
    return await resumeForUser(ctx, userId, args);
  },
});
