import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { enforceApiKeyRateLimit } from "./httpRateLimit";
import { Webhook } from "svix";
import { stripQuotedReply } from "./lib/quotedReply";
import { ratelimitConvex } from "./lib/rateLimit";
import { apiKeyProbeRateLimitKey } from "./apiKeys";

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

const MAX_CAPTURE_CONTENT = 10_000;
const MAX_CAPTURE_TAGS = 10;
const MAX_CAPTURE_BODY_BYTES = 25_000;

function withCors(headers: Record<string, string>): Record<string, string> {
  return { ...headers, ...CORS_HEADERS };
}

function withExactOriginCors(
  headers: Record<string, string>,
  origin: string | null | undefined,
  allowedOrigin: string | null | undefined
): Record<string, string> {
  if (!origin || !allowedOrigin || origin !== allowedOrigin) return headers;
  return {
    ...headers,
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Vary": "Origin",
  };
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get("Authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function clientProbeKey(request: Request, bearer: string | null): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip") || "unknown";
  return `${ip}:${apiKeyProbeRateLimitKey(bearer)}`;
}

async function enforceAuthProbeLimit(request: Request, bearer: string | null) {
  const allowed = await ratelimitConvex(clientProbeKey(request, bearer), "api-key-validation", {
    requests: 30,
    window: "1m",
  });
  return allowed
    ? null
    : { ok: false as const, status: 429, error: "rate_limited", corsHeaders: withCors({}) };
}

async function readJsonWithLimit(request: Request, maxBytes: number): Promise<any> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > maxBytes) throw new Error("too-large");
  const reader = request.body?.getReader();
  if (!reader) {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > maxBytes) {
      throw new Error("too-large");
    }
    return JSON.parse(text);
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) throw new Error("too-large");
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

async function validateCaptureAuth(
  ctx: any,
  request: Request,
  args: {
    requiredScope: "capture:create" | "projects:list";
    projectId?: string | null;
  }
): Promise<
  | {
      ok: true;
      authType: "apiKey";
      userId: string;
      keyId: any;
      rateLimitKey: string;
      corsHeaders: Record<string, string>;
    }
  | {
      ok: true;
      authType: "captureToken";
      userId: string;
      tokenId: any;
      rateLimitKey: string;
      scopedProjectId: string | null;
      corsHeaders: Record<string, string>;
    }
  | { ok: false; status: number; error: string; corsHeaders: Record<string, string> }
> {
  const bearer = bearerToken(request);
  if (!bearer || !bearer.startsWith("hct_")) {
    const probeLimited = await enforceAuthProbeLimit(request, bearer);
    if (probeLimited) return probeLimited;
  }

  if (!bearer) {
    return { ok: false, status: 401, error: "Unauthorized", corsHeaders: withCors({}) };
  }

  if (bearer.startsWith("hct_")) {
    const origin = request.headers.get("origin");
    const validated = await ctx.runQuery(_internal.captureTokens.validate, {
      token: bearer,
      requiredScope: args.requiredScope,
      projectId: args.projectId ?? null,
      origin,
    });
    const corsHeaders = withExactOriginCors(
      { "Content-Type": "application/json" },
      origin,
      validated?.allowedOrigin
    );
    if (!validated?.ok) {
      return {
        ok: false,
        status: validated?.status ?? 401,
        error: validated?.error ?? "invalid_token",
        corsHeaders,
      };
    }
    return {
      ok: true,
      authType: "captureToken",
      userId: validated.userId,
      tokenId: validated.tokenId,
      rateLimitKey: validated.rateLimitKey,
      scopedProjectId: validated.projectId ?? null,
      corsHeaders,
    };
  }

  const validated = await ctx.runQuery(_internal.apiKeys.validate, { key: bearer });
  if (!validated) {
    return { ok: false, status: 401, error: "Unauthorized", corsHeaders: withCors({}) };
  }
  return {
    ok: true,
    authType: "apiKey",
    userId: validated.userId,
    keyId: validated.keyId,
    rateLimitKey: validated.rateLimitKey,
    corsHeaders: withCors({ "Content-Type": "application/json" }),
  };
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
    let body: any;
    try {
      body = await readJsonWithLimit(request, MAX_CAPTURE_BODY_BYTES);
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON" }),
        {
          status: 400,
          headers: withCors({ "Content-Type": "application/json" }),
        }
      );
    }
    const requestedProjectId = typeof body.projectId === "string" ? body.projectId : null;
    const auth = await validateCaptureAuth(ctx, request, {
      requiredScope: "capture:create",
      projectId: requestedProjectId,
    });
    if (!auth.ok) {
      return new Response(
        JSON.stringify({ error: auth.error }),
        {
          status: auth.status,
          headers: auth.corsHeaders,
        }
      );
    }

    const limited = await enforceApiKeyRateLimit(auth.rateLimitKey);
    if (limited) {
      const h = new Headers(limited.headers);
      for (const [k, v] of Object.entries(auth.corsHeaders)) h.set(k, v);
      return new Response(limited.body, { status: limited.status, headers: h });
    }

    const content = typeof body.content === "string" ? body.content.trim() : "";
    const tags = Array.isArray(body.tags)
      ? body.tags.filter((tag: unknown): tag is string => typeof tag === "string").slice(0, MAX_CAPTURE_TAGS)
      : undefined;
    if (!content || content.length > MAX_CAPTURE_CONTENT) {
      return new Response(
        JSON.stringify({ error: "Invalid content" }),
        {
          status: 400,
          headers: auth.corsHeaders,
        }
      );
    }
    const projectId = auth.authType === "captureToken" && auth.scopedProjectId
      ? auth.scopedProjectId
      : requestedProjectId;
    const now = Date.now();
    const id = await ctx.runMutation(internal.objects.putForApiUser, {
      userId: auth.userId,
      kind: body.kind || "note",
      content,
      maturity: "fleeting",
      createdAt: now,
      modifiedAt: now,
      projectId,
      tags,
    });

    if (auth.authType === "apiKey") {
      await ctx.runMutation(_internal.apiKeys.touch, { keyId: auth.keyId });
    } else {
      await ctx.runMutation(_internal.captureTokens.touch, { tokenId: auth.tokenId });
    }

    return new Response(
      JSON.stringify({ id, success: true }),
      {
        status: 200,
        headers: auth.corsHeaders,
      }
    );
  }),
});

// GET /api/projects
http.route({
  path: "/api/projects",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await validateCaptureAuth(ctx, request, {
      requiredScope: "projects:list",
    });
    if (!auth.ok) {
      return new Response(
        JSON.stringify({ error: auth.error }),
        {
          status: auth.status,
          headers: auth.corsHeaders,
        }
      );
    }

    const limited = await enforceApiKeyRateLimit(auth.rateLimitKey);
    if (limited) {
      const h = new Headers(limited.headers);
      for (const [k, v] of Object.entries(auth.corsHeaders)) h.set(k, v);
      return new Response(limited.body, { status: limited.status, headers: h });
    }

    const allObjects = await ctx.runQuery(internal.objects.listForApiUser, {
      userId: auth.userId,
    });
    const projects = allObjects
      .filter((o: { kind: string }) => o.kind === "project")
      .filter((o: { _id: string }) => auth.authType !== "captureToken" || !auth.scopedProjectId || String(o._id) === auth.scopedProjectId)
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
        headers: auth.corsHeaders,
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
