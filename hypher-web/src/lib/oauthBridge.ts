import { createHash, randomBytes } from "crypto";

export const HYPHER_MCP_SCOPE = "hypher.projects.read";

export type OAuthAuthorizeValidation =
  | {
      ok: true;
      responseType: "code";
      clientId: string;
      redirectUri: string;
      codeChallenge: string;
      codeChallengeMethod: "S256";
      resource: string;
      scope: string;
      state?: string;
    }
  | {
      ok: false;
      error: string;
      errorDescription: string;
    };

export function baseUrlFromRequest(url: string): string {
  return process.env.NEXT_PUBLIC_APP_URL || new URL(url).origin;
}

export function base64url(input: Buffer): string {
  return input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function sha256Base64url(value: string): string {
  return base64url(createHash("sha256").update(value).digest());
}

export function codeChallengeS256(verifier: string): string {
  return sha256Base64url(verifier);
}

export function generateOpaqueToken(prefix: string): string {
  const random = base64url(randomBytes(32));
  return `${prefix}_${random}`;
}

export function buildProtectedResourceMetadata(baseUrl: string) {
  return {
    resource: baseUrl,
    authorization_servers: [baseUrl],
    scopes_supported: [HYPHER_MCP_SCOPE],
    resource_documentation: `${baseUrl}/api/mcp`,
    token_endpoint_auth_methods_supported: ["none"],
  };
}

export function buildOAuthMetadata(baseUrl: string) {
  return {
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/oauth/authorize`,
    token_endpoint: `${baseUrl}/oauth/token`,
    client_id_metadata_document_supported: true,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: [HYPHER_MCP_SCOPE],
  };
}

export function validateOAuthAuthorizeParams(
  params: URLSearchParams,
  expectedResource: string
): OAuthAuthorizeValidation {
  const responseType = params.get("response_type") ?? "";
  const clientId = params.get("client_id") ?? "";
  const redirectUri = params.get("redirect_uri") ?? "";
  const codeChallenge = params.get("code_challenge") ?? "";
  const codeChallengeMethod = params.get("code_challenge_method") ?? "";
  const resource = params.get("resource") ?? expectedResource;
  const scope = params.get("scope") || HYPHER_MCP_SCOPE;
  const state = params.get("state") || undefined;

  if (responseType !== "code") {
    return { ok: false, error: "unsupported_response_type", errorDescription: "Hypher only supports authorization code flow." };
  }
  if (!clientId || !redirectUri) {
    return { ok: false, error: "invalid_request", errorDescription: "Missing client_id or redirect_uri." };
  }
  if (!codeChallenge || codeChallengeMethod !== "S256") {
    return { ok: false, error: "invalid_request", errorDescription: "Hypher requires PKCE S256." };
  }
  if (resource !== expectedResource) {
    return { ok: false, error: "invalid_target", errorDescription: "OAuth resource does not match this Hypher MCP server." };
  }
  if (!scope.split(/\s+/).includes(HYPHER_MCP_SCOPE)) {
    return { ok: false, error: "invalid_scope", errorDescription: `Hypher requires ${HYPHER_MCP_SCOPE}.` };
  }

  return {
    ok: true,
    responseType: "code",
    clientId,
    redirectUri,
    codeChallenge,
    codeChallengeMethod: "S256",
    resource,
    scope,
    state,
  };
}

export function buildOAuthAuthorizeRedirect(params: {
  redirectUri: string;
  code: string;
  state?: string;
}): string {
  const redirect = new URL(params.redirectUri);
  redirect.searchParams.set("code", params.code);
  if (params.state) redirect.searchParams.set("state", params.state);
  return redirect.toString();
}
