import { describe, expect, it } from "vitest";
import {
  INBOX_BACKLOG_THRESHOLD,
  MANUAL_OVERRIDE_TTL_MS,
  resolveWorkspaceLayout,
  type WorkspaceLayoutInput,
} from "./workspaceLayout";

const NOW = 1_700_000_000_000;

function baseInput(overrides: Partial<WorkspaceLayoutInput> = {}): WorkspaceLayoutInput {
  return {
    signals: {
      inboxCount: 0,
      agentInboxCount: 0,
      activationIncomplete: false,
      projectHealthScore: 80,
      memoryStale: false,
      hasSelectedProject: true,
    },
    globalDefaultMode: "pulse",
    projectPrefs: null,
    now: NOW,
    ...overrides,
  };
}

describe("resolveWorkspaceLayout", () => {
  it("respects pinned mode over signals", () => {
    const result = resolveWorkspaceLayout(
      baseInput({
        signals: {
          inboxCount: 20,
          agentInboxCount: 3,
          activationIncomplete: true,
          projectHealthScore: 10,
          memoryStale: true,
          hasSelectedProject: true,
        },
        projectPrefs: {
          pinnedMode: "canvas",
          lastManualMode: null,
          lastManualAt: null,
        },
      })
    );
    expect(result.contentMode).toBe("canvas");
    expect(result.autoSwitched).toBe(false);
  });

  it("forces pulse when activation is incomplete on a project", () => {
    const result = resolveWorkspaceLayout(
      baseInput({
        signals: {
          inboxCount: 0,
          agentInboxCount: 0,
          activationIncomplete: true,
          projectHealthScore: 80,
          memoryStale: false,
          hasSelectedProject: true,
        },
      })
    );
    expect(result.contentMode).toBe("pulse");
    expect(result.autoSwitched).toBe(false);
  });

  it("routes global workspace to inbox when backlog is high", () => {
    const result = resolveWorkspaceLayout(
      baseInput({
        signals: {
          inboxCount: INBOX_BACKLOG_THRESHOLD,
          agentInboxCount: 0,
          activationIncomplete: false,
          projectHealthScore: null,
          memoryStale: false,
          hasSelectedProject: false,
        },
      })
    );
    expect(result.contentMode).toBe("inbox");
    expect(result.preset).toBe("triage");
    expect(result.autoSwitched).toBe(true);
  });

  it("routes global workspace to agent inbox when agent items are pending", () => {
    const result = resolveWorkspaceLayout(
      baseInput({
        signals: {
          inboxCount: 0,
          agentInboxCount: 2,
          activationIncomplete: false,
          projectHealthScore: null,
          memoryStale: false,
          hasSelectedProject: false,
        },
      })
    );
    expect(result.contentMode).toBe("agent-inbox");
    expect(result.emphasizeAgentSection).toBe(true);
  });

  it("respects last manual mode within 24h unless high severity", () => {
    const result = resolveWorkspaceLayout(
      baseInput({
        projectPrefs: {
          pinnedMode: null,
          lastManualMode: "canvas",
          lastManualAt: NOW - 60_000,
        },
      })
    );
    expect(result.contentMode).toBe("canvas");
    expect(result.autoSwitched).toBe(false);
  });

  it("ignores stale manual override when inbox backlog is high", () => {
    const result = resolveWorkspaceLayout(
      baseInput({
        signals: {
          inboxCount: INBOX_BACKLOG_THRESHOLD,
          agentInboxCount: 0,
          activationIncomplete: false,
          projectHealthScore: 80,
          memoryStale: false,
          hasSelectedProject: true,
        },
        projectPrefs: {
          pinnedMode: null,
          lastManualMode: "canvas",
          lastManualAt: NOW - 60_000,
        },
      })
    );
    expect(result.contentMode).toBe("list");
    expect(result.autoSwitched).toBe(true);
  });

  it("ignores manual override older than 24h", () => {
    const result = resolveWorkspaceLayout(
      baseInput({
        projectPrefs: {
          pinnedMode: null,
          lastManualMode: "canvas",
          lastManualAt: NOW - MANUAL_OVERRIDE_TTL_MS - 1,
        },
      })
    );
    expect(result.contentMode).toBe("pulse");
  });

  it("routes low-health projects to pulse", () => {
    const result = resolveWorkspaceLayout(
      baseInput({
        signals: {
          inboxCount: 0,
          agentInboxCount: 0,
          activationIncomplete: false,
          projectHealthScore: 40,
          memoryStale: false,
          hasSelectedProject: true,
        },
      })
    );
    expect(result.contentMode).toBe("pulse");
    expect(result.autoSwitched).toBe(true);
  });
});
