import { action, internalMutation, internalQuery, mutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { hasBetaAccess, requireBetaAccess } from "./lib/auth";
import { apiKeyProbeRateLimitKey } from "./apiKeys";
import { ratelimitConvex } from "./lib/rateLimit";
import type { Id } from "./_generated/dataModel";

const _internal = internal as any;

export const CAPTURE_TOKEN_MIN_TTL_MS = 5 * 60_000;
export const CAPTURE_TOKEN_DEFAULT_TTL_MS = 10 * 60_000;
export const CAPTURE_TOKEN_MAX_TTL_MS = 60 * 60_000;

export const CAPTURE_TOKEN_SCOPES = ["capture:create", "projects:list"] as const;
export type CaptureTokenScope = (typeof CAPTURE_TOKEN_SCOPES)[number];

const scopeValidator = v.union(v.literal("capture:create"), v.literal("projects:list"));

type CaptureTokenGrant = {
  scopes: readonly CaptureTokenScope[];
  projectId?: string | null;
  allowedOrigin?: string;
  expiresAt: number;
  revokedAt?: number;
};

type GrantRequest = {
  requiredScope: CaptureTokenScope;
  projectId?: string | null;
  origin?: string | null;
  now?: number;
};

async function allowApiKeyProbe(apiKey: string): Promise<boolean> {
  return ratelimitConvex(apiKeyProbeRateLimitKey(apiKey), "api-key-validation", {
    requests: 30,
    window: "1m",
  });
}

function randomHex(byteCount: number): string {
  const bytes = new Uint8Array(byteCount);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function hashCaptureTokenId(tokenId: string): Promise<string> {
  return sha256Hex(`hct-id:${tokenId}`);
}

export async function hashCaptureToken(token: string): Promise<string> {
  return sha256Hex(`hct-token:${token}`);
}

export async function createCaptureTokenMaterial(): Promise<{
  token: string;
  tokenId: string;
  tokenIdHash: string;
  tokenHash: string;
}> {
  const tokenId = randomHex(16);
  const secret = randomHex(32);
  const token = `hct_${tokenId}_${secret}`;
  return {
    token,
    tokenId,
    tokenIdHash: await hashCaptureTokenId(tokenId),
    tokenHash: await hashCaptureToken(token),
  };
}

export function parseCaptureToken(token: string): { tokenId: string } | null {
  const match = token.match(/^hct_([a-f0-9]{32})_[a-f0-9]{64}$/);
  return match ? { tokenId: match[1]! } : null;
}

export function normalizeCaptureTokenScopes(scopes: readonly string[] | undefined): CaptureTokenScope[] {
  const requested = scopes ?? ["capture:create"];
  const unique = new Set<CaptureTokenScope>();
  for (const scope of requested) {
    if (!CAPTURE_TOKEN_SCOPES.includes(scope as CaptureTokenScope)) {
      throw new Error("Invalid capture token scope");
    }
    unique.add(scope as CaptureTokenScope);
  }
  unique.add("capture:create");
  return CAPTURE_TOKEN_SCOPES.filter((scope) => unique.has(scope));
}

export function buildCaptureTokenExpiry(expiresInSeconds: number | undefined, now = Date.now()): number {
  if (expiresInSeconds === undefined) return now + CAPTURE_TOKEN_DEFAULT_TTL_MS;
  const requestedMs = Math.floor(expiresInSeconds * 1000);
  const ttlMs = Math.min(Math.max(requestedMs, CAPTURE_TOKEN_MIN_TTL_MS), CAPTURE_TOKEN_MAX_TTL_MS);
  return now + ttlMs;
}

export function normalizeAllowedOrigin(origin: string | undefined | null): string | undefined {
  const trimmed = origin?.trim();
  if (!trimmed) return undefined;
  if (trimmed === "*") throw new Error("Wildcard origins are not allowed");
  if (trimmed.startsWith("chrome-extension://")) {
    if (!/^chrome-extension:\/\/[^/]+$/.test(trimmed)) throw new Error("Invalid allowed origin");
    return trimmed;
  }
  const parsed = new URL(trimmed);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Invalid allowed origin");
  }
  return parsed.origin;
}

export function validateCaptureTokenGrant(
  grant: CaptureTokenGrant,
  request: GrantRequest
):
  | { ok: true }
  | { ok: false; status: 401 | 403; error: string } {
  const now = request.now ?? Date.now();
  if (grant.revokedAt !== undefined) return { ok: false, status: 401, error: "token_revoked" };
  if (grant.expiresAt <= now) return { ok: false, status: 401, error: "token_expired" };
  if (!grant.scopes.includes(request.requiredScope)) {
    return { ok: false, status: 403, error: "insufficient_scope" };
  }
  if (grant.allowedOrigin && request.origin !== grant.allowedOrigin) {
    return { ok: false, status: 403, error: "origin_mismatch" };
  }
  if (grant.projectId && request.projectId && request.projectId !== grant.projectId) {
    return { ok: false, status: 403, error: "project_scope_mismatch" };
  }
  return { ok: true };
}

async function assertProjectScope(ctx: any, userId: string, projectId: string | undefined | null) {
  if (!projectId) return;
  const project = await ctx.db.get(projectId as Id<"objects">);
  if (!project || project.userId !== userId || project.kind !== "project") {
    throw new Error("Invalid project scope");
  }
}

async function insertToken(ctx: any, args: {
  userId: string;
  scopes?: CaptureTokenScope[];
  projectId?: string | null;
  allowedOrigin?: string;
  expiresInSeconds?: number;
  sourceApiKeyId?: Id<"apiKeys">;
  mintedByUserId?: string;
}) {
  await assertProjectScope(ctx, args.userId, args.projectId);
  const now = Date.now();
  const material = await createCaptureTokenMaterial();
  const expiresAt = buildCaptureTokenExpiry(args.expiresInSeconds, now);
  const scopes = normalizeCaptureTokenScopes(args.scopes);

  await ctx.db.insert("captureTokens", {
    userId: args.userId,
    tokenIdHash: material.tokenIdHash,
    tokenHash: material.tokenHash,
    scopes,
    projectId: args.projectId ?? null,
    allowedOrigin: normalizeAllowedOrigin(args.allowedOrigin),
    createdAt: now,
    expiresAt,
    sourceApiKeyId: args.sourceApiKeyId,
    mintedByUserId: args.mintedByUserId,
  });

  return {
    token: material.token,
    tokenId: material.tokenId,
    tokenType: "Bearer" as const,
    expiresAt,
    scopes,
    projectId: args.projectId ?? null,
    allowedOrigin: normalizeAllowedOrigin(args.allowedOrigin),
  };
}

export const mintForUser = mutation({
  args: {
    scopes: v.optional(v.array(scopeValidator)),
    projectId: v.optional(v.union(v.string(), v.null())),
    allowedOrigin: v.optional(v.string()),
    expiresInSeconds: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireBetaAccess(ctx);
    return insertToken(ctx, { ...args, userId, mintedByUserId: userId });
  },
});

export const mintForValidatedApiKey = internalMutation({
  args: {
    userId: v.string(),
    sourceApiKeyId: v.id("apiKeys"),
    scopes: v.optional(v.array(scopeValidator)),
    projectId: v.optional(v.union(v.string(), v.null())),
    allowedOrigin: v.optional(v.string()),
    expiresInSeconds: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return insertToken(ctx, args);
  },
});

export const mintWithApiKey = action({
  args: {
    apiKey: v.string(),
    scopes: v.optional(v.array(scopeValidator)),
    projectId: v.optional(v.union(v.string(), v.null())),
    allowedOrigin: v.optional(v.string()),
    expiresInSeconds: v.optional(v.number()),
  },
  handler: async (ctx, { apiKey, ...args }) => {
    if (!(await allowApiKeyProbe(apiKey))) {
      return { ok: false, status: 429, error: "Rate limited" };
    }
    const validated = await ctx.runQuery(_internal.apiKeys.validate, { key: apiKey });
    if (!validated) return { ok: false, status: 401, error: "Invalid API key" };
    try {
      const token = await ctx.runMutation(_internal.captureTokens.mintForValidatedApiKey, {
        ...args,
        userId: validated.userId,
        sourceApiKeyId: validated.keyId,
      });
      await ctx.runMutation(_internal.apiKeys.touch, { keyId: validated.keyId });
      return { ok: true, status: 200, ...token };
    } catch (error) {
      return {
        ok: false,
        status: 400,
        error: error instanceof Error ? error.message : "Invalid capture token request",
      };
    }
  },
});

export const validate = internalQuery({
  args: {
    token: v.string(),
    requiredScope: scopeValidator,
    projectId: v.optional(v.union(v.string(), v.null())),
    origin: v.optional(v.union(v.string(), v.null())),
    now: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const parsed = parseCaptureToken(args.token);
    if (!parsed) return { ok: false, status: 401, error: "invalid_token" };

    const tokenIdHash = await hashCaptureTokenId(parsed.tokenId);
    const rows = await ctx.db
      .query("captureTokens")
      .withIndex("by_token_id_hash", (q) => q.eq("tokenIdHash", tokenIdHash))
      .collect();
    const tokenHash = await hashCaptureToken(args.token);
    const row = rows.find((candidate) => candidate.tokenHash === tokenHash);
    if (!row) return { ok: false, status: 401, error: "invalid_token" };
    if (!(await hasBetaAccess(ctx, row.userId))) {
      return { ok: false, status: 401, error: "invalid_token" };
    }

    const grant = validateCaptureTokenGrant(row, args);
    if (!grant.ok) return grant;

    return {
      ok: true,
      userId: row.userId,
      tokenId: row._id,
      scopes: row.scopes,
      projectId: row.projectId ?? null,
      allowedOrigin: row.allowedOrigin,
      expiresAt: row.expiresAt,
      rateLimitKey: `capture-token:${row.tokenIdHash.slice(0, 16)}`,
    };
  },
});

export const touch = internalMutation({
  args: { tokenId: v.id("captureTokens") },
  handler: async (ctx, { tokenId }) => {
    const row = await ctx.db.get(tokenId);
    if (row && row.revokedAt === undefined) {
      await ctx.db.patch(tokenId, { lastUsedAt: Date.now() });
    }
  },
});

export const revokeMine = mutation({
  args: { tokenId: v.string(), reason: v.optional(v.string()) },
  handler: async (ctx, { tokenId, reason }) => {
    const userId = await requireBetaAccess(ctx);
    const tokenIdHash = await hashCaptureTokenId(tokenId);
    const row = await ctx.db
      .query("captureTokens")
      .withIndex("by_token_id_hash", (q) => q.eq("tokenIdHash", tokenIdHash))
      .first();
    if (!row || row.userId !== userId) throw new Error("Unauthorized");
    await ctx.db.patch(row._id, {
      revokedAt: Date.now(),
      revokedBy: userId,
      revokedReason: reason ?? "user_revoked",
    });
    return { ok: true };
  },
});

export const revokeWithApiKey = action({
  args: { apiKey: v.string(), tokenId: v.string(), reason: v.optional(v.string()) },
  handler: async (ctx, { apiKey, tokenId, reason }) => {
    if (!(await allowApiKeyProbe(apiKey))) {
      return { ok: false, status: 429, error: "Rate limited" };
    }
    const validated = await ctx.runQuery(_internal.apiKeys.validate, { key: apiKey });
    if (!validated) return { ok: false, status: 401, error: "Invalid API key" };
    const tokenIdHash = await hashCaptureTokenId(tokenId);
    const result = await ctx.runMutation(_internal.captureTokens.revokeForApiUser, {
      userId: validated.userId,
      tokenIdHash,
      revokedBy: `apiKey:${String(validated.keyId)}`,
      reason: reason ?? "api_key_revoked",
    });
    return result ? { ok: true, status: 200 } : { ok: false, status: 404, error: "Not found" };
  },
});

export const revokeForApiUser = internalMutation({
  args: {
    userId: v.string(),
    tokenIdHash: v.string(),
    revokedBy: v.string(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("captureTokens")
      .withIndex("by_token_id_hash", (q) => q.eq("tokenIdHash", args.tokenIdHash))
      .first();
    if (!row || row.userId !== args.userId) return false;
    await ctx.db.patch(row._id, {
      revokedAt: Date.now(),
      revokedBy: args.revokedBy,
      revokedReason: args.reason,
    });
    return true;
  },
});
