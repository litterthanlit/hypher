#!/usr/bin/env node
/**
 * Mac helper for the Codex CLI ↔ Claude Code handoff.
 * Prints repo metadata and the MCP arguments to send. Does not launch either CLI
 * and does not post to Hypher.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const HANDOFF_AGENTS = ["codex", "claude-code"];
export const PROJECT_ID_FILL = "FILL: project id from resolve_project_for_repo for litterthanlit/hypher";
export const RESUME_REVISION_FILL = "FILL: revision number returned by prepare_handoff";

const FILL = {
  title: "FILL: one line naming the changed decision",
  body: "FILL: what changed, what is unfinished, and the next action. Do not paste file contents.",
  goal: "FILL: current goal",
  constraint: "FILL: a constraint that is not already in the files",
  decision: "FILL: the decision, including one that changed this session",
  reason: "FILL: why that decision changed or still holds",
  completed: "FILL: work this session actually finished",
  unverified: "FILL: unfinished work, or a claim that was not verified",
  nextAction: "FILL: the single next action",
  sourceRef: "FILL: file path, issue, or prior handoff revision",
  sourceLabel: "FILL: what that source shows",
};

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
    transfersCode: false,
    checksOut: false,
    repo: repoMetadata(),
    configs: {
      claudeMcp: ".mcp.json",
      codexMcp: ".codex/config.toml",
      claudeSave: ".claude/commands/hypher-save.md",
      claudeResume: ".claude/commands/hypher-resume.md",
      codexSave: ".agents/skills/hypher-save/SKILL.md",
      codexResume: ".agents/skills/hypher-resume/SKILL.md",
      claudeHooksStub: ".claude/settings.hooks.stub.json",
    },
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
    "Compare branch, commit, and dirty. Do not checkout or sync files from the handoff.",
    "Print the four MCP calls with: node tools/codex-claude-handoff.mjs round-trip",
    "ranAgents: false",
  ].join("\n");
}

function requireAgent(value, flag) {
  if (!HANDOFF_AGENTS.includes(value)) {
    throw new Error(`${flag} must be codex or claude-code`);
  }
  return value;
}

function requireRepo(repo) {
  if (!repo?.branch || !repo?.commit || typeof repo.dirty !== "boolean") {
    throw new Error("repo metadata is required (branch, commit, dirty)");
  }
  return {
    branch: repo.branch,
    commit: repo.commit,
    dirty: repo.dirty,
  };
}

function requireRevision(value) {
  if (value === RESUME_REVISION_FILL) return value;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error("expectedBaseRevision must be a non-negative integer");
  }
  return value;
}

export function saveCall({ source, expectedBaseRevision, repo, idempotencyKey }) {
  const agent = requireAgent(source, "source");
  const snapshot = requireRepo(repo);
  const revision = requireRevision(expectedBaseRevision);
  const key = typeof idempotencyKey === "string" && idempotencyKey.trim()
    ? idempotencyKey.trim()
    : `${agent}-${randomUUID()}`;
  return {
    tool: "post_agent_event",
    ranAgents: false,
    transfersCode: false,
    checksOut: false,
    replaceBeforeSend: [
      "Every FILL value",
      revision === RESUME_REVISION_FILL ? "expectedBaseRevision, using the revision prepare_handoff returned" : null,
    ].filter(Boolean),
    arguments: {
      kind: "handoff",
      source: agent,
      title: FILL.title,
      body: FILL.body,
      projectId: PROJECT_ID_FILL,
      repo: "litterthanlit/hypher",
      branch: snapshot.branch,
      commitSha: snapshot.commit,
      expectedBaseRevision: revision,
      idempotencyKey: key,
      proposal: {
        schemaVersion: 1,
        goal: FILL.goal,
        constraints: [FILL.constraint],
        decisions: [{ decision: FILL.decision, reason: FILL.reason }],
        completed: [FILL.completed],
        unverified: [FILL.unverified],
        blockers: [],
        nextAction: FILL.nextAction,
        sources: [{ ref: FILL.sourceRef, label: FILL.sourceLabel }],
        repo: snapshot,
      },
    },
  };
}

export function resumeCall({ destination, repo }) {
  const agent = requireAgent(destination, "destination");
  const snapshot = requireRepo(repo);
  return {
    tool: "prepare_handoff",
    ranAgents: false,
    transfersCode: false,
    checksOut: false,
    afterResult: "If repoMatch is false, say which of branch, commit, and dirty differ. Continue from the proposal. Do not checkout or copy files.",
    arguments: {
      projectId: PROJECT_ID_FILL,
      destination: agent,
      destinationProjectId: PROJECT_ID_FILL,
      currentRepo: snapshot,
    },
  };
}

export function roundTrip(repo = repoMetadata(), ids = {}) {
  const snapshot = requireRepo(repo);
  const codexSaveKey = ids.codexSaveKey ?? `codex-${randomUUID()}`;
  const claudeSaveKey = ids.claudeSaveKey ?? `claude-code-${randomUUID()}`;
  if (codexSaveKey === claudeSaveKey) {
    throw new Error("save idempotency keys must differ");
  }
  return {
    ranAgents: false,
    transfersCode: false,
    checksOut: false,
    repo: snapshot,
    beforeContinuing: "Compare branch, commit, and dirty with the handoff snapshot. Memory does not transfer code or uncommitted files.",
    steps: [
      {
        step: 1,
        agent: "codex",
        action: "save",
        skill: "$hypher-save",
        call: saveCall({
          source: "codex",
          expectedBaseRevision: 0,
          repo: snapshot,
          idempotencyKey: codexSaveKey,
        }),
      },
      {
        step: 2,
        agent: "claude-code",
        action: "resume",
        command: "/hypher-resume",
        call: resumeCall({ destination: "claude-code", repo: snapshot }),
      },
      {
        step: 3,
        agent: "claude-code",
        action: "save",
        command: "/hypher-save",
        note: "Include the changed decision and leave unfinished work in unverified. expectedBaseRevision is the revision from step 2, not 0.",
        call: saveCall({
          source: "claude-code",
          expectedBaseRevision: RESUME_REVISION_FILL,
          repo: snapshot,
          idempotencyKey: claudeSaveKey,
        }),
      },
      {
        step: 4,
        agent: "codex",
        action: "resume",
        skill: "$hypher-resume",
        call: resumeCall({ destination: "codex", repo: snapshot }),
      },
    ],
  };
}

function parseFlags(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--source") flags.source = argv[++i];
    else if (arg === "--destination") flags.destination = argv[++i];
    else if (arg === "--base-revision") flags.baseRevision = argv[++i];
    else throw new Error(`Unknown argument: ${arg}`);
    if (argv[i] === undefined) throw new Error(`Missing value for ${arg}`);
  }
  return flags;
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function main() {
  const [command = "status", ...rest] = process.argv.slice(2);
  let flags;
  try {
    flags = parseFlags(rest);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Invalid arguments");
    process.exitCode = 1;
    return;
  }
  if (command === "status") {
    printJson(statusReport());
    return;
  }
  if (command === "prompt") {
    console.log(promptText());
    return;
  }
  const repo = repoMetadata();
  try {
    if (command === "save") {
      if (flags.baseRevision === undefined) {
        throw new Error("--base-revision is required (0 only when no structured handoff exists yet)");
      }
      const expectedBaseRevision = Number(flags.baseRevision);
      if (!Number.isInteger(expectedBaseRevision)) {
        throw new Error("--base-revision must be an integer");
      }
      printJson(saveCall({
        source: flags.source,
        expectedBaseRevision,
        repo,
      }));
      return;
    }
    if (command === "resume") {
      printJson(resumeCall({ destination: flags.destination, repo }));
      return;
    }
    if (command === "round-trip") {
      printJson(roundTrip(repo));
      return;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Failed");
    process.exitCode = 1;
    return;
  }
  console.error("Usage: node tools/codex-claude-handoff.mjs [status|prompt|save|resume|round-trip]");
  process.exitCode = 1;
}

const invokedDirectly = process.argv[1]
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedDirectly) {
  main();
}
