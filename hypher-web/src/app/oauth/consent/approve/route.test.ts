import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMutation = vi.fn();
const requireBetaAccess = vi.fn();

vi.mock("convex/nextjs", () => ({
  fetchMutation,
}));

vi.mock("../../../../../convex/_generated/api", () => ({
  api: {
    oauth: {
      createAuthorizationCode: "createAuthorizationCode",
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

describe("OAuth consent approval route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.HYPHER_OAUTH_CONSENT_SECRET = "test-oauth-consent-secret-at-least-32-bytes";
    requireBetaAccess.mockResolvedValue({ convexToken: "convex-token" });
    fetchMutation.mockResolvedValue({
      redirectUri: "https://chatgpt.com/connector/oauth/callback",
      state: "state-1",
    });
  });

  it("HYP-SEC-003 issues a code only through a pending consent transaction", async () => {
    const { GET } = await import("./route");
    const response = await GET(
      new NextRequest(
        "https://hypher.app/oauth/consent/approve?consent_id=consent-1&csrf_token=csrf-1"
      )
    );

    expect(fetchMutation).toHaveBeenCalledTimes(1);
    expect(fetchMutation.mock.calls[0][0]).toBe("createAuthorizationCode");
    expect(fetchMutation.mock.calls[0][1]).toMatchObject({
      consentId: "consent-1",
      serverSecret: "test-oauth-consent-secret-at-least-32-bytes",
    });
    expect(fetchMutation.mock.calls[0][1].csrfTokenHash).not.toBe("csrf-1");
    expect(response.headers.get("location")).toMatch(
      /^https:\/\/chatgpt\.com\/connector\/oauth\/callback\?code=hyc_/
    );
    expect(response.headers.get("location")).toContain("state=state-1");
  });
});
