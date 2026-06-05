import { describe, expect, it } from "vitest";
import { selectRecentActivityForProject } from "./activity";

const rows = [
  {
    _id: "a-old",
    userId: "u1",
    action: "created",
    objectId: "n1",
    objectKind: "note",
    objectName: "Old",
    projectId: "p1",
    timestamp: 10,
  },
  {
    _id: "a-new",
    userId: "u1",
    action: "updated",
    objectId: "n2",
    objectKind: "note",
    objectName: "New",
    projectId: "p1",
    timestamp: 30,
  },
  {
    _id: "a-other-project",
    userId: "u1",
    action: "created",
    objectId: "n3",
    objectKind: "note",
    objectName: "Other project",
    projectId: "p2",
    timestamp: 40,
  },
  {
    _id: "a-other-user",
    userId: "u2",
    action: "created",
    objectId: "n4",
    objectKind: "note",
    objectName: "Other user",
    projectId: "p1",
    timestamp: 50,
  },
] as any[];

describe("activity query selectors", () => {
  it("returns recent project activity for the current user newest first", () => {
    expect(selectRecentActivityForProject(rows, "u1", "p1", 2).map((item) => item.id)).toEqual([
      "a-new",
      "a-old",
    ]);
  });
});
