import {
  CURSOR_OAUTH_CLIENT,
  HYPHER_CURSOR_OAUTH_CLIENT_ID,
  HYPHER_MCP_SCOPE,
  isCursorOAuthClientId,
} from "../../shared/oauthClients";

export const HYPHER_PUBLIC_ORIGIN = "https://hypher.app";
export const HYPHER_MCP_URL = "https://www.hypher.app/api/mcp";
export const HYPHER_CURSOR_INTEGRATIONS_URL = `${HYPHER_PUBLIC_ORIGIN}/app/settings/integrations`;
export { HYPHER_CURSOR_OAUTH_CLIENT_ID, CURSOR_OAUTH_CLIENT };

export interface CursorOAuthConnection {
  clientId: string;
  revokedAt?: number;
  expiresAt: number;
  lastUsedAt?: number;
}

export function hypherMcpServerConfig(mcpUrl = HYPHER_MCP_URL) {
  return {
    url: mcpUrl,
    auth: {
      CLIENT_ID: HYPHER_CURSOR_OAUTH_CLIENT_ID,
      scopes: [HYPHER_MCP_SCOPE],
    },
  };
}

function encodeJsonBase64(value: object): string {
  const json = JSON.stringify(value);
  if (typeof Buffer !== "undefined") {
    return Buffer.from(json).toString("base64");
  }
  return btoa(json);
}

export function buildCursorMcpInstallDeeplink(mcpUrl = HYPHER_MCP_URL): string {
  const encoded = encodeJsonBase64(hypherMcpServerConfig(mcpUrl));
  return `cursor://anysphere.cursor-deeplink/mcp/install?name=hypher&config=${encodeURIComponent(encoded)}`;
}

export function cursorConnectionStatus(
  connections: CursorOAuthConnection[],
  now: number
): { connected: boolean; lastUsedAt?: number } {
  const active = connections.filter(
    (connection) =>
      isCursorOAuthClientId(connection.clientId) &&
      connection.revokedAt === undefined &&
      connection.expiresAt > now
  );
  if (active.length === 0) return { connected: false };
  const lastUsedAt = active
    .map((connection) => connection.lastUsedAt)
    .filter((value): value is number => typeof value === "number")
    .sort((a, b) => b - a)[0];
  return { connected: true, lastUsedAt };
}
