import { describe, expect, it } from "vitest";
import { selectProjectMemory } from "./projectMemories";

const rows = [
  {
    _id: "m1",
    userId: "u1",
    projectId: "p1",
    summary: "Project one",
    currentDirection: "Ship",
    recentChanges: [],
    openQuestions: [],
    nextActions: [],
    generatedAt: 1,
    sourceUpdatedAt: 1,
    model: "test",
  },
  {
    _id: "m2",
    userId: "u1",
    projectId: "p2",
    summary: "Project two",
    currentDirection: "Plan",
    recentChanges: [],
    openQuestions: [],
    nextActions: [],
    generatedAt: 2,
    sourceUpdatedAt: 2,
    model: "test",
  },
  {
    _id: "m3",
    userId: "u2",
    projectId: "p1",
    summary: "Other user",
    currentDirection: "Ignore",
    recentChanges: [],
    openQuestions: [],
    nextActions: [],
    generatedAt: 3,
    sourceUpdatedAt: 3,
    model: "test",
  },
] as any[];

describe("project memory query selectors", () => {
  it("returns only the current user's memory for the requested project", () => {
    expect(selectProjectMemory(rows, "u1", "p1")).toMatchObject({
      id: "m1",
      projectId: "p1",
      summary: "Project one",
    });
    expect(selectProjectMemory(rows, "u1", "missing")).toBeNull();
  });
});
