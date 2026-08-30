import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMutation = vi.fn();
const requireBetaAccess = vi.fn();

vi.mock("convex/nextjs", () => ({
  fetchMutation,
}));

vi.mock("../../../../convex/_generated/api", () => ({
  api: {
    oauth: {
      createAuthorizationCode: "createAuthorizationCode",
      createPendingConsent: "createPendingConsent",
    },
  },
}));

vi.mock("@/lib/serverAuth", () => ({
  ServerAuthError: class ServerAuthError extends Error {
    status: number;

    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
  requireBetaAccess,
}));

describe("OAuth authorize route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.HYPHER_OAUTH_CONSENT_SECRET = "test-oauth-consent-secret-at-least-32-bytes";
    requireBetaAccess.mockResolvedValue({ convexToken: "convex-token" });
    fetchMutation.mockResolvedValue({ consentId: "consent-1" });
  });

  it("HYP-SEC-003 does not issue a code from consent=approve alone", async () => {
    const { GET } = await import("./route");
    const url = new URL("https://hypher.app/oauth/authorize");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", "https://chatgpt.com/oauth/client.json");
    url.searchParams.set("redirect_uri", "https://chatgpt.com/connector/oauth/callback");
    url.searchParams.set("code_challenge", "challenge-1");
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set("resource", "https://hypher.app");
    url.searchParams.set("scope", "hypher.projects.read");
    url.searchParams.set("state", "state-1");
    url.searchParams.set("consent", "approve");

    const response = await GET(new NextRequest(url));

    expect(response.headers.get("location")).toMatch(
      /^https:\/\/hypher\.app\/oauth\/consent\?consent_id=consent-1&csrf_token=/
    );
    expect(fetchMutation).toHaveBeenCalledTimes(1);
    expect(fetchMutation.mock.calls[0][0]).toBe("createPendingConsent");
    expect(fetchMutation.mock.calls[0][0]).not.toBe("createAuthorizationCode");
  });

  it("accepts MCP and apex resource aliases and sends unsigned users to sign-in", async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    const { ServerAuthError } = await import("@/lib/serverAuth");
    requireBetaAccess.mockRejectedValue(new ServerAuthError("Not authenticated", 401));
    const { GET } = await import("./route");

    for (const resource of [
      "https://hypher.app",
      "https://www.hypher.app/api/mcp",
    ]) {
      const url = new URL("https://www.hypher.app/oauth/authorize");
      url.searchParams.set("response_type", "code");
      url.searchParams.set("client_id", "hypher-grok");
      url.searchParams.set("redirect_uri", "https://www.cursor.com/agents/mcp/oauth/callback");
      url.searchParams.set("code_challenge", "challenge-1");
      url.searchParams.set("code_challenge_method", "S256");
      url.searchParams.set("resource", resource);
      url.searchParams.set("scope", "hypher.projects.read");
      url.searchParams.set("state", "state-1");

      const response = await GET(new NextRequest(url));
      const location = response.headers.get("location") ?? "";
      expect(location).toContain("/sign-in");
      expect(location).not.toContain("invalid_target");
      expect(fetchMutation).not.toHaveBeenCalled();
    }
  });

  it("still rejects a non-Hypher resource as invalid_target", async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    const { GET } = await import("./route");
    const url = new URL("https://www.hypher.app/oauth/authorize");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", "hypher-grok");
    url.searchParams.set("redirect_uri", "https://www.cursor.com/agents/mcp/oauth/callback");
    url.searchParams.set("code_challenge", "challenge-1");
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set("resource", "https://evil.example");
    url.searchParams.set("state", "state-1");

    const response = await GET(new NextRequest(url));
    const location = response.headers.get("location") ?? "";
    expect(location).toContain("invalid_target");
    expect(fetchMutation).not.toHaveBeenCalled();
  });
});
