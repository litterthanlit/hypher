import { describe, expect, it } from "vitest";
import {
  CURSOR_MCP_OAUTH_REDIRECT_URIS,
  CURSOR_OAUTH_CLIENT,
  DEFAULT_OAUTH_CLIENTS,
  GROK_OAUTH_CLIENT,
  HYPHER_CURSOR_OAUTH_CLIENT_ID,
  HYPHER_GROK_OAUTH_CLIENT_ID,
  getRegisteredOAuthClient,
  isGrokOAuthClientId,
  isRedirectUriRegistered,
  registeredOAuthClients,
} from "./oauthClients";

describe("DEFAULT_OAUTH_CLIENTS registration", () => {
  it("registers hypher-cursor and hypher-grok as public clients", () => {
    const ids = DEFAULT_OAUTH_CLIENTS.map((client) => client.clientId);
    expect(ids).toContain(HYPHER_CURSOR_OAUTH_CLIENT_ID);
    expect(ids).toContain(HYPHER_GROK_OAUTH_CLIENT_ID);
    expect(getRegisteredOAuthClient("hypher-cursor")).toEqual(CURSOR_OAUTH_CLIENT);
    expect(getRegisteredOAuthClient("hypher-grok")).toEqual(GROK_OAUTH_CLIENT);
    expect(isGrokOAuthClientId("hypher-grok")).toBe(true);
    expect(isGrokOAuthClientId("hypher-cursor")).toBe(false);
  });

  it("loads hypher-grok from the default registry when HYPHER_OAUTH_CLIENTS_JSON is unset", () => {
    expect(registeredOAuthClients(undefined).map((client) => client.clientId)).toEqual([
      "https://chatgpt.com/oauth/client.json",
      "hypher-cursor",
      "hypher-grok",
    ]);
  });
});

describe("Grok and Cursor MCP redirect allowlists", () => {
  it("allows the documented Cursor MCP callbacks on both hypher-grok and hypher-cursor", () => {
    expect([...CURSOR_MCP_OAUTH_REDIRECT_URIS]).toEqual([
      "http://localhost:8787/callback",
      "https://www.cursor.com/agents/mcp/oauth/callback",
      "cursor://anysphere.cursor-mcp/oauth/callback",
    ]);
    expect(GROK_OAUTH_CLIENT.redirectUris).toEqual([...CURSOR_MCP_OAUTH_REDIRECT_URIS]);
    expect(CURSOR_OAUTH_CLIENT.redirectUris).toEqual([...CURSOR_MCP_OAUTH_REDIRECT_URIS]);

    for (const redirectUri of CURSOR_MCP_OAUTH_REDIRECT_URIS) {
      expect(isRedirectUriRegistered(GROK_OAUTH_CLIENT, redirectUri)).toBe(true);
      expect(isRedirectUriRegistered(CURSOR_OAUTH_CLIENT, redirectUri)).toBe(true);
    }
  });

  it("rejects redirects that are not on the Cursor MCP allowlist", () => {
    expect(isRedirectUriRegistered(GROK_OAUTH_CLIENT, "https://chatgpt.com/connector/oauth/callback")).toBe(
      false
    );
    expect(isRedirectUriRegistered(GROK_OAUTH_CLIENT, "https://attacker.example/callback")).toBe(false);
    expect(isRedirectUriRegistered(GROK_OAUTH_CLIENT, "grokbot://oauth/callback")).toBe(false);
    expect(isRedirectUriRegistered(CURSOR_OAUTH_CLIENT, "http://localhost:3000/callback")).toBe(false);
  });
});
