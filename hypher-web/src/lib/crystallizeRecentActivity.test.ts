import { describe, expect, it } from "vitest";
import type { AnyObject, Handoff, ProjectMemory } from "@/types";
import { suggestCrystallizedUpdates } from "./crystallizeRecentActivity";

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
      ],
      existingMemory,
    });

    expect(suggestions.map((item) => item.text)).toEqual(["Need to add a review panel."]);
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
