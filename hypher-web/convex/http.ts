import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

// CORS preflight
http.route({
  path: "/api/capture",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }),
});

http.route({
  path: "/api/projects",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }),
});

// POST /api/capture
http.route({
  path: "/api/capture",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const apiKey = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Missing API key" }),
        { status: 401, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    const userId = await ctx.runQuery(internal.apiKeys.validate, { key: apiKey });
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Invalid API key" }),
        { status: 401, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    const body = await request.json();
    const now = Date.now();
    const id = await ctx.runMutation(internal.objects.putForApiUser, {
      userId,
      kind: body.kind || "note",
      content: body.content,
      maturity: "fleeting",
      createdAt: now,
      modifiedAt: now,
      projectId: body.projectId || null,
      tags: body.tags,
    });

    // Update lastUsed on API key
    await ctx.runMutation(internal.apiKeys.touch, { key: apiKey });

    return new Response(
      JSON.stringify({ id, success: true }),
      { status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );
  }),
});

// GET /api/projects
http.route({
  path: "/api/projects",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const apiKey = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Missing API key" }),
        { status: 401, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    const userId = await ctx.runQuery(internal.apiKeys.validate, { key: apiKey });
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    const allObjects = await ctx.runQuery(internal.objects.listForApiUser, { userId });
    const projects = allObjects
      .filter((o: { kind: string }) => o.kind === "project")
      .map((o: { _id: string; name?: string; status?: string; priority?: number }) => ({
        id: o._id,
        name: o.name,
        status: o.status || "active",
        priority: o.priority,
      }));

    return new Response(
      JSON.stringify({ projects }),
      { status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );
  }),
});

export default http;
