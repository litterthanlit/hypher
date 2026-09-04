import { describe, expect, it } from "vitest";
import {
  agentEventNeedsHumanAccept,
  applyReceiptToMemory,
  compileHeuristicMemory,
  fallbackProjectMemory,
  isSkeletonSummary,
  isWorkReceipt,
} from "./projectMemoryGenerate";
import { compileBuilderBrief } from "../src/lib/projectContext";
import type { Project, ProjectMemory } from "../src/types";

const NOW = 1_700_000_000_000;

const project: Project = {
  id: "p1",
  kind: "project",
  name: "Hypher",
  description: "",
  status: "active",
  createdAt: 1,
  modifiedAt: 10,
};

function asMemory(compiled: ReturnType<typeof compileHeuristicMemory>): ProjectMemory {
  return {
    projectId: "p1",
    summary: compiled.summary,
    currentGoal: compiled.currentGoal,
    currentDirection: compiled.currentDirection,
    recentChanges: compiled.recentChanges,
    importantDecisions: compiled.importantDecisions,
    constraints: compiled.constraints,
    openQuestions: compiled.openQuestions,
    activeTasks: compiled.activeTasks,
    blockers: compiled.blockers,
    handoffNotes: compiled.handoffNotes,
    nextActions: compiled.nextActions.map((action, index) => ({
      id: `a${index}`,
      title: action.title,
      rationale: action.rationale,
      status: action.status ?? "suggested",
      createdAt: NOW,
      updatedAt: NOW,
    })),
    generatedAt: NOW,
    sourceUpdatedAt: NOW,
    model: "silent-dump",
  };
}

describe("silent dump synthesis", () => {
  it("turns a messy dump into a brief that is not a skeleton", () => {
    const dump = "Shipped the gate. Empty state still broken. Don't widen OAuth.";
    const compiled = compileHeuristicMemory({
      projectName: "Hypher",
      items: [{ content: dump }],
      now: NOW,
    });

    expect(isSkeletonSummary(compiled.summary)).toBe(false);
    expect(compiled.summary).toContain("Shipped the gate");
    expect(compiled.constraints.some((line) => /oauth/i.test(line))).toBe(true);
    expect(compiled.currentDirection.toLowerCase()).toContain("empty state");

    const generateGuts = fallbackProjectMemory({
      projectName: "Hypher",
      items: [{ content: dump }],
      now: NOW,
    });
    expect(generateGuts.constraints?.some((line) => /oauth/i.test(line))).toBe(true);

    const brief = compileBuilderBrief({
      project,
      memory: asMemory(compiled),
      captures: [{
        id: "n1",
        kind: "note",
        content: dump,
        maturity: "fleeting",
        projectId: "p1",
        createdAt: NOW,
        modifiedAt: NOW,
      }],
      actions: [],
      agentEvents: [],
    });

    expect(brief).not.toContain("No short summary captured yet");
    expect(brief.toLowerCase()).toContain("oauth");
    expect(brief.toLowerCase()).toContain("empty state");
  });

  it("does not treat an empty project as a real brief", () => {
    expect(isSkeletonSummary("No summary captured yet")).toBe(true);
    expect(isSkeletonSummary("Hypher has 1 recent captures.")).toBe(true);
  });
});

describe("writeback receipts", () => {
  it("thickens identity from a matched handoff without Accept", () => {
    const applied = applyReceiptToMemory({
      existing: null,
      event: {
        id: "e1",
        kind: "handoff",
        source: "cursor",
        title: "Closed holes 1 and 3",
        body: "Silent synthesis after dump. Next move: add Cursor sessionStart hook.",
        suggestedActions: ["Add Cursor sessionStart hook"],
      },
      now: NOW,
    });

    expect(applied.applied).toBe(true);
    if (!applied.applied) return;
    expect(applied.memory.handoffNotes[0]).toContain("Closed holes 1 and 3");
    expect(applied.memory.recentChanges[0]).toContain("Closed holes 1 and 3");
    expect(applied.memory.nextActions[0]?.title).toContain("sessionStart");
    expect(isSkeletonSummary(applied.memory.summary)).toBe(false);

    const brief = compileBuilderBrief({
      project,
      memory: asMemory(applied.memory),
      captures: [],
      actions: [],
      agentEvents: [{
        id: "e1",
        userId: "u1",
        projectId: "p1",
        source: "cursor",
        kind: "handoff",
        title: "Closed holes 1 and 3",
        body: "Silent synthesis after dump.",
        status: "reviewed",
        createdAt: NOW,
      }],
    });
    expect(brief).toContain("Closed holes 1 and 3");
    expect(brief.toLowerCase()).toContain("sessionstart");
  });

  it("does not apply GitHub build logs as receipts", () => {
    expect(isWorkReceipt("build_log", "github")).toBe(false);
    expect(isWorkReceipt("handoff", "cursor")).toBe(true);
    expect(applyReceiptToMemory({
      existing: null,
      event: {
        kind: "build_log",
        source: "github",
        title: "CI failed",
        body: "tests",
      },
      now: NOW,
    }).applied).toBe(false);
  });

  it("keeps Accept for questions and suggestions, not receipts", () => {
    expect(agentEventNeedsHumanAccept("handoff", "cursor")).toBe(false);
    expect(agentEventNeedsHumanAccept("build_log", "cursor")).toBe(false);
    expect(agentEventNeedsHumanAccept("question", "cursor")).toBe(true);
    expect(agentEventNeedsHumanAccept("suggestion", "cursor")).toBe(true);
    expect(agentEventNeedsHumanAccept("question", "github")).toBe(true);
    expect(agentEventNeedsHumanAccept("build_log", "github")).toBe(false);
  });
});
