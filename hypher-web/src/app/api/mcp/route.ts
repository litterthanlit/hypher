import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { ActivityEntry, AgentEvent, AnyObject, Project, ProjectAction, ProjectMemory } from "@/types";
import {
  buildMcpToolResult,
  getHypherMcpToolDescriptors,
  type HypherMcpContext,
  type HypherMcpProjectContext,
} from "@/lib/mcpTools";

export const runtime = "nodejs";

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: any;
};

function metadataUrl(req: NextRequest): string {
  return `${process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin}/.well-known/oauth-protected-resource`;
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
  return `Bearer resource_metadata="${metadataUrl(req)}", scope="hypher.projects.read"`;
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

  const [memories, actions, agentEvents, subscription] = await Promise.all([
    fetchQuery((api as any).projectMemories.listForDashboard, {}, { token }) as Promise<ProjectMemory[]>,
    fetchQuery((api as any).actions.listForProject, { projectId: projectId as Id<"objects"> }, { token }) as Promise<ProjectAction[]>,
    fetchQuery((api as any).agentEvents.listForProject, { projectId: projectId as Id<"objects">, limit: 12 }, { token }) as Promise<AgentEvent[]>,
    fetchQuery((api as any).subscriptions.getMine, {}, { token }) as Promise<{ status?: string; plan?: string } | null>,
  ]);

  return {
    project: generationInput.project,
    memory: memories.find((item) => item.projectId === projectId) ?? null,
    captures: generationInput.items,
    actions,
    agentEvents,
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

export async function GET() {
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
    body = await req.json() as JsonRpcRequest;
  } catch {
    return jsonRpcError(null, -32700, "Parse error", 400);
  }

  if (body.method === "initialize") {
    return jsonRpc(body.id, {
      protocolVersion: "2024-11-05",
      serverInfo: { name: "hypher", version: "0.1.0" },
      capabilities: { tools: {} },
    });
  }

  if (body.method === "tools/list") {
    return jsonRpc(body.id, { tools: getHypherMcpToolDescriptors() });
  }

  if (body.method !== "tools/call") {
    return jsonRpcError(body.id, -32601, "Method not found");
  }

  const { userId, getToken } = await auth();
  if (!userId) {
    return jsonRpcError(body.id, -32001, "unauth", 401, {
      "WWW-Authenticate": authChallenge(req),
    });
  }

  const token = await getToken({ template: "convex" });
  if (!token) {
    return jsonRpcError(body.id, -32001, "missing-convex-token", 401, {
      "WWW-Authenticate": authChallenge(req),
    });
  }

  const toolName = String(body.params?.name ?? "");
  const args = (body.params?.arguments ?? {}) as Record<string, unknown>;
  const projectId = typeof args.projectId === "string" ? args.projectId : undefined;

  try {
    const context = await getMcpContext(token, toolName === "list_projects" ? undefined : projectId);
    return jsonRpc(body.id, buildMcpToolResult(toolName, args, context));
  } catch (err) {
    console.error("[api/mcp]", err);
    const message = err instanceof Error ? err.message : "tool-call-failed";
    return jsonRpcError(body.id, -32000, message);
  }
}
