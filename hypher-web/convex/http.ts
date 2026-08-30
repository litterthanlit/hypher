import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { enforceApiKeyRateLimit } from "./httpRateLimit";
import { ratelimitConvex } from "./lib/rateLimit";
import { apiKeyProbeRateLimitKey } from "./apiKeys";
import { normalizeCaptureInput, prepareCaptureObject } from "../shared/capture";

// typegen pending convex dev
const _internal = internal as any;

const http = httpRouter();

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

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

    const input = normalizeCaptureInput({
      content: body.content,
      projectId: requestedProjectId,
      tags: body.tags,
      tagMode: "api",
      validateProjectId: false,
    });
    if (!input.ok) {
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
      : input.projectId;
    const now = Date.now();
    const capture = prepareCaptureObject({
      content: input.content,
      projectId,
      now,
      tags: input.tags,
      includeClientFields: false,
      markReviewedOnProject: false,
    });
    const id = await ctx.runMutation(internal.objects.putForApiUser, {
      userId: auth.userId,
      kind: body.kind || capture.kind,
      content: capture.content,
      maturity: capture.maturity,
      createdAt: capture.createdAt,
      modifiedAt: capture.modifiedAt,
      projectId: capture.projectId,
      tags: capture.tags,
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

export default http;
