import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  agentEventNeedsHumanAccept,
  applyReceiptToMemory,
  compileHeuristicMemory,
  expandConstraintLines,
  fallbackProjectMemory,
  isContinueDumpEcho,
  isHookShapedReceipt,
  isProductWorkReceipt,
  isSkeletonSummary,
  isWorkReceipt,
  looksLikeDoNotDo,
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

const LIVE_DUMP_2026_09_06 =
  "Dogfood dump on the real hypher project. Product: dump → one note agents read → writeback. Session 2 should start warm. Do not: invent dumps, gate bind on a github token, or treat try hypher as the home. Next: confirm silent synthesis thickened this note without a generate button.";

const DONE_WHEN_DUMP = "Don't widen OAuth. Pulse stays three panels. Do not rebuild the canvas.";

function importantConstraintLines(brief: string): string[] {
  const lines = brief.split("\n");
  const start = lines.findIndex((line) => line.trim() === "### Important constraints");
  if (start < 0) return [];
  const result: string[] = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    if (line.startsWith("## ") || line.startsWith("### ")) break;
    if (line.startsWith("- ")) result.push(line.slice(2).trim());
  }
  return result;
}

function tryingToBecome(brief: string): string {
  return brief.match(/^- Trying to become: (.+)$/m)?.[1] ?? "";
}

function nextActionLine(brief: string): string {
  return brief.match(/^- Next action: (.+)$/m)?.[1] ?? "";
}

function dumpFirstSentence(dump: string): string {
  return dump.split(/(?<=[.!?])\s+/)[0]?.replace(/[.!?]+$/, "") ?? dump;
}

function assertPacketDoesNotEchoDump(brief: string, dump: string) {
  for (const line of importantConstraintLines(brief)) {
    expect(line.includes("..."), `constraint cut with ellipsis: ${line}`).toBe(false);
  }
  const goal = tryingToBecome(brief);
  const first = dumpFirstSentence(dump);
  if (goal && !/no (current )?goal captured yet/i.test(goal)) {
    const goalNeedle = goal.replace(/[.!?]+$/, "").toLowerCase();
    expect(dump.toLowerCase().startsWith(goalNeedle)).toBe(false);
    expect(goalNeedle).not.toBe(first.toLowerCase());
  }
  expect(nextActionLine(brief).toLowerCase()).not.toContain(`continue: ${first.toLowerCase()}`);
  expect(isContinueDumpEcho(nextActionLine(brief).replace(/^\[[^\]]+\]\s*/, ""), [dump])).toBe(false);
}

function briefFromDump(dump: string, existing?: Parameters<typeof compileHeuristicMemory>[0]["existing"]) {
  const compiled = compileHeuristicMemory({
    projectName: "Hypher",
    items: [{ content: dump }],
    existing,
    now: NOW,
  });
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
  return { compiled, brief };
}

describe("Unit 2 packet baseline", () => {
  it("records that the 2026-09-06 live brief echoed the dump and truncated a do-not", () => {
    const evidence = readFileSync(
      join(process.cwd(), "../.audit/fix-agent-context/evidence/live-brief-2026-09-06.md"),
      "utf8"
    );
    expect(evidence).toContain("Continue: Dogfood dump on the real hypher project.");
    expect(evidence).toContain("Trying to become: Dogfood dump on the real hypher project.");
    expect(evidence).toMatch(/no toke\.\.\./);
  });

  it("does not cut constraint lines with ... inside a do-not, echo the dump as goal, or Continue: the dump", () => {
    const longDoNot =
      "Don't widen OAuth to every surface in agent settings, Pulse, and the landing page until the brief compiler stops cutting this sentence mid-word at the old one hundred eighty character line limit.";
    const dump = `${longDoNot} Empty state still broken. Next: add the snapshot assertions.`;
    const { compiled, brief } = briefFromDump(dump);

    expect(compiled.constraints.some((line) => /oauth/i.test(line) && !line.includes("..."))).toBe(true);
    expect(compiled.constraints.join(" ")).not.toMatch(/\.\.\./);
    expect(compiled.currentGoal ?? "").not.toMatch(/^don't widen oauth/i);
    const goal = (compiled.currentGoal ?? "").replace(/[.!?]+$/, "");
    if (goal) {
      expect(dump.toLowerCase().startsWith(goal.toLowerCase())).toBe(false);
    }
    expect(compiled.nextActions.some((action) => /^continue:/i.test(action.title))).toBe(false);
    assertPacketDoesNotEchoDump(brief, dump);
  });
});

describe("Unit 3 compile identity, do not echo the dump", () => {
  it("turns the done-when dump into three intact constraints and a goal that is not that paragraph", () => {
    const { compiled, brief } = briefFromDump(DONE_WHEN_DUMP);

    expect(compiled.constraints.length).toBeGreaterThanOrEqual(3);
    expect(compiled.constraints.some((line) => /oauth/i.test(line))).toBe(true);
    expect(compiled.constraints.some((line) => /pulse/i.test(line) && /three panels/i.test(line))).toBe(true);
    expect(compiled.constraints.some((line) => /canvas/i.test(line))).toBe(true);
    expect(compiled.constraints.every((line) => !line.includes("..."))).toBe(true);
    expect(compiled.currentGoal ?? "").not.toContain(DONE_WHEN_DUMP);
    const doneWhenGoal = compiled.currentGoal ?? "";
    if (doneWhenGoal) {
      expect(DONE_WHEN_DUMP.toLowerCase().startsWith(doneWhenGoal.toLowerCase())).toBe(false);
    }
    expect(compiled.nextActions.some((action) => /^continue:/i.test(action.title))).toBe(false);

    const constraints = importantConstraintLines(brief);
    expect(constraints.filter((line) => /oauth|pulse|canvas/i.test(line)).length).toBeGreaterThanOrEqual(3);
    expect(constraints.every((line) => !line.includes("..."))).toBe(true);
    expect(tryingToBecome(brief)).not.toBe(DONE_WHEN_DUMP);
    assertPacketDoesNotEchoDump(brief, DONE_WHEN_DUMP);
  });

  it("splits a Do not: A, B, C dump and uses Next: as the task instead of Continue: dump", () => {
    const { compiled, brief } = briefFromDump(LIVE_DUMP_2026_09_06);

    expect(compiled.constraints.length).toBeGreaterThanOrEqual(3);
    expect(compiled.constraints.some((line) => /invent dumps/i.test(line))).toBe(true);
    expect(compiled.constraints.some((line) => /github token/i.test(line))).toBe(true);
    expect(compiled.constraints.some((line) => /try hypher/i.test(line))).toBe(true);
    expect(compiled.currentGoal?.toLowerCase()).toContain("silent synthesis");
    expect(compiled.currentGoal?.toLowerCase()).not.toContain("dogfood dump");
    expect(compiled.nextActions[0]?.title.toLowerCase()).toContain("silent synthesis");
    expect(compiled.nextActions.some((action) => /^continue:/i.test(action.title))).toBe(false);
    expect(compiled.currentDirection.toLowerCase()).toContain("product:");
    assertPacketDoesNotEchoDump(brief, LIVE_DUMP_2026_09_06);
  });

  it("rewrites a mid-sentence don't so the packet matcher can keep it", () => {
    const dump = "Shipped the gate. Please don't widen OAuth while Pulse stays three panels.";
    const { compiled, brief } = briefFromDump(dump);
    const rewritten = expandConstraintLines(["Please don't widen OAuth while Pulse stays three panels."]);
    expect(rewritten.some((line) => looksLikeDoNotDo(line) && /^(do not|don't|dont)\b/i.test(line))).toBe(true);
    expect(compiled.constraints.some((line) => /oauth/i.test(line))).toBe(true);
    expect(brief.toLowerCase()).toContain("oauth");
    expect(brief).toMatch(/Don't widen OAuth|Do not widen OAuth|don't widen OAuth/i);
  });

  it("splits stored Do not: A, B, C memory into intact constraint lines without echoing the dump as goal", () => {
    const dump = LIVE_DUMP_2026_09_06;
    const packet = compileBuilderBrief({
      project,
      memory: {
        projectId: "p1",
        summary: dump,
        currentGoal: "Dogfood dump on the real hypher project.",
        currentDirection: "Dogfood dump on the real hypher project.",
        recentChanges: [dump],
        constraints: ["Do not: invent dumps, gate bind on a github token, or treat try hypher as the home."],
        openQuestions: [],
        activeTasks: ["Continue: Dogfood dump on the real hypher project."],
        nextActions: [{
          id: "a0",
          title: "Continue: Dogfood dump on the real hypher project.",
          rationale: "Compiled from the latest dump or writeback.",
          status: "suggested",
          createdAt: NOW,
          updatedAt: NOW,
        }],
        generatedAt: NOW,
        sourceUpdatedAt: NOW,
        model: "test",
      },
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

    const constraints = importantConstraintLines(packet);
    expect(constraints.some((line) => /invent dumps/i.test(line))).toBe(true);
    expect(constraints.some((line) => /github token/i.test(line))).toBe(true);
    expect(constraints.some((line) => /try hypher/i.test(line))).toBe(true);
    expect(constraints.every((line) => !line.includes("..."))).toBe(true);
    expect(tryingToBecome(packet).toLowerCase()).toContain("silent synthesis");
    expect(tryingToBecome(packet).toLowerCase()).not.toContain("dogfood dump");
    expect(packet).not.toMatch(/Continue: Dogfood dump on the real hypher project/i);
    assertPacketDoesNotEchoDump(packet, dump);
  });

  it("compiles last-handoff identity over a sticky dump when events are on the packet", () => {
    const dump = LIVE_DUMP_2026_09_06;
    const eventBody = "Do not widen OAuth. Pulse stays three panels. Do not rebuild the canvas. Next move: keep the packet warmer than PRODUCT.md.";
    const compiled = compileHeuristicMemory({
      projectName: "Hypher",
      items: [{ content: dump }],
      events: [{
        kind: "handoff",
        source: "cursor",
        title: "Session 2 writeback",
        body: eventBody,
        suggestedActions: ["Keep the packet warmer than PRODUCT.md"],
        createdAt: NOW,
      }],
      existing: {
        summary: dump,
        currentGoal: "Dogfood dump on the real hypher project.",
        currentDirection: "Dogfood dump on the real hypher project.",
        constraints: ["Do not: invent dumps, gate bind on a github token, or treat try hypher as the home."],
      },
      now: NOW,
    });
    expect(compiled.summary.toLowerCase()).not.toContain("dogfood dump");
    expect(compiled.summary.toLowerCase()).toContain("session 2 writeback");
    expect(compiled.currentGoal?.toLowerCase()).toMatch(/warmer than product\.md|silent synthesis/i);
    expect(compiled.currentDirection.toLowerCase()).toContain("product:");
    expect(compiled.constraints.some((line) => /oauth/i.test(line))).toBe(true);
    expect(compiled.constraints.some((line) => /three panels/i.test(line))).toBe(true);
    expect(compiled.constraints.some((line) => /canvas/i.test(line))).toBe(true);

    const brief = compileBuilderBrief({
      project,
      memory: {
        projectId: "p1",
        summary: dump,
        currentGoal: "Dogfood dump on the real hypher project.",
        currentDirection: "Dogfood dump on the real hypher project.",
        recentChanges: [dump],
        constraints: ["Do not: invent dumps, gate bind on a github token, or treat try hypher as the home."],
        openQuestions: [],
        activeTasks: ["Continue: Dogfood dump on the real hypher project."],
        nextActions: [{
          id: "echo",
          title: "Continue: Dogfood dump on the real hypher project.",
          rationale: "Compiled from the latest dump or writeback.",
          status: "suggested",
          createdAt: NOW,
          updatedAt: NOW,
        }],
        generatedAt: NOW,
        sourceUpdatedAt: NOW,
        model: "test",
      },
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
      agentEvents: [{
        id: "session-2",
        userId: "u1",
        projectId: "p1",
        source: "cursor",
        kind: "handoff",
        title: "Session 2 writeback",
        body: eventBody,
        suggestedActions: ["Keep the packet warmer than PRODUCT.md"],
        status: "reviewed",
        createdAt: NOW,
      }],
    });
    expect(brief).toMatch(/- Short summary: Session 2 writeback/i);
    expect(brief).not.toMatch(/- Short summary: Dogfood dump/i);
    expect(tryingToBecome(brief).toLowerCase()).toMatch(/warmer than product\.md|silent synthesis/i);
    expect(brief).toMatch(/Product: dump/i);
    expect(brief.toLowerCase()).toMatch(/widen oauth/);
    expect(brief.toLowerCase()).toMatch(/three panels/);
    expect(brief.toLowerCase()).toMatch(/rebuild the canvas/);
    expect(nextActionLine(brief).toLowerCase()).toContain("warmer than product.md");
    expect(brief).not.toMatch(/Continue: Dogfood dump/i);
    expect(brief).not.toMatch(/\bno toke\.\.\./i);
    assertPacketDoesNotEchoDump(brief, dump);
  });

  it("lets a new constraint in even when eight older filler lines exist", () => {
    const compiled = compileHeuristicMemory({
      projectName: "Hypher",
      items: [{ content: "Don't widen OAuth." }],
      existing: {
        constraints: Array.from({ length: 8 }, (_, index) => `Keep old filler ${index}`),
      },
      now: NOW,
    });
    expect(compiled.constraints.some((line) => /oauth/i.test(line))).toBe(true);
    expect(compiled.constraints[0]?.toLowerCase()).toMatch(/oauth/);
  });
});

describe("Unit 4 hook-shaped receipts do not become identity", () => {
  const hookBody = [
    "Cursor session-end receipt. One handoff event. Not a compiled Builder Brief. No product status inferred.",
    "",
    "Repo: litterthanlit/hypher",
    "Branch: main",
    "",
    "Local git status (files only):",
    "- M hypher-web/shared/projectMemoryGenerate.ts",
  ].join("\n");

  it("does not treat git-status sessionEnd receipts as product work", () => {
    expect(isHookShapedReceipt("Cursor session ended (litterthanlit/hypher)", hookBody)).toBe(true);
    expect(isProductWorkReceipt({
      kind: "handoff",
      source: "cursor",
      title: "Cursor session ended (litterthanlit/hypher)",
      body: hookBody,
    })).toBe(false);
    expect(isWorkReceipt("handoff", "cursor")).toBe(true);
  });

  it("does not copy a hook-shaped receipt into summary or direction", () => {
    const applied = applyReceiptToMemory({
      existing: null,
      event: {
        id: "hook-1",
        kind: "handoff",
        source: "cursor",
        title: "Cursor session ended (litterthanlit/hypher)",
        body: hookBody,
      },
      now: NOW,
    });
    expect(applied.applied).toBe(false);

    const compiled = compileHeuristicMemory({
      projectName: "Hypher",
      items: [],
      events: [{
        kind: "handoff",
        source: "cursor",
        title: "Cursor session ended (litterthanlit/hypher)",
        body: hookBody,
      }],
      now: NOW,
    });
    expect(compiled.summary.toLowerCase()).not.toContain("session-end receipt");
    expect(compiled.currentDirection.toLowerCase()).not.toContain("session-end receipt");
    expect(compiled.handoffNotes.join(" ").toLowerCase()).not.toContain("no product status inferred");
  });

  it("still thickens identity from a real agent handoff body", () => {
    const body = [
      "Compiled identity instead of echoing the dump.",
      "Constraints stay whole. Pulse stays three panels.",
      "Next move: keep session-end git-status receipts out of summary.",
    ].join(" ");
    const applied = applyReceiptToMemory({
      existing: null,
      event: {
        id: "real-1",
        kind: "handoff",
        source: "cursor",
        title: "Closed packet echo on hypher",
        body,
        suggestedActions: ["Keep session-end git-status receipts out of summary"],
      },
      now: NOW,
    });
    expect(applied.applied).toBe(true);
    if (!applied.applied) return;
    expect(applied.memory.summary.toLowerCase()).toContain("compiled identity");
    expect(applied.memory.summary.toLowerCase()).not.toContain("session-end receipt");
    expect(applied.memory.nextActions[0]?.title.toLowerCase()).toContain("git-status");
    expect(applied.memory.handoffNotes.join(" ").toLowerCase()).toContain("compiled identity");

    const brief = compileBuilderBrief({
      project,
      memory: asMemory(applied.memory),
      captures: [],
      actions: [],
      agentEvents: [{
        id: "real-1",
        userId: "u1",
        projectId: "p1",
        source: "cursor",
        kind: "handoff",
        title: "Closed packet echo on hypher",
        body,
        status: "reviewed",
        createdAt: NOW,
      }],
    });
    expect(brief.toLowerCase()).toContain("compiled identity");
    expect(brief).not.toMatch(/\bno toke\.\.\./i);
    expect(nextActionLine(brief).toLowerCase()).not.toContain("continue: dogfood");
  });

  it("lifts intact do-not lines out of a real handoff body", () => {
    const applied = applyReceiptToMemory({
      existing: null,
      event: {
        id: "handoff-constraints",
        kind: "handoff",
        source: "cursor",
        title: "Units 4-5: writeback quality and one next move",
        body: "PR 62. Do not: widen OAuth, rebuild the canvas. Pulse stays three panels. Next move: deploy Convex so production receipt filtering is live.",
        suggestedActions: ["Deploy Convex so isProductWorkReceipt and OAuth activity are live in production"],
      },
      now: NOW,
    });
    expect(applied.applied).toBe(true);
    if (!applied.applied) return;
    expect(applied.memory.constraints.some((line) => /oauth/i.test(line))).toBe(true);
    expect(applied.memory.constraints.some((line) => /canvas/i.test(line))).toBe(true);
    expect(applied.memory.constraints.some((line) => /pulse/i.test(line) && /three panels/i.test(line))).toBe(true);
    expect(applied.memory.constraints.every((line) => !line.includes("..."))).toBe(true);
    expect(applied.memory.nextActions[0]?.title).toContain("isProductWorkReceipt");
    expect(applied.memory.summary).toContain("PR 62");
    expect(applied.memory.summary).not.toMatch(/session-end receipt/i);
  });

  it("replaces a sticky dump-echo summary when a real handoff lands", () => {
    const applied = applyReceiptToMemory({
      existing: {
        summary: LIVE_DUMP_2026_09_06,
        currentGoal: "Dogfood dump on the real hypher project.",
        currentDirection: "Dogfood dump on the real hypher project.",
        constraints: ["Do not invent dumps"],
      },
      event: {
        id: "session-2",
        kind: "handoff",
        source: "cursor",
        title: "Session 2 writeback",
        body: "Do not widen OAuth. Pulse stays three panels. Do not rebuild the canvas. Next move: keep the packet warmer than PRODUCT.md.",
        suggestedActions: ["Keep the packet warmer than PRODUCT.md"],
        createdAt: NOW,
      },
      now: NOW,
    });
    expect(applied.applied).toBe(true);
    if (!applied.applied) return;
    expect(applied.memory.summary.toLowerCase()).not.toContain("dogfood dump");
    expect(applied.memory.summary.toLowerCase()).toContain("session 2 writeback");
    expect(applied.memory.currentGoal?.toLowerCase()).not.toContain("dogfood dump");
    expect(applied.memory.currentGoal?.toLowerCase()).toMatch(/warmer than product\.md|keep the packet/i);
    expect(applied.memory.currentDirection.toLowerCase()).not.toBe("dogfood dump on the real hypher project.");
    expect(applied.memory.constraints.some((line) => /oauth/i.test(line))).toBe(true);
    expect(applied.memory.constraints.some((line) => /pulse/i.test(line) && /three panels/i.test(line))).toBe(true);
    expect(applied.memory.constraints.some((line) => /canvas/i.test(line))).toBe(true);
    expect(applied.memory.constraints.every((line) => !line.includes("..."))).toBe(true);
    expect(applied.memory.nextActions[0]?.title.toLowerCase()).toContain("warmer than product.md");
  });
});