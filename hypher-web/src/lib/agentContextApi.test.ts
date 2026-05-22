import { describe, expect, it } from "vitest";
import type { AgentEvent, AnyObject, Handoff, Project, ProjectAction, ProjectMemory } from "@/types";
import { buildAgentContextApiResponse, getAgentContextLimits } from "./agentContextApi";

const project: Project = {
  id: "p1",
  kind: "project",
  name: "Hypher",
  description: "Project context layer for builders.",
  status: "active",
  createdAt: 1,
  modifiedAt: 100,
};

const memory: ProjectMemory = {
  id: "m1",
  projectId: "p1",
  summary: "Hypher keeps builder agents aligned with live project state.",
  currentGoal: "Expose clean Builder Briefs to agents.",
  currentDirection: "Expose Builder Briefs through the existing server route.",
  recentChanges: ["Copy Builder Brief shipped"],
  openQuestions: ["Which tools should ChatGPT get first?"],
  nextActions: [
    {
      id: "next-1",
      title: "Build read-only context endpoint",
      rationale: "Prepares MCP/OAuth connector.",
      suggestedTargetTool: "ChatGPT",
      confidence: 0.7,
      status: "suggested",
      createdAt: 10,
      updatedAt: 10,
    },
  ],
  generatedAt: 20,
  sourceUpdatedAt: 20,
  model: "test",
};

const captures: AnyObject[] = Array.from({ length: 6 }, (_, index) => ({
  id: `note-${index}`,
  kind: "note",
  content: `Capture ${index}`,
  maturity: "fleeting",
  projectId: "p1",
  createdAt: index,
  modifiedAt: index,
}));

const actions: ProjectAction[] = [
  {
    id: "action-1",
    userId: "u1",
    projectId: "p1",
    title: "Wire ChatGPT connector",
    status: "accepted",
    sourceType: "manual",
    createdAt: 1,
    updatedAt: 1,
  },
];

const agentEvents: AgentEvent[] = [
  {
    id: "event-1",
    userId: "u1",
    projectId: "p1",
    source: "codex",
    kind: "handoff",
    title: "Context endpoint planned",
    body: "OAuth comes after the endpoint.",
    status: "new",
    createdAt: 1,
  },
];

const handoffs: Handoff[] = [
  {
    id: "handoff-1",
    userId: "u1",
    projectId: "p1",
    generatedAt: 120,
    targetTool: "Cursor",
    packetContent: "# Builder Brief: Hypher\n\nOriginal brief",
    sourceCaptures: ["note-1"],
    requestedTask: "Wire Builder Brief parity",
    status: "completed",
    returnedAgentOutput: `Implemented the server context parity path. ${"Detailed implementation log. ".repeat(80)}`,
    userNotes: "Keep this result visible in the next Builder Brief.",
  },
];

describe("getAgentContextLimits", () => {
  it("keeps free packets smaller than paid packets", () => {
    expect(getAgentContextLimits(null)).toEqual({
      captures: 3,
      actions: 3,
      agentEvents: 3,
      recentChanges: 3,
      openQuestions: 3,
    });
    expect(getAgentContextLimits({ status: "active", plan: "pro_monthly" })).toEqual({
      captures: 8,
      actions: 8,
      agentEvents: 8,
      recentChanges: 8,
      openQuestions: 8,
    });
  });
});

describe("buildAgentContextApiResponse", () => {
  it("returns a deterministic JSON response with the compiled Builder Brief", () => {
    const response = buildAgentContextApiResponse({
      project,
      memory,
      captures,
      actions,
      agentEvents,
      subscription: { status: "active", plan: "pro_monthly" },
      task: "Use Hypher from ChatGPT",
      role: "ChatGPT connector",
    });

    expect(response.ok).toBe(true);
    expect(response.projectId).toBe("p1");
    expect(response.plan).toBe("pro");
    expect(response.limits.captures).toBe(8);
    expect(response.context).toContain("# Builder Brief: Hypher");
    expect(response.context).toContain("Expose clean Builder Briefs to agents.");
    expect(response.context).toContain("Build read-only context endpoint");
    expect(response.context).toContain("Expose Builder Briefs through the existing server route.");
    expect(response.context).toContain("Wire ChatGPT connector");
    expect(response.context).toContain("codex / handoff: Context endpoint planned.");
    expect(response.context).toContain("## Handoff Notes");
  });

  it("includes bounded returned agent output and user notes from handoff history", () => {
    const response = buildAgentContextApiResponse({
      project,
      memory,
      captures,
      actions,
      agentEvents: [],
      handoffs,
      subscription: { status: "active", plan: "pro_monthly" },
    });

    expect(response.context).toContain("- Previous Cursor brief was completed: Wire Builder Brief parity.");
    expect(response.context).toContain("- Agent result from previous Cursor brief: Implemented the server context parity path.");
    expect(response.context).toContain("- User note on previous Cursor brief: Keep this result visible in the next Builder Brief.");
    expect(response.context).not.toContain("Detailed implementation log. Detailed implementation log. Detailed implementation log.");
  });

  it("handles no handoffs gracefully", () => {
    const response = buildAgentContextApiResponse({
      project,
      memory,
      captures,
      actions: [],
      agentEvents: [],
      handoffs: [],
      subscription: null,
    });

    expect(response.context).toContain("## Handoff Notes");
    expect(response.context).toContain("- No handoff notes recorded yet.");
  });

  it("keeps handoffs without returned output as history only", () => {
    const response = buildAgentContextApiResponse({
      project,
      memory,
      captures,
      actions,
      agentEvents: [],
      handoffs: [
        {
          ...handoffs[0]!,
          returnedAgentOutput: undefined,
          userNotes: undefined,
        },
      ],
      subscription: { status: "active", plan: "pro_monthly" },
    });

    expect(response.context).toContain("- Previous Cursor brief was completed: Wire Builder Brief parity.");
    expect(response.context).not.toContain("Agent result from previous Cursor brief");
    expect(response.context).not.toContain("User note on previous Cursor brief");
  });

  it("labels inactive or missing subscriptions as free and applies free limits", () => {
    const response = buildAgentContextApiResponse({
      project,
      memory,
      captures,
      actions,
      agentEvents,
      subscription: { status: "canceled", plan: "pro_monthly" },
    });

    expect(response.plan).toBe("free");
    expect(response.limits.captures).toBe(3);
    expect(response.context).toContain("# Builder Brief: Hypher");
    expect(response.context).toContain("- No explicit Do Not Do items recorded yet.");
    expect(response.context).not.toContain("- Capture 2");
  });
});
