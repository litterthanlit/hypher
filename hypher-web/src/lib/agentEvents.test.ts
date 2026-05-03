import { describe, expect, it } from "vitest";
import {
  AGENT_EVENT_KINDS,
  buildAgentEventNoteContent,
  matchProjectForAgentEvent,
  normalizeAgentEventPayload,
  validateAgentEventPayload,
  type AgentEventProjectCandidate,
} from "./agentEvents";

const projects: AgentEventProjectCandidate[] = [
  { id: "p1", name: "Hypher", githubRepo: "litterthanlit/hypher" },
  { id: "p2", name: "Digest polish", githubRepo: "litterthanlit/digest" },
  { id: "p3", name: "Agent inbox", githubRepo: undefined },
];

describe("validateAgentEventPayload", () => {
  it("accepts a minimal handoff with suggested actions", () => {
    const result = validateAgentEventPayload({
      source: "openclaw",
      project: "Hypher",
      kind: "handoff",
      title: "Activation rail implemented",
      body: "Build passed.",
      suggestedActions: ["Add agentEvents schema"],
      repo: "litterthanlit/hypher",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.kind).toBe("handoff");
      expect(result.value.suggestedActions).toEqual(["Add agentEvents schema"]);
    }
  });

  it("rejects invalid payloads with a clean error", () => {
    expect(validateAgentEventPayload({ source: "openclaw", kind: "handoff" })).toEqual({
      ok: false,
      error: "title is required",
    });
    expect(validateAgentEventPayload({ source: "openclaw", kind: "deploy", title: "x", body: "y" })).toEqual({
      ok: false,
      error: `kind must be one of ${AGENT_EVENT_KINDS.join(", ")}`,
    });
  });
});

describe("matchProjectForAgentEvent", () => {
  it("matches by repo before project name", () => {
    expect(matchProjectForAgentEvent(projects, { repo: "litterthanlit/hypher", project: "Digest polish" })).toEqual({
      id: "p1",
      name: "Hypher",
    });
  });

  it("matches by exact and case-insensitive project name", () => {
    expect(matchProjectForAgentEvent(projects, { project: "Hypher" })?.id).toBe("p1");
    expect(matchProjectForAgentEvent(projects, { project: "agent INBOX" })?.id).toBe("p3");
  });

  it("falls back to basic contains matching", () => {
    expect(matchProjectForAgentEvent(projects, { project: "ship the digest polish page" })?.id).toBe("p2");
    expect(matchProjectForAgentEvent(projects, { project: "unknown" })).toBeNull();
  });
});

describe("normalizeAgentEventPayload", () => {
  it("trims fields and defaults status", () => {
    const validated = validateAgentEventPayload({
      source: " codex ",
      kind: "question",
      title: "  Blocked on env ",
      body: "  Missing API key. ",
      suggestedActions: ["  Add env var  ", ""],
      branch: " main ",
    });

    expect(validated.ok).toBe(true);
    if (validated.ok) {
      expect(normalizeAgentEventPayload(validated.value, 123)).toMatchObject({
        source: "codex",
        kind: "question",
        title: "Blocked on env",
        body: "Missing API key.",
        suggestedActions: ["Add env var"],
        branch: "main",
        status: "new",
        createdAt: 123,
      });
    }
  });
});

describe("buildAgentEventNoteContent", () => {
  it("creates a readable project note from an event", () => {
    expect(
      buildAgentEventNoteContent({
        source: "openclaw",
        kind: "handoff",
        title: "Activation rail implemented",
        body: "Tests passed.",
        suggestedActions: ["Build Agent Inbox"],
        repo: "litterthanlit/hypher",
        commitSha: "15129e6",
      })
    ).toContain("Suggested actions:\n- Build Agent Inbox");
  });
});
