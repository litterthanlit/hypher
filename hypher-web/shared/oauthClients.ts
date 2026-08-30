export type RegisteredOAuthClient = {
  clientId: string;
  name: string;
  redirectUris: string[];
};

export const HYPHER_MCP_SCOPE = "hypher.projects.read";
export const HYPHER_CURSOR_OAUTH_CLIENT_ID = "hypher-cursor";
export const HYPHER_GROK_OAUTH_CLIENT_ID = "hypher-grok";

export const CHATGPT_OAUTH_CLIENT: RegisteredOAuthClient = {
  clientId: "https://chatgpt.com/oauth/client.json",
  name: "ChatGPT",
  redirectUris: ["https://chatgpt.com/connector/oauth/callback"],
};

/** Cursor desktop, cloud agents, and custom-scheme MCP OAuth callbacks. */
export const CURSOR_MCP_OAUTH_REDIRECT_URIS = [
  "http://localhost:8787/callback",
  "https://www.cursor.com/agents/mcp/oauth/callback",
  "cursor://anysphere.cursor-mcp/oauth/callback",
] as const;

export const CURSOR_OAUTH_CLIENT: RegisteredOAuthClient = {
  clientId: HYPHER_CURSOR_OAUTH_CLIENT_ID,
  name: "Cursor",
  redirectUris: [...CURSOR_MCP_OAUTH_REDIRECT_URIS],
};

/** Public client for Grok Bot (a Cursor agent). Same MCP callbacks as Cursor. */
export const GROK_OAUTH_CLIENT: RegisteredOAuthClient = {
  clientId: HYPHER_GROK_OAUTH_CLIENT_ID,
  name: "Grok",
  redirectUris: [...CURSOR_MCP_OAUTH_REDIRECT_URIS],
};

export const DEFAULT_OAUTH_CLIENTS: RegisteredOAuthClient[] = [
  CHATGPT_OAUTH_CLIENT,
  CURSOR_OAUTH_CLIENT,
  GROK_OAUTH_CLIENT,
];

export function parseOAuthClientsJson(raw: string | undefined): RegisteredOAuthClient[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as RegisteredOAuthClient[];
    if (!Array.isArray(parsed)) return null;
    const clients = parsed.filter(
      (client) =>
        typeof client.clientId === "string" &&
        typeof client.name === "string" &&
        Array.isArray(client.redirectUris) &&
        client.redirectUris.every((uri) => typeof uri === "string")
    );
    return clients.length > 0 ? clients : null;
  } catch {
    return null;
  }
}

export function registeredOAuthClients(
  raw: string | undefined = typeof process !== "undefined" ? process.env.HYPHER_OAUTH_CLIENTS_JSON : undefined
): RegisteredOAuthClient[] {
  return parseOAuthClientsJson(raw) ?? DEFAULT_OAUTH_CLIENTS;
}

export function getRegisteredOAuthClient(
  clientId: string,
  clients: RegisteredOAuthClient[] = registeredOAuthClients()
): RegisteredOAuthClient | null {
  return clients.find((client) => client.clientId === clientId) ?? null;
}

export function isRedirectUriRegistered(client: RegisteredOAuthClient, redirectUri: string): boolean {
  return client.redirectUris.includes(redirectUri);
}

export function isCursorOAuthClientId(clientId: string): boolean {
  return clientId === HYPHER_CURSOR_OAUTH_CLIENT_ID;
}

export function isGrokOAuthClientId(clientId: string): boolean {
  return clientId === HYPHER_GROK_OAUTH_CLIENT_ID;
}
