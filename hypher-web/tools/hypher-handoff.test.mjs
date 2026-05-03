import { describe, expect, it } from "vitest";
import { buildPayload, parseArgs } from "./hypher-handoff.mjs";

describe("hypher-handoff", () => {
  it("builds a handoff payload from repeated action flags", () => {
    const options = parseArgs([
      "--source", "openclaw",
      "--project", "Hypher",
      "--repo", "litterthanlit/hypher",
      "--kind", "handoff",
      "--title", "Agent Events v0 shipped",
      "--body", "Added ingestion and inbox.",
      "--action", "Draft handoff skill",
      "--action", "Add actions table",
    ]);

    expect(buildPayload(options)).toEqual({
      source: "openclaw",
      project: "Hypher",
      repo: "litterthanlit/hypher",
      kind: "handoff",
      title: "Agent Events v0 shipped",
      body: "Added ingestion and inbox.",
      suggestedActions: ["Draft handoff skill", "Add actions table"],
    });
  });

  it("requires source, title, and body", () => {
    expect(() => buildPayload(parseArgs(["--source", "codex"]))).toThrow("Missing required flag: --title");
  });
});
