import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  runAsApiKeyUser,
  runAsOAuthUser,
  runAsSessionUser,
  touchOnOk,
} from "./lib/authenticatedAction";
import {
  agentSynthesisModel,
  buildSynthesisInput,
  PROJECT_MEMORY_COMPILED_JSON_MAX,
  snapshotForGeneratedUpsert,
  snapshotFromCompiledJson,
  unwrapProjectMemoryJson,
  type SilentMemorySourceEvent,
  type SilentMemorySnapshot,
} from "../shared/projectMemoryGenerate";

const writeResultValidator = v.object({
  ok: v.boolean(),
  status: v.optional(v.number()),
  error: v.optional(v.string()),
  projectId: v.optional(v.string()),
  identityKind: v.optional(v.literal("compiled")),
  model: v.optional(v.string()),
});

export type AgentMemoryWriteResult =
  | {
      ok: true;
      status: number;
      projectId: string;
      identityKind: "compiled";
      model: string;
    }
  | { ok: false; status: number; error: string };

type GenerationInput = {
  project: {
    id: string;
    name: string;
    description: string;
    status?: string;
    blockers?: string;
  };
  items: Array<{ id: string; name: string; content: string; modifiedAt: number }>;
  events: SilentMemorySourceEvent[];
  memory: SilentMemorySnapshot | null;
};

type ActionCtx = {
  runQuery: (...args: any[]) => Promise<unknown>;
  runMutation: (...args: any[]) => Promise<unknown>;
};

export async function persistAgentCompiledMemoryForUser(
  ctx: ActionCtx,
  args: {
    userId: string;
    projectId: string;
    compiledJson: string;
    source?: string;
    now?: number;
  }
): Promise<AgentMemoryWriteResult> {
  const compiledJson = unwrapProjectMemoryJson(args.compiledJson);
  if (!compiledJson) {
    return { ok: false, status: 400, error: "missing-compiled-memory" };
  }
  if (compiledJson.length > PROJECT_MEMORY_COMPILED_JSON_MAX) {
    return { ok: false, status: 400, error: "compiled-json-too-large" };
  }

  const projects = await ctx.runQuery(internal.agentEvents.listProjectsForApiUser, {
    userId: args.userId,
  }) as Array<{ id: string; name?: string }>;
  const matched = projects.find((project) => project.id === args.projectId);
  if (!matched) {
    return { ok: false, status: 400, error: "project-not-found" };
  }

  let input: GenerationInput | null;
  try {
    input = await ctx.runQuery(internal.projectMemories.generationInputForUser, {
      userId: args.userId,
      projectId: matched.id as Id<"objects">,
    }) as GenerationInput | null;
  } catch {
    return { ok: false, status: 400, error: "project-not-found" };
  }
  if (!input) {
    return { ok: false, status: 400, error: "project-not-found" };
  }

  const now = args.now ?? Date.now();
  const built = buildSynthesisInput({
    project: input.project,
    items: input.items,
    events: input.events,
    existing: input.memory,
    identityMemory: input.memory
      ? { summary: input.memory.summary, model: undefined }
      : null,
    now,
  });
  const compiled = snapshotFromCompiledJson({
    heuristic: built.generationInput.heuristic,
    compiledText: compiledJson,
    now,
    dumpTexts: input.items.map((item) => item.content).filter(Boolean),
  });
  if (!compiled.ok) {
    return { ok: false, status: 400, error: compiled.error };
  }

  const model = agentSynthesisModel(args.source);
  await ctx.runMutation(internal.projectMemories.upsertGeneratedForUser, {
    userId: args.userId,
    projectId: matched.id as Id<"objects">,
    snapshot: snapshotForGeneratedUpsert(matched.id, compiled.snapshot, now),
    generatedAt: now,
    model,
  });

  return {
    ok: true,
    status: 200,
    projectId: matched.id,
    identityKind: "compiled",
    model,
  };
}

const AGENT_WRITE_LIMIT = { bucket: "project-memory-agent-write", requests: 40, window: "1h" };
const AGENT_WRITE_OAUTH_LIMIT = { bucket: "project-memory-agent-write-oauth", requests: 40, window: "1h" };

export const writeCompiledFromApiRequest = action({
  args: {
    apiKey: v.string(),
    projectId: v.string(),
    compiledJson: v.string(),
    source: v.optional(v.string()),
  },
  returns: writeResultValidator,
  handler: async (ctx, args): Promise<AgentMemoryWriteResult> => await runAsApiKeyUser(
    ctx,
    { apiKey: args.apiKey, rateLimit: AGENT_WRITE_LIMIT, touchWhen: touchOnOk },
    (userId) => persistAgentCompiledMemoryForUser(ctx, {
      userId,
      projectId: args.projectId,
      compiledJson: args.compiledJson,
      source: args.source,
    })
  ),
});

export const writeCompiledFromOAuthRequest = action({
  args: {
    tokenHash: v.string(),
    resource: v.string(),
    scope: v.string(),
    now: v.number(),
    projectId: v.string(),
    compiledJson: v.string(),
    source: v.optional(v.string()),
  },
  returns: writeResultValidator,
  handler: async (ctx, args): Promise<AgentMemoryWriteResult> => await runAsOAuthUser(
    ctx,
    { ...args, rateLimit: AGENT_WRITE_OAUTH_LIMIT },
    (userId) => persistAgentCompiledMemoryForUser(ctx, {
      userId,
      projectId: args.projectId,
      compiledJson: args.compiledJson,
      source: args.source,
    })
  ),
});

export const writeCompiledFromSession = action({
  args: {
    projectId: v.string(),
    compiledJson: v.string(),
    source: v.optional(v.string()),
  },
  returns: writeResultValidator,
  handler: async (ctx, args): Promise<AgentMemoryWriteResult> => await runAsSessionUser(
    ctx,
    { rateLimit: AGENT_WRITE_LIMIT },
    (userId) => persistAgentCompiledMemoryForUser(ctx, {
      userId,
      projectId: args.projectId,
      compiledJson: args.compiledJson,
      source: args.source,
    })
  ),
});
