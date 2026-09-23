import { getFunctionName } from "convex/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./rateLimit", () => ({ ratelimitConvex: vi.fn(async () => true) }));

import { ratelimitConvex } from "./rateLimit";
import { apiKeyProbeRateLimitKey } from "../apiKeys";
import {
  runAsApiKeyUser,
  runAsOAuthUser,
  runAsSessionUser,
  touchOnOk,
  touchOnOkOrFailedDelivery,
} from "./authenticatedAction";
import { acknowledgeFromApiRequest, acknowledgeFromOAuthRequest, acknowledgeFromSession, resumeFromApiRequest, resumeFromOAuthRequest, resumeFromSession } from "../structuredHandoffs";
import { createFromApiRequest, createFromOAuthRequest, createFromSession } from "../agentEvents";
import { writeCompiledFromApiRequest, writeCompiledFromOAuthRequest, writeCompiledFromSession } from "../projectMemoryMcp";

type TestHandler = (ctx: any, args: any) => Promise<any>;
const handlerOf = (fn: unknown) => (fn as { _handler: TestHandler })._handler;

const KEY = "hyp_abcdefghijklmnopqrstuvwxyz";
const rateLimit = { bucket: "test-bucket", requests: 7, window: "1h" };

function fakeCtx(options: {
  key?: { userId: string; keyId: string; rateLimitKey: string } | null;
  token?: { userId: string } | null;
  identity?: string | null;
  beta?: boolean;
  mutationResult?: unknown;
} = {}) {
  const queries: Array<{ name: string; args: any }> = [];
  const mutations: Array<{ name: string; args: any }> = [];
  const ctx = {
    auth: {
      getUserIdentity: async () => (options.identity ? { subject: options.identity } : null),
    },
    runQuery: vi.fn(async (ref: any, args: any) => {
      const name = getFunctionName(ref);
      queries.push({ name, args });
      if (name === "apiKeys:validate") return options.key === undefined ? { userId: "u1", keyId: "k1", rateLimitKey: "rl-k1" } : options.key;
      if (name === "oauth:userIdForAccessToken") return options.token === undefined ? { userId: "u1" } : options.token;
      if (name === "authz:hasBetaAccessForUser") return options.beta ?? true;
      return null;
    }),
    runMutation: vi.fn(async (ref: any, args: any) => {
      const name = getFunctionName(ref);
      mutations.push({ name, args });
      return options.mutationResult ?? { ok: true, status: 200 };
    }),
  };
  return { ctx: ctx as any, queries, mutations };
}

const rateLimitCalls = () => vi.mocked(ratelimitConvex).mock.calls.map(([key, bucket, opts]) => ({ key, bucket, ...opts }));

beforeEach(() => {
  vi.mocked(ratelimitConvex).mockReset();
  vi.mocked(ratelimitConvex).mockResolvedValue(true);
});

describe("runAsApiKeyUser", () => {
  it("returns 429 on the probe limit before validating the key", async () => {
    vi.mocked(ratelimitConvex).mockResolvedValueOnce(false);
    const { ctx, queries } = fakeCtx();
    const fn = vi.fn();
    const result = await runAsApiKeyUser(ctx, { apiKey: KEY, rateLimit, touchWhen: touchOnOk }, fn);
    expect(result).toEqual({ ok: false, status: 429, error: "Rate limited" });
    expect(rateLimitCalls()).toEqual([{ key: apiKeyProbeRateLimitKey(KEY), bucket: "api-key-validation", requests: 30, window: "1m" }]);
    expect(queries).toEqual([]);
    expect(fn).not.toHaveBeenCalled();
  });

  it("returns 401 for an unknown key without touching", async () => {
    const { ctx, mutations } = fakeCtx({ key: null });
    const fn = vi.fn();
    const result = await runAsApiKeyUser(ctx, { apiKey: KEY, rateLimit, touchWhen: touchOnOk }, fn);
    expect(result).toEqual({ ok: false, status: 401, error: "Unauthorized" });
    expect(fn).not.toHaveBeenCalled();
    expect(mutations).toEqual([]);
  });

  it("applies the per-key limit to the key's rate-limit key", async () => {
    vi.mocked(ratelimitConvex).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const { ctx } = fakeCtx();
    const fn = vi.fn();
    const result = await runAsApiKeyUser(ctx, { apiKey: KEY, rateLimit, touchWhen: touchOnOk }, fn);
    expect(result).toEqual({ ok: false, status: 429, error: "Rate limited" });
    expect(rateLimitCalls()[1]).toEqual({ key: "rl-k1", bucket: "test-bucket", requests: 7, window: "1h" });
    expect(fn).not.toHaveBeenCalled();
  });

  it("runs as the key's user and touches only when touchWhen says so", async () => {
    const cases: Array<[typeof touchOnOk, { ok: boolean; code?: string }, boolean]> = [
      [touchOnOk, { ok: true }, true],
      [touchOnOk, { ok: false, code: "failed-delivery" }, false],
      [touchOnOkOrFailedDelivery, { ok: false, code: "failed-delivery" }, true],
      [touchOnOkOrFailedDelivery, { ok: false, code: "stale" }, false],
    ];
    for (const [touchWhen, outcome, touched] of cases) {
      const { ctx, mutations } = fakeCtx();
      const fn = vi.fn(async () => outcome);
      const result = await runAsApiKeyUser(ctx, { apiKey: KEY, rateLimit, touchWhen }, fn);
      expect(result).toBe(outcome);
      expect(fn).toHaveBeenCalledWith("u1");
      expect(mutations).toEqual(touched ? [{ name: "apiKeys:touch", args: { keyId: "k1" } }] : []);
    }
  });
});

describe("runAsOAuthUser", () => {
  const oauth = { tokenHash: "th", resource: "https://www.hypher.app/api/mcp", scope: "hypher.projects.read", now: 123, rateLimit };

  it("rate limits on the token hash before looking up the token", async () => {
    vi.mocked(ratelimitConvex).mockResolvedValueOnce(false);
    const { ctx, queries } = fakeCtx();
    const result = await runAsOAuthUser(ctx, oauth, vi.fn());
    expect(result).toEqual({ ok: false, status: 429, error: "Rate limited" });
    expect(rateLimitCalls()).toEqual([{ key: "th", bucket: "test-bucket", requests: 7, window: "1h" }]);
    expect(queries).toEqual([]);
  });

  it("returns 401 for an unknown token", async () => {
    const { ctx } = fakeCtx({ token: null });
    const fn = vi.fn();
    expect(await runAsOAuthUser(ctx, oauth, fn)).toEqual({ ok: false, status: 401, error: "Unauthorized" });
    expect(fn).not.toHaveBeenCalled();
  });

  it("checks resource, scope, and now, then runs as the token's user without touching", async () => {
    const { ctx, queries, mutations } = fakeCtx({ token: { userId: "u9" } });
    const result = await runAsOAuthUser(ctx, oauth, async (userId) => ({ ok: true, userId }));
    expect(result).toEqual({ ok: true, userId: "u9" });
    expect(queries).toEqual([{
      name: "oauth:userIdForAccessToken",
      args: { tokenHash: "th", resource: "https://www.hypher.app/api/mcp", scope: "hypher.projects.read", now: 123 },
    }]);
    expect(mutations).toEqual([]);
  });
});

describe("runAsSessionUser", () => {
  it("throws for signed-out and non-beta callers", async () => {
    await expect(runAsSessionUser(fakeCtx({ identity: null }).ctx, { rateLimit }, vi.fn())).rejects.toThrow("Unauthorized");
    await expect(runAsSessionUser(fakeCtx({ identity: "u1", beta: false }).ctx, { rateLimit }, vi.fn())).rejects.toThrow("Beta access required");
  });

  it("rate limits on the user id", async () => {
    vi.mocked(ratelimitConvex).mockResolvedValueOnce(false);
    const fn = vi.fn();
    const result = await runAsSessionUser(fakeCtx({ identity: "u2" }).ctx, { rateLimit }, fn);
    expect(result).toEqual({ ok: false, status: 429, error: "Rate limited" });
    expect(rateLimitCalls()).toEqual([{ key: "u2", bucket: "test-bucket", requests: 7, window: "1h" }]);
    expect(fn).not.toHaveBeenCalled();
  });

  it("runs as the session user", async () => {
    const fn = vi.fn(async (userId: string) => ({ ok: true, userId }));
    expect(await runAsSessionUser(fakeCtx({ identity: "u2" }).ctx, { rateLimit }, fn)).toEqual({ ok: true, userId: "u2" });
  });
});

describe("write actions keep their buckets, limits, and touch rules", () => {
  const oauthArgs = { tokenHash: "th", resource: "r", scope: "s", now: 1 };
  const resume = { projectId: "p1", destinationProjectId: "p1", destination: "claude-code", currentRepo: { branch: "main", commit: "abc", dirty: false }, result: "prepared" };
  const ack = { projectId: "p1", receiptId: "r1", revision: 2, destination: "claude-code" };
  const memory = { projectId: "p1", compiledJson: "{}" };
  const event = { payload: { source: "cursor", kind: "build_log", title: "t", body: "b" } };

  const cases = [
    { name: "resumeFromApiRequest", fn: resumeFromApiRequest, args: { apiKey: KEY, ...resume }, bucket: "structured-handoff", requests: 60 },
    { name: "resumeFromOAuthRequest", fn: resumeFromOAuthRequest, args: { ...oauthArgs, ...resume }, bucket: "structured-handoff-oauth", requests: 60 },
    { name: "resumeFromSession", fn: resumeFromSession, args: resume, bucket: "structured-handoff", requests: 60 },
    { name: "acknowledgeFromApiRequest", fn: acknowledgeFromApiRequest, args: { apiKey: KEY, ...ack }, bucket: "structured-handoff", requests: 60 },
    { name: "acknowledgeFromOAuthRequest", fn: acknowledgeFromOAuthRequest, args: { ...oauthArgs, ...ack }, bucket: "structured-handoff-oauth", requests: 60 },
    { name: "acknowledgeFromSession", fn: acknowledgeFromSession, args: ack, bucket: "structured-handoff", requests: 60 },
    { name: "createFromApiRequest", fn: createFromApiRequest, args: { apiKey: KEY, ...event }, bucket: "agent-events", requests: 120 },
    { name: "createFromOAuthRequest", fn: createFromOAuthRequest, args: { ...oauthArgs, ...event }, bucket: "agent-events-oauth", requests: 120 },
    { name: "createFromSession", fn: createFromSession, args: event, bucket: "agent-events", requests: 120 },
    { name: "writeCompiledFromApiRequest", fn: writeCompiledFromApiRequest, args: { apiKey: KEY, ...memory }, bucket: "project-memory-agent-write", requests: 40 },
    { name: "writeCompiledFromOAuthRequest", fn: writeCompiledFromOAuthRequest, args: { ...oauthArgs, ...memory }, bucket: "project-memory-agent-write-oauth", requests: 40 },
    { name: "writeCompiledFromSession", fn: writeCompiledFromSession, args: memory, bucket: "project-memory-agent-write", requests: 40 },
  ];

  for (const item of cases) {
    it(`${item.name} is rate limited on ${item.bucket} ${item.requests}/1h`, async () => {
      const isApiKey = item.name.endsWith("FromApiRequest");
      vi.mocked(ratelimitConvex).mockResolvedValue(false);
      if (isApiKey) vi.mocked(ratelimitConvex).mockResolvedValueOnce(true);
      const { ctx, mutations } = fakeCtx({ identity: "u1" });
      const result = await handlerOf(item.fn)(ctx, item.args);
      expect(result).toEqual({ ok: false, status: 429, error: "Rate limited" });
      const calls = rateLimitCalls();
      const featureCall = isApiKey ? calls[1] : calls[0];
      expect(featureCall).toMatchObject({ bucket: item.bucket, requests: item.requests, window: "1h" });
      if (isApiKey) expect(calls[0]).toMatchObject({ bucket: "api-key-validation", requests: 30, window: "1m" });
      expect(mutations).toEqual([]);
    });
  }

  it("resume touches the key on a recorded failed delivery; acknowledge does not", async () => {
    const failed = { ok: false, status: 409, code: "failed-delivery", error: "x" };
    const resumed = fakeCtx({ mutationResult: failed });
    expect(await handlerOf(resumeFromApiRequest)(resumed.ctx, { apiKey: KEY, ...resume })).toEqual(failed);
    expect(resumed.mutations.map((m) => m.name)).toEqual(["structuredHandoffs:deliverForUser", "apiKeys:touch"]);

    const acked = fakeCtx({ mutationResult: failed });
    await handlerOf(acknowledgeFromApiRequest)(acked.ctx, { apiKey: KEY, ...ack });
    expect(acked.mutations.map((m) => m.name)).toEqual(["structuredHandoffs:acknowledgeForUser"]);

    const ackOk = fakeCtx({ mutationResult: { ok: true, status: 200, code: "acknowledged" } });
    await handlerOf(acknowledgeFromApiRequest)(ackOk.ctx, { apiKey: KEY, ...ack });
    expect(ackOk.mutations.map((m) => m.name)).toEqual(["structuredHandoffs:acknowledgeForUser", "apiKeys:touch"]);
  });

  it("OAuth and session variants never touch an API key", async () => {
    for (const [fn, args] of [[resumeFromOAuthRequest, { ...oauthArgs, ...resume }], [resumeFromSession, resume]] as const) {
      const { ctx, mutations } = fakeCtx({ identity: "u1" });
      await handlerOf(fn)(ctx, args);
      expect(mutations.map((m) => m.name)).toEqual(["structuredHandoffs:deliverForUser"]);
    }
  });
});
