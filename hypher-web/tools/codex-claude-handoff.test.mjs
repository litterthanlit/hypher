import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promptText, statusReport } from "./codex-claude-handoff.mjs";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("codex-claude handoff helper", () => {
  it("never reports that the CLIs ran", () => {
    const report = statusReport();
    expect(report.ranAgents).toBe(false);
    expect(report.note).toMatch(/does not launch/);
    expect(promptText(report)).toMatch(/ranAgents: false/);
    expect(promptText(report)).toMatch(/Do not checkout/);
  });

  it("prints status JSON from the CLI without starting an agent", () => {
    const stdout = execFileSync("node", ["tools/codex-claude-handoff.mjs", "status"], {
      cwd: webRoot,
      encoding: "utf8",
    });
    const report = JSON.parse(stdout);
    expect(report.ranAgents).toBe(false);
    expect(report).not.toHaveProperty("switched");
  });
});
