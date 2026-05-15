import { describe, expect, it } from "vitest";
import {
  buildOAuthAuthorizeRedirect,
  buildOAuthMetadata,
  buildProtectedResourceMetadata,
  codeChallengeS256,
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
  it("accepts ChatGPT authorization requests with PKCE and resource binding", () => {
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

  it("rejects requests without S256 PKCE", () => {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: "client",
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
