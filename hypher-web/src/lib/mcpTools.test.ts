import { describe, expect, it } from "vitest";
import type { AgentEvent, AnyObject, Project, ProjectAction, ProjectMemory } from "@/types";
import {
  buildMcpToolResult,
  getHypherMcpToolDescriptors,
  type HypherMcpContext,
} from "./mcpTools";

const project: Project = {
  id: "p1",
  kind: "project",
  name: "Hypher",
  description: "Context layer for builders.",
  status: "active",
  githubRepo: "litterthanlit/hypher",
  createdAt: 1,
  modifiedAt: 100,
};

const memory: ProjectMemory = {
  id: "m1",
  projectId: "p1",
  summary: "Hypher keeps active projects aware.",
  currentDirection: "Build the read-only MCP surface.",
  recentChanges: ["Agent context API shipped"],
  openQuestions: ["Can Clerk satisfy ChatGPT OAuth directly?"],
  nextActions: [
    {
      id: "next-1",
      title: "Add OAuth metadata",
      rationale: "ChatGPT needs protected resource discovery.",
      status: "suggested",
      createdAt: 10,
      updatedAt: 10,
    },
  ],
  generatedAt: 20,
  sourceUpdatedAt: 20,
  model: "test",
};

const captures: AnyObject[] = [
  {
    id: "n1",
    kind: "note",
    content: "Keep Hypher Stripe subscriptions as the entitlement source.",
    maturity: "structured",
    projectId: "p1",
    createdAt: 1,
    modifiedAt: 30,
  },
];

const actions: ProjectAction[] = [
  {
    id: "a1",
    userId: "u1",
    projectId: "p1",
    title: "Define list_projects and get_project_context",
    status: "accepted",
    sourceType: "manual",
    createdAt: 1,
    updatedAt: 40,
  },
];

const agentEvents: AgentEvent[] = [
  {
    id: "e1",
    userId: "u1",
    projectId: "p1",
    source: "codex",
    kind: "handoff",
    title: "Context endpoint shipped",
    body: "Build MCP next.",
    status: "new",
    createdAt: 50,
  },
];

const context: HypherMcpContext = {
  projects: [project],
  projectContexts: {
    p1: {
      project,
      memory,
      captures,
      actions,
      agentEvents,
      subscription: { status: "active", plan: "pro_monthly" },
    },
  },
};

describe("Hypher MCP tool descriptors", () => {
  it("defines the first read-only tool surface", () => {
    expect(getHypherMcpToolDescriptors().map((tool) => tool.name)).toEqual([
      "list_projects",
      "get_project_context",
      "get_current_state",
      "get_next_move",
      "prepare_handoff",
    ]);
    expect(getHypherMcpToolDescriptors().every((tool) => tool.annotations.readOnlyHint)).toBe(true);
  });
});

describe("buildMcpToolResult", () => {
  it("lists projects without leaking full context", () => {
    const result = buildMcpToolResult("list_projects", {}, context);

    expect(result.structuredContent).toEqual({
      projects: [
        {
          id: "p1",
          name: "Hypher",
          status: "active",
          githubRepo: "litterthanlit/hypher",
          modifiedAt: 100,
        },
      ],
    });
    expect(result.content[0]?.text).toContain("Hypher");
    expect(result.content[0]?.text).not.toContain("Keep Hypher Stripe");
  });

  it("returns the protected compiled context packet", () => {
    const result = buildMcpToolResult("get_project_context", { projectId: "p1" }, context);

    expect(result.structuredContent.projectId).toBe("p1");
    expect(result.structuredContent.context).toContain("# Agent Context Packet");
    expect(result.structuredContent.context).toContain("Name: Hypher");
    expect(result.structuredContent.context).toContain("Build the read-only MCP surface.");
  });

  it("returns focused current state and next move views", () => {
    expect(buildMcpToolResult("get_current_state", { projectId: "p1" }, context).structuredContent).toMatchObject({
      projectId: "p1",
      currentState: "Build the read-only MCP surface.",
    });

    expect(buildMcpToolResult("get_next_move", { projectId: "p1" }, context).structuredContent).toMatchObject({
      projectId: "p1",
      nextMove: "Define list_projects and get_project_context",
      source: "action_queue",
    });
  });

  it("prepares a concise handoff with account-linking wording", () => {
    const result = buildMcpToolResult("prepare_handoff", { projectId: "p1" }, context);

    expect(result.structuredContent.handoff).toContain("Connect your Hypher account to ChatGPT");
    expect(result.structuredContent.handoff).not.toContain("connect ChatGPT subscription");
  });
});
