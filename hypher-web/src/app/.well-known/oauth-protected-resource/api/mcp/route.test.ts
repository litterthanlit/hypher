import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { GET } from "./route";

describe("RFC 9728 path-appended protected resource metadata", () => {
  const previousAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  afterEach(() => {
    if (previousAppUrl === undefined) {
      delete process.env.NEXT_PUBLIC_APP_URL;
    } else {
      process.env.NEXT_PUBLIC_APP_URL = previousAppUrl;
    }
  });

  it("identifies the MCP server URL for www and apex origins", async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;

    const www = await GET(
      new NextRequest("https://www.hypher.app/.well-known/oauth-protected-resource/api/mcp")
    );
    expect(www.status).toBe(200);
    await expect(www.json()).resolves.toMatchObject({
      resource: "https://www.hypher.app/api/mcp",
      authorization_servers: ["https://www.hypher.app"],
    });

    const apex = await GET(
      new NextRequest("https://hypher.app/.well-known/oauth-protected-resource/api/mcp")
    );
    expect(apex.status).toBe(200);
    await expect(apex.json()).resolves.toMatchObject({
      resource: "https://hypher.app/api/mcp",
      authorization_servers: ["https://hypher.app"],
    });
  });
});
