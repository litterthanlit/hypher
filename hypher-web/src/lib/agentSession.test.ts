import { describe, expect, it } from "vitest";
import {
  START_AGENT_SESSION_ERROR_TOAST,
  START_AGENT_SESSION_LABEL,
  START_AGENT_SESSION_SUCCESS_TOAST,
  buildAgentSessionStub,
  sessionStubSource,
} from "./agentSession";

describe("agent session stub", () => {
  it("keeps Pulse copy language on Start agent session", () => {
    expect(START_AGENT_SESSION_LABEL).toBe("Start agent session");
    expect(START_AGENT_SESSION_SUCCESS_TOAST).toBe("Builder Brief copied. Session started.");
    expect(START_AGENT_SESSION_ERROR_TOAST).toBe("Could not start agent session");
  });

  it("builds a reviewed handoff stub so Needs you stays quiet", () => {
    const stub = buildAgentSessionStub({
      targetTool: "Cursor",
      requestedTask: "Close the writeback loop",
      repo: "litterthanlit/hypher",
      createdAt: 100,
    });

    expect(stub).toEqual({
      source: "cursor",
      kind: "handoff",
      title: "Session started",
      body: "Requested task: Close the writeback loop\nPaste this Builder Brief into Cursor.",
      status: "reviewed",
      repo: "litterthanlit/hypher",
      createdAt: 100,
    });
    expect(sessionStubSource("GitHub Copilot")).toBe("github_copilot");
  });
});
