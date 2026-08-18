import { describe, expect, it } from "vitest";
import type { AgentEvent, Handoff, Project, ProjectAction, ProjectMemory } from "@/types";
import { buildAcceptAgentEventPlan } from "./acceptAgentEvent";
import { compileBuilderBrief } from "./projectContext";

const project: Project = {
  id: "p1",
  kind: "project",
  name: "Hypher",
  description: "Project context layer",
  status: "active",
  createdAt: 1,
  modifiedAt: 1,
};

const emptyMemory: ProjectMemory = {
  projectId: "p1",
  summary: "Hypher remembers project context for builders and agents.",
  currentDirection: "Close the Agent Inbox writeback loop.",
  recentChanges: [],
  openQuestions: [],
  nextActions: [],
  generatedAt: 10,
  sourceUpdatedAt: 10,
  model: "test",
};

describe("v1 dev loop Brief #1 vs Brief #2", () => {
  it("makes the next Builder Brief hotter after accepting writeback without hand-edits", () => {
    const brief1 = compileBuilderBrief({
      project,
      memory: emptyMemory,
      captures: [],
      actions: [],
      agentEvents: [],
      generatedAt: 100,
    });

    const pending: Handoff = {
      id: "h1",
      userId: "u1",
      projectId: "p1",
      generatedAt: 100,
      targetTool: "Cursor",
      packetContent: brief1,
      sourceCaptures: [],
      requestedTask: "Close the writeback loop",
      status: "pending",
    };

    const question: AgentEvent = {
      id: "q1",
      userId: "u1",
      projectId: "p1",
      source: "cursor",
      kind: "question",
      title: "Should CI failures land in Pulse?",
      body: "Failing checks should ask a human before the next session.",
      status: "new",
      createdAt: 200,
    };
    const nextAction: AgentEvent = {
      id: "n1",
      userId: "u1",
      projectId: "p1",
      source: "cursor",
      kind: "next_action",
      title: "Accept the CI question into memory",
      body: "Make Brief #2 include the unanswered CI question.",
      suggestedActions: ["Wire GitHub CI into Agent Inbox"],
      status: "new",
      createdAt: 201,
    };
    const handoff: AgentEvent = {
      id: "e1",
      userId: "u1",
      projectId: "p1",
      source: "cursor",
      kind: "handoff",
      title: "Session wrote back",
      body: "Added Start agent session, Needs you, and Accept.",
      status: "new",
      createdAt: 202,
    };

    const questionPlan = buildAcceptAgentEventPlan({
      event: question,
      memory: emptyMemory,
      pendingHandoff: pending,
      acceptedAt: 300,
    });
    const nextPlan = buildAcceptAgentEventPlan({
      event: nextAction,
      memory: emptyMemory,
      pendingHandoff: pending,
      acceptedAt: 301,
    });
    const handoffPlan = buildAcceptAgentEventPlan({
      event: handoff,
      memory: emptyMemory,
      pendingHandoff: pending,
      acceptedAt: 302,
    });

    const hotterMemory: ProjectMemory = {
      ...emptyMemory,
      openQuestions: questionPlan.openQuestion ? [questionPlan.openQuestion] : [],
      handoffNotes: handoffPlan.memoryPatch.handoffNotes ?? [],
      acceptedCrystallizedSuggestions: handoffPlan.memoryPatch.acceptedCrystallizedSuggestions,
      generatedAt: 302,
      sourceUpdatedAt: 302,
    };
    const hotterActions: ProjectAction[] = nextPlan.actionTitles.map((title, index) => ({
      id: `a${index}`,
      userId: "u1",
      projectId: "p1",
      title,
      status: "accepted",
      sourceType: "agent_event",
      createdAt: 301,
      updatedAt: 301,
    }));
    const hotterHandoff: Handoff = {
      ...pending,
      status: "used",
      returnedAgentOutput: handoffPlan.handoffUpdate?.returnedAgentOutput,
    };

    const brief2 = compileBuilderBrief({
      project,
      memory: hotterMemory,
      captures: [],
      actions: hotterActions,
      agentEvents: [
        { ...question, status: "accepted" },
        { ...nextAction, status: "accepted" },
        { ...handoff, status: "accepted" },
      ],
      handoffs: [hotterHandoff],
      generatedAt: 400,
    });

    expect(brief1).toContain("- No unresolved questions captured yet.");
    expect(brief1).not.toContain("Should CI failures land in Pulse?");
    expect(brief1).not.toContain("Wire GitHub CI into Agent Inbox");
    expect(brief2).toContain("Should CI failures land in Pulse?");
    expect(brief2).toContain("Wire GitHub CI into Agent Inbox");
    expect(brief2).toContain("Session wrote back");
    expect(brief2).not.toBe(brief1);
  });
});
