import { describe, expect, it, vi } from "vitest";
import type { AgentEvent, AnyObject, Handoff, Project, ProjectAction, ProjectMemory } from "@/types";
import { compileBuilderBrief, compileProjectContext, compileProjectContextWithMeta } from "./projectContext";

const project: Project = {
  id: "p1",
  kind: "project",
  name: "Hypher",
  description: "Context control layer for AI builders.",
  status: "active",
  createdAt: 1,
  modifiedAt: 100,
  githubRepo: "litterthanlit/hypher",
};

const memory: ProjectMemory = {
  id: "m1",
  projectId: "p1",
  summary: "Hypher keeps AI builder agents on track by crystallizing project activity into live execution context.",
  currentGoal: "Ship the first Builder Brief workflow inside Project Pulse.",
  currentDirection: "Use the existing compiler and Project Pulse flow instead of creating duplicate context systems.",
  recentChanges: ["Project Pulse already saves handoff packets", "The protected context API route exists"],
  importantDecisions: [
    "The Builder Brief is the core product primitive.",
    "Captures are input. Crystallized Context is the product. Builder Brief is the output.",
  ],
  constraints: [
    "The compiler must remain pure and deterministic.",
    "Do not build OAuth yet.",
    "Do not introduce a new state manager unless necessary.",
  ],
  openQuestions: ["Should Do Not Do become a first-class memory field later?"],
  activeTasks: ["Rename user-facing packet language to Builder Brief"],
  blockers: ["Need compiler tests before implementation"],
  staleAssumptions: ["Agent Context Packet is still the preferred product name."],
  nextActions: [
    {
      id: "na1",
      title: "Implement Copy Builder Brief in Project Pulse",
      rationale: "This makes Hypher's context control loop agent-ready.",
      requiredContext: ["Project Pulse", "project memory", "action queue"],
      suggestedTargetTool: "Cursor",
      confidence: 0.82,
      sourceCaptureIds: ["n1", "a1"],
      status: "accepted",
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
    content: "Don't build MCP yet. Builder Brief comes before delivery integrations.",
    maturity: "developing",
    projectId: "p1",
    captureType: "decision",
    pinnedAsDecision: true,
    createdAt: 50,
    modifiedAt: 70,
  },
  {
    id: "n2",
    kind: "note",
    content: "  # pasted heading\n\n\n```ts\nconst token = 'redacted';\n```  ",
    maturity: "fleeting",
    projectId: "p1",
    createdAt: 40,
    modifiedAt: 60,
  },
  {
    id: "n-stale",
    kind: "note",
    content: "Treat Agent Context Packet as the permanent product name.",
    maturity: "fleeting",
    projectId: "p1",
    stale: true,
    createdAt: 30,
    modifiedAt: 55,
  },
  {
    id: "a1",
    kind: "artifact",
    name: "Project Pulse mock",
    type: "image",
    projectId: "p1",
    createdAt: 40,
    modifiedAt: 50,
  },
];

const actions: ProjectAction[] = [
  {
    id: "pa1",
    userId: "u1",
    projectId: "p1",
    title: "Add Builder Brief compiler tests",
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
    source: "codex",
    kind: "handoff",
    title: "Current build audited",
    body: "Found existing compiler, Project Pulse copy flow, protected context API, and MCP context tool.",
    suggestedActions: ["Adapt compiler instead of duplicating it"],
    status: "new",
    createdAt: 95,
  },
];

const handoffs: Handoff[] = [
  {
    id: "h1",
    userId: "u1",
    projectId: "p1",
    generatedAt: 85,
    targetTool: "Cursor",
    packetContent: "# Old packet",
    sourceCaptures: ["n1"],
    requestedTask: "Ship Copy Agent Context v1",
    status: "used",
  },
];

describe("compileBuilderBrief", () => {
  it("builds Builder Brief v2 as an agent-ready context packet", () => {
    const packet = compileBuilderBrief({
      project,
      memory: {
        ...memory,
        activeTasks: ["Milestone: Builder Brief v2 beta", ...(memory.activeTasks ?? [])],
      },
      captures,
      actions,
      agentEvents,
      handoffs,
      generatedAt: 123,
    });

    const sections = [
      "# Builder Brief: Hypher",
      "## Project identity",
      "## Goal / direction",
      "## Recent changes",
      "## Active decisions",
      "## Open questions / blockers",
      "## Action queue",
      "## Agent instructions",
      "## Source/context hygiene",
    ];

    const indexes = sections.map((section) => packet.indexOf(section));
    expect(indexes.every((index) => index >= 0)).toBe(true);
    expect([...indexes].sort((a, b) => a - b)).toEqual(indexes);
    expect(packet).toContain("- Project name: Hypher");
    expect(packet).toContain("- Active milestone: Builder Brief v2 beta");
    expect(packet).toContain("- [capture:decision] Don't build MCP yet. Builder Brief comes before delivery integrations.");
    expect(packet).toContain("- [agent:codex/handoff] Current build audited.");
    expect(packet).toContain("- [handoff:Cursor/used] Previous Cursor brief was used: Ship Copy Agent Context v1.");
    expect(packet).toContain("- Freshness timestamp: 1970-01-01T00:00:00.123Z");
    expect(packet).toContain("- Compact mode: off");
  });

  it("builds the Builder Brief sections in a fixed order", () => {
    const packet = compileBuilderBrief({
      project,
      memory,
      captures,
      actions,
      agentEvents,
      handoffs,
      generatedAt: 123,
    });

    const sections = [
      "# Builder Brief: Hypher",
      "## Project identity",
      "## Goal / direction",
      "## Recent changes",
      "## Active decisions",
      "## Open questions / blockers",
      "## Action queue",
      "## Agent instructions",
      "## Source/context hygiene",
    ];

    const indexes = sections.map((section) => packet.indexOf(section));
    expect(indexes.every((index) => index >= 0)).toBe(true);
    expect([...indexes].sort((a, b) => a - b)).toEqual(indexes);
  });

  it("renders crystallized project state and anti-drift instructions", () => {
    const packet = compileBuilderBrief({
      project,
      memory,
      captures,
      actions,
      agentEvents,
      handoffs,
      generatedAt: 123,
    });

    expect(packet).toContain("Hypher keeps AI builder agents on track");
    expect(packet).toContain("Ship the first Builder Brief workflow inside Project Pulse.");
    expect(packet).toContain("Implement Copy Builder Brief in Project Pulse");
    expect(packet).toContain("- Next action: [next:accepted] Implement Copy Builder Brief in Project Pulse");
    expect(packet).toContain("- [memory:decision] The Builder Brief is the core product primitive.");
    expect(packet).toContain("- [capture:decision] Don't build MCP yet. Builder Brief comes before delivery integrations.");
    expect(packet).toContain("- [memory:constraint] The compiler must remain pure and deterministic.");
    expect(packet).toContain("- [memory:constraint] Do not build OAuth yet.");
    expect(packet).toContain("- [memory:constraint] Do not introduce a new state manager unless necessary.");
    expect(packet).toContain("- [memory:recent_change] Project Pulse already saves handoff packets");
    expect(packet).toContain("- [action:accepted] Add Builder Brief compiler tests");
    expect(packet).toContain("- [memory:stale_assumption] Do not assume: Agent Context Packet is still the preferred product name.");
    expect(packet).toContain("- [criteria] Current Task is completed or clearly blocked with reasons.");
    expect(packet).toContain("- [handoff:Cursor/used] Previous Cursor brief was used: Ship Copy Agent Context v1.");
    expect(packet).not.toContain("Old dismissed action");
  });

  it("keeps output deterministic and compatible with compileProjectContext", () => {
    const params = {
      project,
      memory,
      captures,
      actions,
      agentEvents,
      handoffs,
      generatedAt: 123,
    };

    expect(compileBuilderBrief(params)).toBe(compileBuilderBrief(params));
    expect(compileProjectContext(params)).toBe(compileBuilderBrief(params));
  });

  it("defaults freshness timestamp from sources instead of wall clock time", () => {
    try {
      vi.useFakeTimers();
      vi.setSystemTime(1_000);
      const first = compileBuilderBrief({ project, memory, captures, actions, agentEvents, handoffs });
      vi.setSystemTime(9_000);
      const second = compileBuilderBrief({ project, memory, captures, actions, agentEvents, handoffs });

      expect(first).toBe(second);
      expect(first).toContain("- Freshness timestamp: 1970-01-01T00:00:00.100Z");
    } finally {
      vi.useRealTimers();
    }
  });

  it("uses clear empty states when optional data is missing", () => {
    const packet = compileBuilderBrief({
      project: { ...project, description: "" },
      captures: [],
      actions: [],
      agentEvents: [],
      generatedAt: 123,
    });

    expect(packet).toContain("# Builder Brief: Hypher");
    expect(packet).toContain("No short summary captured yet.");
    expect(packet).toContain("No product direction captured yet.");
    expect(packet).toContain("No current task captured yet.");
    expect(packet).toContain("- No active tasks recorded yet.");
    expect(packet).toContain("- No accepted decisions captured yet.");
    expect(packet).toContain("- No constraints recorded yet.");
    expect(packet).toContain("- No explicit Do Not Do items recorded yet.");
    expect(packet).toContain("- No recent changes captured yet.");
    expect(packet).toContain("- No unresolved questions captured yet.");
    expect(packet).toContain("- No agent warnings recorded yet.");
    expect(packet).toContain("- No task-specific acceptance criteria recorded yet.");
    expect(packet).toContain("- No handoff notes recorded yet.");
    expect(packet).toContain("- Target tool: Cursor");
    expect(packet).not.toContain("Target tool: ChatGPT");
    expect(packet).not.toContain("Paste this");
    expect(packet).not.toContain("paste this into ChatGPT");
  });

  it("defaults the inferred target tool to Cursor instead of ChatGPT", () => {
    const result = compileProjectContextWithMeta({
      project: { ...project, description: "" },
      captures: [],
      actions: [],
      agentEvents: [],
      task: "Think through the next milestone",
      generatedAt: 123,
    });

    expect(result.targetTool).toBe("Cursor");
    expect(result.packet).toContain("- Target tool: Cursor");
    expect(result.packet).not.toContain("Target tool: ChatGPT");
    expect(result.packet).not.toContain("Paste this Builder Brief");
    expect(result.packet).not.toContain("paste this into ChatGPT");
    expect(result.packet).not.toContain("keyboard tour");
    expect(result.packet).not.toContain("digest teaser");
    expect(result.packet).not.toContain("sample daily digest");
    expect(result.packet).toMatch(/^# Builder Brief: Hypher/m);
  });

  it("still infers ChatGPT when the task names it, without wrapping the packet as a paste recipe", () => {
    const result = compileProjectContextWithMeta({
      project,
      captures: [],
      actions: [],
      agentEvents: [],
      task: "Draft a ChatGPT connector prompt",
      generatedAt: 123,
    });

    expect(result.targetTool).toBe("ChatGPT");
    expect(result.packet).toContain("- Target tool: ChatGPT");
    expect(result.packet).not.toContain("Paste this");
    expect(result.packet).not.toContain("paste this into ChatGPT");
    expect(result.packet).toMatch(/^# Builder Brief: Hypher/m);
  });

  it("puts unanswered agent questions under Unresolved questions", () => {
    const packet = compileBuilderBrief({
      project,
      memory: { ...memory, openQuestions: [] },
      captures,
      actions,
      agentEvents: [{
        id: "q1",
        userId: "u1",
        projectId: "p1",
        source: "cursor",
        kind: "question",
        title: "Should failing CI land in Pulse?",
        body: "The thin GitHub loop should ask a human.",
        status: "new",
        createdAt: 200,
      }],
      generatedAt: 123,
    });

    expect(packet).toContain("- [agent:cursor/question] Should failing CI land in Pulse?");
  });

  it("applies item limits and keeps raw captures from overwhelming crystallized state", () => {
    const noisyCaptures = Array.from({ length: 8 }, (_, index): AnyObject => ({
      id: `n-${index}`,
      kind: "note",
      content: `Raw capture ${index}`,
      maturity: "fleeting",
      projectId: "p1",
      createdAt: index,
      modifiedAt: index,
    }));

    const packet = compileBuilderBrief({
      project,
      memory,
      captures: noisyCaptures,
      actions,
      agentEvents,
      limits: { captures: 2, decisions: 1, constraints: 2, actions: 1 },
      generatedAt: 123,
    });

    expect(packet).toContain("- [memory:decision] The Builder Brief is the core product primitive.");
    expect(packet).toContain("- [capture:note] Raw capture 7");
    expect(packet).toContain("- [capture:note] Raw capture 6");
    expect(packet).not.toContain("Raw capture 5");
    expect(packet).not.toContain("Raw capture 0");
    expect(packet).toContain("- [action:accepted] Add Builder Brief compiler tests");
    expect(packet).toContain("- Compact mode: on");
  });

  it("normalizes messy markdown content without leaking private ids", () => {
    const packet = compileBuilderBrief({
      project: {
        ...project,
        description: "Line one\n\n```secret-ish block```\n# pasted heading",
      },
      memory: {
        ...memory,
        summary: "",
        importantDecisions: ["  # Customer pasted heading\n\n\n```ts\nconst token = 'redacted';\n```  "],
        constraints: ["  Keep   whitespace\n\nreadable.  "],
      },
      captures: [captures[1]],
      actions,
      agentEvents: [],
      generatedAt: 123,
    });

    expect(packet).toContain("Line one ```secret-ish block``` # pasted heading");
    expect(packet).toContain("- [memory:decision] # Customer pasted heading ```ts const token = 'redacted'; ```");
    expect(packet).toContain("- [memory:constraint] Keep whitespace readable.");
    expect(packet).not.toContain("internal-note-id");
    expect(packet).not.toContain("action-secret-id");
    expect(packet).not.toContain("event-secret-id");
    expect(packet).not.toContain("user-secret-id");
  });

  it("returns source metadata and excludes stale, archived, and explicitly excluded captures", () => {
    const result = compileProjectContextWithMeta({
      project,
      memory,
      captures: [
        captures[1],
        { ...captures[2], excludeFromPackets: true },
        { ...captures[3], stale: true },
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
      generatedAt: 123,
    });

    expect(result.sourceCaptureIds).toEqual(["n1"]);
    expect(result.excludedSourceCaptureIds).toEqual(["n2", "n-stale", "n-archived"]);
    expect(result.targetTool).toBe("Cursor");
    expect(result.requestedTask).toBe("Implement Copy Builder Brief in Project Pulse");
    expect(result.packet).toContain("# Builder Brief: Hypher");
  });

  it("includes returned agent output in handoff notes without dumping the full result", () => {
    const longReturnedOutput = `Implemented the Copy Builder Brief button and tests. ${"Detailed log line. ".repeat(80)}`;
    const packet = compileBuilderBrief({
      project,
      memory,
      captures,
      actions,
      agentEvents: [],
      handoffs: [
        {
          ...handoffs[0]!,
          returnedAgentOutput: longReturnedOutput,
          userNotes: "Use this result as recent progress in the next Builder Brief.",
        },
      ],
      generatedAt: 123,
    });

    expect(packet).toContain("- [handoff:Cursor/result] Agent result from previous Cursor brief: Implemented the Copy Builder Brief button and tests.");
    expect(packet).toContain("- [handoff:Cursor/result] User note on previous Cursor brief: Use this result as recent progress in the next Builder Brief.");
    expect(packet).not.toContain("Detailed log line. Detailed log line. Detailed log line. Detailed log line. Detailed log line.");
  });

  it("renders accepted crystallized memory fields in Builder Brief sections", () => {
    const packet = compileBuilderBrief({
      project,
      memory: {
        ...memory,
        constraints: [
          ...(memory.constraints ?? []),
          "Do not silently mutate durable state.",
        ],
        acceptanceCriteria: ["Accepted suggestions appear in future Builder Briefs."],
        agentWarnings: ["Watch for duplicate accepted suggestions."],
        handoffNotes: ["A returned agent result was accepted into project memory."],
      },
      captures,
      actions,
      agentEvents: [],
      handoffs: [],
      generatedAt: 123,
    });

    expect(packet).toContain("- [memory:constraint] Do not silently mutate durable state.");
    expect(packet).toContain("- [memory:acceptance_criterion] Accepted suggestions appear in future Builder Briefs.");
    expect(packet).toContain("- [memory:agent_warning] Watch for duplicate accepted suggestions.");
    expect(packet).toContain("- [memory:handoff_note] A returned agent result was accepted into project memory.");
    expect(packet).not.toContain("Unaccepted suggestion");
  });

  it("keeps stale and excluded accepted crystallized memory out of Builder Briefs", () => {
    const packet = compileBuilderBrief({
      project,
      memory: {
        ...memory,
        importantDecisions: [
          "Decision: keep active memory.",
          "Decision: stale memory should not guide agents.",
        ],
        constraints: [
          "Keep the compiler deterministic.",
          "Do not use stale delivery advice.",
        ],
        acceptanceCriteria: [
          "Active criteria stay visible.",
          "Excluded criteria should not appear.",
        ],
        agentWarnings: [
          "Watch active warning.",
          "Watch stale warning.",
        ],
        handoffNotes: [
          "Active handoff note.",
          "Excluded handoff note.",
        ],
        acceptedCrystallizedSuggestions: [
          {
            kind: "decision",
            text: "Decision: stale memory should not guide agents.",
            sourceType: "capture",
            sourceId: "capture-stale",
            suggestionId: "suggestion-stale-decision",
            createdAt: 10,
            status: "stale",
            updatedAt: 20,
          },
          {
            kind: "do_not_do",
            text: "Do not use stale delivery advice.",
            sourceType: "capture",
            sourceId: "capture-excluded",
            suggestionId: "suggestion-excluded-do-not-do",
            createdAt: 10,
            status: "excluded",
            updatedAt: 20,
          },
          {
            kind: "acceptance_criterion",
            text: "Excluded criteria should not appear.",
            sourceType: "user_note",
            sourceId: "handoff-2",
            suggestionId: "suggestion-excluded-criteria",
            createdAt: 10,
            status: "excluded",
            updatedAt: 20,
          },
          {
            kind: "agent_warning",
            text: "Watch stale warning.",
            sourceType: "returned_agent_output",
            sourceId: "handoff-3",
            suggestionId: "suggestion-stale-warning",
            createdAt: 10,
            status: "stale",
            updatedAt: 20,
          },
          {
            kind: "handoff_note",
            text: "Excluded handoff note.",
            sourceType: "user_note",
            sourceId: "handoff-4",
            suggestionId: "suggestion-excluded-note",
            createdAt: 10,
            status: "excluded",
            updatedAt: 20,
          },
          {
            kind: "constraint",
            text: "Accepted source metadata still renders when the string array is missing.",
            sourceType: "capture",
            sourceId: "capture-active",
            suggestionId: "suggestion-active-constraint",
            createdAt: 10,
            status: "active",
            updatedAt: 20,
          },
        ],
      },
      captures,
      actions,
      agentEvents: [],
      handoffs: [],
      generatedAt: 123,
    });

    expect(packet).toContain("- [memory:decision] Decision: keep active memory.");
    expect(packet).toContain("- [memory:constraint] Keep the compiler deterministic.");
    expect(packet).toContain("- [memory:acceptance_criterion] Active criteria stay visible.");
    expect(packet).toContain("- [memory:agent_warning] Watch active warning.");
    expect(packet).toContain("- [memory:handoff_note] Active handoff note.");
    expect(packet).toContain("- [accepted memory:constraint] Accepted source metadata still renders when the string array is missing.");
    expect(packet).not.toContain("stale memory should not guide agents");
    expect(packet).not.toContain("Do not use stale delivery advice");
    expect(packet).not.toContain("Excluded criteria should not appear");
    expect(packet).not.toContain("Watch stale warning");
    expect(packet).not.toContain("Excluded handoff note");
  });

  it("puts the last product handoff first in Recent changes and lists each do-not once", () => {
    const dump =
      "Dogfood dump on the real hypher project. Product: dump → one note agents read → writeback. Session 2 should start warm. Do not: invent dumps, gate bind on a github token, or treat try hypher as the home. Next: confirm silent synthesis thickened this note without a generate button.";
    const packet = compileBuilderBrief({
      project,
      memory: {
        ...memory,
        summary: dump,
        currentGoal: "Dogfood dump on the real hypher project.",
        currentDirection: "Dogfood dump on the real hypher project.",
        recentChanges: [dump, "note got thicker. dumped on the real hypher project."],
        constraints: ["Do not: invent dumps, gate bind on a github token, or treat try hypher as the home."],
        handoffNotes: [dump],
        nextActions: [{
          id: "echo",
          title: "Continue: Dogfood dump on the real hypher project.",
          rationale: "Compiled from the latest dump or writeback.",
          status: "suggested",
          createdAt: 80,
          updatedAt: 80,
        }],
      },
      captures: [{
        id: "n-dump",
        kind: "note",
        content: dump,
        maturity: "fleeting",
        projectId: "p1",
        createdAt: 40,
        modifiedAt: 60,
      }],
      actions: [],
      agentEvents: [{
        id: "session-2",
        userId: "u1",
        projectId: "p1",
        source: "cursor",
        kind: "handoff",
        title: "Keep dump echo out of identity",
        body: "Do not widen OAuth. Pulse stays three panels. Do not rebuild the canvas. Next move: keep the packet warmer than PRODUCT.md.",
        suggestedActions: ["Keep the packet warmer than PRODUCT.md"],
        status: "reviewed",
        createdAt: 200,
      }],
      generatedAt: 200,
    });

    const recentSection = packet.split("## Recent changes")[1]?.split("##")[0] ?? "";
    const firstBullet = recentSection.split("\n").find((line) => line.startsWith("- ["));
    expect(firstBullet).toMatch(/Keep dump echo out of identity/);
    expect(recentSection).not.toMatch(/Dogfood dump on the real hypher project/);
    expect(packet).not.toMatch(/Continue: Make Hypher the default project-memory packet/);
    expect(packet).not.toMatch(/Continue: Dogfood dump on the real hypher project/);
    const constraintSection = packet.split("### Important constraints")[1]?.split("##")[0] ?? "";
    expect(constraintSection).toMatch(/Do not widen OAuth/);
    expect(constraintSection).toMatch(/Pulse stays three panels/);
    expect(constraintSection).toMatch(/Do not rebuild the canvas/);
    expect(constraintSection.match(/Do not widen OAuth/g)?.length).toBe(1);
    expect(constraintSection.match(/Pulse stays three panels/g)?.length).toBe(1);
    expect(constraintSection.match(/Do not rebuild the canvas/g)?.length).toBe(1);
  });
});
