/**
 * One wrapper per caller kind for public write actions.
 *
 * Every write feature exposes three actions: `...FromApiRequest` (plaintext
 * `hyp_` key), `...FromOAuthRequest` (MCP bearer token hash), and
 * `...FromSession` (Clerk session through Convex auth). These helpers own the
 * rate limits, auth checks, and `apiKeys.touch` so a feature only supplies the
 * per-user body. The denial shapes are the wire contract the Next.js routes map
 * to HTTP / JSON-RPC errors; keep them byte-for-byte stable.
 */
import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import { apiKeyProbeRateLimitKey } from "../apiKeys";
import { requireActionBetaAccess } from "./actionAuth";
import { ratelimitConvex } from "./rateLimit";

export const RATE_LIMITED = { ok: false, status: 429, error: "Rate limited" } as const;
export const UNAUTHORIZED = { ok: false, status: 401, error: "Unauthorized" } as const;
export type AuthDenied = { ok: false; status: 429 | 401; error: string };

export type RateLimitRule = { bucket: string; requests: number; window: string };

/** Every API-key request is first limited by key prefix, before the key is checked. */
const API_KEY_PROBE_LIMIT: RateLimitRule = { bucket: "api-key-validation", requests: 30, window: "1m" };

type AuthedActionCtx = Pick<ActionCtx, "runQuery" | "runMutation" | "auth">;

type TouchableResult = { ok: boolean; code?: string };

/** Touch the key only when the write succeeded. */
export const touchOnOk = (result: TouchableResult): boolean => result.ok;

/** Resume paths also count a recorded failed delivery as key use. */
export const touchOnOkOrFailedDelivery = (result: TouchableResult): boolean =>
  result.ok || result.code === "failed-delivery";

async function allowed(key: string, rule: RateLimitRule): Promise<boolean> {
  return await ratelimitConvex(key, rule.bucket, { requests: rule.requests, window: rule.window });
}

export async function runAsApiKeyUser<R extends TouchableResult>(
  ctx: AuthedActionCtx,
  opts: { apiKey: string; rateLimit: RateLimitRule; touchWhen: (result: R) => boolean },
  fn: (userId: string) => Promise<R>
): Promise<R | AuthDenied> {
  if (!await allowed(apiKeyProbeRateLimitKey(opts.apiKey), API_KEY_PROBE_LIMIT)) return { ...RATE_LIMITED };
  const key = await ctx.runQuery(internal.apiKeys.validate, { key: opts.apiKey });
  if (!key) return { ...UNAUTHORIZED };
  if (!await allowed(key.rateLimitKey, opts.rateLimit)) return { ...RATE_LIMITED };
  const result = await fn(key.userId);
  if (opts.touchWhen(result)) await ctx.runMutation(internal.apiKeys.touch, { keyId: key.keyId });
  return result;
}

export async function runAsOAuthUser<R>(
  ctx: AuthedActionCtx,
  opts: { tokenHash: string; resource: string; scope: string; now: number; rateLimit: RateLimitRule },
  fn: (userId: string) => Promise<R>
): Promise<R | AuthDenied> {
  if (!await allowed(opts.tokenHash, opts.rateLimit)) return { ...RATE_LIMITED };
  const token = await ctx.runQuery(internal.oauth.userIdForAccessToken, {
    tokenHash: opts.tokenHash,
    resource: opts.resource,
    scope: opts.scope,
    now: opts.now,
  });
  if (!token) return { ...UNAUTHORIZED };
  return await fn(token.userId);
}

/** Session callers throw (Unauthorized / Beta access required) rather than returning 401. */
export async function runAsSessionUser<R>(
  ctx: AuthedActionCtx,
  opts: { rateLimit: RateLimitRule },
  fn: (userId: string) => Promise<R>
): Promise<R | AuthDenied> {
  const userId = await requireActionBetaAccess(ctx);
  if (!await allowed(userId, opts.rateLimit)) return { ...RATE_LIMITED };
  return await fn(userId);
}
