import { describe, expect, it } from "vitest";
import type { AnyObject, Handoff, ProjectMemory } from "@/types";
import {
  buildAcceptedCrystallizedMemoryPatch,
  buildCrystallizedMemoryStatusPatch,
  suggestCrystallizedUpdates,
} from "./crystallizeRecentActivity";

const baseCapture: AnyObject = {
  id: "capture-1",
  kind: "note",
  content: "",
  maturity: "developing",
  projectId: "project-1",
  createdAt: 1,
  modifiedAt: 10,
};

const baseHandoff: Handoff = {
  id: "handoff-1",
  userId: "user-1",
  projectId: "project-1",
  generatedAt: 20,
  targetTool: "Cursor",
  packetContent: "# Builder Brief",
  sourceCaptures: ["capture-1"],
  requestedTask: "Build recent activity crystallization",
  status: "completed",
};

function capture(id: string, content: string, patch: Partial<AnyObject> = {}): AnyObject {
  return {
    ...baseCapture,
    id,
    content,
    modifiedAt: Number(id.replace(/\D/g, "")) || 10,
    ...patch,
  } as AnyObject;
}

describe("suggestCrystallizedUpdates", () => {
  it("suggests typed crystallized updates from recent captures", () => {
    const suggestions = suggestCrystallizedUpdates({
      captures: [
        capture(
          "capture-1",
          [
            "Decision: use the existing Builder Brief compiler.",
            "The compiler must remain pure.",
            "Do not expand MCP tools.",
            "Next verify protected routes.",
            "Done when npm test and npm run build pass.",
            "Watch out for agent drift in auth work.",
            "Current task is crystallize recent activity.",
          ].join(" ")
        ),
      ],
    });

    expect(suggestions.map((item) => item.kind)).toEqual([
      "decision",
      "constraint",
      "do_not_do",
      "open_action",
      "acceptance_criterion",
      "agent_warning",
      "current_task",
    ]);
    expect(suggestions.every((item) => item.sourceType === "capture")).toBe(true);
    expect(suggestions.every((item) => item.sourceId === "capture-1")).toBe(true);
    expect(suggestions[0]).toMatchObject({
      text: "Decision: use the existing Builder Brief compiler.",
      confidence: "high",
    });
  });

  it("ignores stale, archived, and packet-excluded captures", () => {
    const suggestions = suggestCrystallizedUpdates({
      captures: [
        capture("capture-1", "Decision: keep this current."),
        capture("capture-2", "Decision: stale context.", { stale: true }),
        capture("capture-3", "Decision: excluded context.", { excludeFromPackets: true }),
        capture("capture-4", "Decision: archived context.", { captureStatus: "archived" }),
      ],
    });

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({
      text: "Decision: keep this current.",
      sourceId: "capture-1",
    });
  });

  it("suggests bounded handoff notes from returned agent output and user notes", () => {
    const suggestions = suggestCrystallizedUpdates({
      handoffs: [
        {
          ...baseHandoff,
          returnedAgentOutput: `Implemented Project Pulse handoff parity and verified tests passed. ${"Detailed log line. ".repeat(40)}`,
          userNotes: "Do not treat this as automatic project memory yet.",
        },
      ],
    });

    expect(suggestions).toEqual([
      expect.objectContaining({
        kind: "handoff_note",
        sourceType: "returned_agent_output",
        sourceId: "handoff-1",
        text: "Implemented Project Pulse handoff parity and verified tests passed.",
      }),
      expect.objectContaining({
        kind: "do_not_do",
        sourceType: "user_note",
        sourceId: "handoff-1",
        text: "Do not treat this as automatic project memory yet.",
      }),
    ]);
    expect(suggestions[0]!.text).not.toContain("Detailed log line. Detailed log line.");
  });

  it("avoids duplicate suggestions from existing memory and repeated activity", () => {
    const existingMemory: ProjectMemory = {
      projectId: "project-1",
      summary: "Existing memory.",
      currentDirection: "Use the current compiler.",
      recentChanges: [],
      importantDecisions: ["Decision: use the existing Builder Brief compiler."],
      constraints: [],
      acceptanceCriteria: ["Done when npm test passes."],
      agentWarnings: ["Watch out for auth drift."],
      handoffNotes: ["Keep handoff notes bounded."],
      acceptedCrystallizedSuggestions: [
        {
          kind: "constraint",
          text: "The compiler must stay deterministic.",
          sourceType: "capture",
          sourceId: "capture-4",
          suggestionId: "crystal-constraint-capture-capture-4-existing",
          createdAt: 20,
        },
      ],
      openQuestions: [],
      nextActions: [],
      generatedAt: 1,
      sourceUpdatedAt: 1,
      model: "test",
    };

    const suggestions = suggestCrystallizedUpdates({
      captures: [
        capture("capture-1", "Decision: use the existing Builder Brief compiler."),
        capture("capture-2", "Decision: use the existing Builder Brief compiler."),
        capture("capture-3", "Need to add a review panel."),
        capture("capture-4", "The compiler must stay deterministic."),
        capture("capture-5", "Done when npm test passes."),
        capture("capture-6", "Watch out for auth drift."),
        capture("capture-7", "Keep handoff notes bounded."),
      ],
      existingMemory,
    });

    expect(suggestions.map((item) => item.text)).toEqual(["Need to add a review panel."]);
  });

  it("does not suggest already pinned decisions or converted tasks", () => {
    const suggestions = suggestCrystallizedUpdates({
      captures: [
        capture("capture-1", "Decision: keep the existing compiler.", { pinnedAsDecision: true }),
        capture("capture-2", "Need to wire durable persistence.", { convertedToTask: true }),
        capture("capture-3", "Need to add source metadata."),
      ],
    });

    expect(suggestions.map((item) => item.text)).toEqual(["Need to add source metadata."]);
  });

  it("builds a durable memory patch for accepted crystallized suggestions", () => {
    const memory: ProjectMemory = {
      projectId: "project-1",
      summary: "Existing memory.",
      currentDirection: "Keep the loop review-first.",
      recentChanges: [],
      importantDecisions: ["Decision: existing decision."],
      constraints: ["Existing constraint."],
      openQuestions: [],
      nextActions: [],
      generatedAt: 1,
      sourceUpdatedAt: 1,
      model: "test",
    };

    const patch = buildAcceptedCrystallizedMemoryPatch({
      memory,
      suggestion: {
        id: "crystal-acceptance-capture-capture-1-abc",
        kind: "acceptance_criterion",
        text: "Done when accepted suggestions appear in the Builder Brief.",
        sourceType: "capture",
        sourceId: "capture-1",
      },
      acceptedAt: 50,
    });

    expect(patch).toEqual({
      acceptanceCriteria: ["Done when accepted suggestions appear in the Builder Brief."],
      acceptedCrystallizedSuggestions: [
        {
          kind: "acceptance_criterion",
          text: "Done when accepted suggestions appear in the Builder Brief.",
          sourceType: "capture",
          sourceId: "capture-1",
          suggestionId: "crystal-acceptance-capture-capture-1-abc",
          createdAt: 50,
          status: "active",
          updatedAt: 50,
        },
      ],
    });
  });

  it("avoids duplicate accepted memory items", () => {
    const memory: ProjectMemory = {
      projectId: "project-1",
      summary: "Existing memory.",
      currentDirection: "Keep the loop review-first.",
      recentChanges: [],
      constraints: ["Do not expand MCP tools."],
      acceptedCrystallizedSuggestions: [
        {
          kind: "do_not_do",
          text: "Do not expand MCP tools.",
          sourceType: "capture",
          sourceId: "capture-1",
          suggestionId: "crystal-do_not_do-capture-capture-1-abc",
          createdAt: 20,
        },
      ],
      openQuestions: [],
      nextActions: [],
      generatedAt: 1,
      sourceUpdatedAt: 1,
      model: "test",
    };

    const patch = buildAcceptedCrystallizedMemoryPatch({
      memory,
      suggestion: {
        id: "crystal-do_not_do-capture-capture-1-abc",
        kind: "do_not_do",
        text: "Do not expand MCP tools.",
        sourceType: "capture",
        sourceId: "capture-1",
      },
      acceptedAt: 50,
    });

    expect(patch).toEqual({});
  });

  it("updates accepted crystallized memory lifecycle status", () => {
    const memory: ProjectMemory = {
      projectId: "project-1",
      summary: "Existing memory.",
      currentDirection: "Keep the loop review-first.",
      recentChanges: [],
      constraints: ["Do not expand MCP tools."],
      acceptedCrystallizedSuggestions: [
        {
          kind: "do_not_do",
          text: "Do not expand MCP tools.",
          sourceType: "capture",
          sourceId: "capture-1",
          suggestionId: "crystal-do_not_do-capture-capture-1-abc",
          createdAt: 20,
          status: "active",
          updatedAt: 20,
        },
      ],
      openQuestions: [],
      nextActions: [],
      generatedAt: 1,
      sourceUpdatedAt: 1,
      model: "test",
    };

    const patch = buildCrystallizedMemoryStatusPatch({
      memory,
      target: memory.acceptedCrystallizedSuggestions![0]!,
      status: "excluded",
      updatedAt: 60,
    });

    expect(patch).toEqual({
      acceptedCrystallizedSuggestions: [
        {
          kind: "do_not_do",
          text: "Do not expand MCP tools.",
          sourceType: "capture",
          sourceId: "capture-1",
          suggestionId: "crystal-do_not_do-capture-capture-1-abc",
          createdAt: 20,
          status: "excluded",
          updatedAt: 60,
        },
      ],
    });
  });

  it("applies suggestion limits and keeps output deterministic", () => {
    const params = {
      captures: [
        capture("capture-1", "Need to verify API context parity."),
        capture("capture-2", "Need to verify MCP context parity."),
        capture("capture-3", "Need to verify Project Pulse parity."),
      ],
      limits: { maxSuggestions: 2, maxSourceLength: 80 },
    };

    const first = suggestCrystallizedUpdates(params);
    const second = suggestCrystallizedUpdates(params);

    expect(first).toHaveLength(2);
    expect(first).toEqual(second);
    expect(first.map((item) => item.kind)).toEqual(["open_action", "open_action"]);
    expect(first.every((item) => item.text.length <= 80)).toBe(true);
  });

  it("returns an empty list for empty input", () => {
    expect(suggestCrystallizedUpdates({})).toEqual([]);
  });
});
