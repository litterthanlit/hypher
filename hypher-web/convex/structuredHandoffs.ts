import { action, internalMutation, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./lib/generatedApiGap";
import type { Id } from "./_generated/dataModel";
import { normalizeGitHubRepo } from "../shared/githubRepo";
import {
  runAsApiKeyUser,
  runAsOAuthUser,
  runAsSessionUser,
  touchOnOk,
  touchOnOkOrFailedDelivery,
} from "./lib/authenticatedAction";
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
  validateDecisionTransition,
  type HandoffProposalV1,
  type StructuredHandoffHead,
} from "../shared/structuredHandoff";


const resumeArgs = {
  projectId: v.id("objects"),
  destinationProjectId: v.id("objects"),
  destination: v.string(),
  currentRepo: repoSnapshotValidator,
  result: v.union(v.literal("prepared"), v.literal("failed")),
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

function sameLinkedRepo(linked: string | undefined, supplied: string | undefined): boolean {
  const expected = linked && normalizeGitHubRepo(linked);
  const actual = supplied && normalizeGitHubRepo(supplied);
  return Boolean(expected && actual && expected.toLowerCase() === actual.toLowerCase());
}

function requestFingerprint(args: {
  proposal: HandoffProposalV1;
  source: string;
  title: string;
  body: string;
  repo?: string;
  expectedBaseRevision: number;
}): string {
  return JSON.stringify(args);
}

async function validateProposalSources(
  ctx: MutationCtx,
  userId: string,
  projectId: Id<"objects">,
  proposal: HandoffProposalV1
): Promise<{ error?: string; approvedSourceRefs: Set<string> }> {
  const approvedSourceRefs = new Set<string>();
  for (const source of proposal.sources) {
    if (source.kind === "capture") {
      let capture;
      try { capture = await ctx.db.get(source.sourceId as Id<"objects">); } catch { capture = null; }
      if (!capture || capture.userId !== userId || capture.kind === "project"
        || (capture.projectId !== String(projectId) && capture.confirmedProjectId !== String(projectId))
        || capture.captureStatus === "archived" || capture.stale || capture.excludeFromPackets) {
        return { error: `Capture source is unavailable in this project: ${source.ref}`, approvedSourceRefs };
      }
      if (capture.pinnedAsDecision) approvedSourceRefs.add(source.ref);
    } else if (source.kind === "agent_event") {
      let event;
      try { event = await ctx.db.get(source.sourceId as Id<"agentEvents">); } catch { event = null; }
      if (!event || event.userId !== userId || event.projectId !== projectId || event.status === "dismissed") {
        return { error: `Agent event source is unavailable in this project: ${source.ref}`, approvedSourceRefs };
      }
    }
  }
  return { approvedSourceRefs };
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
  const row = await ctx.db
    .query("handoffs")
    .withIndex("by_user_project_revision", (q) => q.eq("userId", userId).eq("projectId", projectId))
    .order("desc")
    .first();
  if (!row?.proposal || typeof row.revision !== "number" || !row.idempotencyKey || !row.sourceAgent) {
    return null;
  }
  const parsed = parseHandoffProposal(row.proposal, { allowPlaceholders: true });
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
    if (!sameLinkedRepo(project.githubRepo, parsed.value.repo.repository)
      || (args.repo && !sameLinkedRepo(project.githubRepo, args.repo))) {
      return { ok: false, status: 400, code: "wrong-project", error: "Handoff repository does not match the linked project." };
    }
    const loaded = await loadHead(ctx, args.userId, args.projectId);
    const idempotencyKey = args.idempotencyKey.trim();
    const fingerprint = requestFingerprint({
      proposal: parsed.value,
      source: args.source,
      title: args.title,
      body: args.body,
      repo: args.repo,
      expectedBaseRevision: args.expectedBaseRevision,
    });
    const existing = await ctx.db
      .query("handoffs")
      .withIndex("by_user_project_idempotency", (q) =>
        q.eq("userId", args.userId).eq("projectId", args.projectId).eq("idempotencyKey", idempotencyKey)
      )
      .first();
    if (existing?.requestFingerprint === fingerprint && typeof existing.revision === "number") {
      return withoutEmpty({
        ok: true, status: 200, code: "already-saved",
        handoffId: String(existing._id), eventId: existing.eventId ? String(existing.eventId) : undefined,
        revision: existing.revision, headRevision: loaded?.head.revision ?? existing.revision,
        matchedProjectId: String(args.projectId), matchedProjectName: project.name ?? "Project",
        needsReview: false, transfersCode: false, checksOut: false,
      });
    }
    const sources = await validateProposalSources(ctx, args.userId, args.projectId, parsed.value);
    if (sources.error) return { ok: false, status: 400, code: "invalid", error: sources.error };
    const transitionError = validateDecisionTransition(loaded?.head.proposal ?? null, parsed.value, sources.approvedSourceRefs);
    if (transitionError) return { ok: false, status: 400, code: "invalid", error: transitionError };
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
      requestFingerprint: fingerprint,
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
    await ctx.db.patch(handoffId, { eventId });
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
    if (!sameLinkedRepo(project.githubRepo, args.currentRepo.repository)) {
      return { ok: false, status: 400, code: "wrong-project", error: "Destination repository does not match the linked project." };
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

export const acknowledgeForUser = internalMutation({
  args: {
    userId: v.string(),
    projectId: v.id("objects"),
    receiptId: v.id("handoffDeliveries"),
    revision: v.number(),
    destination: v.string(),
    now: v.number(),
  },
  returns: structuredHandoffWireValidator,
  handler: async (ctx, args): Promise<Wire> => {
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== args.userId || project.kind !== "project") {
      return { ok: false, status: 400, code: "wrong-project", error: "project-not-found" };
    }
    const receipt = await ctx.db.get(args.receiptId);
    if (!receipt || receipt.userId !== args.userId || receipt.projectId !== args.projectId
      || receipt.revision !== args.revision || receipt.destination !== args.destination) {
      return { ok: false, status: 400, code: "invalid", error: "Receipt does not match this handoff." };
    }
    if (receipt.result === "acknowledged") {
      return { ok: true, status: 200, code: "already-acknowledged", revision: receipt.revision,
        receiptId: String(receipt._id), destination: receipt.destination, matchedProjectId: String(args.projectId) };
    }
    if (receipt.result !== "prepared") {
      return { ok: false, status: 409, code: "invalid", error: "Only a prepared handoff can be acknowledged." };
    }
    await ctx.db.patch(args.receiptId, { result: "acknowledged", acknowledgedAt: args.now });
    return { ok: true, status: 200, code: "acknowledged", revision: receipt.revision,
      receiptId: String(receipt._id), destination: receipt.destination, matchedProjectId: String(args.projectId) };
  },
});

async function acknowledgeForAuthenticatedUser(
  ctx: { runMutation: (...args: any[]) => Promise<Wire> },
  userId: string,
  args: { projectId: string; receiptId: string; revision: number; destination: string }
): Promise<Wire> {
  try {
    // Pick fields: callers pass credentials (apiKey, tokenHash, …) the mutation's validator rejects.
    return await ctx.runMutation(internal.structuredHandoffs.acknowledgeForUser, {
      projectId: args.projectId,
      receiptId: args.receiptId,
      revision: args.revision,
      destination: args.destination,
      userId,
      now: Date.now(),
    });
  } catch (error) {
    const invalid = invalidId(error);
    if (invalid) return invalid;
    throw error;
  }
}

const STRUCTURED_HANDOFF_LIMIT = { bucket: "structured-handoff", requests: 60, window: "1h" };
const STRUCTURED_HANDOFF_OAUTH_LIMIT = { bucket: "structured-handoff-oauth", requests: 60, window: "1h" };

export const acknowledgeFromApiRequest = action({
  args: { apiKey: v.string(), projectId: v.string(), receiptId: v.string(), revision: v.number(), destination: v.string() },
  returns: structuredHandoffWireValidator,
  handler: async (ctx, args): Promise<Wire> => await runAsApiKeyUser(
    ctx,
    { apiKey: args.apiKey, rateLimit: STRUCTURED_HANDOFF_LIMIT, touchWhen: touchOnOk },
    (userId) => acknowledgeForAuthenticatedUser(ctx, userId, args)
  ),
});

export const acknowledgeFromOAuthRequest = action({
  args: { tokenHash: v.string(), resource: v.string(), scope: v.string(), now: v.number(), projectId: v.string(), receiptId: v.string(), revision: v.number(), destination: v.string() },
  returns: structuredHandoffWireValidator,
  handler: async (ctx, args): Promise<Wire> => await runAsOAuthUser(
    ctx,
    { ...args, rateLimit: STRUCTURED_HANDOFF_OAUTH_LIMIT },
    (userId) => acknowledgeForAuthenticatedUser(ctx, userId, args)
  ),
});

export const acknowledgeFromSession = action({
  args: { projectId: v.string(), receiptId: v.string(), revision: v.number(), destination: v.string() },
  returns: structuredHandoffWireValidator,
  handler: async (ctx, args): Promise<Wire> => await runAsSessionUser(
    ctx,
    { rateLimit: STRUCTURED_HANDOFF_LIMIT },
    (userId) => acknowledgeForAuthenticatedUser(ctx, userId, args)
  ),
});

async function resumeForUser(
  ctx: { runMutation: (...args: any[]) => Promise<Wire> },
  userId: string,
  args: {
    projectId: string;
    destinationProjectId: string;
    destination: string;
    currentRepo: { branch: string; commit: string; dirty: boolean };
    result: "prepared" | "failed";
    reason?: string;
  }
): Promise<Wire> {
  try {
    return await ctx.runMutation(internal.structuredHandoffs.deliverForUser, {
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
    result: v.union(v.literal("prepared"), v.literal("failed")),
    reason: v.optional(v.string()),
  },
  returns: structuredHandoffWireValidator,
  handler: async (ctx, args): Promise<Wire> => await runAsApiKeyUser(
    ctx,
    { apiKey: args.apiKey, rateLimit: STRUCTURED_HANDOFF_LIMIT, touchWhen: touchOnOkOrFailedDelivery },
    (userId) => resumeForUser(ctx, userId, args)
  ),
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
    result: v.union(v.literal("prepared"), v.literal("failed")),
    reason: v.optional(v.string()),
  },
  returns: structuredHandoffWireValidator,
  handler: async (ctx, args): Promise<Wire> => await runAsOAuthUser(
    ctx,
    { ...args, rateLimit: STRUCTURED_HANDOFF_OAUTH_LIMIT },
    (userId) => resumeForUser(ctx, userId, args)
  ),
});

export const resumeFromSession = action({
  args: {
    projectId: v.string(),
    destinationProjectId: v.string(),
    destination: v.string(),
    currentRepo: repoSnapshotValidator,
    result: v.union(v.literal("prepared"), v.literal("failed")),
    reason: v.optional(v.string()),
  },
  returns: structuredHandoffWireValidator,
  handler: async (ctx, args): Promise<Wire> => await runAsSessionUser(
    ctx,
    { rateLimit: STRUCTURED_HANDOFF_LIMIT },
    (userId) => resumeForUser(ctx, userId, args)
  ),
});
