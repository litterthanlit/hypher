import { createHash, randomBytes } from "crypto";
import {
  GROK_OAUTH_CLIENT,
  HYPHER_GROK_OAUTH_CLIENT_ID,
  HYPHER_MCP_SCOPE,
  getRegisteredOAuthClient as lookupRegisteredOAuthClient,
  intersectCursorMcpRedirectUris,
  isRedirectUriRegistered as clientHasRedirectUri,
  registeredOAuthClients as loadRegisteredOAuthClients,
  type RegisteredOAuthClient,
} from "../../shared/oauthClients";
import {
  canonicalizeOAuthResource,
  isAllowedOAuthResource,
  mcpServerResourceUrl,
} from "../../shared/oauthResources";

export { HYPHER_MCP_SCOPE };
export type { RegisteredOAuthClient };
const CONSENT_ID_PARAM = "consent_id";
const CSRF_TOKEN_PARAM = "csrf_token";

export type OAuthAuthorizeValidation =
  | {
      ok: true;
      responseType: "code";
      clientId: string;
      redirectUri: string;
      clientName: string;
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

export type OAuthConsentRequestValidation =
  | {
      ok: true;
      consentId: string;
      csrfToken: string;
    }
  | {
      ok: false;
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

export function oauthConsentServerSecret(): string | null {
  return process.env.HYPHER_OAUTH_CONSENT_SECRET || null;
}

export function registeredOAuthClients(): RegisteredOAuthClient[] {
  return loadRegisteredOAuthClients(process.env.HYPHER_OAUTH_CLIENTS_JSON);
}

export function getRegisteredOAuthClient(clientId: string): RegisteredOAuthClient | null {
  return lookupRegisteredOAuthClient(clientId, registeredOAuthClients());
}

export function isRedirectUriRegistered(client: RegisteredOAuthClient, redirectUri: string): boolean {
  return clientHasRedirectUri(client, redirectUri);
}

export function buildProtectedResourceMetadata(baseUrl: string, resource = baseUrl) {
  return {
    resource,
    authorization_servers: [baseUrl],
    scopes_supported: [HYPHER_MCP_SCOPE],
    resource_documentation: mcpServerResourceUrl(baseUrl),
    token_endpoint_auth_methods_supported: ["none"],
  };
}

export function buildMcpProtectedResourceMetadata(baseUrl: string) {
  return buildProtectedResourceMetadata(baseUrl, mcpServerResourceUrl(baseUrl));
}

export function oauthProtectedResourceMetadataUrl(baseUrl: string, pathAppended: boolean | string = false): string {
  const origin = baseUrl.replace(/\/+$/, "");
  if (pathAppended === true) {
    return `${origin}/.well-known/oauth-protected-resource/api/mcp`;
  }
  if (typeof pathAppended === "string" && pathAppended.length > 0) {
    const suffix = pathAppended.replace(/^\/+/, "");
    return `${origin}/.well-known/oauth-protected-resource/${suffix}`;
  }
  return `${origin}/.well-known/oauth-protected-resource`;
}

/** RFC 9728 path-appended metadata URL for the MCP resource the client requested. */
export function mcpAuthChallengeMetadataUrl(requestUrl: string): string {
  const pathname = new URL(requestUrl).pathname.replace(/\/+$/, "") || "/";
  const suffix = pathname === "/mcp" ? "mcp" : "api/mcp";
  return oauthProtectedResourceMetadataUrl(baseUrlFromRequest(requestUrl), suffix);
}

export function mcpWwwAuthenticateChallenge(requestUrl: string): string {
  return `Bearer resource_metadata="${mcpAuthChallengeMetadataUrl(requestUrl)}", scope="${HYPHER_MCP_SCOPE}"`;
}

export function buildOAuthMetadata(baseUrl: string) {
  const origin = baseUrl.replace(/\/+$/, "");
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/oauth/token`,
    registration_endpoint: `${origin}/oauth/register`,
    client_id_metadata_document_supported: true,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: [HYPHER_MCP_SCOPE],
  };
}

export type DynamicClientRegistrationRequest = {
  redirect_uris?: unknown;
  token_endpoint_auth_method?: unknown;
  grant_types?: unknown;
  response_types?: unknown;
};

export type DynamicClientRegistrationSuccess = {
  client_id: typeof HYPHER_GROK_OAUTH_CLIENT_ID;
  client_name: string;
  client_id_issued_at: number;
  redirect_uris: string[];
  token_endpoint_auth_method: "none";
  grant_types: ["authorization_code"];
  response_types: ["code"];
  code_challenge_methods: ["S256"];
};

export type DynamicClientRegistrationResult =
  | { ok: true; client: DynamicClientRegistrationSuccess }
  | { ok: false; error: string; error_description: string };

function asStringArray(value: unknown): string[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    return null;
  }
  return value;
}

/**
 * RFC 7591 public-client DCR. Reuses hypher-grok when requested redirects
 * intersect the Cursor/Grok allowlist. Does not persist new clients.
 */
export function registerPublicGrokOAuthClient(
  body: DynamicClientRegistrationRequest,
  issuedAtSeconds = Math.floor(Date.now() / 1000)
): DynamicClientRegistrationResult {
  const tokenAuth = body.token_endpoint_auth_method ?? "none";
  if (tokenAuth !== "none") {
    return {
      ok: false,
      error: "invalid_client_metadata",
      error_description: "Public clients must use token_endpoint_auth_method none.",
    };
  }

  const grantTypes = asStringArray(body.grant_types);
  if (grantTypes === null) {
    return {
      ok: false,
      error: "invalid_client_metadata",
      error_description: "grant_types must be an array of strings.",
    };
  }
  if (grantTypes.length > 0 && !grantTypes.includes("authorization_code")) {
    return {
      ok: false,
      error: "invalid_client_metadata",
      error_description: "Hypher only supports authorization_code.",
    };
  }

  const responseTypes = asStringArray(body.response_types);
  if (responseTypes === null) {
    return {
      ok: false,
      error: "invalid_client_metadata",
      error_description: "response_types must be an array of strings.",
    };
  }
  if (responseTypes.length > 0 && !responseTypes.includes("code")) {
    return {
      ok: false,
      error: "invalid_client_metadata",
      error_description: "Hypher only supports response_type code.",
    };
  }

  const requested = asStringArray(body.redirect_uris);
  if (requested === null) {
    return {
      ok: false,
      error: "invalid_redirect_uri",
      error_description: "redirect_uris must be an array of strings.",
    };
  }

  const redirectUris = intersectCursorMcpRedirectUris(requested);
  if (redirectUris.length === 0) {
    return {
      ok: false,
      error: "invalid_redirect_uri",
      error_description: "redirect_uris must intersect the registered Cursor MCP callbacks.",
    };
  }

  return {
    ok: true,
    client: {
      client_id: HYPHER_GROK_OAUTH_CLIENT_ID,
      client_name: GROK_OAUTH_CLIENT.name,
      client_id_issued_at: issuedAtSeconds,
      redirect_uris: redirectUris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code"],
      response_types: ["code"],
      code_challenge_methods: ["S256"],
    },
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
  const client = getRegisteredOAuthClient(clientId);
  if (!client) {
    return { ok: false, error: "unauthorized_client", errorDescription: "OAuth client is not registered with Hypher." };
  }
  if (!isRedirectUriRegistered(client, redirectUri)) {
    return { ok: false, error: "invalid_request", errorDescription: "redirect_uri is not registered for this OAuth client." };
  }
  if (!codeChallenge || codeChallengeMethod !== "S256") {
    return { ok: false, error: "invalid_request", errorDescription: "Hypher requires PKCE S256." };
  }
  const canonicalResource = canonicalizeOAuthResource(resource);
  if (!canonicalResource || !isAllowedOAuthResource(resource, expectedResource)) {
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
    clientName: client.name,
    codeChallenge,
    codeChallengeMethod: "S256",
    resource: canonicalResource,
    scope,
    state,
  };
}

export function parseOAuthConsentRequestParams(
  params: URLSearchParams
): OAuthConsentRequestValidation {
  const consentId = params.get(CONSENT_ID_PARAM) ?? "";
  const csrfToken = params.get(CSRF_TOKEN_PARAM) ?? "";
  if (!consentId || !csrfToken) {
    return { ok: false, errorDescription: "Missing consent transaction." };
  }
  return { ok: true, consentId, csrfToken };
}

export function buildOAuthConsentUrl(
  baseUrl: string,
  params: { consentId: string; csrfToken: string }
): string {
  const url = new URL("/oauth/consent", baseUrl);
  url.searchParams.set(CONSENT_ID_PARAM, params.consentId);
  url.searchParams.set(CSRF_TOKEN_PARAM, params.csrfToken);
  return url.toString();
}

export function buildOAuthApproveConsentUrl(params: {
  consentId: string;
  csrfToken: string;
}): string {
  const qs = new URLSearchParams();
  qs.set(CONSENT_ID_PARAM, params.consentId);
  qs.set(CSRF_TOKEN_PARAM, params.csrfToken);
  return `/oauth/consent/approve?${qs.toString()}`;
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
