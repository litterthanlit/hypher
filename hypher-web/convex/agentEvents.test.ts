import { describe, expect, it } from "vitest";
import { validateAgentEventPayload } from "./agentEvents";

describe("HYP-REL-009 agent event payload caps", () => {
  it("rejects oversized strings and suggested-action arrays", () => {
    expect(
      validateAgentEventPayload({
        source: "codex",
        kind: "handoff",
        title: "x".repeat(201),
        body: "ok",
      })
    ).toEqual({ ok: false, error: "title is too long" });

    expect(
      validateAgentEventPayload({
        source: "codex",
        kind: "handoff",
        title: "ok",
        body: "ok",
        suggestedActions: Array.from({ length: 11 }, (_, i) => `action ${i}`),
      })
    ).toEqual({ ok: false, error: "suggestedActions has too many items" });
  });
});
