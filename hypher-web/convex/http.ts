import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { enforceApiKeyRateLimit } from "./httpRateLimit";

const http = httpRouter();

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

function withCors(headers: Record<string, string>): Record<string, string> {
  return { ...headers, ...CORS_HEADERS };
}

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
        {
          status: 401,
          headers: withCors({ "Content-Type": "application/json" }),
        }
      );
    }

    const validated = await ctx.runQuery(internal.apiKeys.validate, {
      key: apiKey,
    });
    if (!validated) {
      return new Response(
        JSON.stringify({ error: "Invalid API key" }),
        {
          status: 401,
          headers: withCors({ "Content-Type": "application/json" }),
        }
      );
    }

    const limited = await enforceApiKeyRateLimit(validated.rateLimitKey);
    if (limited) {
      const h = new Headers(limited.headers);
      for (const [k, v] of Object.entries(CORS_HEADERS)) h.set(k, v);
      return new Response(limited.body, { status: limited.status, headers: h });
    }

    const body = await request.json();
    const now = Date.now();
    const id = await ctx.runMutation(internal.objects.putForApiUser, {
      userId: validated.userId,
      kind: body.kind || "note",
      content: body.content,
      maturity: "fleeting",
      createdAt: now,
      modifiedAt: now,
      projectId: body.projectId || null,
      tags: body.tags,
    });

    await ctx.runMutation(internal.apiKeys.touch, { keyId: validated.keyId });

    return new Response(
      JSON.stringify({ id, success: true }),
      {
        status: 200,
        headers: withCors({ "Content-Type": "application/json" }),
      }
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
        {
          status: 401,
          headers: withCors({ "Content-Type": "application/json" }),
        }
      );
    }

    const validated = await ctx.runQuery(internal.apiKeys.validate, {
      key: apiKey,
    });
    if (!validated) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: withCors({ "Content-Type": "application/json" }),
        }
      );
    }

    const limited = await enforceApiKeyRateLimit(validated.rateLimitKey);
    if (limited) {
      const h = new Headers(limited.headers);
      for (const [k, v] of Object.entries(CORS_HEADERS)) h.set(k, v);
      return new Response(limited.body, { status: limited.status, headers: h });
    }

    const allObjects = await ctx.runQuery(internal.objects.listForApiUser, {
      userId: validated.userId,
    });
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
      {
        status: 200,
        headers: withCors({ "Content-Type": "application/json" }),
      }
    );
  }),
});

export default http;
