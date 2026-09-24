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
import { PACKET_AGENT_EVENT_FETCH_LIMIT, prioritizeAgentEventsForPacket } from "../../../../shared/projectMemoryGenerate";
import { hydratePacketAgentEvents } from "@/lib/projectContext";
import { isRequestBodyTooLarge, readJsonWithLimit } from "@/lib/requestBody";
import {
  buildMcpToolResult,
  formatAgentEventWriteResult,
  formatHandoffAcknowledgeResult,
  formatHandoffResumeResult,
  formatWriteProjectMemoryResult,
  getHypherMcpToolDescriptors,
  isMcpWriteTool,
  isStructuredHandoffResume,
  mcpToolNeedsProjectContext,
  parseHandoffResumeArgs,
  parseHandoffAcknowledgeArgs,
  parsePostAgentEventArgs,
  parseWriteProjectMemoryArgs,
  type HypherMcpContext,
  type HypherMcpProjectContext,
  type HypherMcpToolResult,
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

function packetAgentEvents(
  events: AgentEvent[],
  memory?: ProjectMemory | null,
  captures: AnyObject[] = [],
): AgentEvent[] {
  return hydratePacketAgentEvents(
    prioritizeAgentEventsForPacket(events, PACKET_AGENT_EVENT_FETCH_LIMIT),
    memory,
    captures,
  );
}

async function getProjectContext(projectId: string, token: string): Promise<HypherMcpProjectContext> {
  const generationInput = await fetchQuery(
    api.projectMemories.generationInput,
    { projectId: projectId as Id<"objects"> },
    { token }
  ) as {
    project: Project;
    items: AnyObject[];
    activities: ActivityEntry[];
    githubSummary?: string;
  };

  const [memories, actions, agentEvents, handoffs, subscription] = await Promise.all([
    fetchQuery(api.projectMemories.listForDashboard, {}, { token }) as Promise<ProjectMemory[]>,
    fetchQuery(api.actions.listForProject, { projectId: projectId as Id<"objects"> }, { token }) as Promise<ProjectAction[]>,
    fetchQuery(api.agentEvents.listForProject, { projectId: projectId as Id<"objects">, limit: PACKET_AGENT_EVENT_FETCH_LIMIT }, { token }) as Promise<AgentEvent[]>,
    fetchQuery(api.handoffs.listForProject, { projectId: projectId as Id<"objects">, limit: 6 }, { token }) as Promise<Handoff[]>,
    fetchQuery(api.subscriptions.getMine, {}, { token }) as Promise<{ status?: string; plan?: string } | null>,
  ]);

  const memory = memories.find((item) => item.projectId === projectId) ?? null;
  const captures = generationInput.items;

  return {
    project: generationInput.project,
    memory,
    captures,
    activity: generationInput.activities,
    actions,
    agentEvents: packetAgentEvents(agentEvents, memory, captures),
    handoffs,
    subscription,
  };
}

async function getMcpContext(token: string, projectId?: string): Promise<HypherMcpContext> {
  const rows = await fetchQuery(api.objects.list, {}, { token });
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
    data = await fetchQuery(api.mcpApiKey.dataForApiKey, {
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

async function getMcpContextForTokenHash(tokenHash: string, resource: string, projectId?: string): Promise<HypherMcpContext | null> {
  const now = Date.now();

  let validated: unknown;
  try {
    validated = await fetchMutation(api.oauth.validateAccessToken, {
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
    data = await fetchQuery(api.oauthContext.dataForToken, {
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

  const projectContext = data.projectContext
    ? {
      ...data.projectContext,
      agentEvents: packetAgentEvents(
        data.projectContext.agentEvents,
        data.projectContext.memory,
        data.projectContext.captures,
      ),
    }
    : null;

  return {
    projects: data.projects,
    projectContexts: projectId && projectContext ? { [projectId]: projectContext } : {},
  };
}

/** Who is calling `tools/call`, resolved once per request. */
type McpCaller =
  | { kind: "apiKey"; apiKey: string }
  | { kind: "oauth"; tokenHash: string; resource: string }
  | { kind: "session"; convexToken: string };

async function resolveMcpCaller(req: NextRequest): Promise<McpCaller | null> {
  const accessToken = bearerToken(req);
  if (isHypherApiKey(accessToken)) return { kind: "apiKey", apiKey: accessToken };
  if (accessToken) {
    return { kind: "oauth", tokenHash: sha256Base64url(accessToken), resource: mcpRequestResource(req) };
  }
  const { userId, getToken } = await auth();
  if (!userId) return null;
  const convexToken = await getToken({ template: "convex" });
  return convexToken ? { kind: "session", convexToken } : null;
}

async function loadMcpContext(caller: McpCaller, projectId?: string): Promise<HypherMcpContext | null> {
  switch (caller.kind) {
    case "apiKey":
      return await getMcpContextForApiKey(caller.apiKey, projectId);
    case "oauth":
      return await getMcpContextForTokenHash(caller.tokenHash, caller.resource, projectId);
    case "session":
      return await getMcpContext(caller.convexToken, projectId);
  }
}

/** A Convex write action answered 401; the route replies with the MCP auth challenge. */
class McpUnauthorizedError extends Error {
  constructor() {
    super("unauth");
  }
}

type OAuthActionAuth = { tokenHash: string; resource: string; scope: string; now: number };

/**
 * One call per caller kind. Each Convex write feature exposes `...FromApiRequest`,
 * `...FromOAuthRequest`, and `...FromSession`; the handler says how to call each,
 * this picks the one for the caller and maps a 401 to the auth challenge.
 */
async function callAuthed<Result extends { status?: number }>(
  caller: McpCaller,
  calls: {
    apiKey: (auth: { apiKey: string }) => Promise<Result>;
    oauth: (auth: OAuthActionAuth) => Promise<Result>;
    session: (options: { token: string }) => Promise<Result>;
  }
): Promise<Result> {
  let result: Result;
  switch (caller.kind) {
    case "apiKey":
      result = await calls.apiKey({ apiKey: caller.apiKey });
      break;
    case "oauth":
      result = await calls.oauth({
        tokenHash: caller.tokenHash,
        resource: caller.resource,
        scope: HYPHER_MCP_SCOPE,
        now: Date.now(),
      });
      break;
    case "session":
      result = await calls.session({ token: caller.convexToken });
      break;
  }
  if (result.status === 401) throw new McpUnauthorizedError();
  return result;
}

type McpToolHandler = {
  /** When set and false, the call falls through to the read tools. */
  when?: (args: Record<string, unknown>) => boolean;
  handle: (args: Record<string, unknown>, caller: McpCaller, context: HypherMcpContext) => Promise<HypherMcpToolResult>;
};

/**
 * Write and structured-handoff tools. Adding one: a descriptor in
 * `getHypherMcpToolDescriptors`, then one entry here. Everything else goes
 * through `buildMcpToolResult`.
 */
const MCP_TOOL_HANDLERS = new Map<string, McpToolHandler>([
  ["acknowledge_handoff", {
    handle: async (args, caller) => {
      const ackArgs = parseHandoffAcknowledgeArgs(args);
      const result = await callAuthed(caller, {
        apiKey: (auth) => fetchAction(api.structuredHandoffs.acknowledgeFromApiRequest, { ...auth, ...ackArgs }),
        oauth: (auth) => fetchAction(api.structuredHandoffs.acknowledgeFromOAuthRequest, { ...auth, ...ackArgs }),
        session: (options) => fetchAction(api.structuredHandoffs.acknowledgeFromSession, ackArgs, options),
      });
      return formatHandoffAcknowledgeResult(result);
    },
  }],
  ["prepare_handoff", {
    when: isStructuredHandoffResume,
    handle: async (args, caller) => {
      const parsed = parseHandoffResumeArgs(args);
      const resumeArgs = {
        projectId: parsed.projectId,
        destinationProjectId: parsed.destinationProjectId,
        destination: parsed.destination,
        currentRepo: parsed.currentRepo,
        result: parsed.result,
        ...(parsed.reason ? { reason: parsed.reason } : {}),
      };
      const result = await callAuthed(caller, {
        apiKey: (auth) => fetchAction(api.structuredHandoffs.resumeFromApiRequest, { ...auth, ...resumeArgs }),
        oauth: (auth) => fetchAction(api.structuredHandoffs.resumeFromOAuthRequest, { ...auth, ...resumeArgs }),
        session: (options) => fetchAction(api.structuredHandoffs.resumeFromSession, resumeArgs, options),
      });
      return formatHandoffResumeResult(result);
    },
  }],
  ["write_project_memory", {
    handle: async (args, caller) => {
      const parsed = parseWriteProjectMemoryArgs(args);
      const writeArgs = {
        projectId: parsed.projectId,
        compiledJson: parsed.compiledJson,
        source: parsed.source,
      };
      const result = await callAuthed(caller, {
        apiKey: (auth) => fetchAction(api.projectMemoryMcp.writeCompiledFromApiRequest, { ...auth, ...writeArgs }),
        oauth: (auth) => fetchAction(api.projectMemoryMcp.writeCompiledFromOAuthRequest, { ...auth, ...writeArgs }),
        session: (options) => fetchAction(api.projectMemoryMcp.writeCompiledFromSession, writeArgs, options),
      });
      return formatWriteProjectMemoryResult(result);
    },
  }],
  ["post_agent_event", {
    handle: async (args, caller) => {
      const parsed = parsePostAgentEventArgs(args);
      const writeArgs = {
        payload: parsed.payload,
        projectId: parsed.projectId,
      };
      const result = await callAuthed(caller, {
        // The API-key action takes the payload only; its project id rides inside the payload.
        apiKey: (auth) => fetchAction(api.agentEvents.createFromApiRequest, { ...auth, payload: parsed.payload }),
        oauth: (auth) => fetchAction(api.agentEvents.createFromOAuthRequest, { ...auth, ...writeArgs }),
        session: (options) => fetchAction(api.agentEvents.createFromSession, writeArgs, options),
      });
      return formatAgentEventWriteResult(result);
    },
  }],
]);

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
    const caller = await resolveMcpCaller(req);
    const context = caller
      ? await loadMcpContext(caller, mcpToolNeedsProjectContext(toolName) ? projectId : undefined)
      : null;

    if (!caller || !context) {
      return jsonRpcError(body.id, -32001, "unauth", 401, {
        "WWW-Authenticate": authChallenge(req),
      });
    }

    const tool = MCP_TOOL_HANDLERS.get(toolName);
    if (tool && (!tool.when || tool.when(args))) {
      return jsonRpc(body.id, await tool.handle(args, caller, context));
    }
    if (isMcpWriteTool(toolName)) {
      throw new Error("unknown-tool");
    }

    return jsonRpc(body.id, buildMcpToolResult(toolName, args, context));
  } catch (err) {
    if (err instanceof McpUnauthorizedError) {
      return jsonRpcError(body.id, -32001, "unauth", 401, {
        "WWW-Authenticate": authChallenge(req),
      });
    }
    console.error("[api/mcp]", err);
    const message = err instanceof Error ? err.message : "tool-call-failed";
    return jsonRpcError(body.id, -32000, message);
  }
}
