import { describe, expect, it } from "vitest";
import type { AgentEvent } from "@/types";
import {
  countProjectNeedsYou,
  formatNeedsYouLabel,
  needsYouTotal,
  prioritizeAgentEventsForPulse,
} from "./needsYou";

function event(patch: Partial<AgentEvent> & Pick<AgentEvent, "id" | "kind" | "status" | "createdAt">): AgentEvent {
  return {
    userId: "u1",
    projectId: "p1",
    source: "cursor",
    title: patch.title ?? patch.id,
    body: "body",
    ...patch,
  };
}

describe("needs you counts", () => {
  it("counts only new questions and next actions", () => {
    const counts = countProjectNeedsYou([
      event({ id: "q1", kind: "question", status: "new", createdAt: 3 }),
      event({ id: "q2", kind: "question", status: "reviewed", createdAt: 2 }),
      event({ id: "n1", kind: "next_action", status: "new", createdAt: 1 }),
      event({ id: "h1", kind: "handoff", status: "new", createdAt: 4 }),
    ]);
    expect(counts).toEqual({ questions: 1, nextActions: 1 });
    expect(formatNeedsYouLabel({ ...counts, unmatched: 1 })).toBe("1 question · 1 next action · 1 unmatched");
    expect(needsYouTotal({ questions: 0, nextActions: 0, unmatched: 0 })).toBe(0);
    expect(formatNeedsYouLabel({ questions: 0, nextActions: 0, unmatched: 0 })).toBeNull();
  });
});

describe("prioritizeAgentEventsForPulse", () => {
  it("surfaces new questions before older handoffs and drops dismissed rows", () => {
    const ranked = prioritizeAgentEventsForPulse([
      event({ id: "old-handoff", kind: "handoff", status: "accepted", createdAt: 50 }),
      event({ id: "new-handoff", kind: "handoff", status: "new", createdAt: 40 }),
      event({ id: "hidden", kind: "question", status: "dismissed", createdAt: 90 }),
      event({ id: "new-question", kind: "question", status: "new", createdAt: 10 }),
    ], 3);

    expect(ranked.map((item) => item.id)).toEqual(["new-question", "new-handoff", "old-handoff"]);
  });
});
