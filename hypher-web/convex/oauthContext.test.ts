import { describe, expect, it } from "vitest";
import { selectActivityForOAuthContext } from "./oauthContext";
import { prioritizeAgentEventsForPacket } from "../shared/projectMemoryGenerate";

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

  it("keeps the same product-state handoff Clerk MCP would fetch, not only newest changelog", () => {
    const changelog = Array.from({ length: 12 }, (_, index) => ({
      status: "reviewed",
      kind: "handoff",
      source: "cursor",
      title: `Changelog titles leave Recent changes ${index}`,
      createdAt: 2000 + index,
    }));
    const wait = {
      status: "reviewed",
      kind: "handoff",
      source: "cursor",
      title: "Wait-for-review next when merge is locked",
      createdAt: 100,
    };
    const selected = prioritizeAgentEventsForPacket([...changelog, wait], 12);
    expect(selected.some((event) => event.title === wait.title)).toBe(true);
  });
});
