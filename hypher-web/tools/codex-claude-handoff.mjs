#!/usr/bin/env node
/**
 * Mac helper for the Codex CLI ↔ Claude Code handoff.
 * Prints repo metadata and paste-in instructions. Does not launch either CLI.
 */
import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

export function commandOnPath(bin) {
  const result = spawnSync("which", [bin], { encoding: "utf8" });
  return result.status === 0 && Boolean(result.stdout?.trim());
}

function git(args) {
  try {
    return execFileSync("git", args, { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

export function repoMetadata() {
  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]);
  const commit = git(["rev-parse", "HEAD"]);
  const status = git(["status", "--porcelain"]);
  if (!branch || !commit) return null;
  return {
    branch,
    commit,
    dirty: Boolean(status),
  };
}

export function statusReport() {
  return {
    codexOnPath: commandOnPath("codex"),
    claudeOnPath: commandOnPath("claude"),
    ranAgents: false,
    repo: repoMetadata(),
    note: "This command does not launch Codex or Claude Code and does not checkout files.",
  };
}

export function promptText(report = statusReport()) {
  const repo = report.repo
    ? JSON.stringify(report.repo)
    : "unavailable (not a git checkout)";
  return [
    "Hypher explicit handoff. Do not launch a second agent from this script.",
    `Repo metadata: ${repo}`,
    "Save: post_agent_event kind handoff with proposal schemaVersion 1, expectedBaseRevision, and a new idempotencyKey.",
    "Resume: prepare_handoff with destination (claude-code or codex) and currentRepo from this metadata.",
    "Compare the working tree. Do not checkout or sync files from the handoff.",
    "ranAgents: false",
  ].join("\n");
}

function main() {
  const command = process.argv[2] ?? "status";
  if (command !== "status" && command !== "prompt") {
    console.error("Usage: node tools/codex-claude-handoff.mjs [status|prompt]");
    process.exitCode = 1;
    return;
  }
  const report = statusReport();
  if (command === "status") {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  console.log(promptText(report));
}

const invokedDirectly = process.argv[1]
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedDirectly) {
  main();
}
