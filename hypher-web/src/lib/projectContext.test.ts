import { describe, expect, it } from "vitest";
import type { AgentEvent, AnyObject, Project, ProjectAction, ProjectMemory } from "@/types";
import { compileProjectContext, compileProjectContextWithMeta } from "./projectContext";

const project: Project = {
  id: "p1",
  kind: "project",
  name: "Hypher",
  description: "Capture-first workspace for project context.",
  status: "active",
  createdAt: 1,
  modifiedAt: 100,
  githubRepo: "litterthanlit/hypher",
};

const memory: ProjectMemory = {
  id: "m1",
  projectId: "p1",
  summary: "Hypher is becoming the project context layer for AI builders.",
  currentGoal: "Ship the narrow beta loop from messy capture to saved handoff.",
  currentDirection: "Prove Copy Agent Context before SDK or MCP.",
  recentChanges: ["Agent handoffs now appear in Project Pulse", "Project actions can be created from suggestions"],
  importantDecisions: ["Markdown copy is the first agent handoff win."],
  constraints: ["Do not build generic productivity features."],
  openQuestions: ["How much context should an agent packet include?"],
  blockers: ["Need saved handoff history."],
  staleAssumptions: ["Graph view is not part of the beta loop."],
  nextActions: [
    {
      id: "na1",
      title: "Run production handoff smoke",
      rationale: "Validates the agent-to-Pulse loop.",
      requiredContext: ["Project Pulse", "latest captures", "recent handoffs"],
      suggestedTargetTool: "Cursor",
      confidence: 0.82,
      sourceCaptureIds: ["n1", "a1"],
      status: "suggested",
      createdAt: 80,
      updatedAt: 80,
    },
  ],
  generatedAt: 90,
  sourceUpdatedAt: 80,
  model: "test",
};

const captures: AnyObject[] = [
  project,
  {
    id: "n1",
    kind: "note",
    content: "Creed validates the context-layer category, but Hypher should keep capture as the source of truth.",
    maturity: "developing",
    projectId: "p1",
    createdAt: 50,
    modifiedAt: 70,
  },
  {
    id: "a1",
    kind: "artifact",
    name: "Project Pulse mock",
    type: "image",
    projectId: "p1",
    createdAt: 40,
    modifiedAt: 60,
  },
];

const actions: ProjectAction[] = [
  {
    id: "pa1",
    userId: "u1",
    projectId: "p1",
    title: "Build Copy Agent Context v1",
    status: "accepted",
    sourceType: "manual",
    createdAt: 70,
    updatedAt: 70,
  },
  {
    id: "pa2",
    userId: "u1",
    projectId: "p1",
    title: "Old dismissed action",
    status: "dismissed",
    sourceType: "manual",
    createdAt: 20,
    updatedAt: 20,
  },
];

const agentEvents: AgentEvent[] = [
  {
    id: "e1",
    userId: "u1",
    projectId: "p1",
    source: "openclaw",
    kind: "handoff",
    title: "Context layer strategy reviewed",
    body: "Compared Hypher against Creed and kept Copy Agent Context as the immediate proof.",
    suggestedActions: ["Ship context packet compiler"],
    status: "new",
    createdAt: 95,
  },
];

describe("compileProjectContext", () => {
  it("builds a task-specific markdown packet from project memory, actions, captures, and agent events", () => {
    const packet = compileProjectContext({
      project,
      memory,
      captures,
      actions,
      agentEvents,
      task: "Implement the first context packet",
      role: "coding agent",
    });

    expect(packet).toContain("# Agent Context Packet");
    expect(packet).toContain("Name: Hypher");
    expect(packet).toContain("Current goal: Ship the narrow beta loop from messy capture to saved handoff.");
    expect(packet).toContain("Suggested target tool: Cursor");
    expect(packet).toContain("Recommended action: Run production handoff smoke");
    expect(packet).toContain("Expected output:");
    expect(packet).toContain("Success criteria:");
    expect(packet).toContain("Freshness:");
    expect(packet).toContain("Sources included:");
    expect(packet).toContain("Hypher is becoming the project context layer for AI builders.");
    expect(packet).toContain("Prove Copy Agent Context before SDK or MCP.");
    expect(packet).toContain("- Markdown copy is the first agent handoff win.");
    expect(packet).toContain("- Do not build generic productivity features.");
    expect(packet).toContain("- How much context should an agent packet include?");
    expect(packet).toContain("- Build Copy Agent Context v1");
    expect(packet).not.toContain("Old dismissed action");
    expect(packet).toContain("- Creed validates the context-layer category");
    expect(packet).toContain("- Project Pulse mock (image)");
    expect(packet).toContain("- openclaw / handoff: Context layer strategy reviewed");
    expect(packet).toContain("Do not:");
  });

  it("uses project fields when memory is not available", () => {
    const packet = compileProjectContext({
      project,
      captures: [],
      actions: [],
      agentEvents: [],
    });

    expect(packet).toContain("Capture-first workspace for project context.");
    expect(packet).toContain("No generated project memory yet.");
    expect(packet).toContain("No active tasks recorded.");
  });

  it("limits noisy sections to keep the packet focused", () => {
    const manyCaptures = Array.from({ length: 8 }, (_, index): AnyObject => ({
      id: `n-${index}`,
      kind: "note",
      content: `Capture ${index}`,
      maturity: "fleeting",
      projectId: "p1",
      createdAt: index,
      modifiedAt: index,
    }));

    const packet = compileProjectContext({
      project,
      captures: manyCaptures,
      actions: [],
      agentEvents: [],
      limits: { captures: 3 },
    });

    expect(packet).toContain("- Capture 7");
    expect(packet).toContain("- Capture 5");
    expect(packet).not.toContain("- Capture 4");
  });

  it("keeps section ordering deterministic", () => {
    const packet = compileProjectContext({
      project,
      memory,
      captures,
      actions,
      agentEvents,
    });

    const sections = [
      "# Agent Context Packet",
      "## Project",
      "## Current State",
      "## Task For Agent",
      "## Relevant Context",
      "## Guardrails",
      "## Metadata",
    ];

    expect(sections.map((section) => packet.indexOf(section))).toEqual(
      sections.map((section) => expect.any(Number))
    );
    const indexes = sections.map((section) => packet.indexOf(section));
    expect(indexes.every((index) => index >= 0)).toBe(true);
    expect([...indexes].sort((a, b) => a - b)).toEqual(indexes);
  });

  it("returns source metadata for saved handoffs and excludes stale or archived captures", () => {
    const result = compileProjectContextWithMeta({
      project,
      memory,
      captures: [
        captures[1],
        { ...captures[2], stale: true },
        {
          id: "n-archived",
          kind: "note",
          content: "Old irrelevant capture",
          maturity: "fleeting",
          projectId: "p1",
          captureStatus: "archived",
          createdAt: 1,
          modifiedAt: 1,
        },
      ],
      actions,
      agentEvents,
    });

    expect(result.sourceCaptureIds).toEqual(["n1"]);
    expect(result.excludedSourceCaptureIds).toEqual(["a1", "n-archived"]);
    expect(result.targetTool).toBe("Cursor");
    expect(result.requestedTask).toBe("Run production handoff smoke");
    expect(result.packet).toContain("Sources excluded: 2 captures");
  });

  it("normalizes messy markdown content without leaking private ids", () => {
    const packet = compileProjectContext({
      project: {
        ...project,
        description: "Line one\n\n```secret-ish block```\n# pasted heading",
      },
      captures: [
        {
          id: "internal-note-id",
          kind: "note",
          content: "  # Customer pasted heading\n\n\n```ts\nconst token = 'redacted';\n```  ",
          maturity: "fleeting",
          projectId: "p1",
          createdAt: 1,
          modifiedAt: 1,
        },
      ],
      actions: [
        {
          id: "action-secret-id",
          userId: "user-secret-id",
          projectId: "p1",
          title: "  Trim whitespace  ",
          status: "suggested",
          sourceType: "manual",
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      agentEvents: [
        {
          id: "event-secret-id",
          userId: "user-secret-id",
          projectId: "p1",
          source: "codex",
          kind: "handoff",
          title: "  Messy handoff  ",
          body: "Line one\n\n\nLine two",
          status: "new",
          createdAt: 1,
        },
      ],
    });

    expect(packet).toContain("Line one ```secret-ish block``` # pasted heading");
    expect(packet).toContain("- # Customer pasted heading ```ts const token = 'redacted'; ```");
    expect(packet).toContain("- Trim whitespace (Manual)");
    expect(packet).toContain("- codex / handoff: Messy handoff. Line one Line two");
    expect(packet).not.toContain("internal-note-id");
    expect(packet).not.toContain("action-secret-id");
    expect(packet).not.toContain("event-secret-id");
    expect(packet).not.toContain("user-secret-id");
  });
});
