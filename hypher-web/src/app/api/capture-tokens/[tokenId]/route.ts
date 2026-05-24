import { NextRequest, NextResponse } from "next/server";
import { fetchAction, fetchMutation } from "convex/nextjs";
import { api } from "../../../../../convex/_generated/api";
import { authErrorJson, requireBetaAccess } from "@/lib/serverAuth";

export const runtime = "nodejs";

const CONVEX_URL =
  process.env.NEXT_PUBLIC_CONVEX_URL ??
  process.env.CONVEX_URL ??
  "https://build-placeholder.convex.cloud";

interface RouteContext {
  params: Promise<{ tokenId: string }>;
}

function bearerToken(req: Request): string | null {
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function noStoreHeaders(): Record<string, string> {
  return { "Cache-Control": "no-store" };
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const { tokenId } = await context.params;
  if (!/^[a-f0-9]{32}$/.test(tokenId)) {
    return NextResponse.json({ ok: false, error: "Invalid token id" }, { status: 400 });
  }

  const apiKey = bearerToken(req);
  if (apiKey) {
    const result = await fetchAction(
      (api as any).captureTokens.revokeWithApiKey,
      { apiKey, tokenId, reason: "api_request" },
      { url: CONVEX_URL }
    ) as { ok: boolean; status?: number; error?: string };
    return NextResponse.json(result, {
      status: result.status ?? (result.ok ? 200 : 400),
      headers: noStoreHeaders(),
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
      (api as any).captureTokens.revokeMine,
      { tokenId, reason: "api_request" },
      { token: session.convexToken }
    ) as { ok: boolean };
    return NextResponse.json(result, { headers: noStoreHeaders() });
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
  }
}
