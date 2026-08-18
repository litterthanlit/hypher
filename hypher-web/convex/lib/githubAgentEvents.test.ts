import { describe, expect, it } from "vitest";
import {
  GITHUB_STALE_PR_MS,
  buildGithubLoopSignals,
  githubCiFailKey,
  planGithubLoopWrites,
} from "./githubAgentEvents";

describe("buildGithubLoopSignals", () => {
  it("emits CI failures as questions and stale PRs as build logs", () => {
    const now = 1_700_000_000_000;
    const signals = buildGithubLoopSignals({
      repo: "litterthanlit/hypher",
      now,
      prs: [
        {
          number: 12,
          title: "Close writeback loop",
          draft: false,
          updatedAtMs: now - 1000,
          failingChecks: ["test", "typecheck"],
        },
        {
          number: 9,
          title: "Old PR",
          draft: false,
          updatedAtMs: now - GITHUB_STALE_PR_MS - 86400000,
          failingChecks: [],
        },
      ],
      issues: [
        { number: 4, title: "CI flakes in Pulse", labels: ["bug"] },
        { number: 5, title: "Docs typo", labels: ["docs"] },
      ],
    });

    expect(signals.map((item) => item.externalKey)).toEqual([
      githubCiFailKey(12),
      "github:pr:9:stale",
      "github:issue:4:blocker",
    ]);
    expect(signals[0]?.kind).toBe("question");
    expect(signals[1]?.kind).toBe("build_log");
  });
});

describe("planGithubLoopWrites", () => {
  it("inserts new fingerprints, auto-dismisses resolved CI, and reopens auto-resolved failures", () => {
    const signal = {
      externalKey: githubCiFailKey(12),
      kind: "question" as const,
      title: "PR #12 has failing CI",
      body: "tests failed",
    };

    expect(planGithubLoopWrites({
      signals: [signal],
      existing: [],
    })).toEqual([{ op: "insert", signal }]);

    expect(planGithubLoopWrites({
      signals: [],
      existing: [{ externalKey: signal.externalKey, status: "new", title: signal.title, body: signal.body }],
    })).toEqual([{
      op: "patch",
      externalKey: signal.externalKey,
      status: "dismissed",
      autoResolved: true,
    }]);

    expect(planGithubLoopWrites({
      signals: [signal],
      existing: [{
        externalKey: signal.externalKey,
        status: "dismissed",
        autoResolved: true,
        title: "old",
        body: "old",
      }],
    })).toEqual([{
      op: "patch",
      externalKey: signal.externalKey,
      status: "new",
      autoResolved: false,
      title: signal.title,
      body: signal.body,
    }]);
  });

  it("does not revive a user-dismissed still-failing check", () => {
    const signal = {
      externalKey: githubCiFailKey(12),
      kind: "question" as const,
      title: "PR #12 has failing CI",
      body: "tests failed",
    };
    expect(planGithubLoopWrites({
      signals: [signal],
      existing: [{
        externalKey: signal.externalKey,
        status: "dismissed",
        title: signal.title,
        body: signal.body,
      }],
    })).toEqual([]);
  });
});
