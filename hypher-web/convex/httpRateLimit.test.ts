import { describe, it, expect, vi, beforeEach } from "vitest";

const mockLimit = vi.fn().mockResolvedValue({ success: true, reset: Date.now() + 60_000 });

vi.mock("@upstash/ratelimit", () => {
  function MockRatelimit() {
    return { limit: mockLimit };
  }
  MockRatelimit.slidingWindow = vi.fn().mockReturnValue("mock-limiter");
  return { Ratelimit: MockRatelimit };
});

vi.mock("@upstash/redis", () => {
  function MockRedis() {
    return {};
  }
  return { Redis: MockRedis };
});

describe("enforceApiKeyRateLimit", () => {
  beforeEach(() => {
    vi.resetModules();
    mockLimit.mockReset();
    mockLimit.mockResolvedValue({ success: true, reset: Date.now() + 60_000 });
    vi.stubEnv("NODE_ENV", "test");
    process.env.UPSTASH_REDIS_REST_URL = "https://fake.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "fake-token";
  });

  it("returns null when Upstash allows the request", async () => {
    const { enforceApiKeyRateLimit } = await import("./httpRateLimit");
    const result = await enforceApiKeyRateLimit("key-allow");
    expect(result).toBeNull();
  });

  it("returns 429 when Upstash denies the request", async () => {
    mockLimit.mockResolvedValueOnce({ success: false, reset: Date.now() + 60_000 });
    const { enforceApiKeyRateLimit } = await import("./httpRateLimit");
    const result = await enforceApiKeyRateLimit("key-deny");
    expect(result).not.toBeNull();
    expect(result?.status).toBe(429);
    const body = await result?.json();
    expect(body.error).toBe("rate_limited");
  });

  it("returns null (allow) when env vars are missing", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    const { enforceApiKeyRateLimit } = await import("./httpRateLimit");
    const result = await enforceApiKeyRateLimit("key-no-env");
    expect(result).toBeNull();
  });

  it("returns null (allow) in production when Upstash env vars are missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    const { enforceApiKeyRateLimit } = await import("./httpRateLimit");
    const result = await enforceApiKeyRateLimit("key-prod-no-env");
    expect(result).toBeNull();
  });

  it("returns null (allow) in production when Upstash env vars are placeholders", async () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.UPSTASH_REDIS_REST_URL = "https://...";
    process.env.UPSTASH_REDIS_REST_TOKEN = "...";
    const { enforceApiKeyRateLimit } = await import("./httpRateLimit");
    const result = await enforceApiKeyRateLimit("key-prod-placeholder");
    expect(result).toBeNull();
  });
});
