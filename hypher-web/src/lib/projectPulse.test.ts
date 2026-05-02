import { describe, expect, it } from "vitest";
import type { ActivityEntry, AnyObject, Project, ProjectMemory } from "@/types";
import { buildProjectPulseModel } from "./projectPulse";

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
});
