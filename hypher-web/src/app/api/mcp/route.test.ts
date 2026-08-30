import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(async () => ({ userId: null, getToken: async () => null })),
}));

vi.mock("convex/nextjs", () => ({
  fetchAction: vi.fn(),
  fetchMutation: vi.fn(),
  fetchQuery: vi.fn(),
}));

vi.mock("../../../../convex/_generated/api", () => ({
  api: {
    objects: { list: "objects.list" },
    oauth: { validateAccessToken: "oauth.validateAccessToken" },
    oauthContext: { dataForToken: "oauthContext.dataForToken" },
  },
}));

function jsonRpcRequest(url: string, method: string, token?: string): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method }),
  });
}

describe("MCP HTTP auth challenge", () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  it("returns 401 WWW-Authenticate on unauthenticated initialize, tools/list, and GET", async () => {
    const { GET, POST } = await import("./route");
    const expectedChallenge =
      'Bearer resource_metadata="https://www.hypher.app/.well-known/oauth-protected-resource/api/mcp", scope="hypher.projects.read"';

    for (const method of ["initialize", "tools/list"] as const) {
      const response = await POST(jsonRpcRequest("https://www.hypher.app/api/mcp", method));
      expect(response.status).toBe(401);
      expect(response.headers.get("WWW-Authenticate")).toBe(expectedChallenge);
      await expect(response.json()).resolves.toMatchObject({
        jsonrpc: "2.0",
        id: 1,
        error: { code: -32001, message: "unauth" },
      });
    }

    const getResponse = await GET(new NextRequest("https://www.hypher.app/api/mcp"));
    expect(getResponse.status).toBe(401);
    expect(getResponse.headers.get("WWW-Authenticate")).toBe(expectedChallenge);
    await expect(getResponse.json()).resolves.toMatchObject({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32001, message: "unauth" },
    });
  });

  it("skips the challenge when a Bearer token is present", async () => {
    const { GET, POST } = await import("./route");
    const initialize = await POST(
      jsonRpcRequest("https://www.hypher.app/api/mcp", "initialize", "hya_test")
    );
    expect(initialize.status).toBe(200);
    expect(initialize.headers.get("WWW-Authenticate")).toBeNull();
    await expect(initialize.json()).resolves.toMatchObject({
      jsonrpc: "2.0",
      result: { serverInfo: { name: "hypher" } },
    });

    const listed = await POST(
      jsonRpcRequest("https://www.hypher.app/api/mcp", "tools/list", "hya_test")
    );
    expect(listed.status).toBe(200);
    expect(listed.headers.get("WWW-Authenticate")).toBeNull();

    const getResponse = await GET(
      new NextRequest("https://www.hypher.app/api/mcp", {
        headers: { authorization: "Bearer hya_test" },
      })
    );
    expect(getResponse.status).toBe(200);
    expect(getResponse.headers.get("WWW-Authenticate")).toBeNull();
  });

  it("points /mcp initialize at the RFC 9728 /mcp resource_metadata URL", async () => {
    const { POST } = await import("./route");
    const response = await POST(jsonRpcRequest("https://www.hypher.app/mcp", "initialize"));
    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toBe(
      'Bearer resource_metadata="https://www.hypher.app/.well-known/oauth-protected-resource/mcp", scope="hypher.projects.read"'
    );
  });

  it("lets OPTIONS succeed without a token", async () => {
    const { OPTIONS } = await import("./route");
    const response = await OPTIONS();
    expect(response.status).toBe(204);
    expect(response.headers.get("WWW-Authenticate")).toBeNull();
  });
});
