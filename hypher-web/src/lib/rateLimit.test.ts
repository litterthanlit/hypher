import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock the Upstash packages BEFORE importing the module under test.
// vitest hoists vi.mock() calls, so this executes before any imports.
// ---------------------------------------------------------------------------

const mockLimit = vi.fn().mockResolvedValue({ success: true });

vi.mock("@upstash/ratelimit", () => {
  // Must be a proper constructor function (class or function) — not an arrow fn.
  function MockRatelimit() {
    return { limit: mockLimit };
  }
  MockRatelimit.slidingWindow = vi.fn().mockReturnValue("mock-limiter");
  return { Ratelimit: MockRatelimit };
});

vi.mock("@upstash/redis", () => {
  // Must be a proper constructor function.
  function MockRedis() {
    return {};
  }
  return { Redis: MockRedis };
});

// ---------------------------------------------------------------------------
// Import AFTER mocks are registered.
// Use a fresh module import each test-file run (cache is shared across tests
// in the same file, which is fine — we use unique bucket names to bypass it).
// ---------------------------------------------------------------------------

const { ratelimitUser } = await import("./rateLimit");

describe("ratelimitUser", () => {
  beforeEach(() => {
    // Reset Upstash env vars to "present" before each test.
    vi.stubEnv("NODE_ENV", "test");
    process.env.UPSTASH_REDIS_REST_URL = "https://fake.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "fake-token";
    mockLimit.mockResolvedValue({ success: true });
  });

  it("returns true when Upstash allows the request", async () => {
    mockLimit.mockResolvedValueOnce({ success: true });
    const allowed = await ratelimitUser("user_abc", "bucket-allow", {
      requests: 30,
      window: "1h",
    });
    expect(allowed).toBe(true);
  });

  it("returns false when Upstash denies the request", async () => {
    mockLimit.mockResolvedValueOnce({ success: false });
    // Use a unique bucket name to avoid module-level Ratelimit cache from above test
    const denied = await ratelimitUser("user_abc", "bucket-deny", {
      requests: 30,
      window: "1h",
    });
    expect(denied).toBe(false);
  });

  it("allows local/test requests when env vars are missing", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    // Use a fresh bucket name that was never cached with env vars present.
    const allowed = await ratelimitUser("user_xyz", "bucket-no-env", {
      requests: 5,
      window: "1m",
    });
    expect(allowed).toBe(true);
  });

  it("HYP-REL-009 denies production requests when rate-limit env vars are missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const allowed = await ratelimitUser("user_xyz", "bucket-prod-no-env", {
      requests: 5,
      window: "1m",
    });
    expect(allowed).toBe(false);
  });
});
