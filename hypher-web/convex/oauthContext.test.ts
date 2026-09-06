import { describe, expect, it } from "vitest";
import { selectActivityForOAuthContext } from "./oauthContext";

describe("OAuth MCP project context activity", () => {
  it("keeps the same user-scoped recent activity the Clerk MCP path includes", () => {
    const rows = [
      { _id: "a-old", userId: "u1", action: "created", objectId: "n1", objectKind: "note", objectName: "Old", timestamp: 10, projectId: "p1" },
      { _id: "a-new", userId: "u1", action: "updated", objectId: "n2", objectKind: "note", objectName: "New", timestamp: 30, projectId: "p1" },
      { _id: "a-other-user", userId: "u2", action: "created", objectId: "n3", objectKind: "note", objectName: "Other", timestamp: 40, projectId: "p1" },
    ];
    const selected = selectActivityForOAuthContext(rows, "u1", 24);
    expect(selected.map((entry) => entry.id)).toEqual(["a-new", "a-old"]);
    expect(selected[0]).not.toHaveProperty("userId");
  });
});
