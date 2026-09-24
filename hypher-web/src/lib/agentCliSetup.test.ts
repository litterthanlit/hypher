import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AGENT_CLI_DOORS, CLAUDE_CODE_MCP_JSON, CODEX_CONFIG_TOML } from "./agentCliSetup";

const repoRoot = path.resolve(__dirname, "../../..");

describe("agent CLI setup", () => {
  it("matches the checked-in Claude Code MCP config", () => {
    const onDisk = JSON.parse(readFileSync(path.join(repoRoot, ".mcp.json"), "utf8"));
    expect(JSON.parse(CLAUDE_CODE_MCP_JSON)).toEqual(onDisk);
  });

  it("matches the checked-in Codex config", () => {
    const onDisk = readFileSync(path.join(repoRoot, ".codex/config.toml"), "utf8")
      .split("\n")
      .filter((line) => line.trim() && !line.startsWith("#"))
      .join("\n");
    expect(CODEX_CONFIG_TOML.split("\n").filter((line) => line.trim()).join("\n")).toBe(onDisk);
  });

  it("never carries a key and never claims the switch is proven", () => {
    for (const door of AGENT_CLI_DOORS) {
      expect(door.config).not.toMatch(/hyp_[A-Za-z0-9]/);
      expect(door.status.toLowerCase()).toContain("not yet recorded");
    }
  });
});
