import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  HYPHER_CURSOR_OAUTH_CLIENT_ID,
  HYPHER_MCP_URL,
  buildCursorMcpInstallDeeplink,
  cursorConnectionStatus,
  hypherMcpServerConfig,
} from "./cursorPlugin";

describe("Cursor plugin connect helpers", () => {
  it("builds a Cursor MCP install deeplink for the production Hypher server", () => {
    const deeplink = buildCursorMcpInstallDeeplink();
    expect(deeplink.startsWith("cursor://anysphere.cursor-deeplink/mcp/install?name=hypher&config=")).toBe(true);
    expect(hypherMcpServerConfig()).toEqual({
      url: HYPHER_MCP_URL,
      auth: {
        CLIENT_ID: HYPHER_CURSOR_OAUTH_CLIENT_ID,
        scopes: ["hypher.projects.read"],
      },
    });
  });

  it("treats a live hypher-cursor OAuth token as connected", () => {
    expect(
      cursorConnectionStatus(
        [
          {
            clientId: "hypher-cursor",
            expiresAt: 2_000,
            lastUsedAt: 1_500,
          },
        ],
        1_000
      )
    ).toEqual({ connected: true, lastUsedAt: 1_500 });
    expect(
      cursorConnectionStatus(
        [{ clientId: "hypher-cursor", expiresAt: 500, revokedAt: undefined }],
        1_000
      )
    ).toEqual({ connected: false });
  });

  it("keeps the plugin mcp.json pointed at the same production MCP URL and client", () => {
    const mcp = JSON.parse(
      readFileSync(join(process.cwd(), "../extensions/cursor/mcp.json"), "utf8")
    ) as {
      mcpServers: { hypher: { url: string; auth: { CLIENT_ID: string } } };
    };
    expect(mcp.mcpServers.hypher.url).toBe(HYPHER_MCP_URL);
    expect(mcp.mcpServers.hypher.auth.CLIENT_ID).toBe(HYPHER_CURSOR_OAUTH_CLIENT_ID);
  });
});
