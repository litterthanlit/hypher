#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const INTEGRATIONS_URL = "https://hypher.app/app/settings/integrations";
export const DEFAULT_MCP_URL = "https://www.hypher.app/api/mcp";
export const DEFAULT_EVENTS_URL = "https://hypher.app/api/agent/events";
export const SOURCE = "cursor";
export const MIN_SESSION_MS = 5_000;
export const MAX_BRIEF_CHARS = 48_000;
export const FETCH_TIMEOUT_MS = 8_000;
const MAX_STATUS_FILES = 30;

export function normalizeGitHubRepo(input) {
  const raw = (input ?? "").trim();
  if (!raw) return null;

  let value = raw.replace(/\.git$/i, "");
  const sshMatch = value.match(/^git@github\.com:(.+)$/i);
  if (sshMatch?.[1]) {
    value = sshMatch[1];
  } else if (/github\.com/i.test(value)) {
    try {
      const url = new URL(value.startsWith("http") ? value : `https://${value.replace(/^git\+/, "")}`);
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length >= 2) {
        value = `${parts[0]}/${parts[1]}`;
      }
    } catch {
      return null;
    }
  }

  value = value.replace(/^\/+/, "").replace(/\.git$/i, "");
  if (!/^[\w.-]+\/[\w.-]+$/.test(value)) return null;
  return value;
}

export function readCredentials(env = process.env) {
  const apiKey = String(env.HYPHER_API_KEY ?? "").trim();
  const accessToken = String(
    env.HYPHER_ACCESS_TOKEN ?? env.HYPHER_OAUTH_TOKEN ?? env.HYPHER_TOKEN ?? ""
  ).trim();
  const tokenIsApiKey = accessToken.startsWith("hyp_");
  return {
    apiKey: apiKey || (tokenIsApiKey ? accessToken : ""),
    accessToken: accessToken && !tokenIsApiKey ? accessToken : "",
  };
}

export function eventsUrl(env = process.env) {
  return String(env.HYPHER_ENDPOINT ?? "").trim() || DEFAULT_EVENTS_URL;
}

export function mcpUrl(env = process.env) {
  return String(env.HYPHER_MCP_URL ?? "").trim() || DEFAULT_MCP_URL;
}

function gitText(cwd, args) {
  try {
    return execFileSync("git", ["-C", cwd, ...args], {
      encoding: "utf8",
      timeout: 3_000,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

function firstRemoteUrl(cwd) {
  const names = gitText(cwd, ["remote"]).split("\n").map((line) => line.trim()).filter(Boolean);
  if (names.length === 0) return "";
  const origin = names.includes("origin") ? "origin" : names[0];
  return gitText(cwd, ["remote", "get-url", origin]);
}

export function detectGitIdentity(cwd) {
  const root = String(cwd ?? "").trim();
  if (!root) {
    return { cwd: "", remote: "", repo: null, branch: "", commitSha: "", changedFiles: [] };
  }
  const remote = gitText(root, ["remote", "get-url", "origin"]) || firstRemoteUrl(root);
  const branch = gitText(root, ["branch", "--show-current"]);
  const commitSha = gitText(root, ["rev-parse", "HEAD"]);
  const status = gitText(root, ["status", "--porcelain"]);
  const changedFiles = status.split("\n").map((line) => line.trimEnd()).filter(Boolean);
  return {
    cwd: root,
    remote,
    repo: normalizeGitHubRepo(remote),
    branch,
    commitSha,
    changedFiles,
  };
}

export function unwrapMcpToolResult(payload) {
  if (!payload || typeof payload !== "object") return null;
  return payload.result ?? payload;
}

export function extractStructured(payload) {
  const result = unwrapMcpToolResult(payload);
  if (result?.structuredContent && typeof result.structuredContent === "object") {
    return result.structuredContent;
  }
  const text = result?.content?.[0]?.text;
  if (typeof text === "string") {
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
      return null;
    }
  }
  return null;
}

export function extractBrief(payload) {
  const result = unwrapMcpToolResult(payload);
  const fromStructured = result?.structuredContent?.context;
  if (typeof fromStructured === "string" && fromStructured.trim()) return fromStructured.trim();
  const text = result?.content?.[0]?.text;
  if (typeof text === "string" && text.trim()) return text.trim();
  return "";
}

export async function readStdinJson(stream = process.stdin) {
  const chunks = [];
  try {
    for await (const chunk of stream) chunks.push(chunk);
  } catch {
    return {};
  }
  const raw = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("utf8").trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function markerDir(env = process.env) {
  return String(env.HYPHER_HOOK_MARKER_DIR ?? "").trim() || join(tmpdir(), "hypher-cursor");
}

export function markerPath(sessionId, env = process.env) {
  const safe = String(sessionId || "unknown").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  return join(markerDir(env), `${safe}.json`);
}

export function readMarker(sessionId, env = process.env) {
  try {
    const raw = readFileSync(markerPath(sessionId, env), "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function writeMarker(sessionId, data, env = process.env) {
  const dir = markerDir(env);
  mkdirSync(dir, { recursive: true });
  writeFileSync(markerPath(sessionId, env), `${JSON.stringify({ sessionId, ...data, updatedAt: Date.now() })}\n`);
}

export function capBrief(brief) {
  const text = String(brief ?? "").trim();
  if (text.length <= MAX_BRIEF_CHARS) return text;
  return `${text.slice(0, MAX_BRIEF_CHARS)}\n\n[Brief truncated. Call get_project_context once for the rest.]`;
}

export function buildLoadOnceInstruction(git) {
  const remote = git.remote || git.repo || "";
  const lines = [
    "Hypher session start (automatic via Cursor plugin hook).",
    "",
    "Load project memory once now, then work in Cursor. Do not reload the full Builder Brief every turn.",
    "",
    "1. Call resolve_project_for_repo with this workspace git remote:",
    `   repo: ${remote || "(no origin remote)"}`,
  ];
  if (git.branch) lines.push(`   branch: ${git.branch}`);
  lines.push(
    "2. If matched is true: call get_project_context once with that projectId. Treat the Builder Brief as working context for the rest of this session.",
    `3. If matched is false: tell the builder to link the repo at ${INTEGRATIONS_URL}. Do not invent project status from the repo.`,
    "4. At session end, post one handoff with post_agent_event (kind: handoff, source: cursor), including repo, branch, and commit SHA when available. Do not spam build_log.",
    "5. /hypher-brief and /hypher-handoff stay as manual overrides. Prefer one event total.",
    "6. This start instruction is not a posted handoff. Call post_agent_event at session end even though this text names those tools. The sessionEnd hook does not post unless a Hypher token is in the hook process.",
  );
  return lines.join("\n");
}

export function buildUnmatchedInstruction(git) {
  const repo = git.repo || git.remote || "this workspace";
  return [
    "Hypher session start (automatic via Cursor plugin hook).",
    "",
    `No Hypher project is linked to ${repo}.`,
    `Link owner/repo at ${INTEGRATIONS_URL}. A GitHub token is not required.`,
    "Do not invent project status from the repository. Cursor already has the code; Hypher has the decisions that never made it into the code.",
    "/hypher-brief is the manual retry after the repo is linked.",
  ].join("\n");
}

export function buildNoRepoInstruction() {
  return [
    "Hypher session start (automatic via Cursor plugin hook).",
    "",
    "This workspace has no git origin, so Hypher cannot resolve a project.",
    "Do not invent project status. /hypher-brief stays available after a remote is added and linked.",
  ].join("\n");
}

export function buildBriefContext({ git, projectId, projectName, brief }) {
  const label = projectName ? `${projectName} (${projectId})` : projectId;
  return [
    "Hypher session start (automatic via Cursor plugin hook).",
    "",
    `Linked repo ${git.repo || git.remote} → ${label}.`,
    "This Builder Brief is working context for the rest of the session. Do not call get_project_context again unless the user runs /hypher-brief.",
    "At session end, Hypher wants one handoff — not a firehose of build_log. /hypher-handoff is the manual override.",
    "",
    capBrief(brief),
  ].join("\n");
}

export function sessionEnvFrom(git, extra = {}) {
  const env = {};
  if (git.repo) env.HYPHER_HOOK_REPO = git.repo;
  if (git.remote) env.HYPHER_HOOK_REMOTE = git.remote;
  if (git.branch) env.HYPHER_HOOK_BRANCH = git.branch;
  if (git.commitSha) env.HYPHER_HOOK_COMMIT = git.commitSha;
  for (const [key, value] of Object.entries(extra)) {
    if (value === undefined || value === null || value === "") continue;
    env[key] = String(value);
  }
  return env;
}

async function parseFetchJson(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { parseError: true, text };
  }
}

export async function callMcpTool({ url, token, name, args, fetchImpl = fetch, timeoutMs = FETCH_TIMEOUT_MS }) {
  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name, arguments: args },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const payload = await parseFetchJson(response);
  if (!response.ok) {
    const message = payload?.error?.message || payload?.text || `HTTP ${response.status}`;
    throw new Error(`mcp ${name} failed: ${message}`);
  }
  if (payload?.error) {
    throw new Error(`mcp ${name} failed: ${payload.error.message || "jsonrpc error"}`);
  }
  return payload;
}

export async function postHandoffEvent({ endpoint, token, payload, fetchImpl = fetch, timeoutMs = FETCH_TIMEOUT_MS }) {
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`handoff failed (${response.status}): ${text}`);
  return text;
}

export async function loadBriefForRepo({ mcpUrl: url, token, git, fetchImpl = fetch }) {
  const repoArg = git.remote || git.repo;
  if (!repoArg || !token) return { ok: false, reason: "missing-repo-or-token" };

  const resolvedPayload = await callMcpTool({
    url,
    token,
    name: "resolve_project_for_repo",
    args: git.branch ? { repo: repoArg, branch: git.branch } : { repo: repoArg },
    fetchImpl,
  });
  const resolved = extractStructured(resolvedPayload);
  if (!resolved?.matched || !resolved.projectId) {
    return {
      ok: true,
      matched: false,
      repo: git.repo || repoArg,
      integrationsUrl: resolved?.integrationsUrl || INTEGRATIONS_URL,
    };
  }

  const briefPayload = await callMcpTool({
    url,
    token,
    name: "get_project_context",
    args: { projectId: String(resolved.projectId) },
    fetchImpl,
  });
  const brief = extractBrief(briefPayload);
  if (!brief) return { ok: false, reason: "empty-brief", matched: true, projectId: resolved.projectId };

  return {
    ok: true,
    matched: true,
    projectId: String(resolved.projectId),
    projectName: typeof resolved.projectName === "string" ? resolved.projectName : "",
    brief,
  };
}

export async function runSessionStart({
  input = {},
  env = process.env,
  git,
  fetchImpl = fetch,
} = {}) {
  const sessionId = String(input.session_id ?? "").trim();
  const identity = git ?? detectGitIdentity(env.CURSOR_PROJECT_DIR || env.CLAUDE_PROJECT_DIR || process.cwd());
  const creds = readCredentials(env);
  let additionalContext = identity.remote || identity.repo
    ? buildLoadOnceInstruction(identity)
    : buildNoRepoInstruction();
  const extraEnv = {
    HYPHER_HOOK_SESSION_ID: sessionId,
  };

  if (creds.accessToken && (identity.remote || identity.repo)) {
    try {
      const loaded = await loadBriefForRepo({
        mcpUrl: mcpUrl(env),
        token: creds.accessToken,
        git: identity,
        fetchImpl,
      });
      if (loaded.ok && loaded.matched) {
        additionalContext = buildBriefContext({
          git: identity,
          projectId: loaded.projectId,
          projectName: loaded.projectName,
          brief: loaded.brief,
        });
        extraEnv.HYPHER_HOOK_MATCHED = "1";
        extraEnv.HYPHER_HOOK_PROJECT_ID = loaded.projectId;
        if (loaded.projectName) extraEnv.HYPHER_HOOK_PROJECT_NAME = loaded.projectName;
      } else if (loaded.ok && loaded.matched === false) {
        additionalContext = buildUnmatchedInstruction(identity);
        extraEnv.HYPHER_HOOK_MATCHED = "0";
      }
    } catch {
      additionalContext = buildLoadOnceInstruction(identity);
    }
  }

  if (sessionId) {
    writeMarker(sessionId, {
      phase: "start",
      posted: false,
      repo: identity.repo,
      remote: identity.remote,
      branch: identity.branch,
      commitSha: identity.commitSha,
      matched: extraEnv.HYPHER_HOOK_MATCHED ?? null,
      projectId: extraEnv.HYPHER_HOOK_PROJECT_ID ?? null,
    }, env);
  }

  return {
    additional_context: additionalContext,
    env: sessionEnvFrom(identity, extraEnv),
  };
}

export function buildHandoffBody({ reason, durationMs, repo, branch, commitSha, changedFiles }) {
  const lines = [
    "Cursor session-end receipt. One handoff event. Not a compiled Builder Brief. No product status inferred.",
    "",
  ];
  if (repo) lines.push(`Repo: ${repo}`);
  if (branch) lines.push(`Branch: ${branch}`);
  if (commitSha) lines.push(`Commit: ${commitSha}`);
  if (reason) lines.push(`Ended: ${reason}`);
  if (typeof durationMs === "number" && Number.isFinite(durationMs)) {
    lines.push(`Duration_ms: ${Math.round(durationMs)}`);
  }
  lines.push("");
  const files = Array.isArray(changedFiles) ? changedFiles.filter(Boolean) : [];
  if (files.length > 0) {
    lines.push("Local git status (files only):");
    for (const file of files.slice(0, MAX_STATUS_FILES)) lines.push(`- ${file}`);
    if (files.length > MAX_STATUS_FILES) lines.push(`- … ${files.length - MAX_STATUS_FILES} more`);
  } else {
    lines.push("No local git changes listed.");
  }
  return lines.join("\n");
}

export function buildHandoffPayload({ git, input, projectName }) {
  const repo = git.repo || undefined;
  const title = repo ? `Cursor session ended (${repo})` : "Cursor session ended";
  const payload = {
    source: SOURCE,
    kind: "handoff",
    title,
    body: buildHandoffBody({
      reason: input.reason,
      durationMs: input.duration_ms,
      repo: git.repo,
      branch: git.branch,
      commitSha: git.commitSha,
      changedFiles: git.changedFiles,
    }),
  };
  if (repo) payload.repo = repo;
  if (git.branch) payload.branch = git.branch;
  if (git.commitSha) payload.commitSha = git.commitSha;
  if (projectName) payload.project = projectName;
  return payload;
}

export function shouldSkipSessionEnd(input = {}, marker = null) {
  if (marker?.posted) return "already-posted";
  const duration = Number(input.duration_ms);
  if (Number.isFinite(duration) && duration < MIN_SESSION_MS) return "too-short";
  return null;
}

export function textLooksLikePostedHandoff(text) {
  const slice = String(text ?? "");
  if (!slice.trim()) return false;
  return /"(?:name|tool)"\s*:\s*"post_agent_event"/i.test(slice)
    && /"kind"\s*:\s*"handoff"/i.test(slice);
}

export function transcriptHasHandoff(transcriptPath) {
  const file = String(transcriptPath ?? "").trim();
  if (!file) return false;
  try {
    const raw = readFileSync(file, "utf8");
    const slice = raw.length > 200_000 ? raw.slice(-200_000) : raw;
    return textLooksLikePostedHandoff(slice);
  } catch {
    return false;
  }
}

function gitFromEnvAndMarker(env, marker, detected) {
  return {
    cwd: detected.cwd,
    remote: env.HYPHER_HOOK_REMOTE || marker?.remote || detected.remote,
    repo: env.HYPHER_HOOK_REPO || marker?.repo || detected.repo,
    branch: env.HYPHER_HOOK_BRANCH || marker?.branch || detected.branch,
    commitSha: env.HYPHER_HOOK_COMMIT || marker?.commitSha || detected.commitSha,
    changedFiles: detected.changedFiles,
  };
}

export async function runSessionEnd({
  input = {},
  env = process.env,
  git,
  fetchImpl = fetch,
} = {}) {
  const sessionId = String(input.session_id ?? env.HYPHER_HOOK_SESSION_ID ?? "").trim();
  const marker = sessionId ? readMarker(sessionId, env) : null;
  const skip = shouldSkipSessionEnd(input, marker);
  if (skip) {
    if (sessionId) writeMarker(sessionId, { ...(marker ?? {}), phase: "end", posted: Boolean(marker?.posted), skip }, env);
    return { skipped: skip };
  }

  if (transcriptHasHandoff(env.CURSOR_TRANSCRIPT_PATH)) {
    if (sessionId) writeMarker(sessionId, { ...(marker ?? {}), phase: "end", posted: true, skip: "agent-already-posted" }, env);
    return { skipped: "agent-already-posted" };
  }

  const creds = readCredentials(env);
  if (!creds.apiKey && !creds.accessToken) {
    if (sessionId) writeMarker(sessionId, { ...(marker ?? {}), phase: "end", posted: false, skip: "no-credential" }, env);
    return { skipped: "no-credential" };
  }

  const detected = git ?? detectGitIdentity(env.CURSOR_PROJECT_DIR || env.CLAUDE_PROJECT_DIR || process.cwd());
  const identity = gitFromEnvAndMarker(env, marker, detected);
  if (!identity.repo && !identity.remote) {
    if (sessionId) writeMarker(sessionId, { ...(marker ?? {}), phase: "end", posted: false, skip: "no-repo" }, env);
    return { skipped: "no-repo" };
  }

  let matchedFlag = env.HYPHER_HOOK_MATCHED ?? marker?.matched;
  let projectId = env.HYPHER_HOOK_PROJECT_ID || marker?.projectId || "";
  let projectName = env.HYPHER_HOOK_PROJECT_NAME || marker?.projectName || "";

  if ((matchedFlag === "0" || matchedFlag === false) && creds.accessToken) {
    try {
      const resolvedPayload = await callMcpTool({
        url: mcpUrl(env),
        token: creds.accessToken,
        name: "resolve_project_for_repo",
        args: identity.branch
          ? { repo: identity.remote || identity.repo, branch: identity.branch }
          : { repo: identity.remote || identity.repo },
        fetchImpl,
      });
      const resolved = extractStructured(resolvedPayload);
      if (resolved?.matched && resolved.projectId) {
        matchedFlag = "1";
        projectId = String(resolved.projectId);
        if (typeof resolved.projectName === "string" && resolved.projectName.trim()) {
          projectName = resolved.projectName.trim();
        }
      }
    } catch {
      // Still unmatched. Skip rather than invent a project.
    }
  }

  if (matchedFlag === "0" || matchedFlag === false) {
    if (sessionId) writeMarker(sessionId, { ...(marker ?? {}), phase: "end", posted: false, skip: "unmatched" }, env);
    return { skipped: "unmatched" };
  }

  const payload = buildHandoffPayload({ git: identity, input, projectName });

  try {
    if (creds.accessToken) {
      const args = {
        kind: "handoff",
        title: payload.title,
        body: payload.body,
        source: SOURCE,
      };
      if (projectId) args.projectId = projectId;
      if (payload.repo) args.repo = payload.repo;
      if (payload.branch) args.branch = payload.branch;
      if (payload.commitSha) args.commitSha = payload.commitSha;
      await callMcpTool({
        url: mcpUrl(env),
        token: creds.accessToken,
        name: "post_agent_event",
        args,
        fetchImpl,
      });
    } else {
      await postHandoffEvent({
        endpoint: eventsUrl(env),
        token: creds.apiKey,
        payload,
        fetchImpl,
      });
    }
    if (sessionId) writeMarker(sessionId, { ...(marker ?? {}), phase: "end", posted: true }, env);
    return { posted: true };
  } catch {
    if (sessionId) writeMarker(sessionId, { ...(marker ?? {}), phase: "end", posted: false, skip: "write-failed" }, env);
    return { skipped: "write-failed" };
  }
}

export function emit(output) {
  process.stdout.write(`${JSON.stringify(output)}\n`);
}
