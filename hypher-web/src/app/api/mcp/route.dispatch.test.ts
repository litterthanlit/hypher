import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sha256Base64url } from "@/lib/oauthBridge";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(async () => ({ userId: null, getToken: async () => null })),
}));

vi.mock("convex/nextjs", () => ({
  fetchAction: vi.fn(),
  fetchMutation: vi.fn(),
  fetchQuery: vi.fn(),
}));

vi.mock("../../../../convex/_generated/api", () => {
  const refs = (module: string, names: string[]) =>
    Object.fromEntries(names.map((name) => [name, `${module}.${name}`]));
  const kinds = (prefix: string) => [`${prefix}FromApiRequest`, `${prefix}FromOAuthRequest`, `${prefix}FromSession`];
  return {
    api: {
      objects: refs("objects", ["list"]),
      oauth: refs("oauth", ["validateAccessToken"]),
      oauthContext: refs("oauthContext", ["dataForToken"]),
      mcpApiKey: refs("mcpApiKey", ["dataForApiKey"]),
      projectMemories: refs("projectMemories", ["generationInput", "listForDashboard"]),
      actions: refs("actions", ["listForProject"]),
      handoffs: refs("handoffs", ["listForProject"]),
      subscriptions: refs("subscriptions", ["getMine"]),
      projectMemoryMcp: refs("projectMemoryMcp", kinds("writeCompiled")),
      agentEvents: refs("agentEvents", ["listForProject", ...kinds("create")]),
      structuredHandoffs: refs("structuredHandoffs", [...kinds("resume"), ...kinds("acknowledge")]),
    },
  };
});

const OAUTH_TOKEN = "hya_oauth_access";
const API_KEY = "hyp_testkey";
const CHALLENGE =
  'Bearer resource_metadata="https://www.hypher.app/.well-known/oauth-protected-resource/api/mcp", scope="hypher.projects.read"';

type Kind = "apiKey" | "oauth" | "session";

async function setCaller(kind: Kind) {
  const { auth } = await import("@clerk/nextjs/server");
  vi.mocked(auth).mockImplementation((async () => (kind === "session"
    ? { userId: "user_1", getToken: async () => "convex-session-token" }
    : { userId: null, getToken: async () => null })) as never);
}

function toolCall(kind: Kind, name: string, args: Record<string, unknown>): NextRequest {
  const token = kind === "apiKey" ? API_KEY : kind === "oauth" ? OAUTH_TOKEN : null;
  return new NextRequest("https://www.hypher.app/api/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 7, method: "tools/call", params: { name, arguments: args } }),
  });
}

const tools = [
  {
    name: "acknowledge_handoff",
    module: "structuredHandoffs.acknowledge",
    args: { projectId: "p1", receiptId: "r1", revision: 2, destination: "claude-code" },
    result: { ok: true, status: 200, code: "acknowledged", revision: 2, receiptId: "r1", destination: "claude-code" },
  },
  {
    name: "prepare_handoff",
    module: "structuredHandoffs.resume",
    args: { projectId: "p1", destination: "claude-code", currentRepo: { branch: "main", commit: "abc123", dirty: false } },
    result: { ok: true, status: 200, code: "prepared", revision: 2, receiptId: "r1", destination: "claude-code" },
  },
  {
    name: "write_project_memory",
    module: "projectMemoryMcp.writeCompiled",
    args: { projectId: "p1", memory: { summary: "One note." } },
    result: { ok: true, status: 200, projectId: "p1", identityKind: "compiled", model: "agent-synthesis:cursor" },
  },
  {
    name: "post_agent_event",
    module: "agentEvents.create",
    args: { projectId: "p1", kind: "build_log", title: "Ran tests", body: "All green." },
    result: { ok: true, status: 200, eventId: "e1", matchedProjectId: "p1", matchedProjectName: "Hypher", needsReview: false },
  },
];

const suffix: Record<Kind, string> = { apiKey: "FromApiRequest", oauth: "FromOAuthRequest", session: "FromSession" };

describe("MCP tools/call caller dispatch", () => {
  beforeEach(async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    vi.clearAllMocks();
    const { fetchMutation, fetchQuery } = await import("convex/nextjs");
    vi.mocked(fetchMutation).mockResolvedValue({ ok: true } as never);
    vi.mocked(fetchQuery).mockImplementation((async (ref: unknown) => {
      if (ref === "mcpApiKey.dataForApiKey" || ref === "oauthContext.dataForToken") {
        return { projects: [{ id: "p1", name: "Hypher", kind: "project" }], projectContext: null };
      }
      if (ref === "projectMemories.generationInput") return { project: { id: "p1" }, items: [], activities: [] };
      if (ref === "subscriptions.getMine") return null;
      return [];
    }) as never);
  });

  for (const tool of tools) {
    for (const kind of ["apiKey", "oauth", "session"] as const) {
      it(`${tool.name} over ${kind} reaches ${tool.module}${suffix[kind]}`, async () => {
        await setCaller(kind);
        const { fetchAction } = await import("convex/nextjs");
        vi.mocked(fetchAction).mockResolvedValue(tool.result as never);
        const { POST } = await import("./route");

        const response = await POST(toolCall(kind, tool.name, tool.args));

        expect(response.status).toBe(200);
        expect(fetchAction).toHaveBeenCalledTimes(1);
        const [ref, actionArgs, options] = vi.mocked(fetchAction).mock.calls[0] as unknown as [string, Record<string, unknown>, unknown];
        expect(ref).toBe(`${tool.module}${suffix[kind]}`);
        if (kind === "apiKey") {
          expect(actionArgs.apiKey).toBe(API_KEY);
          expect(options).toBeUndefined();
        } else if (kind === "oauth") {
          expect(actionArgs).toMatchObject({
            tokenHash: sha256Base64url(OAUTH_TOKEN),
            resource: "https://www.hypher.app",
            scope: "hypher.projects.read",
          });
          expect(typeof actionArgs.now).toBe("number");
          expect(actionArgs.apiKey).toBeUndefined();
          expect(options).toBeUndefined();
        } else {
          expect(actionArgs.apiKey).toBeUndefined();
          expect(actionArgs.tokenHash).toBeUndefined();
          expect(options).toEqual({ token: "convex-session-token" });
        }
        const body = await response.json() as { result?: { structuredContent?: { ok?: boolean } } };
        expect(body.result?.structuredContent?.ok).toBe(true);
      });
    }
  }

  it("post_agent_event over an API key sends the payload only; OAuth and session also send projectId", async () => {
    const { fetchAction } = await import("convex/nextjs");
    const { POST } = await import("./route");
    const args = tools[3].args;
    for (const kind of ["apiKey", "oauth", "session"] as const) {
      vi.mocked(fetchAction).mockClear();
      await setCaller(kind);
      vi.mocked(fetchAction).mockResolvedValue(tools[3].result as never);
      await POST(toolCall(kind, "post_agent_event", args));
      const actionArgs = vi.mocked(fetchAction).mock.calls[0]?.[1] as Record<string, unknown>;
      expect((actionArgs.payload as { projectId?: string }).projectId).toBe("p1");
      if (kind === "apiKey") expect(Object.keys(actionArgs).sort()).toEqual(["apiKey", "payload"]);
      else expect(actionArgs.projectId).toBe("p1");
    }
  });

  it("maps a 401 from any write action to the JSON-RPC auth challenge", async () => {
    const { fetchAction } = await import("convex/nextjs");
    const { POST } = await import("./route");
    for (const tool of tools) {
      for (const kind of ["apiKey", "oauth", "session"] as const) {
        await setCaller(kind);
        vi.mocked(fetchAction).mockResolvedValue({ ok: false, status: 401, error: "Unauthorized" } as never);
        const response = await POST(toolCall(kind, tool.name, tool.args));
        expect(response.status).toBe(401);
        expect(response.headers.get("WWW-Authenticate")).toBe(CHALLENGE);
        await expect(response.json()).resolves.toEqual({ jsonrpc: "2.0", id: 7, error: { code: -32001, message: "unauth" } });
      }
    }
  });

  it("passes a rate-limited write through as a tool result, not an auth error", async () => {
    await setCaller("apiKey");
    const { fetchAction } = await import("convex/nextjs");
    vi.mocked(fetchAction).mockResolvedValue({ ok: false, status: 429, error: "Rate limited" } as never);
    const { POST } = await import("./route");
    const response = await POST(toolCall("apiKey", "write_project_memory", tools[2].args));
    expect(response.status).toBe(200);
    const body = await response.json() as { result?: { structuredContent?: unknown; content?: Array<{ text?: string }> } };
    expect(body.result?.structuredContent).toEqual({ ok: false, error: "Rate limited" });
    expect(body.result?.content?.[0]?.text).toBe("Rate limited");
  });

  it("returns the auth challenge before any action when no caller resolves", async () => {
    await setCaller("session");
    const { auth } = await import("@clerk/nextjs/server");
    vi.mocked(auth).mockImplementation((async () => ({ userId: "user_1", getToken: async () => null })) as never);
    const { fetchAction } = await import("convex/nextjs");
    const { POST } = await import("./route");
    const response = await POST(toolCall("session", "post_agent_event", tools[3].args));
    expect(response.status).toBe(401);
    expect(fetchAction).not.toHaveBeenCalled();
  });

  it("prepare_handoff without a destination stays a read tool", async () => {
    await setCaller("apiKey");
    const { fetchAction } = await import("convex/nextjs");
    const { POST } = await import("./route");
    const response = await POST(toolCall("apiKey", "prepare_handoff", { projectId: "p1" }));
    expect(response.status).toBe(200);
    expect(fetchAction).not.toHaveBeenCalled();
  });

  it("does not treat Object prototype keys as registered tools", async () => {
    await setCaller("apiKey");
    const { fetchAction } = await import("convex/nextjs");
    const { POST } = await import("./route");
    const response = await POST(toolCall("apiKey", "constructor", {}));
    expect(fetchAction).not.toHaveBeenCalled();
    const body = await response.json() as { error?: { code: number }; result?: unknown };
    expect(body.error?.code ?? 0).not.toBe(-32001);
  });
});
