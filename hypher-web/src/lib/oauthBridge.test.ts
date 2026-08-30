import { describe, expect, it } from "vitest";
import {
  buildOAuthApproveConsentUrl,
  buildOAuthConsentUrl,
  buildOAuthAuthorizeRedirect,
  buildMcpProtectedResourceMetadata,
  buildOAuthMetadata,
  buildProtectedResourceMetadata,
  codeChallengeS256,
  mcpAuthChallengeMetadataUrl,
  mcpWwwAuthenticateChallenge,
  oauthProtectedResourceMetadataUrl,
  parseOAuthConsentRequestParams,
  registerPublicGrokOAuthClient,
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

  it("publishes RFC 9728 path-appended metadata that identifies the MCP server URL", () => {
    expect(buildMcpProtectedResourceMetadata("https://www.hypher.app")).toEqual({
      resource: "https://www.hypher.app/api/mcp",
      authorization_servers: ["https://www.hypher.app"],
      scopes_supported: ["hypher.projects.read"],
      resource_documentation: "https://www.hypher.app/api/mcp",
      token_endpoint_auth_methods_supported: ["none"],
    });
    expect(buildMcpProtectedResourceMetadata("https://hypher.app")).toEqual({
      resource: "https://hypher.app/api/mcp",
      authorization_servers: ["https://hypher.app"],
      scopes_supported: ["hypher.projects.read"],
      resource_documentation: "https://hypher.app/api/mcp",
      token_endpoint_auth_methods_supported: ["none"],
    });
    expect(oauthProtectedResourceMetadataUrl("https://www.hypher.app", true)).toBe(
      "https://www.hypher.app/.well-known/oauth-protected-resource/api/mcp"
    );
    expect(oauthProtectedResourceMetadataUrl("https://www.hypher.app", "mcp")).toBe(
      "https://www.hypher.app/.well-known/oauth-protected-resource/mcp"
    );
    expect(oauthProtectedResourceMetadataUrl("https://hypher.app")).toBe(
      "https://hypher.app/.well-known/oauth-protected-resource"
    );
  });

  it("publishes OAuth metadata for authorization code plus PKCE", () => {
    expect(buildOAuthMetadata("https://hypher.app")).toMatchObject({
      issuer: "https://hypher.app",
      authorization_endpoint: "https://hypher.app/oauth/authorize",
      token_endpoint: "https://hypher.app/oauth/token",
      registration_endpoint: "https://hypher.app/oauth/register",
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      scopes_supported: ["hypher.projects.read"],
    });
  });

  it("builds RFC 9728 WWW-Authenticate resource_metadata from the MCP request path", () => {
    expect(mcpAuthChallengeMetadataUrl("https://www.hypher.app/api/mcp")).toBe(
      "https://www.hypher.app/.well-known/oauth-protected-resource/api/mcp"
    );
    expect(mcpAuthChallengeMetadataUrl("https://www.hypher.app/mcp")).toBe(
      "https://www.hypher.app/.well-known/oauth-protected-resource/mcp"
    );
    expect(mcpWwwAuthenticateChallenge("https://www.hypher.app/api/mcp")).toBe(
      'Bearer resource_metadata="https://www.hypher.app/.well-known/oauth-protected-resource/api/mcp", scope="hypher.projects.read"'
    );
  });
});

describe("RFC 7591 public-client DCR", () => {
  it("reuses hypher-grok when requested redirects intersect the Cursor allowlist", () => {
    expect(
      registerPublicGrokOAuthClient(
        {
          redirect_uris: [
            "https://www.cursor.com/agents/mcp/oauth/callback",
            "cursor://anysphere.cursor-mcp/oauth/callback",
            "https://attacker.example/callback",
          ],
          token_endpoint_auth_method: "none",
          grant_types: ["authorization_code"],
        },
        1_700_000_000
      )
    ).toEqual({
      ok: true,
      client: {
        client_id: "hypher-grok",
        client_name: "Grok",
        client_id_issued_at: 1_700_000_000,
        redirect_uris: [
          "https://www.cursor.com/agents/mcp/oauth/callback",
          "cursor://anysphere.cursor-mcp/oauth/callback",
        ],
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code"],
        response_types: ["code"],
        code_challenge_methods: ["S256"],
      },
    });
  });

  it("rejects unknown redirects and does not invent grokbot URIs", () => {
    expect(
      registerPublicGrokOAuthClient({
        redirect_uris: ["grokbot://oauth/callback"],
      })
    ).toEqual({
      ok: false,
      error: "invalid_redirect_uri",
      error_description: "redirect_uris must intersect the registered Cursor MCP callbacks.",
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

  it("accepts hypher-grok authorization requests with each Cursor MCP redirect", () => {
    const redirects = [
      "http://localhost:8787/callback",
      "https://www.cursor.com/agents/mcp/oauth/callback",
      "cursor://anysphere.cursor-mcp/oauth/callback",
      "https://cursor.com/agents/mcp/oauth/callback",
    ];

    for (const redirect_uri of redirects) {
      const params = new URLSearchParams({
        response_type: "code",
        client_id: "hypher-grok",
        redirect_uri,
        code_challenge: "abc",
        code_challenge_method: "S256",
        resource: "https://hypher.app",
        scope: "hypher.projects.read",
      });

      expect(validateOAuthAuthorizeParams(params, "https://hypher.app")).toMatchObject({
        ok: true,
        clientId: "hypher-grok",
        clientName: "Grok",
        redirectUri: redirect_uri,
      });
    }
  });

  it("accepts hypher-cursor with the Cursor Agents MCP callback (Grok Bot fallback)", () => {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: "hypher-cursor",
      redirect_uri: "https://www.cursor.com/agents/mcp/oauth/callback",
      code_challenge: "abc",
      code_challenge_method: "S256",
      resource: "https://hypher.app",
      scope: "hypher.projects.read",
    });

    expect(validateOAuthAuthorizeParams(params, "https://hypher.app")).toMatchObject({
      ok: true,
      clientId: "hypher-cursor",
      clientName: "Cursor",
    });
  });

  it("accepts apex, www, /api/mcp, and /mcp resource aliases when the expected resource is www", () => {
    const aliases = [
      "https://hypher.app",
      "https://www.hypher.app",
      "https://hypher.app/api/mcp",
      "https://www.hypher.app/api/mcp",
      "https://hypher.app/mcp",
      "https://www.hypher.app/mcp",
    ];

    for (const resource of aliases) {
      const params = new URLSearchParams({
        response_type: "code",
        client_id: "hypher-grok",
        redirect_uri: "https://www.cursor.com/agents/mcp/oauth/callback",
        code_challenge: "abc",
        code_challenge_method: "S256",
        resource,
        scope: "hypher.projects.read",
      });

      expect(validateOAuthAuthorizeParams(params, "https://www.hypher.app")).toMatchObject({
        ok: true,
        clientId: "hypher-grok",
        resource: "https://www.hypher.app",
      });
    }
  });

  it("rejects a resource that is not a Hypher origin or MCP alias", () => {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: "hypher-grok",
      redirect_uri: "https://www.cursor.com/agents/mcp/oauth/callback",
      code_challenge: "abc",
      code_challenge_method: "S256",
      resource: "https://evil.example",
    });

    expect(validateOAuthAuthorizeParams(params, "https://www.hypher.app")).toEqual({
      ok: false,
      error: "invalid_target",
      errorDescription: "OAuth resource does not match this Hypher MCP server.",
    });
  });

  it("rejects unregistered Grok-style redirect URIs", () => {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: "hypher-grok",
      redirect_uri: "grokbot://oauth/callback",
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
