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
    mcpApiKey: { dataForApiKey: "mcpApiKey.dataForApiKey" },
    projectMemoryMcp: {
      writeCompiledFromApiRequest: "projectMemoryMcp.writeCompiledFromApiRequest",
      writeCompiledFromOAuthRequest: "projectMemoryMcp.writeCompiledFromOAuthRequest",
      writeCompiledFromSession: "projectMemoryMcp.writeCompiledFromSession",
    },
    agentEvents: {
      createFromApiRequest: "agentEvents.createFromApiRequest",
      createFromOAuthRequest: "agentEvents.createFromOAuthRequest",
      createFromSession: "agentEvents.createFromSession",
    },
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
    const listedBody = await listed.json() as { result?: { tools?: Array<{ name: string }> } };
    const names = listedBody.result?.tools?.map((tool) => tool.name) ?? [];
    expect(names).toContain("get_synthesis_input");
    expect(names).toContain("write_project_memory");
    expect(names).toContain("post_agent_event");
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

describe("MCP agent-side synthesis", () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    vi.clearAllMocks();
  });

  it("writes compiled memory over a hyp_ API key without calling Anthropic", async () => {
    const { fetchAction, fetchQuery } = await import("convex/nextjs");
    vi.mocked(fetchQuery).mockResolvedValue({
      projects: [{ id: "p1", name: "Hypher", kind: "project" }],
      projectContext: null,
    });
    vi.mocked(fetchAction).mockResolvedValue({
      ok: true,
      status: 200,
      projectId: "p1",
      identityKind: "compiled",
      model: "agent-synthesis:cursor",
    });

    const { POST } = await import("./route");
    const response = await POST(new NextRequest("https://www.hypher.app/api/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer hyp_testkey",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "write_project_memory",
          arguments: {
            projectId: "p1",
            memory: {
              summary: "Hypher stores the note; agents compile identity on their model.",
              currentDirection: "Product stays dump → one note → writeback.",
              recentChanges: ["Added agent-side synthesis tools."],
              openQuestions: [],
              nextActions: [{
                title: "Call get_project_context next session",
                rationale: "The stored note should be warmer.",
              }],
            },
          },
        },
      }),
    }));

    expect(response.status).toBe(200);
    expect(fetchAction).toHaveBeenCalled();
    const actionArgs = vi.mocked(fetchAction).mock.calls[0]?.[1] as {
      apiKey?: string;
      projectId?: string;
      compiledJson?: string;
    };
    expect(actionArgs.apiKey).toBe("hyp_testkey");
    expect(actionArgs.projectId).toBe("p1");
    expect(actionArgs.compiledJson).toContain("Hypher stores the note");
    await expect(response.json()).resolves.toMatchObject({
      jsonrpc: "2.0",
      result: {
        structuredContent: {
          ok: true,
          projectId: "p1",
          identityKind: "compiled",
        },
      },
    });
  });

  it("returns synthesis input over a hyp_ API key from existing project context", async () => {
    const { fetchQuery } = await import("convex/nextjs");
    vi.mocked(fetchQuery).mockResolvedValue({
      projects: [{ id: "p1", name: "Hypher", kind: "project", status: "active" }],
      projectContext: {
        project: {
          id: "p1",
          kind: "project",
          name: "Hypher",
          description: "Context layer",
          status: "active",
          createdAt: 1,
          modifiedAt: 100,
        },
        memory: {
          id: "m1",
          projectId: "p1",
          summary: "No summary captured yet.",
          currentDirection: "",
          recentChanges: [],
          openQuestions: [],
          nextActions: [],
          generatedAt: 20,
          sourceUpdatedAt: 20,
          model: "generate+dump",
        },
        captures: [{
          id: "n1",
          kind: "note",
          content: "Don't widen OAuth. Pulse stays three panels.",
          maturity: "fleeting",
          projectId: "p1",
          createdAt: 1,
          modifiedAt: 30,
        }],
        actions: [],
        agentEvents: [],
        handoffs: [],
        subscription: { status: "active", plan: "pro_monthly" },
      },
    });

    const { POST } = await import("./route");
    const response = await POST(new NextRequest("https://www.hypher.app/api/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer hyp_testkey",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "get_synthesis_input",
          arguments: { projectId: "p1" },
        },
      }),
    }));

    expect(response.status).toBe(200);
    const body = await response.json() as {
      result?: { structuredContent?: { needsSynthesis?: boolean; prompt?: string } };
    };
    expect(body.result?.structuredContent?.needsSynthesis).toBe(true);
    expect(body.result?.structuredContent?.prompt).toContain("PROJECT_MEMORY_INPUT_JSON");
    expect(body.result?.structuredContent?.prompt).toContain("Don't widen OAuth");
  });
});
