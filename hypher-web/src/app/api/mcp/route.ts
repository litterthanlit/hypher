import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchAction, fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { ActivityEntry, AgentEvent, AnyObject, Handoff, Project, ProjectAction, ProjectMemory } from "@/types";
import {
  HYPHER_MCP_SCOPE,
  baseUrlFromRequest,
  mcpWwwAuthenticateChallenge,
  sha256Base64url,
} from "@/lib/oauthBridge";
import { canonicalizeOAuthResource } from "../../../../shared/oauthResources";
import { isRequestBodyTooLarge, readJsonWithLimit } from "@/lib/requestBody";
import {
  buildMcpToolResult,
  formatAgentEventWriteResult,
  getHypherMcpToolDescriptors,
  isMcpWriteTool,
  mcpToolNeedsProjectContext,
  parsePostAgentEventArgs,
  type HypherMcpContext,
  type HypherMcpProjectContext,
} from "@/lib/mcpTools";

export const runtime = "nodejs";
const MAX_BODY_BYTES = 25_000;

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: any;
};

function mcpRequestResource(req: NextRequest): string {
  const baseUrl = baseUrlFromRequest(req.url);
  return canonicalizeOAuthResource(baseUrl) ?? baseUrl;
}

function jsonRpc(id: JsonRpcRequest["id"], result: unknown, status = 200) {
  return NextResponse.json({ jsonrpc: "2.0", id: id ?? null, result }, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function jsonRpcError(id: JsonRpcRequest["id"], code: number, message: string, status = 200, headers?: HeadersInit) {
  return NextResponse.json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } }, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}

function authChallenge(req: NextRequest) {
  return mcpWwwAuthenticateChallenge(req.url);
}

function bearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

async function hasClerkSession(): Promise<boolean> {
  try {
    const { userId } = await auth();
    return Boolean(userId);
  } catch {
    return false;
  }
}

async function unauthenticatedMcpChallenge(req: NextRequest, id: JsonRpcRequest["id"]) {
  if (bearerToken(req) || await hasClerkSession()) {
    return null;
  }
  return jsonRpcError(id, -32001, "unauth", 401, {
    "WWW-Authenticate": authChallenge(req),
  });
}

function isMissingConvexFunctionError(err: unknown): boolean {
  return err instanceof Error && err.message.includes("Could not find public function");
}

function mapProject(row: any): Project | null {
  if (!row || row.kind !== "project") return null;
  return {
    id: String(row._id ?? row.id),
    kind: "project",
    name: row.name ?? "Untitled project",
    description: row.description ?? "",
    status: row.status ?? "active",
    priority: row.priority,
    blockers: row.blockers,
    lastActivity: row.lastActivity,
    githubRepo: row.githubRepo,
    githubLastSync: row.githubLastSync,
    createdAt: row.createdAt,
    modifiedAt: row.modifiedAt,
  };
}

async function getProjectContext(projectId: string, token: string): Promise<HypherMcpProjectContext> {
  const generationInput = await fetchQuery(
    (api as any).projectMemories.generationInput,
    { projectId: projectId as Id<"objects"> },
    { token }
  ) as {
    project: Project;
    items: AnyObject[];
    activities: ActivityEntry[];
    githubSummary?: string;
  };

  const [memories, actions, agentEvents, handoffs, subscription] = await Promise.all([
    fetchQuery((api as any).projectMemories.listForDashboard, {}, { token }) as Promise<ProjectMemory[]>,
    fetchQuery((api as any).actions.listForProject, { projectId: projectId as Id<"objects"> }, { token }) as Promise<ProjectAction[]>,
    fetchQuery((api as any).agentEvents.listForProject, { projectId: projectId as Id<"objects">, limit: 12 }, { token }) as Promise<AgentEvent[]>,
    fetchQuery((api as any).handoffs.listForProject, { projectId: projectId as Id<"objects">, limit: 6 }, { token }) as Promise<Handoff[]>,
    fetchQuery((api as any).subscriptions.getMine, {}, { token }) as Promise<{ status?: string; plan?: string } | null>,
  ]);

  return {
    project: generationInput.project,
    memory: memories.find((item) => item.projectId === projectId) ?? null,
    captures: generationInput.items,
    activity: generationInput.activities,
    actions,
    agentEvents,
    handoffs,
    subscription,
  };
}

async function getMcpContext(token: string, projectId?: string): Promise<HypherMcpContext> {
  const rows = await fetchQuery(api.objects.list, {}, { token }) as any[];
  const projects = rows.map(mapProject).filter((project): project is Project => Boolean(project));
  const projectContexts: HypherMcpContext["projectContexts"] = {};

  if (projectId) {
    projectContexts[projectId] = await getProjectContext(projectId, token);
  }

  return { projects, projectContexts };
}

function isHypherApiKey(token: string | null): token is string {
  return typeof token === "string" && token.startsWith("hyp_");
}

async function getMcpContextForApiKey(apiKey: string, projectId?: string): Promise<HypherMcpContext | null> {
  let data: { projects: Project[]; projectContext: HypherMcpProjectContext | null } | null;
  try {
    data = await fetchQuery((api as any).mcpApiKey.dataForApiKey, {
      key: apiKey,
      projectId,
    }) as { projects: Project[]; projectContext: HypherMcpProjectContext | null } | null;
  } catch (err) {
    if (isMissingConvexFunctionError(err)) {
      console.warn("[api/mcp] mcpApiKey.dataForApiKey is unavailable in the configured Convex backend");
      return null;
    }
    throw err;
  }
  if (!data) return null;

  return {
    projects: data.projects,
    projectContexts: projectId && data.projectContext ? { [projectId]: data.projectContext } : {},
  };
}

async function getMcpContextForAccessToken(accessToken: string, resource: string, projectId?: string): Promise<HypherMcpContext | null> {
  const tokenHash = sha256Base64url(accessToken);
  const now = Date.now();

  let validated: unknown;
  try {
    validated = await fetchMutation((api as any).oauth.validateAccessToken, {
      tokenHash,
      resource,
      scope: HYPHER_MCP_SCOPE,
      now,
    });
  } catch (err) {
    if (isMissingConvexFunctionError(err)) {
      console.warn("[api/mcp] oauth.validateAccessToken is unavailable in the configured Convex backend");
      return null;
    }
    throw err;
  }
  if (!validated) return null;

  let data: { projects: Project[]; projectContext: HypherMcpProjectContext | null } | null;
  try {
    data = await fetchQuery((api as any).oauthContext.dataForToken, {
      tokenHash,
      resource,
      scope: HYPHER_MCP_SCOPE,
      projectId,
      now,
    }) as { projects: Project[]; projectContext: HypherMcpProjectContext | null } | null;
  } catch (err) {
    if (isMissingConvexFunctionError(err)) {
      console.warn("[api/mcp] oauthContext.dataForToken is unavailable in the configured Convex backend");
      return null;
    }
    throw err;
  }
  if (!data) return null;

  return {
    projects: data.projects,
    projectContexts: projectId && data.projectContext ? { [projectId]: data.projectContext } : {},
  };
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(req: NextRequest) {
  const challenge = await unauthenticatedMcpChallenge(req, null);
  if (challenge) return challenge;

  return NextResponse.json({
    name: "hypher",
    protocol: "mcp",
    tools: getHypherMcpToolDescriptors().map(({ name, title, description, annotations }) => ({
      name,
      title,
      description,
      annotations,
    })),
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(req: NextRequest) {
  let body: JsonRpcRequest;
  try {
    body = await readJsonWithLimit<JsonRpcRequest>(req, MAX_BODY_BYTES);
  } catch (error) {
    if (isRequestBodyTooLarge(error)) {
      return jsonRpcError(null, -32700, "Request body too large", 413);
    }
    return jsonRpcError(null, -32700, "Parse error", 400);
  }

  if (body.method === "initialize" || body.method === "tools/list") {
    const challenge = await unauthenticatedMcpChallenge(req, body.id);
    if (challenge) return challenge;

    if (body.method === "initialize") {
      return jsonRpc(body.id, {
        protocolVersion: "2024-11-05",
        serverInfo: { name: "hypher", version: "0.1.0" },
        capabilities: { tools: {} },
      });
    }

    return jsonRpc(body.id, { tools: getHypherMcpToolDescriptors() });
  }

  if (body.method !== "tools/call") {
    return jsonRpcError(body.id, -32601, "Method not found");
  }

  const toolName = String(body.params?.name ?? "");
  const args = (body.params?.arguments ?? {}) as Record<string, unknown>;
  const projectId = typeof args.projectId === "string" ? args.projectId : undefined;

  try {
    const accessToken = bearerToken(req);
    const usingApiKey = isHypherApiKey(accessToken);
    let context: HypherMcpContext | null = null;

    if (usingApiKey) {
      context = await getMcpContextForApiKey(
        accessToken,
        mcpToolNeedsProjectContext(toolName) ? projectId : undefined
      );
    } else if (accessToken) {
      context = await getMcpContextForAccessToken(
        accessToken,
        mcpRequestResource(req),
        mcpToolNeedsProjectContext(toolName) ? projectId : undefined
      );
    } else {
      const { userId, getToken } = await auth();
      if (userId) {
        const convexToken = await getToken({ template: "convex" });
        if (convexToken) {
          context = await getMcpContext(
            convexToken,
            mcpToolNeedsProjectContext(toolName) ? projectId : undefined
          );
        }
      }
    }

    if (!context) {
      return jsonRpcError(body.id, -32001, "unauth", 401, {
        "WWW-Authenticate": authChallenge(req),
      });
    }

    if (isMcpWriteTool(toolName)) {
      if (toolName !== "post_agent_event") {
        throw new Error("unknown-tool");
      }
      const parsed = parsePostAgentEventArgs(args);
      const writeArgs = {
        payload: parsed.payload,
        projectId: parsed.projectId,
      };
      let result: {
        ok: boolean;
        status?: number;
        error?: string;
        eventId?: string;
        matchedProjectId?: string | null;
        matchedProjectName?: string;
        needsReview?: boolean;
      };
      if (usingApiKey) {
        result = await fetchAction((api as any).agentEvents.createFromApiRequest, {
          apiKey: accessToken,
          payload: parsed.payload,
        }) as typeof result;
      } else if (accessToken) {
        result = await fetchAction((api as any).agentEvents.createFromOAuthRequest, {
          tokenHash: sha256Base64url(accessToken),
          resource: mcpRequestResource(req),
          scope: HYPHER_MCP_SCOPE,
          now: Date.now(),
          ...writeArgs,
        }) as typeof result;
      } else {
        const { getToken } = await auth();
        const convexToken = await getToken({ template: "convex" });
        if (!convexToken) {
          return jsonRpcError(body.id, -32001, "unauth", 401, {
            "WWW-Authenticate": authChallenge(req),
          });
        }
        result = await fetchAction(
          (api as any).agentEvents.createFromSession,
          writeArgs,
          { token: convexToken }
        ) as typeof result;
      }
      if (result.status === 401) {
        return jsonRpcError(body.id, -32001, "unauth", 401, {
          "WWW-Authenticate": authChallenge(req),
        });
      }
      return jsonRpc(body.id, formatAgentEventWriteResult(result));
    }

    return jsonRpc(body.id, buildMcpToolResult(toolName, args, context));
  } catch (err) {
    console.error("[api/mcp]", err);
    const message = err instanceof Error ? err.message : "tool-call-failed";
    return jsonRpcError(body.id, -32000, message);
  }
}
