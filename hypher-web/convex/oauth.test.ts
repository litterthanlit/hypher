import { describe, expect, it } from "vitest";
import { validatePendingOAuthConsentForCodeIssue } from "./oauth";

const pendingConsent = {
  userId: "user-1",
  clientId: "https://chatgpt.com/oauth/client.json",
  redirectUri: "https://chatgpt.com/connector/oauth/callback",
  csrfTokenHash: "csrf-hash",
  expiresAt: 2_000,
};

describe("HYP-SEC-003 OAuth consent enforcement", () => {
  it("rejects direct authorization code creation without the server consent secret", () => {
    expect(
      validatePendingOAuthConsentForCodeIssue({
        consent: pendingConsent,
        userId: "user-1",
        csrfTokenHash: "csrf-hash",
        now: 1_000,
        serverSecret: undefined,
        expectedServerSecret: "server-secret",
      })
    ).toEqual({ ok: false, reason: "server_secret" });
  });

  it("requires a matching pending consent transaction before issuing a code", () => {
    expect(
      validatePendingOAuthConsentForCodeIssue({
        consent: null,
        userId: "user-1",
        csrfTokenHash: "csrf-hash",
        now: 1_000,
        serverSecret: "server-secret",
        expectedServerSecret: "server-secret",
      })
    ).toEqual({ ok: false, reason: "not_found" });

    expect(
      validatePendingOAuthConsentForCodeIssue({
        consent: pendingConsent,
        userId: "user-1",
        csrfTokenHash: "csrf-hash",
        now: 1_000,
        serverSecret: "server-secret",
        expectedServerSecret: "server-secret",
      })
    ).toEqual({ ok: true });
  });
});
