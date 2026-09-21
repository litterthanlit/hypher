import { v } from "convex/values";

export const repoSnapshotValidator = v.object({
  repository: v.optional(v.string()),
  branch: v.string(),
  commit: v.string(),
  dirty: v.boolean(),
  worktreePath: v.optional(v.string()),
  dirtyFingerprint: v.optional(v.string()),
});

export const handoffProposalValidator = v.object({
  schemaVersion: v.literal(1),
  goal: v.string(),
  constraints: v.array(v.string()),
  decisions: v.array(v.object({
    decision: v.string(),
    reason: v.string(),
    status: v.optional(v.union(v.literal("reported"), v.literal("approved"))),
    sourceRefs: v.optional(v.array(v.string())),
    supersedes: v.optional(v.string()),
  })),
  completed: v.array(v.string()),
  unverified: v.array(v.string()),
  blockers: v.array(v.string()),
  nextAction: v.string(),
  sources: v.array(v.object({
    ref: v.string(),
    label: v.optional(v.string()),
    kind: v.optional(v.union(v.literal("agent_report"), v.literal("capture"), v.literal("agent_event"))),
    sourceId: v.optional(v.string()),
  })),
  repo: repoSnapshotValidator,
});

export const handoffResumeValidator = v.object({
  destination: v.string(),
  destinationProjectId: v.optional(v.string()),
  currentRepo: repoSnapshotValidator,
  result: v.optional(v.union(v.literal("delivered"), v.literal("prepared"), v.literal("failed"))),
  reason: v.optional(v.string()),
});

export const structuredHandoffWireValidator = v.object({
  ok: v.boolean(),
  status: v.number(),
  code: v.optional(v.string()),
  error: v.optional(v.string()),
  eventId: v.optional(v.string()),
  handoffId: v.optional(v.string()),
  matchedProjectId: v.optional(v.union(v.string(), v.null())),
  matchedProjectName: v.optional(v.string()),
  needsReview: v.optional(v.boolean()),
  revision: v.optional(v.number()),
  headRevision: v.optional(v.number()),
  preservedRevision: v.optional(v.number()),
  repoMatch: v.optional(v.boolean()),
  warning: v.optional(v.string()),
  transfersCode: v.optional(v.boolean()),
  checksOut: v.optional(v.boolean()),
  proposal: v.optional(handoffProposalValidator),
  repoSnapshot: v.optional(repoSnapshotValidator),
  destination: v.optional(v.string()),
  receiptId: v.optional(v.string()),
});
