import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { enforceApiKeyRateLimit } from "./httpRateLimit";
import { Webhook } from "svix";
import { stripQuotedReply } from "./lib/quotedReply";
import { ratelimitConvex } from "./lib/rateLimit";

// typegen pending convex dev
const _internal = internal as any;

interface ResendInboundEmail {
  to: Array<{ address: string }>;
  from: Array<{ address: string }>;
  subject?: string;
  text?: string;
  html?: string;
}

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

// POST /api/email/inbound — Resend Inbound webhook
http.route({
  path: "/api/email/inbound",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // 1. Verify Resend webhook signature via Svix
    const secret = process.env.RESEND_INBOUND_SECRET;
    if (!secret) {
      console.warn("[hypher/inbound] RESEND_INBOUND_SECRET missing — rejecting");
      return new Response("bad-signature", { status: 401 });
    }

    const svixId = request.headers.get("svix-id") ?? "";
    const svixTs = request.headers.get("svix-timestamp") ?? "";
    const svixSig = request.headers.get("svix-signature") ?? "";
    const body = await request.text();

    try {
      const wh = new Webhook(secret);
      wh.verify(body, {
        "svix-id": svixId,
        "svix-timestamp": svixTs,
        "svix-signature": svixSig,
      });
    } catch {
      return new Response("bad-signature", { status: 401 });
    }

    // 2. Parse the JSON payload
    let parsed: ResendInboundEmail;
    try {
      parsed = JSON.parse(body) as ResendInboundEmail;
    } catch {
      return new Response("ok", { status: 200 }); // malformed — ack to stop retries
    }

    // 3. Extract reply token from the To address
    const toAddress = parsed.to?.[0]?.address ?? "";
    const tokenMatch = toAddress.match(/^reply\+([a-f0-9-]{36})@/i);
    if (!tokenMatch) {
      return new Response("ok", { status: 200 }); // not for us
    }
    const token = tokenMatch[1]!;

    // 4. Look up the token
    const tokenRow: { userId: string; createdAt: number } | null =
      await ctx.runQuery(_internal.digestEmail.lookupToken, { token });
    if (!tokenRow) return new Response("ok", { status: 200 });
    if (Date.now() - tokenRow.createdAt > 14 * 86_400_000) {
      return new Response("ok", { status: 200 });
    }

    // 5. Rate-limit: 50 notes/hour per token
    const allowed = await ratelimitConvex(token, "inbound", {
      requests: 50,
      window: "1h",
    });
    if (!allowed) return new Response("ok", { status: 200 });

    // 6. Strip quoted reply chain
    const rawText = parsed.text ?? "";
    const text = stripQuotedReply(rawText).trim();
    if (!text || text.length > 4000) {
      return new Response("ok", { status: 200 });
    }

    // 7. Resolve inbox project
    const projectId: string | null = await ctx.runQuery(
      _internal.digestEmail.getInboxProjectId,
      { userId: tokenRow.userId }
    );

    // 8. Insert note
    const now = Date.now();
    await ctx.runMutation(_internal.objects.putForApiUser, {
      userId: tokenRow.userId,
      kind: "note",
      content: text,
      maturity: "fleeting",
      tags: ["from-email"],
      projectId: projectId ?? null,
      createdAt: now,
      modifiedAt: now,
    });

    return new Response("ok", { status: 200 });
  }),
});

export default http;
