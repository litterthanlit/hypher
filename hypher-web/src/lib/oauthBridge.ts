import { createHash, randomBytes } from "crypto";

export const HYPHER_MCP_SCOPE = "hypher.projects.read";
const CONSENT_ID_PARAM = "consent_id";
const CSRF_TOKEN_PARAM = "csrf_token";

export type RegisteredOAuthClient = {
  clientId: string;
  name: string;
  redirectUris: string[];
};

const DEFAULT_OAUTH_CLIENTS: RegisteredOAuthClient[] = [
  {
    clientId: "https://chatgpt.com/oauth/client.json",
    name: "ChatGPT",
    redirectUris: ["https://chatgpt.com/connector/oauth/callback"],
  },
];

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
  const raw = process.env.HYPHER_OAUTH_CLIENTS_JSON;
  if (!raw) return DEFAULT_OAUTH_CLIENTS;
  try {
    const parsed = JSON.parse(raw) as RegisteredOAuthClient[];
    if (!Array.isArray(parsed)) return DEFAULT_OAUTH_CLIENTS;
    const clients = parsed.filter(
      (client) =>
        typeof client.clientId === "string" &&
        typeof client.name === "string" &&
        Array.isArray(client.redirectUris) &&
        client.redirectUris.every((uri) => typeof uri === "string")
    );
    return clients.length > 0 ? clients : DEFAULT_OAUTH_CLIENTS;
  } catch {
    return DEFAULT_OAUTH_CLIENTS;
  }
}

export function getRegisteredOAuthClient(clientId: string): RegisteredOAuthClient | null {
  return registeredOAuthClients().find((client) => client.clientId === clientId) ?? null;
}

export function isRedirectUriRegistered(client: RegisteredOAuthClient, redirectUri: string): boolean {
  return client.redirectUris.includes(redirectUri);
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
    clientName: client.name,
    codeChallenge,
    codeChallengeMethod: "S256",
    resource,
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
