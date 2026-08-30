import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

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

function grokAuthorizeUrl(resource = "https://hypher.app") {
  const url = new URL("https://www.hypher.app/oauth/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", "hypher-grok");
  url.searchParams.set("redirect_uri", "https://www.cursor.com/agents/mcp/oauth/callback");
  url.searchParams.set("code_challenge", "challenge-1");
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("resource", resource);
  url.searchParams.set("scope", "hypher.projects.read");
  url.searchParams.set("state", "state-1");
  return url;
}

function loggedPayloads(spy: MockInstance): string[] {
  return spy.mock.calls.map((args) => JSON.stringify(args));
}

describe("OAuth authorize route", () => {
  let warnSpy: MockInstance;
  let errorSpy: MockInstance;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.NEXT_PUBLIC_APP_URL;
    process.env.HYPHER_OAUTH_CONSENT_SECRET = "test-oauth-consent-secret-at-least-32-bytes";
    requireBetaAccess.mockResolvedValue({ convexToken: "convex-token" });
    fetchMutation.mockResolvedValue({ consentId: "consent-1" });
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    errorSpy.mockRestore();
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
      "https://www.hypher.app/mcp",
    ]) {
      const response = await GET(new NextRequest(grokAuthorizeUrl(resource)));
      const location = response.headers.get("location") ?? "";
      expect(location).toContain("/sign-in");
      expect(location).not.toContain("invalid_target");
      expect(location).not.toContain("server_error");
      expect(fetchMutation).not.toHaveBeenCalled();
    }

    expect(warnSpy).toHaveBeenCalledWith(
      "[oauth/authorize]",
      expect.objectContaining({
        destination: "sign_in",
        error: "Not authenticated",
        error_description: "Sign-in required.",
        client_id: "hypher-grok",
        redirect_uri_host: "www.cursor.com",
        clerk_session_existed: false,
      })
    );
    for (const serialized of loggedPayloads(warnSpy)) {
      expect(serialized).not.toContain("challenge-1");
      expect(serialized).not.toContain("/agents/mcp/oauth/callback");
    }
  });

  it("errorRedirects missing_convex_token instead of sending a signed-in user to sign-in", async () => {
    const { ServerAuthError } = await import("@/lib/serverAuth");
    requireBetaAccess.mockRejectedValue(new ServerAuthError("missing_convex_token", 401));
    const { GET } = await import("./route");

    const response = await GET(new NextRequest(grokAuthorizeUrl()));
    const location = new URL(response.headers.get("location") ?? "");

    expect(location.origin + location.pathname).toBe(
      "https://www.cursor.com/agents/mcp/oauth/callback"
    );
    expect(location.searchParams.get("error")).toBe("server_error");
    expect(location.searchParams.get("error_description")).toBe("Missing Hypher auth token.");
    expect(location.searchParams.get("state")).toBe("state-1");
    expect(location.href).not.toContain("/sign-in");
    expect(fetchMutation).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      "[oauth/authorize]",
      expect.objectContaining({
        destination: "error_redirect",
        error: "server_error",
        error_description: "Missing Hypher auth token.",
        client_id: "hypher-grok",
        redirect_uri_host: "www.cursor.com",
        clerk_session_existed: true,
      })
    );
    for (const serialized of loggedPayloads(warnSpy)) {
      expect(serialized).not.toContain("challenge-1");
      expect(serialized).not.toContain("convex-token");
    }
  });

  it("logs HYPHER_OAUTH_CONSENT_SECRET missing and still errorRedirects", async () => {
    delete process.env.HYPHER_OAUTH_CONSENT_SECRET;
    const { GET } = await import("./route");

    const response = await GET(new NextRequest(grokAuthorizeUrl()));
    const location = new URL(response.headers.get("location") ?? "");

    expect(location.searchParams.get("error")).toBe("server_error");
    expect(location.searchParams.get("error_description")).toBe("OAuth consent is not configured.");
    expect(location.href).not.toContain("/sign-in");
    expect(fetchMutation).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith("[oauth/authorize] HYPHER_OAUTH_CONSENT_SECRET missing");
    expect(warnSpy).toHaveBeenCalledWith(
      "[oauth/authorize]",
      expect.objectContaining({
        destination: "error_redirect",
        error: "server_error",
        client_id: "hypher-grok",
        redirect_uri_host: "www.cursor.com",
        clerk_session_existed: true,
      })
    );
  });

  it("still rejects a non-Hypher resource as invalid_target", async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    const { GET } = await import("./route");
    const response = await GET(new NextRequest(grokAuthorizeUrl("https://evil.example")));
    const location = response.headers.get("location") ?? "";
    expect(location).toContain("invalid_target");
    expect(fetchMutation).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      "[oauth/authorize]",
      expect.objectContaining({
        destination: "error_redirect",
        error: "invalid_target",
        client_id: "hypher-grok",
        redirect_uri_host: "www.cursor.com",
        clerk_session_existed: false,
      })
    );
  });
});
