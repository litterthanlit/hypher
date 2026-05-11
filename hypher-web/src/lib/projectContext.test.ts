import { describe, expect, it } from "vitest";
import type { AgentEvent, AnyObject, Project, ProjectAction, ProjectMemory } from "@/types";
import { compileProjectContext } from "./projectContext";

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
  currentDirection: "Prove Copy Agent Context before SDK or MCP.",
  recentChanges: ["Agent handoffs now appear in Project Pulse", "Project actions can be created from suggestions"],
  openQuestions: ["How much context should an agent packet include?"],
  nextActions: [
    {
      id: "na1",
      title: "Run production handoff smoke",
      rationale: "Validates the agent-to-Pulse loop.",
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

    expect(packet).toContain("# Agent Context: Hypher");
    expect(packet).toContain("Task: Implement the first context packet");
    expect(packet).toContain("Role: coding agent");
    expect(packet).toContain("Repository: litterthanlit/hypher");
    expect(packet).toContain("Hypher is becoming the project context layer for AI builders.");
    expect(packet).toContain("Prove Copy Agent Context before SDK or MCP.");
    expect(packet).toContain("- How much context should an agent packet include?");
    expect(packet).toContain("- [accepted] Build Copy Agent Context v1 (Manual)");
    expect(packet).not.toContain("Old dismissed action");
    expect(packet).toContain("- Creed validates the context-layer category");
    expect(packet).toContain("- Project Pulse mock (image)");
    expect(packet).toContain("- openclaw handoff: Context layer strategy reviewed");
    expect(packet).toContain("Do not treat this packet as a full task manager or agent builder spec.");
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
    expect(packet).toContain("No accepted or suggested actions.");
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
      "# Agent Context: Hypher",
      "## Project Summary",
      "## Current Direction",
      "## Recent Changes",
      "## Open Questions",
      "## Action Queue",
      "## Suggested Next Moves",
      "## Relevant Recent Captures",
      "## Recent Agent Handoffs",
      "## Instructions For The Agent",
    ];

    expect(sections.map((section) => packet.indexOf(section))).toEqual(
      sections.map((section) => expect.any(Number))
    );
    const indexes = sections.map((section) => packet.indexOf(section));
    expect(indexes.every((index) => index >= 0)).toBe(true);
    expect([...indexes].sort((a, b) => a - b)).toEqual(indexes);
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
    expect(packet).toContain("- [suggested] Trim whitespace (Manual)");
    expect(packet).toContain("- codex handoff: Messy handoff. Line one Line two");
    expect(packet).not.toContain("internal-note-id");
    expect(packet).not.toContain("action-secret-id");
    expect(packet).not.toContain("event-secret-id");
    expect(packet).not.toContain("user-secret-id");
  });
});
