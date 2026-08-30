import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { GET } from "./route";

describe("RFC 9728 /mcp protected resource metadata", () => {
  const previousAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  afterEach(() => {
    if (previousAppUrl === undefined) {
      delete process.env.NEXT_PUBLIC_APP_URL;
    } else {
      process.env.NEXT_PUBLIC_APP_URL = previousAppUrl;
    }
  });

  it("serves the same MCP metadata as the /api/mcp well-known", async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;

    const response = await GET(
      new NextRequest("https://www.hypher.app/.well-known/oauth-protected-resource/mcp")
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      resource: "https://www.hypher.app/api/mcp",
      authorization_servers: ["https://www.hypher.app"],
      scopes_supported: ["hypher.projects.read"],
    });
  });
});
