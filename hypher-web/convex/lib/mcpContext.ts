import type { QueryCtx } from "../_generated/server";

/**
 * Shared builder for the read-side MCP context (projects + one optional project
 * context). Both the OAuth token path (`oauthContext.dataForToken`) and the API
 * key path (`mcpApiKey.dataForApiKey`) return the exact same shape so the
 * `/api/mcp` route and Hypher MCP tools behave identically regardless of which
 * credential a caller (IDE plugin, cloud agent, ChatGPT) presents.
 */

function mapObject(doc: any) {
  const { _id, _creationTime, userId, ...rest } = doc;
  return { ...rest, id: String(_id) };
}

function mapMemory(doc: any) {
  const { _id, _creationTime, userId, ...rest } = doc;
  return { ...rest, id: String(_id) };
}

function mapAction(doc: any) {
  const { _id, _creationTime, ...rest } = doc;
  return { ...rest, id: String(_id) };
}

function mapEvent(doc: any) {
  const { _id, _creationTime, ...rest } = doc;
  return { ...rest, id: String(_id) };
}

function mapHandoff(doc: any) {
  const { _id, _creationTime, ...rest } = doc;
  return { ...rest, id: String(_id) };
}

export type McpContextData = {
  projects: Array<Record<string, unknown>>;
  projectContext: Record<string, unknown> | null;
};

export async function buildMcpContextForUser(
  ctx: QueryCtx,
  userId: string,
  projectId?: string
): Promise<McpContextData> {
  const objects = await ctx.db
    .query("objects")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  const projects = objects.filter((obj) => obj.kind === "project").map(mapObject);

  if (!projectId) {
    return { projects, projectContext: null };
  }

  const project = objects.find(
    (obj) => String(obj._id) === projectId && obj.kind === "project"
  );
  if (!project) return { projects, projectContext: null };

  const items = objects
    .filter((obj) => obj.projectId === projectId && obj.kind !== "project")
    .sort((a, b) => (b.modifiedAt ?? 0) - (a.modifiedAt ?? 0))
    .slice(0, 24)
    .map(mapObject);

  const memory = await ctx.db
    .query("projectMemories")
    .withIndex("by_user_project", (q) => q.eq("userId", userId).eq("projectId", project._id))
    .unique();

  const actions = await ctx.db
    .query("actions")
    .withIndex("by_user_project", (q) => q.eq("userId", userId).eq("projectId", project._id))
    .collect();

  const agentEvents = await ctx.db
    .query("agentEvents")
    .withIndex("by_user_project", (q) => q.eq("userId", userId).eq("projectId", project._id))
    .collect();

  const handoffs = await ctx.db
    .query("handoffs")
    .withIndex("by_user_project", (q) => q.eq("userId", userId).eq("projectId", project._id))
    .collect();

  const subscription = await ctx.db
    .query("subscriptions")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();

  return {
    projects,
    projectContext: {
      project: mapObject(project),
      memory: memory ? mapMemory(memory) : null,
      captures: items,
      actions: actions.sort((a, b) => b.updatedAt - a.updatedAt).map(mapAction),
      agentEvents: agentEvents
        .filter((event) => event.status !== "dismissed")
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 12)
        .map(mapEvent),
      handoffs: handoffs
        .sort((a, b) => b.generatedAt - a.generatedAt)
        .slice(0, 6)
        .map(mapHandoff),
      subscription: subscription
        ? { status: subscription.status, plan: subscription.plan }
        : null,
    },
  };
}
