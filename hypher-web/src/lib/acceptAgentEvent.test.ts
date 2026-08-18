import { describe, expect, it } from "vitest";
import type { AgentEvent, Handoff, ProjectMemory } from "@/types";
import { acceptActionTitles, buildAcceptAgentEventPlan } from "./acceptAgentEvent";

const event: AgentEvent = {
  id: "e1",
  userId: "u1",
  projectId: "p1",
  source: "cursor",
  kind: "handoff",
  title: "Writeback loop closed",
  body: "Accept now writes memory and the action queue.",
  suggestedActions: ["Dogfood Brief #2", "Dogfood Brief #2"],
  status: "new",
  createdAt: 10,
};

const memory: ProjectMemory = {
  projectId: "p1",
  summary: "Hypher is the context layer.",
  currentDirection: "Close the agent loop.",
  recentChanges: [],
  openQuestions: [],
  handoffNotes: [],
  nextActions: [],
  generatedAt: 1,
  sourceUpdatedAt: 1,
  model: "test",
};

const pending: Handoff = {
  id: "h1",
  userId: "u1",
  projectId: "p1",
  generatedAt: 5,
  targetTool: "Cursor",
  packetContent: "# Brief",
  sourceCaptures: [],
  requestedTask: "Close the loop",
  status: "pending",
};

describe("acceptAgentEvent", () => {
  it("dedupes suggested actions and writes a handoff note plus pending handoff result", () => {
    const plan = buildAcceptAgentEventPlan({
      event,
      memory,
      pendingHandoff: pending,
      acceptedAt: 20,
    });

    expect(plan.actionTitles).toEqual(["Dogfood Brief #2"]);
    expect(plan.memoryPatch.handoffNotes?.[0]).toContain("Writeback loop closed");
    expect(plan.handoffUpdate).toEqual({
      handoffId: "h1",
      returnedAgentOutput: "Writeback loop closed. Accept now writes memory and the action queue.",
      status: "used",
    });
  });

  it("maps questions onto open questions and next_action titles onto the queue", () => {
    const question: AgentEvent = {
      ...event,
      id: "q1",
      kind: "question",
      title: "Should GitHub CI land in Pulse?",
      body: "Failing checks should ask a human.",
      suggestedActions: undefined,
    };
    const next: AgentEvent = {
      ...event,
      id: "n1",
      kind: "next_action",
      title: "Triage the CI failure",
      body: "",
      suggestedActions: undefined,
    };

    expect(buildAcceptAgentEventPlan({
      event: question,
      memory,
      pendingHandoff: null,
      acceptedAt: 20,
    }).openQuestion).toContain("Should GitHub CI land in Pulse?");
    expect(acceptActionTitles(next)).toEqual(["Triage the CI failure"]);
  });
});
