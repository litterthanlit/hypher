import { describe, expect, it } from "vitest";
import {
  selectInboxObjects,
  selectObjectsForProject,
  selectRecentObjects,
} from "./objects";
import { selectProjects } from "./projects";

const rows = [
  {
    _id: "p1",
    userId: "u1",
    kind: "project",
    name: "Alpha",
    description: "",
    status: "active",
    createdAt: 1,
    modifiedAt: 10,
  },
  {
    _id: "p2",
    userId: "u2",
    kind: "project",
    name: "Other",
    description: "",
    status: "active",
    createdAt: 2,
    modifiedAt: 20,
  },
  {
    _id: "n-inbox-new",
    userId: "u1",
    kind: "note",
    content: "New inbox",
    maturity: "fleeting",
    createdAt: 30,
    modifiedAt: 30,
  },
  {
    _id: "n-reviewed",
    userId: "u1",
    kind: "note",
    content: "Reviewed inbox",
    maturity: "fleeting",
    reviewedAt: 40,
    createdAt: 40,
    modifiedAt: 40,
  },
  {
    _id: "n-project",
    userId: "u1",
    kind: "note",
    content: "Project note",
    maturity: "developing",
    projectId: "p1",
    createdAt: 50,
    modifiedAt: 50,
  },
  {
    _id: "n-archived",
    userId: "u1",
    kind: "note",
    content: "Archived note",
    maturity: "fleeting",
    projectId: "p1",
    captureStatus: "archived",
    createdAt: 60,
    modifiedAt: 60,
  },
] as any[];

describe("object query selectors", () => {
  it("returns only the current user's projects", () => {
    expect(selectProjects(rows, "u1").map((item) => item.id)).toEqual(["p1"]);
  });

  it("returns unsorted and reviewed inbox objects without archived/project items", () => {
    expect(selectInboxObjects(rows, "u1").map((item) => item.id)).toEqual([
      "n-inbox-new",
      "n-reviewed",
    ]);
  });

  it("returns active project children for a project", () => {
    expect(selectObjectsForProject(rows, "u1", "p1").map((item) => item.id)).toEqual([
      "n-project",
    ]);
  });

  it("returns recent non-project objects newest first", () => {
    expect(selectRecentObjects(rows, "u1", 2).map((item) => item.id)).toEqual([
      "n-archived",
      "n-project",
    ]);
  });
});
