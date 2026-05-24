import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Cache Ratelimit instances by bucket so we don't recreate on every request.
const cache = new Map<string, Ratelimit | null>();

function getRatelimitForBucket(
  bucket: string,
  opts: { requests: number; window: string },
): Ratelimit | null {
  const cacheKey = `${bucket}:${opts.requests}:${opts.window}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        `[hypher/rateLimit] Upstash Redis env missing — denying production request for bucket "${bucket}"`
      );
      cache.set(cacheKey, null);
      return null;
    }
    console.warn(`[hypher/rateLimit] Upstash Redis env missing — rate limiting disabled for bucket "${bucket}"`);
    cache.set(cacheKey, null);
    return null;
  }

  const redis = new Redis({ url, token });

  // Parse the window string like "30s", "1h", "10m", "7d" into an Upstash Duration.
  // Upstash accepts: "1 ms", "1 s", "1 m", "1 h", "1 d" — we reformat the input.
  const match = opts.window.match(/^(\d+)(s|m|h|d)$/);
  if (!match) {
    throw new Error(`[hypher/rateLimit] Invalid window format: "${opts.window}". Expected e.g. "30s", "1h".`);
  }
  const [, count, unit] = match;
  const upstashWindow = `${count} ${unit}` as `${number} ${"ms" | "s" | "m" | "h" | "d"}`;

  const rl = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(opts.requests, upstashWindow),
    // Prefix mirrors convex/httpRateLimit.ts's "hypher-api" namespace
    prefix: `hypher-api:ratelimit:${bucket}`,
  });

  cache.set(cacheKey, rl);
  return rl;
}

/**
 * Generic per-user rate-limit helper backed by Upstash Redis.
 *
 * @param userId  - Clerk user ID (identifies who is being limited).
 * @param bucket  - Logical bucket name, e.g. "ambient-ask", "digest-stream".
 * @param opts    - { requests: max allowed calls, window: sliding window duration }.
 * @returns `true` if the request is allowed, `false` if it should be rate-limited (429).
 *
 * When Upstash env vars are not set, always returns `true` (rate limiting disabled)
 * with a console warning — this matches the behaviour of convex/httpRateLimit.ts.
 */
export async function ratelimitUser(
  userId: string,
  bucket: string,
  opts: { requests: number; window: `${number}${"s" | "m" | "h" | "d"}` },
): Promise<boolean> {
  const rl = getRatelimitForBucket(bucket, opts);
  if (!rl) return process.env.NODE_ENV !== "production"; // local/test allow, production deny

  const key = `${userId}`;
  const result = await rl.limit(key);
  return result.success;
}
