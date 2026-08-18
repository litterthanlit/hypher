import { describe, expect, it } from "vitest";
import {
  buildOAuthApproveConsentUrl,
  buildOAuthConsentUrl,
  buildOAuthAuthorizeRedirect,
  buildOAuthMetadata,
  buildProtectedResourceMetadata,
  codeChallengeS256,
  parseOAuthConsentRequestParams,
  validateOAuthAuthorizeParams,
} from "./oauthBridge";

describe("OAuth bridge metadata", () => {
  it("publishes protected resource metadata for ChatGPT discovery", () => {
    expect(buildProtectedResourceMetadata("https://hypher.app")).toEqual({
      resource: "https://hypher.app",
      authorization_servers: ["https://hypher.app"],
      scopes_supported: ["hypher.projects.read"],
      resource_documentation: "https://hypher.app/api/mcp",
      token_endpoint_auth_methods_supported: ["none"],
    });
  });

  it("publishes OAuth metadata for authorization code plus PKCE", () => {
    expect(buildOAuthMetadata("https://hypher.app")).toMatchObject({
      issuer: "https://hypher.app",
      authorization_endpoint: "https://hypher.app/oauth/authorize",
      token_endpoint: "https://hypher.app/oauth/token",
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      scopes_supported: ["hypher.projects.read"],
    });
  });
});

describe("OAuth authorize params", () => {
  it("HYP-SEC-003 accepts registered ChatGPT authorization requests with PKCE and resource binding", () => {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: "https://chatgpt.com/oauth/client.json",
      redirect_uri: "https://chatgpt.com/connector/oauth/callback",
      code_challenge: "abc",
      code_challenge_method: "S256",
      resource: "https://hypher.app",
      state: "state-1",
      scope: "hypher.projects.read",
    });

    expect(validateOAuthAuthorizeParams(params, "https://hypher.app")).toMatchObject({
      ok: true,
      clientId: "https://chatgpt.com/oauth/client.json",
      scope: "hypher.projects.read",
    });
  });

  it("HYP-SEC-003 accepts registered Cursor authorization requests with PKCE and resource binding", () => {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: "hypher-cursor",
      redirect_uri: "http://localhost:8787/callback",
      code_challenge: "abc",
      code_challenge_method: "S256",
      resource: "https://hypher.app",
      state: "state-1",
      scope: "hypher.projects.read",
    });

    expect(validateOAuthAuthorizeParams(params, "https://hypher.app")).toMatchObject({
      ok: true,
      clientId: "hypher-cursor",
      clientName: "Cursor",
      scope: "hypher.projects.read",
    });
  });

  it("HYP-SEC-003 rejects unknown OAuth clients", () => {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: "https://attacker.example/client.json",
      redirect_uri: "https://attacker.example/callback",
      code_challenge: "abc",
      code_challenge_method: "S256",
      resource: "https://hypher.app",
    });

    expect(validateOAuthAuthorizeParams(params, "https://hypher.app")).toEqual({
      ok: false,
      error: "unauthorized_client",
      errorDescription: "OAuth client is not registered with Hypher.",
    });
  });

  it("HYP-SEC-003 rejects redirect URIs not bound to the client", () => {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: "https://chatgpt.com/oauth/client.json",
      redirect_uri: "https://attacker.example/callback",
      code_challenge: "abc",
      code_challenge_method: "S256",
      resource: "https://hypher.app",
    });

    expect(validateOAuthAuthorizeParams(params, "https://hypher.app")).toEqual({
      ok: false,
      error: "invalid_request",
      errorDescription: "redirect_uri is not registered for this OAuth client.",
    });
  });

  it("HYP-SEC-003 builds a consent page URL from a server-created transaction", () => {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: "https://chatgpt.com/oauth/client.json",
      redirect_uri: "https://chatgpt.com/connector/oauth/callback",
      code_challenge: "abc",
      code_challenge_method: "S256",
      resource: "https://hypher.app",
      state: "state-1",
      scope: "hypher.projects.read",
    });
    const validation = validateOAuthAuthorizeParams(params, "https://hypher.app");
    expect(validation.ok).toBe(true);
    if (!validation.ok) return;

    expect(
      buildOAuthConsentUrl("https://hypher.app", {
        consentId: "consent-1",
        csrfToken: "csrf-1",
      })
    ).toBe("https://hypher.app/oauth/consent?consent_id=consent-1&csrf_token=csrf-1");
    expect(buildOAuthApproveConsentUrl({ consentId: "consent-1", csrfToken: "csrf-1" })).toBe(
      "/oauth/consent/approve?consent_id=consent-1&csrf_token=csrf-1"
    );
  });

  it("HYP-SEC-003 rejects query-flag-only consent approval", () => {
    const params = new URLSearchParams({
      consent: "approve",
    });

    expect(parseOAuthConsentRequestParams(params)).toEqual({
      ok: false,
      errorDescription: "Missing consent transaction.",
    });
  });

  it("rejects requests without S256 PKCE", () => {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: "https://chatgpt.com/oauth/client.json",
      redirect_uri: "https://chatgpt.com/connector/oauth/callback",
      code_challenge: "abc",
      code_challenge_method: "plain",
      resource: "https://hypher.app",
    });

    expect(validateOAuthAuthorizeParams(params, "https://hypher.app")).toEqual({
      ok: false,
      error: "invalid_request",
      errorDescription: "Hypher requires PKCE S256.",
    });
  });

  it("binds the authorization code redirect to the original state", () => {
    const redirect = buildOAuthAuthorizeRedirect({
      redirectUri: "https://chatgpt.com/connector/oauth/callback",
      code: "code-1",
      state: "state-1",
    });

    expect(redirect).toBe("https://chatgpt.com/connector/oauth/callback?code=code-1&state=state-1");
  });
});

describe("PKCE", () => {
  it("computes S256 challenges using base64url", () => {
    expect(codeChallengeS256("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe(
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
    );
  });
});
