import { fetchAction } from "convex/nextjs";
import { api } from "../../../../../convex/_generated/api";

export const runtime = "nodejs";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

const CONVEX_URL =
  process.env.NEXT_PUBLIC_CONVEX_URL ??
  process.env.CONVEX_URL ??
  "https://adamant-pheasant-663.convex.cloud";
const MAX_BODY_BYTES = 50_000;

function bearerToken(req: Request): string | null {
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: Request) {
  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (contentLength > MAX_BODY_BYTES) {
    return Response.json({ ok: false, error: "Payload too large" }, { status: 413, headers: CORS_HEADERS });
  }

  const apiKey = bearerToken(req);
  if (!apiKey) {
    return Response.json({ ok: false, error: "Missing API key" }, { status: 401, headers: CORS_HEADERS });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400, headers: CORS_HEADERS });
  }

  let result: { ok: boolean; status?: number; error?: string };
  try {
    result = await fetchAction(
      (api as any).agentEvents.createFromApiRequest,
      { apiKey, payload },
      { url: CONVEX_URL }
    ) as { ok: boolean; status?: number; error?: string };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Agent event request failed";
    console.error("[agent/events]", message);
    return Response.json(
      { ok: false, error: "Agent event request failed", detail: message },
      { status: 500, headers: CORS_HEADERS }
    );
  }

  return Response.json(result, {
    status: result.status ?? (result.ok ? 200 : 400),
    headers: CORS_HEADERS,
  });
}
