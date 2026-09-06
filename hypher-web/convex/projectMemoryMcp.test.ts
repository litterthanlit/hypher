import { describe, expect, it } from "vitest";
import { persistAgentCompiledMemoryForUser } from "./projectMemoryMcp";
import type { SilentMemorySnapshot } from "../shared/projectMemoryGenerate";

const NOW = 1_700_000_000_000;
const dump = "Shipped the gate. Empty state still broken. Don't widen OAuth. Next: thicken identity on the agent.";

const heuristicMemory: SilentMemorySnapshot = {
  summary: "Shipped the gate. Empty state still broken.",
  currentGoal: "thicken identity on the agent",
  currentDirection: "Shipped the gate. Empty state still broken.",
  recentChanges: ["Shipped the gate."],
  importantDecisions: [],
  constraints: ["Don't widen OAuth."],
  openQuestions: [],
  activeTasks: ["thicken identity on the agent"],
  blockers: [],
  staleAssumptions: [],
  handoffNotes: [],
  nextActions: [{
    title: "thicken identity on the agent",
    rationale: "Compiled from the latest dump or writeback.",
    status: "suggested",
    createdAt: NOW,
    updatedAt: NOW,
  }],
  acceptedCrystallizedSuggestions: [],
};

const generationInput = {
  project: {
    id: "p1",
    name: "Hypher",
    description: "Project memory under agents.",
  },
  items: [{ id: "n1", name: dump.slice(0, 80), content: dump, modifiedAt: NOW }],
  events: [{
    id: "e1",
    kind: "handoff",
    source: "github",
    title: "CI failed on main",
    body: "Signal only.",
  }],
  memory: heuristicMemory,
};

const compiled = {
  summary: "Hypher keeps project identity across agent sessions.",
  currentGoal: "Thicken the brief without hosting a model in Hypher.",
  currentDirection: "Product stays dump → one note → writeback.",
  recentChanges: ["Silent dump still writes a heuristic note."],
  importantDecisions: ["Pulse stays three panels."],
  constraints: ["Do not widen OAuth.", "Do not rebuild the canvas."],
  openQuestions: [],
  activeTasks: ["Write compiled identity back once."],
  blockers: [],
  staleAssumptions: [],
  nextActions: [{
    title: "Call write_project_memory once",
    rationale: "Hypher stores the compiled note.",
  }],
};

function mockCtx(options?: { projects?: Array<{ id: string }>; input?: typeof generationInput | null }) {
  const upserts: unknown[] = [];
  return {
    upserts,
    ctx: {
      runQuery: async (_ref: unknown, args: { projectId?: string }) => {
        if (args && "projectId" in args) return options?.input === undefined ? generationInput : options.input;
        return options?.projects ?? [{ id: "p1", name: "Hypher" }];
      },
      runMutation: async (_ref: unknown, args: unknown) => {
        upserts.push(args);
      },
    },
  };
}

describe("persistAgentCompiledMemoryForUser", () => {
  it("merges compiled JSON and upserts durable memory without Anthropic", async () => {
    const { ctx, upserts } = mockCtx();
    const result = await persistAgentCompiledMemoryForUser(ctx, {
      userId: "u1",
      projectId: "p1",
      compiledJson: JSON.stringify(compiled),
      source: "cursor",
      now: NOW,
    });

    expect(result).toMatchObject({
      ok: true,
      projectId: "p1",
      identityKind: "compiled",
      model: "agent-synthesis:cursor",
    });
    expect(upserts).toHaveLength(1);
    const payload = upserts[0] as {
      model: string;
      snapshot: { summary: string; constraints: string[]; nextActions: Array<{ title: string }> };
    };
    expect(payload.model).toBe("agent-synthesis:cursor");
    expect(payload.snapshot.summary).toBe(compiled.summary);
    expect(payload.snapshot.constraints.some((line) => /oauth/i.test(line))).toBe(true);
    expect(payload.snapshot.nextActions[0]?.title).toBe("Call write_project_memory once");
  });

  it("rejects unknown projects and malformed JSON without writing", async () => {
    const missing = mockCtx({ projects: [{ id: "other" }] });
    await expect(persistAgentCompiledMemoryForUser(missing.ctx, {
      userId: "u1",
      projectId: "p1",
      compiledJson: JSON.stringify(compiled),
      now: NOW,
    })).resolves.toEqual({ ok: false, status: 400, error: "project-not-found" });
    expect(missing.upserts).toHaveLength(0);

    const bad = mockCtx();
    await expect(persistAgentCompiledMemoryForUser(bad.ctx, {
      userId: "u1",
      projectId: "p1",
      compiledJson: "{not json",
      now: NOW,
    })).resolves.toEqual({ ok: false, status: 400, error: "malformed-json" });
    expect(bad.upserts).toHaveLength(0);
  });
});
