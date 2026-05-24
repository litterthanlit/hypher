import { NextRequest, NextResponse } from "next/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../convex/_generated/dataModel";
import type { ActivityEntry, AgentEvent, AnyObject, Handoff, Project, ProjectAction, ProjectMemory } from "@/types";
import { buildAgentContextApiResponse } from "@/lib/agentContextApi";
import { authErrorJson, requireBetaAccess } from "@/lib/serverAuth";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ projectId: string }>;
}

function optionalParam(req: NextRequest, key: string): string | undefined {
  const value = req.nextUrl.searchParams.get(key)?.trim();
  return value || undefined;
}

export async function GET(req: NextRequest, context: RouteContext) {
  let session;
  try {
    session = await requireBetaAccess();
  } catch (error) {
    return authErrorJson(error) as NextResponse;
  }
  const token = session.convexToken;

  const { projectId } = await context.params;
  if (!projectId) {
    return NextResponse.json({ ok: false, error: "missing-project-id" }, { status: 400 });
  }

  try {
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

    const memory = memories.find((item) => item.projectId === projectId) ?? null;
    const response = buildAgentContextApiResponse({
      project: generationInput.project,
      memory,
      captures: generationInput.items,
      actions,
      agentEvents,
      handoffs,
      subscription,
      task: optionalParam(req, "task"),
      role: optionalParam(req, "role"),
    });

    return NextResponse.json(response, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[api/projects/agent-context]", err);
    return NextResponse.json({ ok: false, error: "context-fetch-failed" }, { status: 500 });
  }
}
