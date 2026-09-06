import { describe, expect, it } from "vitest";
import type { AgentEvent, AnyObject, Handoff, Project, ProjectAction, ProjectMemory } from "@/types";
import {
  buildMcpToolResult,
  formatAgentEventWriteResult,
  formatWriteProjectMemoryResult,
  getHypherMcpToolDescriptors,
  parsePostAgentEventArgs,
  parseWriteProjectMemoryArgs,
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

const handoffs: Handoff[] = [
  {
    id: "h1",
    userId: "u1",
    projectId: "p1",
    generatedAt: 60,
    targetTool: "Cursor",
    packetContent: "# Builder Brief: Hypher\n\nPrevious brief",
    sourceCaptures: ["n1"],
    requestedTask: "Build MCP Builder Brief parity",
    status: "used",
    returnedAgentOutput: "MCP now carries saved handoff result context into the Builder Brief.",
    userNotes: "Use the same context as Project Pulse.",
  },
];

const handoffWithoutResult: Handoff = {
  ...handoffs[0]!,
  id: "h2",
  generatedAt: 55,
  returnedAgentOutput: undefined,
  userNotes: undefined,
};

const context: HypherMcpContext = {
  projects: [project],
  projectContexts: {
    p1: {
      project,
      memory,
      captures,
      actions,
      agentEvents,
      handoffs,
      subscription: { status: "active", plan: "pro_monthly" },
    },
  },
};

describe("Hypher MCP tool descriptors", () => {
  it("defines the read surface plus v1 resolve and write tools", () => {
    expect(getHypherMcpToolDescriptors().map((tool) => tool.name)).toEqual([
      "list_projects",
      "get_project_context",
      "get_current_state",
      "get_next_move",
      "prepare_handoff",
      "resolve_project_for_repo",
      "get_synthesis_input",
      "write_project_memory",
      "post_agent_event",
    ]);
    expect(
      getHypherMcpToolDescriptors()
        .filter((tool) => tool.name !== "post_agent_event" && tool.name !== "write_project_memory")
        .every((tool) => tool.annotations.readOnlyHint)
    ).toBe(true);
    expect(getHypherMcpToolDescriptors().find((tool) => tool.name === "post_agent_event")?.annotations.readOnlyHint).toBe(false);
    expect(getHypherMcpToolDescriptors().find((tool) => tool.name === "write_project_memory")?.annotations.readOnlyHint).toBe(false);
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

  it("returns the protected compiled Builder Brief", () => {
    const result = buildMcpToolResult("get_project_context", { projectId: "p1" }, context);

    expect(result.structuredContent.projectId).toBe("p1");
    expect(result.structuredContent.context).toContain("# Builder Brief: Hypher");
    expect(result.structuredContent.context).toContain("Build the read-only MCP surface.");
    expect(result.structuredContent.context).toContain("- Target tool: Cursor");
    expect(result.structuredContent.context).not.toContain("Paste this Builder Brief");
    expect(result.structuredContent.context).not.toContain("paste this into ChatGPT");
    expect(result.structuredContent.context).toContain("- [handoff:Cursor/result] Agent result from previous Cursor brief: MCP now carries saved handoff result context into the Builder Brief.");
    expect(result.structuredContent.context).toContain("- [handoff:Cursor/result] User note on previous Cursor brief: Use the same context as Project Pulse.");
  });

  it("includes activity lines when OAuth context supplies them, matching Clerk", () => {
    const withoutActivity = String(
      buildMcpToolResult("get_project_context", { projectId: "p1" }, context).structuredContent.context
    );
    const withActivity = String(
      buildMcpToolResult("get_project_context", { projectId: "p1" }, {
        ...context,
        projectContexts: {
          p1: {
            ...context.projectContexts.p1!,
            activity: [{
              id: "act-1",
              action: "updated",
              objectId: "n1",
              objectKind: "note",
              objectName: "Builder Brief source note",
              timestamp: 130,
              projectId: "p1",
              summary: "Builder Brief source note was accepted into project memory.",
            }],
          },
        },
      }).structuredContent.context
    );
    expect(withoutActivity).not.toContain("[activity:updated]");
    expect(withActivity).toContain("[activity:updated] Builder Brief source note was accepted into project memory.");
  });

  it("agrees with Pulse on the current next move", () => {
    const packet = String(buildMcpToolResult("get_project_context", { projectId: "p1" }, context).structuredContent.context);
    const next = buildMcpToolResult("get_next_move", { projectId: "p1" }, context).structuredContent;
    const nextLine = packet.match(/^- Next action: (.+)$/m)?.[1] ?? "";
    expect(next.nextMove).toBe("Add OAuth metadata");
    expect(nextLine).toContain("Add OAuth metadata");
  });

  it("keeps MCP Builder Brief output stable when no handoff result exists", () => {
    const result = buildMcpToolResult("get_project_context", { projectId: "p1" }, {
      ...context,
      projectContexts: {
        p1: {
          ...context.projectContexts.p1!,
          agentEvents: [],
          handoffs: [handoffWithoutResult],
        },
      },
    });

    expect(result.structuredContent.context).toContain("- [handoff:Cursor/used] Previous Cursor brief was used: Build MCP Builder Brief parity.");
    expect(result.structuredContent.context).not.toContain("Agent result from previous Cursor brief");
    expect(result.structuredContent.context).not.toContain("User note on previous Cursor brief");
  });

  it("returns focused current state and next move views", () => {
    expect(buildMcpToolResult("get_current_state", { projectId: "p1" }, context).structuredContent).toMatchObject({
      projectId: "p1",
      currentState: "Context endpoint shipped",
    });

    expect(buildMcpToolResult("get_next_move", { projectId: "p1" }, context).structuredContent).toMatchObject({
      projectId: "p1",
      nextMove: "Add OAuth metadata",
      source: "project_memory",
    });
  });

  it("does not report dump-echo current state or dump reprints as the latest change", () => {
    const dump =
      "Dogfood dump on the real hypher project. Product: dump → one note agents read → writeback. Session 2 should start warm. Do not: invent dumps, gate bind on a github token, or treat try hypher as the home.";
    const nextMove = "Merge PR 62 and deploy Convex so production memory and packet compile drop the dump echo";
    const dumpContext: HypherMcpContext = {
      ...context,
      projectContexts: {
        p1: {
          project,
          memory: {
            ...memory,
            summary: dump,
            currentGoal: "",
            currentDirection: "Dogfood dump on the real hypher project.",
            recentChanges: [
              `${dump} Packet compile no longer reprints the dogfood dump in Recent changes.`,
              "Dump reprints no longer crowd Recent changes or constraints. PR 62 commit bb1e392.",
            ],
            nextActions: [{
              id: "na",
              title: nextMove,
              rationale: "Compiled from the latest dump or writeback.",
              status: "suggested",
              createdAt: 90,
              updatedAt: 90,
            }],
          },
          captures: [{
            id: "n-dump",
            kind: "note",
            content: dump,
            maturity: "fleeting",
            projectId: "p1",
            createdAt: 1,
            modifiedAt: 30,
          }],
          actions: [],
          agentEvents: [{
            id: "latest",
            userId: "u1",
            projectId: "p1",
            source: "cursor",
            kind: "handoff",
            title: "Dump reprints no longer crowd Recent changes or constraints",
            body: "Do not widen OAuth. Pulse stays three panels. Do not rebuild the canvas.",
            suggestedActions: [nextMove],
            status: "reviewed",
            createdAt: 90,
          }],
          handoffs: [],
          subscription: { status: "active", plan: "pro_monthly" },
        },
      },
    };

    const state = buildMcpToolResult("get_current_state", { projectId: "p1" }, dumpContext).structuredContent;
    const recentChanges = Array.isArray(state.recentChanges) ? state.recentChanges.map(String) : [];
    expect(state.currentState).toBe("Dump reprints no longer crowd Recent changes or constraints");
    expect(state.currentState).not.toMatch(/Dogfood dump on the real hypher project/i);
    expect(recentChanges[0]).toBe("Dump reprints no longer crowd Recent changes or constraints.");
    expect(recentChanges.some((item) => /Dogfood dump on the real hypher project/i.test(item))).toBe(false);
    expect(recentChanges.some((item) => /\.\.\./.test(item))).toBe(false);

    const move = buildMcpToolResult("get_next_move", { projectId: "p1" }, dumpContext).structuredContent;
    expect(move.nextMove).toBe(nextMove);

    const brief = String(buildMcpToolResult("get_project_context", { projectId: "p1" }, dumpContext).structuredContent.context);
    expect(brief).toMatch(/- Short summary: Dump reprints no longer crowd Recent changes or constraints/);
    expect(brief).toMatch(/- Current state: Dump reprints no longer crowd Recent changes or constraints/);
    expect(brief).not.toMatch(/- Current state:.*Dogfood dump/);
    expect(brief).not.toMatch(/Continue: Dogfood dump/);
    expect(brief).not.toMatch(/reprin\.\.\./);
    expect(brief).toMatch(/Do not widen OAuth/);
    expect(brief).toContain("- Target tool: Cursor");
    expect(brief).not.toContain("- Target tool: GitHub");
  });

  it("does not return a merge next move when the brief says do not merge until reviewed", () => {
    const dump =
      "Dogfood dump on the real hypher project. Product: dump → one note agents read → writeback. Session 2 should start warm. Do not: invent dumps, gate bind on a github token, or treat try hypher as the home. Next: confirm silent synthesis thickened this note without a generate button.";
    const merge = "Merge PR 62 and deploy Convex so production memory and packet compile drop the dump echo";
    const locked: HypherMcpContext = {
      ...context,
      projectContexts: {
        p1: {
          project,
          memory: {
            ...memory,
            summary: dump,
            currentGoal: "",
            currentDirection: "",
            recentChanges: [
              "Changelog titles are not session identity. Do not widen OAuth. Pulse stays three panels. Do not rebuild the canvas.",
              "Wait-for-review next when merge is locked. Do not widen OAuth. Pulse stays three panels. Do not rebuild the canvas.",
            ],
            nextActions: [
              {
                id: "continue",
                title: "Continue: Dogfood dump on the real hypher project.",
                rationale: "Compiled from the latest dump or writeback.",
                status: "suggested",
                createdAt: 92,
                updatedAt: 92,
              },
              {
                id: "dump-next",
                title: "confirm silent synthesis thickened this note without a generate button",
                rationale: "Compiled from the latest dump or writeback.",
                status: "suggested",
                createdAt: 91,
                updatedAt: 91,
              },
              {
                id: "na",
                title: merge,
                rationale: "Compiled from the latest dump or writeback.",
                status: "suggested",
                createdAt: 90,
                updatedAt: 90,
              },
            ],
          },
          captures: [{
            id: "n-dump",
            kind: "note",
            content: dump,
            maturity: "fleeting",
            projectId: "p1",
            createdAt: 1,
            modifiedAt: 30,
          }],
          actions: [],
          agentEvents: [
            {
              id: "changelog",
              userId: "u1",
              projectId: "p1",
              source: "cursor",
              kind: "handoff",
              title: "Changelog titles are not session identity",
              body: "Do not widen OAuth. Pulse stays three panels. Do not rebuild the canvas. Do not merge until reviewed.",
              status: "reviewed",
              createdAt: 110,
            },
            {
              id: "wait-lock",
              userId: "u1",
              projectId: "p1",
              source: "cursor",
              kind: "handoff",
              title: "Wait-for-review next when merge is locked",
              body: "Do not widen OAuth. Pulse stays three panels. Do not rebuild the canvas. Do not merge until reviewed.",
              suggestedActions: [merge],
              status: "new",
              createdAt: 90,
            },
          ],
          handoffs: [],
          subscription: { status: "active", plan: "pro_monthly" },
        },
      },
    };
    const state = buildMcpToolResult("get_current_state", { projectId: "p1" }, locked).structuredContent;
    const recentChanges = Array.isArray(state.recentChanges) ? state.recentChanges.map(String) : [];
    expect(String(state.currentState)).toBe("Wait-for-review next when merge is locked");
    expect(recentChanges[0]).toBe("Wait-for-review next when merge is locked.");
    expect(recentChanges.join("\n")).not.toMatch(/Changelog titles/);
    expect(recentChanges.join("\n")).not.toMatch(/Packet current state/);
    const move = buildMcpToolResult("get_next_move", { projectId: "p1" }, locked).structuredContent;
    const brief = String(buildMcpToolResult("get_project_context", { projectId: "p1" }, locked).structuredContent.context);
    expect(String(move.nextMove)).not.toMatch(/Merge PR 62/i);
    expect(String(move.nextMove)).not.toMatch(/silent synthesis/i);
    expect(String(move.nextMove)).not.toMatch(/Continue:/i);
    expect(String(move.nextMove)).toBe("Wait for review before merging PR 62");
    expect(String(move.rationale)).not.toMatch(/Compiled from the latest dump/i);
    expect(String(move.rationale)).toBe("Start with Wait for review before merging PR 62.");
    expect(brief).not.toMatch(/- Next action:.*Merge PR 62/i);
    expect(brief).toMatch(/Wait for review before merging PR 62/);
    expect(brief).not.toMatch(/Compiled from the latest dump/);
    expect(brief).toMatch(/Suggested next move: Start with Wait for review before merging PR 62/);
    expect(brief).toMatch(/Do not merge until reviewed/);
  });

  it("recovers wait-for-review identity when OAuth recency-12 is all compiler changelog", () => {
    const dump =
      "Dogfood dump on the real hypher project. Product: dump → one note agents read → writeback. Session 2 should start warm. Do not: invent dumps, gate bind on a github token, or treat try hypher as the home. Next: confirm silent synthesis thickened this note without a generate button.";
    const merge = "Merge PR 62 and deploy Vercel plus Convex so production get_project_context drops the dump echo";
    const latestBody = "Do not widen OAuth. Pulse stays three panels. Do not rebuild the canvas. Do not merge until reviewed. GitHub is a signal. Cursor is the door.";
    const changelogEvents: AgentEvent[] = Array.from({ length: 12 }, (_, index) => ({
      id: `cl-${index}`,
      userId: "u1",
      projectId: "p1",
      source: "cursor",
      kind: "handoff",
      title: `Changelog titles leave OAuth recency-12 ${index}`,
      body: latestBody,
      status: "reviewed",
      createdAt: 2000 - index,
    }));
    const oauthShaped: HypherMcpContext = {
      ...context,
      projectContexts: {
        p1: {
          project,
          memory: {
            ...memory,
            summary: dump,
            currentGoal: "",
            currentDirection: "",
            recentChanges: changelogEvents.slice(0, 6).map((event) => `${event.title}. ${latestBody}`),
            nextActions: [
              {
                id: "continue",
                title: "Continue: Dogfood dump on the real hypher project.",
                rationale: "Compiled from the latest dump or writeback.",
                status: "suggested",
                createdAt: 92,
                updatedAt: 92,
              },
              {
                id: "na",
                title: merge,
                rationale: "Compiled from the latest dump or writeback.",
                status: "suggested",
                createdAt: 90,
                updatedAt: 90,
              },
            ],
          },
          captures: [{
            id: "n-dump",
            kind: "note",
            content: dump,
            maturity: "fleeting",
            projectId: "p1",
            createdAt: 1,
            modifiedAt: 30,
          }],
          actions: [],
          agentEvents: changelogEvents,
          handoffs: [],
          subscription: { status: "active", plan: "pro_monthly" },
        },
      },
    };
    const state = buildMcpToolResult("get_current_state", { projectId: "p1" }, oauthShaped).structuredContent;
    const move = buildMcpToolResult("get_next_move", { projectId: "p1" }, oauthShaped).structuredContent;
    const brief = String(buildMcpToolResult("get_project_context", { projectId: "p1" }, oauthShaped).structuredContent.context);
    const recentChanges = Array.isArray(state.recentChanges) ? state.recentChanges.map(String) : [];
    expect(String(state.currentState)).toBe("Wait for review before merging PR 62");
    expect(recentChanges[0]).toBe("Wait for review before merging PR 62.");
    expect(recentChanges.join("\n")).not.toMatch(/Changelog titles/);
    expect(String(move.nextMove)).toBe("Wait for review before merging PR 62");
    expect(brief).toMatch(/- Short summary: Wait for review before merging PR 62/);
    expect(brief).toMatch(/- Next action: \[next:suggested\] Wait for review before merging PR 62/);
    expect(brief).not.toMatch(/- Short summary: Dogfood dump/);
    expect(brief).not.toMatch(/- Short summary: Changelog titles/);
    expect(brief).toMatch(/Cursor is the door/);
    expect(brief).toMatch(/GitHub is a signal/);
    expect(brief).toContain("- Target tool: Cursor");
    expect(brief).not.toContain("- Target tool: GitHub");
  });

  it("prepares a concise handoff with account-linking wording", () => {
    const result = buildMcpToolResult("prepare_handoff", { projectId: "p1" }, context);

    expect(result.structuredContent.handoff).toContain("Connect your Hypher account to Cursor");
    expect(result.structuredContent.handoff).not.toContain("connect ChatGPT subscription");
  });

  it("resolves a GitHub repo URL to the linked Hypher project", () => {
    const result = buildMcpToolResult(
      "resolve_project_for_repo",
      { repo: "git@github.com:litterthanlit/hypher.git", branch: "main" },
      context
    );

    expect(result.structuredContent).toMatchObject({
      matched: true,
      projectId: "p1",
      projectName: "Hypher",
    });
  });

  it("returns an unmatched repo with an Integrations link", () => {
    const result = buildMcpToolResult(
      "resolve_project_for_repo",
      { repo: "acme/unknown" },
      context
    );

    expect(result.structuredContent).toMatchObject({
      matched: false,
      projectId: null,
      integrationsUrl: "https://hypher.app/app/settings/integrations",
    });
  });

  it("defaults post_agent_event source to cursor", () => {
    expect(
      parsePostAgentEventArgs({
        kind: "handoff",
        title: "Session wrap",
        body: "Shipped the Cursor plugin slice.",
        projectId: "p1",
        repo: "litterthanlit/hypher",
      })
    ).toMatchObject({
      projectId: "p1",
      payload: {
        source: "cursor",
        kind: "handoff",
        title: "Session wrap",
      },
    });
  });

  it("formats a successful writeback confirmation", () => {
    expect(
      formatAgentEventWriteResult({
        ok: true,
        eventId: "e1",
        matchedProjectId: "p1",
        matchedProjectName: "Hypher",
        needsReview: false,
      }).content[0]?.text
    ).toContain("Logged to Hypher → Project Pulse (Hypher) / Agent Inbox.");
  });
});

describe("agent-side synthesis MCP tools", () => {
  const compiledMemory = {
    summary: "Hypher stores the note; agents compile identity on their model.",
    currentGoal: "Ship agent-side synthesis without hosting the brain.",
    currentDirection: "Product stays dump → one note → writeback.",
    recentChanges: ["Added get_synthesis_input and write_project_memory."],
    importantDecisions: ["Pulse stays three panels."],
    constraints: ["Do not widen OAuth.", "Do not rebuild the canvas."],
    openQuestions: ["Can cloud agents thicken a heuristic note in one call?"],
    activeTasks: ["Write compiled identity back once."],
    blockers: [],
    staleAssumptions: [],
    nextActions: [
      {
        title: "Call write_project_memory once",
        rationale: "Hypher stores the compiled note.",
      },
    ],
  };

  it("returns generation input and the existing buildProjectMemoryPrompt for get_synthesis_input", () => {
    const result = buildMcpToolResult("get_synthesis_input", { projectId: "p1" }, context);
    const structured = result.structuredContent;

    expect(structured.projectId).toBe("p1");
    expect(structured.identityKind).toBe("heuristic");
    expect(structured.needsSynthesis).toBe(true);
    expect(String(structured.prompt)).toContain("PROJECT_MEMORY_INPUT_JSON");
    expect(String(structured.prompt)).toContain("untrusted data");
    expect(String(structured.prompt)).toContain("Keep Hypher Stripe subscriptions as the entitlement source.");
    expect(result.content[0]?.text).toContain("write_project_memory");
    expect(result.content[0]?.text).not.toContain("ANTHROPIC_API_KEY");
    expect(JSON.stringify(structured.generationInput)).toContain("Keep Hypher Stripe subscriptions as the entitlement source.");
    expect(JSON.stringify(structured.generationInput)).toContain("Context endpoint shipped");
  });

  it("drops GitHub signal events from synthesis input", () => {
    const withGithub: HypherMcpContext = {
      ...context,
      projectContexts: {
        p1: {
          ...context.projectContexts.p1!,
          agentEvents: [
            ...agentEvents,
            {
              id: "gh1",
              userId: "u1",
              projectId: "p1",
              source: "github",
              kind: "build_log",
              title: "CI failed on main",
              body: "Do not ingest this as identity.",
              status: "new",
              createdAt: 80,
            },
          ],
        },
      },
    };
    const result = buildMcpToolResult("get_synthesis_input", { projectId: "p1" }, withGithub);
    const events = (result.structuredContent.generationInput as { events: Array<{ source: string; title: string }> }).events;
    expect(events.some((event) => event.source === "github")).toBe(false);
    expect(events.some((event) => event.title === "CI failed on main")).toBe(false);
    expect(events.some((event) => event.title === "Context endpoint shipped")).toBe(true);
  });

  it("skips synthesis when identity is already compiled", () => {
    const compiled: HypherMcpContext = {
      ...context,
      projectContexts: {
        p1: {
          ...context.projectContexts.p1!,
          memory: {
            ...memory,
            model: "agent-synthesis:cursor",
          },
        },
      },
    };
    const result = buildMcpToolResult("get_synthesis_input", { projectId: "p1" }, compiled);
    expect(result.structuredContent.identityKind).toBe("compiled");
    expect(result.structuredContent.needsSynthesis).toBe(false);
    expect(result.content[0]?.text).toContain("already compiled");
  });

  it("parses write_project_memory args from an object or JSON string", () => {
    expect(parseWriteProjectMemoryArgs({ projectId: "p1", memory: compiledMemory })).toMatchObject({
      projectId: "p1",
      source: "cursor",
    });
    expect(JSON.parse(parseWriteProjectMemoryArgs({ projectId: "p1", memory: compiledMemory }).compiledJson)).toMatchObject({
      summary: compiledMemory.summary,
    });
    expect(
      parseWriteProjectMemoryArgs({
        projectId: "p1",
        memoryJson: `\`\`\`json\n${JSON.stringify(compiledMemory)}\n\`\`\``,
        source: "claude",
      }).source
    ).toBe("claude");
  });

  it("rejects write_project_memory without compiled JSON", () => {
    expect(() => parseWriteProjectMemoryArgs({ projectId: "p1" })).toThrow("missing-compiled-memory");
  });

  it("formats a successful memory write", () => {
    expect(
      formatWriteProjectMemoryResult({
        ok: true,
        projectId: "p1",
        identityKind: "compiled",
        model: "agent-synthesis:cursor",
      }).content[0]?.text
    ).toContain("Next get_project_context will be warmer");
  });
});
