import { NextRequest, NextResponse } from "next/server";
import { fetchAction, fetchMutation } from "convex/nextjs";
import { api } from "../../../../convex/_generated/api";
import { authErrorJson, requireBetaAccess } from "@/lib/serverAuth";
import { isRequestBodyTooLarge, readJsonWithLimit } from "@/lib/requestBody";

export const runtime = "nodejs";

const CONVEX_URL =
  process.env.NEXT_PUBLIC_CONVEX_URL ??
  process.env.CONVEX_URL ??
  "https://build-placeholder.convex.cloud";
const MAX_BODY_BYTES = 10_000;
const VALID_SCOPES = new Set(["capture:create", "projects:list"]);

type MintResult = {
  ok?: boolean;
  status?: number;
  error?: string;
  token?: string;
  tokenId?: string;
  tokenType?: "Bearer";
  expiresAt?: number;
  scopes?: string[];
  projectId?: string | null;
  allowedOrigin?: string;
};

function bearerToken(req: Request): string | null {
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function exactCors(req: Request, allowedOrigin?: string): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  if (!origin || !allowedOrigin || origin !== allowedOrigin) {
    return { "Cache-Control": "no-store" };
  }
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  };
}

function preflightCors(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  if (!origin || origin === "*") return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Vary": "Origin",
  };
}

function cleanBody(input: unknown, req: Request) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {
      scopes: undefined,
      projectId: undefined,
      allowedOrigin: req.headers.get("origin") ?? undefined,
      expiresInSeconds: undefined,
    };
  }
  const body = input as Record<string, unknown>;
  const scopes = Array.isArray(body.scopes)
    ? body.scopes.filter((scope): scope is string => typeof scope === "string")
    : undefined;
  if (scopes?.some((scope) => !VALID_SCOPES.has(scope))) {
    throw new Error("Invalid capture token scope");
  }
  return {
    scopes,
    projectId: typeof body.projectId === "string" ? body.projectId : body.projectId === null ? null : undefined,
    allowedOrigin:
      typeof body.allowedOrigin === "string"
        ? body.allowedOrigin
        : req.headers.get("origin") ?? undefined,
    expiresInSeconds: typeof body.expiresInSeconds === "number" ? body.expiresInSeconds : undefined,
  };
}

export async function OPTIONS(req: NextRequest) {
  const headers = preflightCors(req);
  if (!headers["Access-Control-Allow-Origin"]) {
    return new NextResponse(null, { status: 403 });
  }
  return new NextResponse(null, { status: 204, headers });
}

export async function POST(req: NextRequest) {
  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false, error: "Payload too large" }, { status: 413 });
  }

  let payload: unknown = {};
  try {
    payload = await readJsonWithLimit(req, MAX_BODY_BYTES);
  } catch (error) {
    if (isRequestBodyTooLarge(error)) {
      return NextResponse.json({ ok: false, error: "Payload too large" }, { status: 413 });
    }
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  let args: ReturnType<typeof cleanBody>;
  try {
    args = cleanBody(payload, req);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Invalid request" },
      { status: 400 }
    );
  }

  const apiKey = bearerToken(req);
  if (apiKey) {
    const result = await fetchAction(
      (api as any).captureTokens.mintWithApiKey,
      { apiKey, ...args },
      { url: CONVEX_URL }
    ) as MintResult;
    return NextResponse.json(result, {
      status: result.status ?? (result.ok === false ? 400 : 200),
      headers: exactCors(req, result.allowedOrigin),
    });
  }

  let session;
  try {
    session = await requireBetaAccess();
  } catch (error) {
    return authErrorJson(error) as NextResponse;
  }

  try {
    const result = await fetchMutation(
      (api as any).captureTokens.mintForUser,
      args,
      { token: session.convexToken }
    ) as MintResult;
    return NextResponse.json({ ok: true, ...result }, {
      headers: exactCors(req, result.allowedOrigin),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid capture token request";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
