import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import {
  applyReceiptToMemory,
  asProjectMemoryTargetTool,
  compileHeuristicMemory,
  mergeAcceptedNextActions,
  type SilentMemorySnapshot,
} from "../../shared/projectMemoryGenerate";

const _internal = internal as any;

type StoredCrystallized = {
  kind: "decision" | "constraint" | "do_not_do" | "current_task" | "open_action" | "acceptance_criterion" | "agent_warning" | "handoff_note";
  text: string;
  sourceType: "capture" | "handoff" | "returned_agent_output" | "user_note";
  sourceId?: string;
  suggestionId?: string;
  createdAt: number;
  status?: "active" | "stale" | "excluded";
  updatedAt?: number;
};

function storedCrystallized(items: SilentMemorySnapshot["acceptedCrystallizedSuggestions"]): StoredCrystallized[] {
  const kinds = new Set([
    "decision", "constraint", "do_not_do", "current_task", "open_action",
    "acceptance_criterion", "agent_warning", "handoff_note",
  ]);
  const sources = new Set(["capture", "handoff", "returned_agent_output", "user_note"]);
  const result: StoredCrystallized[] = [];
  for (const item of items) {
    if (!kinds.has(item.kind) || !sources.has(item.sourceType) || !item.text.trim()) continue;
    const status = item.status === "stale" || item.status === "excluded" || item.status === "active"
      ? item.status
      : "active";
    result.push({
      kind: item.kind as StoredCrystallized["kind"],
      text: item.text,
      sourceType: item.sourceType as StoredCrystallized["sourceType"],
      sourceId: item.sourceId,
      suggestionId: item.suggestionId,
      createdAt: item.createdAt,
      status,
      updatedAt: item.updatedAt,
    });
  }
  return result;
}

export function snapshotFromDoc(doc: {
  summary?: string;
  currentGoal?: string;
  currentDirection?: string;
  recentChanges?: string[];
  importantDecisions?: string[];
  constraints?: string[];
  openQuestions?: string[];
  activeTasks?: string[];
  blockers?: string[];
  staleAssumptions?: string[];
  handoffNotes?: string[];
  nextActions?: SilentMemorySnapshot["nextActions"];
  acceptedCrystallizedSuggestions?: SilentMemorySnapshot["acceptedCrystallizedSuggestions"];
} | null): SilentMemorySnapshot | null {
  if (!doc) return null;
  return {
    summary: doc.summary ?? "",
    currentGoal: doc.currentGoal,
    currentDirection: doc.currentDirection ?? "",
    recentChanges: doc.recentChanges ?? [],
    importantDecisions: doc.importantDecisions ?? [],
    constraints: doc.constraints ?? [],
    openQuestions: doc.openQuestions ?? [],
    activeTasks: doc.activeTasks ?? [],
    blockers: doc.blockers ?? [],
    staleAssumptions: doc.staleAssumptions ?? [],
    handoffNotes: doc.handoffNotes ?? [],
    nextActions: (doc.nextActions ?? []).map((action) => ({
      id: action.id,
      title: action.title,
      rationale: action.rationale,
      status: action.status,
      requiredContext: action.requiredContext,
      suggestedTargetTool: action.suggestedTargetTool,
      confidence: action.confidence,
      sourceCaptureIds: action.sourceCaptureIds,
      createdAt: action.createdAt,
      updatedAt: action.updatedAt,
    })),
    acceptedCrystallizedSuggestions: doc.acceptedCrystallizedSuggestions ?? [],
  };
}

function storedNextActions(
  projectId: string,
  existing: SilentMemorySnapshot | null,
  generated: SilentMemorySnapshot["nextActions"],
  now: number
) {
  const merged = mergeAcceptedNextActions(existing?.nextActions, generated, now);
  return merged.map((action, index) => ({
    id: action.id ?? `${projectId}:action:${index}:${now}`,
    title: action.title,
    rationale: action.rationale,
    requiredContext: action.requiredContext,
    suggestedTargetTool: asProjectMemoryTargetTool(action.suggestedTargetTool),
    confidence: action.confidence,
    sourceCaptureIds: action.sourceCaptureIds,
    status: action.status ?? "suggested",
    createdAt: action.createdAt ?? now,
    updatedAt: action.updatedAt ?? now,
  }));
}

export async function persistSilentMemory(
  ctx: MutationCtx,
  args: {
    userId: string;
    projectId: Id<"objects">;
    now: number;
    model: string;
    snapshot: SilentMemorySnapshot;
  }
) {
  const existingDoc = await ctx.db
    .query("projectMemories")
    .withIndex("by_user_project", (q) => q.eq("userId", args.userId).eq("projectId", args.projectId))
    .unique();
  const existing = snapshotFromDoc(existingDoc);
  const nextActions = storedNextActions(String(args.projectId), existing, args.snapshot.nextActions, args.now);
  const data = {
    projectId: args.projectId,
    summary: args.snapshot.summary,
    currentGoal: args.snapshot.currentGoal,
    currentDirection: args.snapshot.currentDirection,
    recentChanges: args.snapshot.recentChanges,
    importantDecisions: args.snapshot.importantDecisions,
    constraints: args.snapshot.constraints,
    openQuestions: args.snapshot.openQuestions,
    activeTasks: args.snapshot.activeTasks,
    blockers: args.snapshot.blockers,
    staleAssumptions: args.snapshot.staleAssumptions,
    handoffNotes: args.snapshot.handoffNotes,
    acceptedCrystallizedSuggestions: storedCrystallized(args.snapshot.acceptedCrystallizedSuggestions),
    nextActions,
    generatedAt: args.now,
    sourceUpdatedAt: args.now,
    lastUpdatedAt: args.now,
    model: args.model,
  };

  if (existingDoc) {
    await ctx.db.patch(existingDoc._id, data);
    return;
  }
  await ctx.db.insert("projectMemories", { ...data, userId: args.userId });
}

export async function scheduleProjectMemorySynthesis(
  ctx: { scheduler: { runAfter: (...args: any[]) => Promise<unknown> } },
  args: {
    userId: string;
    projectId: Id<"objects">;
    reason: "dump" | "writeback" | "manual";
  }
): Promise<void> {
  await ctx.scheduler.runAfter(0, _internal.projectMemoryActions.synthesize, args);
}

export async function ingestDumpIntoMemory(
  ctx: MutationCtx,
  args: {
    userId: string;
    projectId: Id<"objects">;
    content: string;
    now: number;
  }
): Promise<boolean> {
  const content = args.content.trim();
  if (!content) return false;
  const project = await ctx.db.get(args.projectId);
  if (!project || project.userId !== args.userId || project.kind !== "project") return false;
  const existingDoc = await ctx.db
    .query("projectMemories")
    .withIndex("by_user_project", (q) => q.eq("userId", args.userId).eq("projectId", args.projectId))
    .unique();
  const snapshot = compileHeuristicMemory({
    projectName: project.name ?? "Project",
    projectDescription: project.description,
    projectBlockers: project.blockers,
    items: [{ content }],
    existing: snapshotFromDoc(existingDoc),
    now: args.now,
  });
  await persistSilentMemory(ctx, {
    userId: args.userId,
    projectId: args.projectId,
    now: args.now,
    model: "generate+dump",
    snapshot,
  });
  await scheduleProjectMemorySynthesis(ctx, {
    userId: args.userId,
    projectId: args.projectId,
    reason: "dump",
  });
  return true;
}

export async function applyReceiptForEvent(
  ctx: MutationCtx,
  args: {
    userId: string;
    projectId: Id<"objects">;
    eventId: string;
    kind: string;
    source: string;
    title: string;
    body: string;
    suggestedActions?: string[];
    now: number;
  }
): Promise<boolean> {
  const project = await ctx.db.get(args.projectId);
  if (!project || project.userId !== args.userId || project.kind !== "project") {
    return false;
  }
  const existingDoc = await ctx.db
    .query("projectMemories")
    .withIndex("by_user_project", (q) => q.eq("userId", args.userId).eq("projectId", args.projectId))
    .unique();
  const applied = applyReceiptToMemory({
    existing: snapshotFromDoc(existingDoc),
    event: {
      id: args.eventId,
      kind: args.kind,
      source: args.source,
      title: args.title,
      body: args.body,
      suggestedActions: args.suggestedActions,
    },
    now: args.now,
  });
  if (!applied.applied) return false;
  await persistSilentMemory(ctx, {
    userId: args.userId,
    projectId: args.projectId,
    now: args.now,
    model: "generate+receipt",
    snapshot: applied.memory,
  });
  await scheduleProjectMemorySynthesis(ctx, {
    userId: args.userId,
    projectId: args.projectId,
    reason: "writeback",
  });
  return true;
}
