import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { execFileSync } from "node:child_process";
import {
  INTEGRATIONS_URL,
  buildBriefContext,
  buildHandoffPayload,
  buildLoadOnceInstruction,
  buildUnmatchedInstruction,
  extractBrief,
  extractStructured,
  normalizeGitHubRepo,
  readCredentials,
  runSessionEnd,
  runSessionStart,
  shouldSkipSessionEnd,
  transcriptHasHandoff,
} from "./hypher-session.mjs";

const here = dirname(fileURLToPath(import.meta.url));

function jsonResponse(body, status = 200) {
  const text = JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return text;
    },
    async json() {
      return body;
    },
  };
}

function mcpFetch(handlers) {
  return async (_url, init) => {
    const body = JSON.parse(init.body);
    const name = body.params?.name;
    const handler = handlers[name];
    if (!handler) return jsonResponse({ error: { message: `unexpected ${name}` } }, 500);
    return handler(body);
  };
}

test("normalizeGitHubRepo accepts ssh, https, and owner/repo", () => {
  assert.equal(normalizeGitHubRepo("git@github.com:litterthanlit/hypher.git"), "litterthanlit/hypher");
  assert.equal(normalizeGitHubRepo("https://github.com/litterthanlit/hypher.git"), "litterthanlit/hypher");
  assert.equal(normalizeGitHubRepo("litterthanlit/hypher"), "litterthanlit/hypher");
  assert.equal(normalizeGitHubRepo(""), null);
});

test("readCredentials treats hyp_ tokens as API keys, not MCP OAuth", () => {
  assert.deepEqual(readCredentials({ HYPHER_API_KEY: "hyp_abc" }), { apiKey: "hyp_abc", accessToken: "" });
  assert.deepEqual(readCredentials({ HYPHER_TOKEN: "hyp_abc" }), { apiKey: "hyp_abc", accessToken: "" });
  assert.deepEqual(readCredentials({ HYPHER_ACCESS_TOKEN: "oauth-token" }), { apiKey: "", accessToken: "oauth-token" });
});

test("unmatched instruction points at Integrations and does not invent status", () => {
  const text = buildUnmatchedInstruction({ repo: "acme/unknown" });
  assert.match(text, /acme\/unknown/);
  assert.match(text, new RegExp(INTEGRATIONS_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(text, /Do not invent project status/);
  assert.doesNotMatch(text, /current direction/i);
});

test("load-once instruction asks for one resolve + one brief + one handoff", () => {
  const text = buildLoadOnceInstruction({
    remote: "git@github.com:litterthanlit/hypher.git",
    repo: "litterthanlit/hypher",
    branch: "main",
  });
  assert.match(text, /resolve_project_for_repo/);
  assert.match(text, /get_project_context once/);
  assert.match(text, /post_agent_event/);
  assert.match(text, /Do not spam build_log/);
  assert.match(text, /\/hypher-brief/);
  assert.match(text, /\/hypher-handoff/);
});

test("injected brief tells the agent not to reload every turn", () => {
  const text = buildBriefContext({
    git: { repo: "litterthanlit/hypher" },
    projectId: "p1",
    projectName: "Hypher",
    brief: "# Builder Brief: Hypher\nDon't widen OAuth.",
  });
  assert.match(text, /Builder Brief: Hypher/);
  assert.match(text, /Do not call get_project_context again/);
  assert.match(text, /one handoff/);
});

test("extractors read MCP jsonrpc tool results", () => {
  const payload = {
    jsonrpc: "2.0",
    id: 1,
    result: {
      structuredContent: { matched: true, projectId: "p1", context: "# Builder Brief" },
      content: [{ type: "text", text: "# Builder Brief" }],
    },
  };
  assert.equal(extractStructured(payload).projectId, "p1");
  assert.equal(extractBrief(payload), "# Builder Brief");
});

test("sessionStart without a token instructs the agent to load the brief once", async () => {
  const dir = mkdtempSync(join(tmpdir(), "hypher-hook-"));
  const out = await runSessionStart({
    input: { session_id: "s-nored" },
    env: { CURSOR_PROJECT_DIR: dir, HYPHER_HOOK_MARKER_DIR: dir },
    git: {
      remote: "git@github.com:litterthanlit/hypher.git",
      repo: "litterthanlit/hypher",
      branch: "main",
      commitSha: "abc",
      changedFiles: [],
    },
  });
  assert.match(out.additional_context, /resolve_project_for_repo/);
  assert.equal(out.env.HYPHER_HOOK_REPO, "litterthanlit/hypher");
  assert.equal(out.env.HYPHER_HOOK_SESSION_ID, "s-nored");
  assert.equal(out.env.HYPHER_HOOK_MATCHED, undefined);
});

test("sessionStart injects the Builder Brief when MCP resolves the repo", async () => {
  const dir = mkdtempSync(join(tmpdir(), "hypher-hook-"));
  const fetchImpl = mcpFetch({
    resolve_project_for_repo: () => jsonResponse({
      jsonrpc: "2.0",
      id: 1,
      result: { structuredContent: { matched: true, projectId: "p1", projectName: "Hypher" } },
    }),
    get_project_context: () => jsonResponse({
      jsonrpc: "2.0",
      id: 1,
      result: {
        structuredContent: { projectId: "p1", context: "# Builder Brief: Hypher\nPulse stays three panels." },
        content: [{ type: "text", text: "# Builder Brief: Hypher\nPulse stays three panels." }],
      },
    }),
  });
  const out = await runSessionStart({
    input: { session_id: "s-brief" },
    env: {
      CURSOR_PROJECT_DIR: dir,
      HYPHER_HOOK_MARKER_DIR: dir,
      HYPHER_ACCESS_TOKEN: "oauth-token",
    },
    git: {
      remote: "https://github.com/litterthanlit/hypher.git",
      repo: "litterthanlit/hypher",
      branch: "main",
      commitSha: "def",
      changedFiles: [],
    },
    fetchImpl,
  });
  assert.match(out.additional_context, /Pulse stays three panels/);
  assert.equal(out.env.HYPHER_HOOK_MATCHED, "1");
  assert.equal(out.env.HYPHER_HOOK_PROJECT_ID, "p1");
});

test("sessionStart unmatched MCP result points at Integrations", async () => {
  const dir = mkdtempSync(join(tmpdir(), "hypher-hook-"));
  const fetchImpl = mcpFetch({
    resolve_project_for_repo: () => jsonResponse({
      jsonrpc: "2.0",
      id: 1,
      result: {
        structuredContent: {
          matched: false,
          projectId: null,
          integrationsUrl: INTEGRATIONS_URL,
        },
      },
    }),
  });
  const out = await runSessionStart({
    input: { session_id: "s-unmatched" },
    env: {
      CURSOR_PROJECT_DIR: dir,
      HYPHER_HOOK_MARKER_DIR: dir,
      HYPHER_ACCESS_TOKEN: "oauth-token",
    },
    git: { remote: "https://github.com/acme/unknown.git", repo: "acme/unknown", branch: "main", commitSha: "1", changedFiles: [] },
    fetchImpl,
  });
  assert.match(out.additional_context, /No Hypher project is linked/);
  assert.equal(out.env.HYPHER_HOOK_MATCHED, "0");
});

test("handoff payload is one cursor handoff with git metadata, not a brief", () => {
  const payload = buildHandoffPayload({
    git: {
      repo: "litterthanlit/hypher",
      branch: "main",
      commitSha: "abc123",
      changedFiles: [" M extensions/cursor/README.md"],
    },
    input: { reason: "user_close", duration_ms: 45_000 },
  });
  assert.equal(payload.source, "cursor");
  assert.equal(payload.kind, "handoff");
  assert.equal(payload.repo, "litterthanlit/hypher");
  assert.match(payload.body, /session-end receipt/);
  assert.doesNotMatch(payload.body, /current direction/i);
  assert.match(payload.body, /extensions\/cursor\/README.md/);
});

test("sessionEnd skips short sessions and already-posted markers", () => {
  assert.equal(shouldSkipSessionEnd({ duration_ms: 400 }, null), "too-short");
  assert.equal(shouldSkipSessionEnd({ duration_ms: 60_000 }, { posted: true }), "already-posted");
  assert.equal(shouldSkipSessionEnd({ duration_ms: 60_000 }, null), null);
});

test("sessionEnd with no credential does not post and leaves a marker", async () => {
  const dir = mkdtempSync(join(tmpdir(), "hypher-hook-"));
  const calls = [];
  const result = await runSessionEnd({
    input: { session_id: "s-silent", reason: "user_close", duration_ms: 60_000 },
    env: { HYPHER_HOOK_MARKER_DIR: dir, CURSOR_PROJECT_DIR: dir },
    git: { repo: "litterthanlit/hypher", branch: "main", commitSha: "abc", changedFiles: [] },
    fetchImpl: async (...args) => {
      calls.push(args);
      return jsonResponse({ ok: true });
    },
  });
  assert.equal(result.skipped, "no-credential");
  assert.equal(calls.length, 0);
  const marker = JSON.parse(readFileSync(join(dir, "s-silent.json"), "utf8"));
  assert.equal(marker.posted, false);
  assert.equal(marker.skip, "no-credential");
});

test("sessionEnd posts one events-API handoff when HYPHER_API_KEY is set", async () => {
  const dir = mkdtempSync(join(tmpdir(), "hypher-hook-"));
  const posts = [];
  const result = await runSessionEnd({
    input: { session_id: "s-key", reason: "completed", duration_ms: 90_000 },
    env: {
      HYPHER_HOOK_MARKER_DIR: dir,
      HYPHER_API_KEY: "hyp_testkey",
      HYPHER_ENDPOINT: "https://hypher.app/api/agent/events",
    },
    git: {
      repo: "litterthanlit/hypher",
      branch: "main",
      commitSha: "abc123",
      changedFiles: ["M README.md"],
    },
    fetchImpl: async (url, init) => {
      posts.push({ url, body: JSON.parse(init.body), auth: init.headers.Authorization });
      return jsonResponse({ ok: true, eventId: "e1" });
    },
  });
  assert.equal(result.posted, true);
  assert.equal(posts.length, 1);
  assert.equal(posts[0].url, "https://hypher.app/api/agent/events");
  assert.equal(posts[0].body.kind, "handoff");
  assert.equal(posts[0].body.source, "cursor");
  assert.equal(posts[0].auth, "Bearer hyp_testkey");
  assert.equal(JSON.parse(readFileSync(join(dir, "s-key.json"), "utf8")).posted, true);
});

test("sessionEnd uses MCP post_agent_event when an OAuth token is present", async () => {
  const dir = mkdtempSync(join(tmpdir(), "hypher-hook-"));
  const names = [];
  const result = await runSessionEnd({
    input: { session_id: "s-oauth", reason: "user_close", duration_ms: 20_000 },
    env: {
      HYPHER_HOOK_MARKER_DIR: dir,
      HYPHER_ACCESS_TOKEN: "oauth-token",
      HYPHER_HOOK_PROJECT_ID: "p1",
      HYPHER_MCP_URL: "https://www.hypher.app/api/mcp",
    },
    git: { repo: "litterthanlit/hypher", branch: "main", commitSha: "abc", changedFiles: [] },
    fetchImpl: mcpFetch({
      post_agent_event: (body) => {
        names.push(body.params.arguments.kind);
        assert.equal(body.params.arguments.projectId, "p1");
        assert.equal(body.params.arguments.source, "cursor");
        return jsonResponse({ jsonrpc: "2.0", id: 1, result: { structuredContent: { ok: true } } });
      },
    }),
  });
  assert.equal(result.posted, true);
  assert.deepEqual(names, ["handoff"]);
});

test("sessionEnd skips unmatched repos instead of inventing a project", async () => {
  const dir = mkdtempSync(join(tmpdir(), "hypher-hook-"));
  const result = await runSessionEnd({
    input: { session_id: "s-skip-unmatched", duration_ms: 20_000 },
    env: {
      HYPHER_HOOK_MARKER_DIR: dir,
      HYPHER_API_KEY: "hyp_test",
      HYPHER_HOOK_MATCHED: "0",
    },
    git: { repo: "acme/unknown", branch: "main", commitSha: "1", changedFiles: [] },
    fetchImpl: async () => {
      throw new Error("should not post");
    },
  });
  assert.equal(result.skipped, "unmatched");
});

test("transcriptHasHandoff detects an existing writeback", () => {
  const dir = mkdtempSync(join(tmpdir(), "hypher-hook-"));
  const file = join(dir, "transcript.jsonl");
  writeFileSync(file, `{"tool":"post_agent_event","args":{"kind":"handoff"}}\n`);
  assert.equal(transcriptHasHandoff(file), true);
  assert.equal(transcriptHasHandoff(join(dir, "missing.json")), false);
});

test("session-start.mjs prints JSON additional_context for a real git repo", async () => {
  const dir = mkdtempSync(join(tmpdir(), "hypher-git-"));
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: dir });
  execFileSync("git", ["remote", "add", "origin", "git@github.com:litterthanlit/hypher.git"], { cwd: dir });
  execFileSync("git", ["-c", "user.email=hook@test", "-c", "user.name=Hook", "commit", "--allow-empty", "-q", "-m", "init"], { cwd: dir });

  const stdout = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(here, "session-start.mjs")], {
      env: { ...process.env, CURSOR_PROJECT_DIR: dir, HYPHER_HOOK_MARKER_DIR: dir },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (chunk) => { out += chunk; });
    child.stderr.on("data", (chunk) => { err += chunk; });
    child.on("close", (code) => {
      if (code !== 0) reject(new Error(`exit ${code}: ${err}`));
      else resolve(out);
    });
    child.stdin.end(`${JSON.stringify({ session_id: "cli-start", composer_mode: "agent" })}\n`);
  });

  const parsed = JSON.parse(stdout.trim());
  assert.equal(typeof parsed.additional_context, "string");
  assert.match(parsed.additional_context, /resolve_project_for_repo/);
  assert.equal(parsed.env.HYPHER_HOOK_REPO, "litterthanlit/hypher");
});

test("session-end.mjs exits 0 with empty JSON when no credential is present", async () => {
  const dir = mkdtempSync(join(tmpdir(), "hypher-git-"));
  const stdout = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(here, "session-end.mjs")], {
      env: {
        ...process.env,
        CURSOR_PROJECT_DIR: dir,
        HYPHER_HOOK_MARKER_DIR: dir,
        HYPHER_HOOK_REPO: "litterthanlit/hypher",
      },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (chunk) => { out += chunk; });
    child.stderr.on("data", (chunk) => { err += chunk; });
    child.on("close", (code) => {
      if (code !== 0) reject(new Error(`exit ${code}: ${err}`));
      else resolve(out);
    });
    child.stdin.end(`${JSON.stringify({ session_id: "cli-end", reason: "user_close", duration_ms: 12_000 })}\n`);
  });
  assert.deepEqual(JSON.parse(stdout.trim()), {});
});
