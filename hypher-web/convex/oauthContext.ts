import { query } from "./_generated/server";
import { v } from "convex/values";
import { hasBetaAccess } from "./lib/auth";
import { oauthResourcesEquivalent } from "../shared/oauthResources";
import { prioritizeAgentEventsForPacket } from "../shared/projectMemoryGenerate";

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

function mapActivity(doc: any) {
  const { _id, _creationTime, userId, ...rest } = doc;
  return { ...rest, id: String(_id) };
}

export function selectActivityForOAuthContext(
  entries: Array<{ userId?: string; timestamp: number }>,
  userId: string,
  limit = 24
) {
  return entries
    .filter((entry) => entry.userId === userId)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit)
    .map(mapActivity);
}

async function validateToken(ctx: any, args: { tokenHash: string; resource: string; scope: string; now: number }) {
  const token = await ctx.db
    .query("oauthAccessTokens")
    .withIndex("by_tokenHash", (q: any) => q.eq("tokenHash", args.tokenHash))
    .unique();

  if (!token || token.revokedAt !== undefined || token.expiresAt <= args.now) return null;
  if (
    !oauthResourcesEquivalent(token.resource, args.resource) ||
    !token.scope.split(/\s+/).includes(args.scope)
  ) {
    return null;
  }
  if (!(await hasBetaAccess(ctx, token.userId))) return null;
  return token;
}

export const dataForToken = query({
  args: {
    tokenHash: v.string(),
    resource: v.string(),
    scope: v.string(),
    projectId: v.optional(v.string()),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const token = await validateToken(ctx, args);
    if (!token) return null;

    const objects = await ctx.db
      .query("objects")
      .withIndex("by_user", (q) => q.eq("userId", token.userId))
      .collect();
    const projects = objects.filter((obj) => obj.kind === "project").map(mapObject);

    if (!args.projectId) {
      return { projects, projectContext: null };
    }

    const project = objects.find((obj) => String(obj._id) === args.projectId && obj.kind === "project");
    if (!project) return { projects, projectContext: null };

    const items = objects
      .filter((obj) => obj.projectId === args.projectId && obj.kind !== "project")
      .sort((a, b) => (b.modifiedAt ?? 0) - (a.modifiedAt ?? 0))
      .slice(0, 24)
      .map(mapObject);

    const memory = await ctx.db
      .query("projectMemories")
      .withIndex("by_user_project", (q) => q.eq("userId", token.userId).eq("projectId", project._id))
      .unique();

    const actions = await ctx.db
      .query("actions")
      .withIndex("by_user_project", (q) => q.eq("userId", token.userId).eq("projectId", project._id))
      .collect();

    const agentEvents = await ctx.db
      .query("agentEvents")
      .withIndex("by_user_project", (q) => q.eq("userId", token.userId).eq("projectId", project._id))
      .collect();

    const handoffs = await ctx.db
      .query("handoffs")
      .withIndex("by_user_project", (q) => q.eq("userId", token.userId).eq("projectId", project._id))
      .collect();

    const activities = await ctx.db
      .query("activity")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .collect();

    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", token.userId))
      .first();

    return {
      projects,
      projectContext: {
        project: mapObject(project),
        memory: memory ? mapMemory(memory) : null,
        captures: items,
        activity: selectActivityForOAuthContext(activities, token.userId, 24),
        actions: actions.sort((a, b) => b.updatedAt - a.updatedAt).map(mapAction),
        agentEvents: prioritizeAgentEventsForPacket(agentEvents, 12).map(mapEvent),
        handoffs: handoffs
          .sort((a, b) => b.generatedAt - a.generatedAt)
          .slice(0, 6)
          .map(mapHandoff),
        subscription: subscription
          ? { status: subscription.status, plan: subscription.plan }
          : null,
      },
    };
  },
});
