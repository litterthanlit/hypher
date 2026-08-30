import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { POST } from "./route";

function registerRequest(body: unknown): NextRequest {
  return new NextRequest("https://www.hypher.app/oauth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("RFC 7591 dynamic client registration", () => {
  it("reuses hypher-grok for Cursor MCP redirect URIs without a client secret", async () => {
    const response = await POST(
      registerRequest({
        redirect_uris: [
          "http://localhost:8787/callback",
          "https://www.cursor.com/agents/mcp/oauth/callback",
          "https://attacker.example/callback",
        ],
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code"],
        response_types: ["code"],
      })
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toMatchObject({
      client_id: "hypher-grok",
      client_name: "Grok",
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code"],
      response_types: ["code"],
      code_challenge_methods: ["S256"],
      redirect_uris: [
        "http://localhost:8787/callback",
        "https://www.cursor.com/agents/mcp/oauth/callback",
      ],
    });
    expect(body.client_secret).toBeUndefined();
    expect(typeof body.client_id_issued_at).toBe("number");
  });

  it("rejects unknown redirects including invented grokbot URIs", async () => {
    const response = await POST(
      registerRequest({
        redirect_uris: ["grokbot://oauth/callback", "https://attacker.example/callback"],
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code"],
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "invalid_redirect_uri",
      error_description: "redirect_uris must intersect the registered Cursor MCP callbacks.",
    });
  });
});
