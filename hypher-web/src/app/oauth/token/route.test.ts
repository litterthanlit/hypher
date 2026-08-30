import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMutation = vi.fn();
const mockLimit = vi.fn().mockResolvedValue({ success: true });

vi.mock("convex/nextjs", () => ({
  fetchMutation,
}));

vi.mock("../../../../convex/_generated/api", () => ({
  api: {
    oauth: {
      exchangeAuthorizationCode: "exchangeAuthorizationCode",
    },
  },
}));

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

function tokenRequest(): NextRequest {
  return new NextRequest("https://hypher.app/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: "fake-authorization-code",
      redirect_uri: "https://www.cursor.com/agents/mcp/oauth/callback",
      client_id: "hypher-grok",
      code_verifier: "verifier-1",
    }).toString(),
  });
}

describe("OAuth token route rate limit", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    fetchMutation.mockResolvedValue(null);
    mockLimit.mockResolvedValue({ success: true });
  });

  it("allows production token exchange when Upstash env is missing (does not 429)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const { POST } = await import("./route");
    const response = await POST(tokenRequest());

    expect(response.status).not.toBe(429);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "invalid_grant",
      error_description:
        "Authorization code is invalid, expired, already used, or not bound to this client.",
    });
    expect(fetchMutation).toHaveBeenCalledTimes(1);
    expect(mockLimit).not.toHaveBeenCalled();
  });

  it("returns 429 when Upstash is present and denies the request", async () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.UPSTASH_REDIS_REST_URL = "https://fake.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "fake-token";
    mockLimit.mockResolvedValueOnce({ success: false });

    const { POST } = await import("./route");
    const response = await POST(tokenRequest());

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({
      error: "slow_down",
      error_description: "Too many token exchange attempts.",
    });
    expect(fetchMutation).not.toHaveBeenCalled();
  });
});
