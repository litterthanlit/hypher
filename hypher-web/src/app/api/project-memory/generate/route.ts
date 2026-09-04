import { NextRequest, NextResponse } from "next/server";
import { fetchAction } from "convex/nextjs";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { ratelimitUser } from "@/lib/rateLimit";
import { isRequestBodyTooLarge, readJsonWithLimit } from "@/lib/requestBody";
import { authErrorJson, requireBetaAccess } from "@/lib/serverAuth";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 10_000;

export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireBetaAccess();
  } catch (error) {
    return authErrorJson(error) as NextResponse;
  }

  const allowed = await ratelimitUser(session.userId, "project-memory-generate", {
    requests: 20,
    window: "1h",
  });
  if (!allowed) {
    return NextResponse.json({ ok: false, error: "rate-limited" }, { status: 429 });
  }

  const token = session.convexToken;
  if (!token) {
    return NextResponse.json({ ok: false, error: "missing-convex-token" }, { status: 401 });
  }

  let body: { projectId?: string };
  try {
    body = await readJsonWithLimit<{ projectId?: string }>(req, MAX_BODY_BYTES);
  } catch (error) {
    if (isRequestBodyTooLarge(error)) {
      return NextResponse.json({ ok: false, error: "payload-too-large" }, { status: 413 });
    }
    return NextResponse.json({ ok: false, error: "bad-body" }, { status: 400 });
  }

  if (!body.projectId || typeof body.projectId !== "string") {
    return NextResponse.json({ ok: false, error: "bad-body" }, { status: 400 });
  }

  try {
    const result = await fetchAction(
      (api as any).projectMemoryActions.synthesizeForCurrentUser,
      { projectId: body.projectId as Id<"objects"> },
      { token }
    ) as { ok: boolean; fallback?: boolean; error?: string };

    if (!result.ok) {
      const status = result.error === "project-not-found" ? 404 : 500;
      return NextResponse.json({ ok: false, error: result.error ?? "generation-failed" }, { status });
    }

    return NextResponse.json(
      { ok: true, fallback: result.fallback === true },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[api/project-memory/generate]", err);
    return NextResponse.json({ ok: false, error: "generation-failed" }, { status: 500 });
  }
}
