import { describe, expect, it } from "vitest";
import type { ActivityEntry, AgentEvent, AnyObject, Project, ProjectAction, ProjectMemory } from "@/types";
import {
  BUILDER_BRIEF_COPY_ERROR_TOAST,
  BUILDER_BRIEF_COPY_LABEL,
  BUILDER_BRIEF_COPY_SUCCESS_TOAST,
  agentEventNeedsHumanAccept,
  buildProjectContextInput,
  buildProjectPulseModel,
  builderBriefFields,
  livePulseBriefPacket,
} from "./projectPulse";
import { compileBuilderBrief } from "./projectContext";

const project: Project = {
  id: "p1",
  kind: "project",
  name: "Hypher",
  description: "Capture-first workspace",
  status: "active",
  createdAt: 1,
  modifiedAt: 10,
};

const objects: AnyObject[] = [
  project,
  {
    id: "n-old",
    kind: "note",
    content: "Older note",
    maturity: "fleeting",
    projectId: "p1",
    createdAt: 2,
    modifiedAt: 20,
  },
  {
    id: "n-new",
    kind: "note",
    content: "Newer note",
    maturity: "fleeting",
    projectId: "p1",
    createdAt: 3,
    modifiedAt: 30,
  },
];

const activity: ActivityEntry[] = [
  {
    id: "a1",
    action: "created",
    objectId: "n-new",
    objectKind: "note",
    objectName: "Newer note",
    timestamp: 40,
    projectId: "p1",
  },
];

const memory: ProjectMemory = {
  id: "m1",
  projectId: "p1",
  summary: "Hypher is tightening activation.",
  currentDirection: "Make capture become project memory quickly.",
  recentChanges: ["Capture empty state updated"],
  openQuestions: ["How should agent entries appear?"],
  nextActions: [
    {
      id: "na1",
      title: "Run a first-user smoke test",
      rationale: "Validates the activation loop.",
      status: "suggested",
      createdAt: 50,
      updatedAt: 50,
    },
  ],
  generatedAt: 60,
  sourceUpdatedAt: 40,
  model: "test",
};

describe("buildProjectPulseModel", () => {
  it("keeps the project object out of latest captures and sorts items newest first", () => {
    const model = buildProjectPulseModel({
      project,
      allObjects: objects,
      activity,
      memories: [memory],
    });

    expect(model.latestCaptures.map((item) => item.id)).toEqual(["n-new", "n-old"]);
    expect(model.memory?.summary).toBe("Hypher is tightening activation.");
    expect(model.primaryNextAction?.title).toBe("Run a first-user smoke test");
    expect(model.recentActivity.map((entry) => entry.id)).toEqual(["a1"]);
  });

  it("uses the same next move as the compiled brief when memory still has Continue dump", () => {
    const echoed: ProjectMemory = {
      ...memory,
      nextActions: [{
        id: "echo",
        title: "Continue: Dogfood dump on the real hypher project.",
        rationale: "Compiled from the latest dump or writeback.",
        status: "suggested",
        createdAt: 50,
        updatedAt: 50,
      }],
    };
    const events: AgentEvent[] = [{
      id: "session-2",
      userId: "u1",
      projectId: "p1",
      source: "cursor",
      kind: "handoff",
      title: "Session 2 writeback",
      body: "Do not widen OAuth. Pulse stays three panels. Do not rebuild the canvas.",
      suggestedActions: ["Keep the packet warmer than PRODUCT.md"],
      status: "reviewed",
      createdAt: 90,
    }];
    const model = buildProjectPulseModel({
      project,
      allObjects: objects,
      activity,
      memories: [echoed],
      agentEvents: events,
    });
    const pulse = builderBriefFields(echoed, { captures: objects, agentEvents: events });
    expect(model.primaryNextAction?.title).toBe("Keep the packet warmer than PRODUCT.md");
    expect(pulse.nextMove).toBe(model.primaryNextAction?.title);
  });
});

describe("buildProjectContextInput", () => {
  it("maps Project Pulse data into compiler input without browser state", () => {
    const actions: ProjectAction[] = [
      {
        id: "pa1",
        userId: "u1",
        projectId: "p1",
        title: "Copy Builder Brief",
        status: "accepted",
        sourceType: "manual",
        createdAt: 70,
        updatedAt: 70,
      },
    ];
    const agentEvents: AgentEvent[] = [
      {
        id: "e1",
        userId: "u1",
        projectId: "p1",
        source: "openclaw",
        kind: "handoff",
        title: "Smoke test passed",
        body: "Matched handoff reached Project Pulse.",
        status: "new",
        createdAt: 80,
      },
    ];

    const input = buildProjectContextInput({
      project,
      model: buildProjectPulseModel({ project, allObjects: objects, activity, memories: [memory] }),
      actionQueue: actions,
      agentEvents,
    });

    expect(input).toEqual({
      project,
      memory,
      captures: [objects[2], objects[1]],
      activity: [activity[0]],
      actions,
      agentEvents,
    });
  });
});

describe("Builder Brief UI copy", () => {
  it("uses Copy brief as the Pulse primary action", () => {
    expect(BUILDER_BRIEF_COPY_LABEL).toBe("Copy brief");
    expect(BUILDER_BRIEF_COPY_SUCCESS_TOAST).toBe("Brief copied");
    expect(BUILDER_BRIEF_COPY_ERROR_TOAST).toBe("Could not copy brief");
    expect(BUILDER_BRIEF_COPY_LABEL).not.toMatch(/generate memory/i);
  });
});

describe("builderBriefFields", () => {
  it("treats missing or skeleton summaries as an empty brief", () => {
    expect(builderBriefFields(null).empty).toBe(true);
    expect(
      builderBriefFields({
        ...memory,
        summary: "No summary captured yet",
      }).empty,
    ).toBe(true);
    expect(builderBriefFields(memory).empty).toBe(false);
    expect(builderBriefFields(memory).direction).toBe("Make capture become project memory quickly.");
  });

  it("uses the same next move as get_project_context instead of a stored dump echo", () => {
    const echoed: ProjectMemory = {
      ...memory,
      nextActions: [
        {
          id: "echo",
          title: "Continue: Dogfood dump on the real hypher project.",
          rationale: "Compiled from the latest dump or writeback.",
          status: "suggested",
          createdAt: 50,
          updatedAt: 50,
        },
        {
          id: "real",
          title: "Keep constraints whole in compileHeuristicMemory",
          rationale: "Packet quality.",
          status: "suggested",
          createdAt: 51,
          updatedAt: 51,
        },
      ],
      constraints: ["Do not: invent dumps, gate bind on a github token, or treat try hypher as the home."],
    };
    const pulse = builderBriefFields(echoed, { actions: [], captures: objects });
    const packet = compileBuilderBrief({
      project,
      memory: echoed,
      captures: objects.filter((item) => item.kind !== "project"),
      actions: [],
      agentEvents: [],
    });
    const nextLine = packet.match(/^- Next action: (.+)$/m)?.[1] ?? "";
    expect(pulse.nextMove).toBe("Keep constraints whole in compileHeuristicMemory");
    expect(nextLine).toContain("Keep constraints whole in compileHeuristicMemory");
    expect(pulse.nextMove).not.toMatch(/continue:/i);
    expect(pulse.constraints.some((line) => /invent dumps/i.test(line))).toBe(true);
    expect(pulse.constraints.some((line) => /github token/i.test(line))).toBe(true);

    const live = livePulseBriefPacket({
      project,
      model: buildProjectPulseModel({ project, allObjects: objects, activity, memories: [echoed] }),
      actionQueue: [],
      agentEvents: [],
      handoffs: [{
        id: "stale",
        userId: "u1",
        projectId: "p1",
        generatedAt: 1,
        targetTool: "Cursor",
        packetContent: "# Builder Brief: Hypher\n\n- Next action: Continue: Dogfood dump on the real hypher project.",
        sourceCaptures: [],
        requestedTask: "Continue: Dogfood dump on the real hypher project.",
        status: "used",
      }],
    });
    expect(live).toContain("Keep constraints whole in compileHeuristicMemory");
    expect(live).not.toMatch(/Continue: Dogfood dump on the real hypher project/);
  });

  it("uses the same last-handoff identity as the compiled brief when stored memory is a dump echo", () => {
    const dump = "Dogfood dump on the real hypher project. Product: dump → one note agents read → writeback. Session 2 should start warm. Do not: invent dumps, gate bind on a github token, or treat try hypher as the home.";
    const echoed: ProjectMemory = {
      ...memory,
      summary: dump,
      currentGoal: "Dogfood dump on the real hypher project.",
      currentDirection: "Dogfood dump on the real hypher project.",
      constraints: ["Do not: invent dumps, gate bind on a github token, or treat try hypher as the home."],
      nextActions: [{
        id: "echo",
        title: "Continue: Dogfood dump on the real hypher project.",
        rationale: "Compiled from the latest dump or writeback.",
        status: "suggested",
        createdAt: 50,
        updatedAt: 50,
      }],
    };
    const captures = [{
      id: "n-dump",
      kind: "note" as const,
      content: dump,
      maturity: "fleeting" as const,
      projectId: "p1",
      createdAt: 3,
      modifiedAt: 30,
    }];
    const events: AgentEvent[] = [{
      id: "session-2",
      userId: "u1",
      projectId: "p1",
      source: "cursor",
      kind: "handoff",
      title: "Session 2 writeback",
      body: "Do not widen OAuth. Pulse stays three panels. Do not rebuild the canvas. Next move: keep the packet warmer than PRODUCT.md.",
      suggestedActions: ["Keep the packet warmer than PRODUCT.md"],
      status: "reviewed",
      createdAt: 90,
    }];
    const pulse = builderBriefFields(echoed, { actions: [], captures, agentEvents: events });
    const packet = compileBuilderBrief({
      project,
      memory: echoed,
      captures,
      actions: [],
      agentEvents: events,
    });
    expect(pulse.summary).toBe("Session 2 writeback");
    expect(pulse.summary.toLowerCase()).not.toContain("dogfood dump");
    expect(pulse.nextMove).toBe("Keep the packet warmer than PRODUCT.md");
    expect(pulse.constraints.some((line) => /oauth/i.test(line))).toBe(true);
    expect(pulse.constraints.some((line) => /three panels/i.test(line))).toBe(true);
    expect(pulse.constraints.some((line) => /canvas/i.test(line))).toBe(true);
    expect(pulse.decisions.some((line) => /three panels/i.test(line))).toBe(true);
    expect(packet).toMatch(/- Short summary: Session 2 writeback/);
    expect(packet).toMatch(/Trying to become: Session 2 should start warm/);
    expect(packet).toContain("Keep the packet warmer than PRODUCT.md");
    expect(packet).not.toMatch(/Continue: Dogfood dump/);
    expect(pulse.nextMove).toBe(packet.match(/^- Next action: (.+)$/m)?.[1]?.replace(/^\[[^\]]+\]\s*/, ""));
  });

  it("does not show a merge next move when the brief forbids merge until reviewed", () => {
    const dump = "Dogfood dump on the real hypher project. Product: dump → one note agents read → writeback. Session 2 should start warm. Do not: invent dumps, gate bind on a github token, or treat try hypher as the home. Next: confirm silent synthesis thickened this note without a generate button.";
    const merge = "Merge PR 62 and deploy Vercel plus Convex so production get_project_context drops the dump echo";
    const echoed: ProjectMemory = {
      ...memory,
      summary: dump,
      currentGoal: "",
      currentDirection: "",
      constraints: ["Do not invent dumps"],
      nextActions: [
        {
          id: "continue",
          title: "Continue: Dogfood dump on the real hypher project.",
          rationale: "Compiled from the latest dump or writeback.",
          status: "suggested",
          createdAt: 52,
          updatedAt: 52,
        },
        {
          id: "dump-next",
          title: "confirm silent synthesis thickened this note without a generate button",
          rationale: "Compiled from the latest dump or writeback.",
          status: "suggested",
          createdAt: 51,
          updatedAt: 51,
        },
        {
          id: "echo",
          title: merge,
          rationale: "Compiled from the latest dump or writeback.",
          status: "suggested",
          createdAt: 50,
          updatedAt: 50,
        },
      ],
    };
    const captures = [{
      id: "n-dump",
      kind: "note" as const,
      content: dump,
      maturity: "fleeting" as const,
      projectId: "p1",
      createdAt: 3,
      modifiedAt: 30,
    }];
    const events: AgentEvent[] = [{
      id: "session-2",
      userId: "u1",
      projectId: "p1",
      source: "cursor",
      kind: "handoff",
      title: "Dump-only constraints keep packet slots",
      body: "Do not widen OAuth. Pulse stays three panels. Do not rebuild the canvas. Do not merge until reviewed.",
      suggestedActions: [merge],
      status: "reviewed",
      createdAt: 90,
    }];
    const pulse = builderBriefFields(echoed, { actions: [], captures, agentEvents: events });
    const model = buildProjectPulseModel({
      project,
      allObjects: captures,
      activity,
      memories: [echoed],
      agentEvents: events,
    });
    const packet = compileBuilderBrief({
      project,
      memory: echoed,
      captures,
      actions: [],
      agentEvents: events,
    });
    expect(pulse.nextMove).not.toMatch(/Merge PR 62/);
    expect(pulse.nextMove).not.toMatch(/silent synthesis/i);
    expect(pulse.nextMove).not.toMatch(/continue:/i);
    expect(pulse.summary.toLowerCase()).not.toContain("dogfood dump");
    expect(pulse.nextMove).toBe("Wait for review before merging PR 62");
    expect(model.primaryNextAction?.title).toBe("Wait for review before merging PR 62");
    expect(model.primaryNextAction?.rationale).toBe("Start with Wait for review before merging PR 62.");
    expect(packet).not.toMatch(/- Next action:.*Merge PR 62/i);
    expect(packet).not.toMatch(/Compiled from the latest dump/);
    expect(packet).toMatch(/Suggested next move: Start with Wait for review before merging PR 62/);
    expect(packet).toMatch(/Wait for review before merging PR 62/);
    expect(pulse.nextMove).toBe(packet.match(/^- Next action: (.+)$/m)?.[1]?.replace(/^\[[^\]]+\]\s*/, ""));
  });

  it("matches get_project_context when OAuth recency-12 is all compiler changelog", () => {
    const dump = "Dogfood dump on the real hypher project. Product: dump → one note agents read → writeback. Session 2 should start warm. Do not: invent dumps, gate bind on a github token, or treat try hypher as the home. Next: confirm silent synthesis thickened this note without a generate button.";
    const merge = "Merge PR 62 and deploy Vercel plus Convex so production get_project_context drops the dump echo";
    const latestBody = "Do not widen OAuth. Pulse stays three panels. Do not rebuild the canvas. Do not merge until reviewed.";
    const echoed: ProjectMemory = {
      ...memory,
      summary: dump,
      currentGoal: "",
      currentDirection: "",
      constraints: ["Do not invent dumps"],
      nextActions: [
        {
          id: "continue",
          title: "Continue: Dogfood dump on the real hypher project.",
          rationale: "Compiled from the latest dump or writeback.",
          status: "suggested",
          createdAt: 52,
          updatedAt: 52,
        },
        {
          id: "echo",
          title: merge,
          rationale: "Compiled from the latest dump or writeback.",
          status: "suggested",
          createdAt: 50,
          updatedAt: 50,
        },
      ],
    };
    const captures = [{
      id: "n-dump",
      kind: "note" as const,
      content: dump,
      maturity: "fleeting" as const,
      projectId: "p1",
      createdAt: 3,
      modifiedAt: 30,
    }];
    const events: AgentEvent[] = Array.from({ length: 12 }, (_, index) => ({
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
    const pulse = builderBriefFields(echoed, { actions: [], captures, agentEvents: events });
    const packet = compileBuilderBrief({
      project,
      memory: echoed,
      captures,
      actions: [],
      agentEvents: events,
    });
    expect(pulse.summary).toBe("Wait for review before merging PR 62");
    expect(pulse.nextMove).toBe("Wait for review before merging PR 62");
    expect(packet).toMatch(/- Short summary: Wait for review before merging PR 62/);
    expect(pulse.nextMove).toBe(packet.match(/^- Next action: (.+)$/m)?.[1]?.replace(/^\[[^\]]+\]\s*/, ""));
    expect(pulse.summary.toLowerCase()).not.toContain("dogfood dump");
    expect(pulse.summary).not.toMatch(/Changelog titles/);
  });
});

describe("agent event Accept gating", () => {
  it("requires Accept only for questions and suggestions", () => {
    expect(agentEventNeedsHumanAccept("question", "cursor")).toBe(true);
    expect(agentEventNeedsHumanAccept("suggestion", "cursor")).toBe(true);
    expect(agentEventNeedsHumanAccept("handoff", "cursor")).toBe(false);
    expect(agentEventNeedsHumanAccept("build_log", "cursor")).toBe(false);
    expect(agentEventNeedsHumanAccept("build_log", "github")).toBe(false);
  });
});
