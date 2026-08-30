import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let cached: Ratelimit | null | undefined;

function hasUsableRedisEnv(url: string | undefined, token: string | undefined): url is string {
  return Boolean(url?.startsWith("https://") && !url.includes("...") && token && token !== "...");
}

function getRatelimit(): Ratelimit | null {
  if (cached !== undefined) return cached;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!hasUsableRedisEnv(url, token)) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[hypher/http] Upstash Redis env missing or invalid — allowing request (fail-open)"
      );
    } else {
      console.warn(
        "[hypher/http] Upstash Redis env missing — rate limiting disabled (set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN)"
      );
    }
    cached = null;
    return null;
  }
  const redis = new Redis({ url, token });
  cached = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, "1 m"),
    prefix: "hypher-api",
  });
  return cached;
}

/**
 * Returns a 429 Response if over limit, or null if allowed / rate limiting off.
 * When Upstash is missing or invalid, returns null (allow) instead of 503.
 */
export async function enforceApiKeyRateLimit(
  rateLimitKey: string
): Promise<Response | null> {
  const rl = getRatelimit();
  if (!rl) return null;

  const result = await rl.limit(rateLimitKey);
  if (result.success) return null;

  const retryAfter = Math.max(
    1,
    Math.ceil((result.reset - Date.now()) / 1000)
  );

  return new Response(
    JSON.stringify({ error: "rate_limited", retryAfter }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
      },
    }
  );
}
