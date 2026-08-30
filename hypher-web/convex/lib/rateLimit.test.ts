import { describe, it, expect, vi, beforeEach } from "vitest";

const mockLimit = vi.fn().mockResolvedValue({ success: true });

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

const { ratelimitConvex } = await import("./rateLimit");

describe("ratelimitConvex", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "test");
    process.env.UPSTASH_REDIS_REST_URL = "https://fake.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "fake-token";
    mockLimit.mockResolvedValue({ success: true });
  });

  it("returns true when Upstash allows the request", async () => {
    mockLimit.mockResolvedValueOnce({ success: true });
    const allowed = await ratelimitConvex("key-allow", "convex-bucket-allow", {
      requests: 30,
      window: "1h",
    });
    expect(allowed).toBe(true);
  });

  it("returns false when Upstash denies the request", async () => {
    mockLimit.mockResolvedValueOnce({ success: false });
    const denied = await ratelimitConvex("key-deny", "convex-bucket-deny", {
      requests: 30,
      window: "1h",
    });
    expect(denied).toBe(false);
  });

  it("allows requests when env vars are missing", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const allowed = await ratelimitConvex("key-no-env", "convex-bucket-no-env", {
      requests: 5,
      window: "1m",
    });
    expect(allowed).toBe(true);
  });

  it("allows production requests when Upstash env vars are missing (fail-open)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const allowed = await ratelimitConvex("key-prod-no-env", "convex-bucket-prod-no-env", {
      requests: 5,
      window: "1m",
    });
    expect(allowed).toBe(true);
  });

  it("allows production requests when Upstash env vars are placeholder values", async () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.UPSTASH_REDIS_REST_URL = "https://...";
    process.env.UPSTASH_REDIS_REST_TOKEN = "...";

    const allowed = await ratelimitConvex(
      "key-prod-placeholder",
      "convex-bucket-prod-placeholder",
      { requests: 5, window: "1m" }
    );
    expect(allowed).toBe(true);
  });
});
