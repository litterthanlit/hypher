/**
 * Convex-runtime rate-limit helper backed by Upstash Redis.
 *
 * Mirrors the pattern from hypher-web/src/lib/rateLimit.ts but runs in the
 * Convex Node action runtime (cannot import from src/).
 *
 * When Upstash env vars are absent, returns true (allowed) with a console warn.
 */
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Per-process cache of Ratelimit instances by bucket key
const cache = new Map<string, Ratelimit | null>();

function getRatelimitForBucket(
  bucket: string,
  requests: number,
  windowStr: string
): Ratelimit | null {
  const cacheKey = `${bucket}:${requests}:${windowStr}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    console.warn(
      `[hypher/convex/rateLimit] Upstash Redis env missing — rate limiting disabled for bucket "${bucket}"`
    );
    cache.set(cacheKey, null);
    return null;
  }

  const redis = new Redis({ url, token });

  // Parse "1h", "30s", "10m", etc. → Upstash Duration
  const match = windowStr.match(/^(\d+)(s|m|h|d)$/);
  if (!match) {
    throw new Error(
      `[hypher/convex/rateLimit] Invalid window format: "${windowStr}". Expected e.g. "30s", "1h".`
    );
  }
  const [, count, unit] = match;
  const upstashWindow = `${count} ${unit}` as `${number} ${"ms" | "s" | "m" | "h" | "d"}`;

  const rl = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requests, upstashWindow),
    prefix: `hypher-api:ratelimit:${bucket}`,
  });

  cache.set(cacheKey, rl);
  return rl;
}

/**
 * Returns true if the request is allowed, false if it should be rate-limited.
 * When Upstash is not configured, always returns true.
 */
export async function ratelimitConvex(
  key: string,
  bucket: string,
  opts: { requests: number; window: string }
): Promise<boolean> {
  const rl = getRatelimitForBucket(bucket, opts.requests, opts.window);
  if (!rl) return true;
  const result = await rl.limit(key);
  return result.success;
}
