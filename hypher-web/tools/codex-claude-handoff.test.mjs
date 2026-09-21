import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseHandoffProposal, compareRepoSnapshot } from "../shared/structuredHandoff.ts";
import {
  commandOnPath,
  promptText,
  resumeCall,
  roundTrip,
  saveCall,
  statusReport,
} from "./codex-claude-handoff.mjs";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(webRoot, "..");

const sampleRepo = {
  branch: "cursor/codex-claude-adapter-spike-d851",
  commit: "abc123def456",
  dirty: true,
};

function fillValue(value) {
  if (typeof value === "string" && value.startsWith("FILL:")) {
    return `Recorded ${value.slice("FILL:".length).trim()}`;
  }
  if (Array.isArray(value)) return value.map(fillValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, fillValue(item)]));
  }
  return value;
}

describe("codex-claude handoff helper", () => {
  it("never reports that the CLIs ran", () => {
    const report = statusReport();
    expect(report.ranAgents).toBe(false);
    expect(report.transfersCode).toBe(false);
    expect(report.checksOut).toBe(false);
    expect(report.note).toMatch(/does not launch/);
    expect(promptText(report)).toMatch(/ranAgents: false/);
    expect(promptText(report)).toMatch(/Do not checkout/);
    if (!commandOnPath("codex")) expect(report.codexOnPath).toBe(false);
    if (!commandOnPath("claude")) expect(report.claudeOnPath).toBe(false);
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

  it("builds a save payload whose repo snapshot is metadata only", () => {
    const call = saveCall({
      source: "codex",
      expectedBaseRevision: 0,
      repo: sampleRepo,
      idempotencyKey: "codex-test-key",
    });
    expect(call.ranAgents).toBe(false);
    expect(call.transfersCode).toBe(false);
    expect(call.checksOut).toBe(false);
    expect(call.arguments.kind).toBe("handoff");
    expect(call.arguments.source).toBe("codex");
    expect(call.arguments.proposal.repo).toEqual(sampleRepo);
    expect(call.arguments.proposal).not.toHaveProperty("files");
    expect(call.arguments.proposal).not.toHaveProperty("patch");
    expect(call.arguments.proposal).not.toHaveProperty("diff");
    const filled = fillValue(call.arguments.proposal);
    expect(parseHandoffProposal(filled).ok).toBe(true);
    expect(parseHandoffProposal({ ...filled, files: "secret" }).ok).toBe(false);
  });

  it("resume carries destination repo metadata and warns when dirty state differs", () => {
    const call = resumeCall({ destination: "claude-code", repo: sampleRepo });
    expect(call.tool).toBe("prepare_handoff");
    expect(call.arguments.destination).toBe("claude-code");
    expect(call.arguments.currentRepo).toEqual(sampleRepo);
    expect(call.arguments.projectId).toBe(call.arguments.destinationProjectId);
    expect(call.checksOut).toBe(false);
    const comparison = compareRepoSnapshot(sampleRepo, { ...sampleRepo, dirty: false });
    expect(comparison.match).toBe(false);
    expect(comparison.warning).toMatch(/dirty/);
    expect(comparison.warning).toMatch(/did not transfer code/);
  });

  it("prints the four-step round trip without launching agents", () => {
    const trip = roundTrip(sampleRepo, {
      codexSaveKey: "codex-one",
      claudeSaveKey: "claude-code-two",
    });
    expect(trip.ranAgents).toBe(false);
    expect(trip.steps.map((step) => `${step.agent}:${step.action}`)).toEqual([
      "codex:save",
      "claude-code:resume",
      "claude-code:save",
      "codex:resume",
    ]);
    expect(trip.steps[0].call.arguments.expectedBaseRevision).toBe(0);
    expect(trip.steps[2].call.arguments.expectedBaseRevision).toMatch(/FILL:/);
    expect(trip.steps[2].call.arguments.idempotencyKey).not.toBe(trip.steps[0].call.arguments.idempotencyKey);
    expect(trip.steps[2].note).toMatch(/changed decision/);
    expect(trip.steps[2].note).toMatch(/unverified/);
    expect(JSON.stringify(trip)).not.toMatch(/git checkout/);

    const stdout = execFileSync("node", ["tools/codex-claude-handoff.mjs", "round-trip"], {
      cwd: webRoot,
      encoding: "utf8",
    });
    const printed = JSON.parse(stdout);
    expect(printed.ranAgents).toBe(false);
    expect(printed.steps).toHaveLength(4);
    expect(printed.repo.branch).toBeTruthy();
    expect(printed.repo.commit).toMatch(/^[0-9a-f]{7,}$/);
    expect(typeof printed.repo.dirty).toBe("boolean");
  });

  it("rejects a save that does not name the agent", () => {
    expect(() => execFileSync("node", ["tools/codex-claude-handoff.mjs", "save"], {
      cwd: webRoot,
      encoding: "utf8",
      stdio: "pipe",
    })).toThrow();
  });
});

describe("project-local adapter samples", () => {
  it("points both CLIs at Hypher MCP without embedding a key", () => {
    const claude = JSON.parse(readFileSync(path.join(repoRoot, ".mcp.json"), "utf8"));
    expect(claude.mcpServers.hypher.url).toBe("https://www.hypher.app/api/mcp");
    expect(claude.mcpServers.hypher.headers.Authorization).toBe("Bearer ${HYPHER_API_KEY}");
    const codex = readFileSync(path.join(repoRoot, ".codex/config.toml"), "utf8");
    expect(codex).toMatch(/url = "https:\/\/www\.hypher\.app\/api\/mcp"/);
    expect(codex).toMatch(/bearer_token_env_var = "HYPHER_API_KEY"/);
    expect(codex).not.toMatch(/features\.hooks\s*=\s*true/);
    expect(`${JSON.stringify(claude)}\n${codex}`).not.toMatch(/hyp_[A-Za-z0-9]/);
  });

  it("skills and commands call MCP and refuse checkout", () => {
    const files = [
      ".claude/commands/hypher-save.md",
      ".claude/commands/hypher-resume.md",
      ".agents/skills/hypher-save/SKILL.md",
      ".agents/skills/hypher-resume/SKILL.md",
    ].map((file) => readFileSync(path.join(repoRoot, file), "utf8"));
    const combined = files.join("\n");
    expect(combined).toMatch(/post_agent_event/);
    expect(combined).toMatch(/prepare_handoff/);
    expect(combined).toMatch(/currentRepo/);
    expect(combined).toMatch(/Do not checkout/);
    expect(combined).not.toMatch(/git checkout/);
  });

  it("keeps the Claude hook stub from posting a handoff", () => {
    const stub = JSON.parse(readFileSync(path.join(repoRoot, ".claude/settings.hooks.stub.json"), "utf8"));
    const command = stub.hooks.SessionStart[0].hooks[0].command;
    expect(command).toMatch(/codex-claude-handoff\.mjs/);
    expect(command).toMatch(/prompt/);
    expect(command).not.toMatch(/post_agent_event/);
    expect(command).not.toMatch(/curl /);
  });
});
