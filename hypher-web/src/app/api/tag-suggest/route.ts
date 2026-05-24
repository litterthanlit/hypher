/**
 * POST /api/tag-suggest — session-authed AI tag suggestion for the Chrome extension popup.
 *
 * Forwards { content } to api.ai.generateTags (the public Convex action) via fetchQuery.
 * Rate-limited at 60 requests/hour/user via Upstash Redis.
 *
 * CORS: echoes chrome-extension://* in dev, or the specific EXTENSION_ID in prod.
 * TODO: tighten EXTENSION_ID after Chrome Web Store submission — replace the broad
 *       chrome-extension://* with chrome-extension://<EXTENSION_ID>.
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchAction } from "convex/nextjs";
import { api } from "../../../../convex/_generated/api";
import { ratelimitUser } from "@/lib/rateLimit";
import { authErrorJson, requireBetaAccess } from "@/lib/serverAuth";
import { isRequestBodyTooLarge, readJsonWithLimit } from "@/lib/requestBody";

export const runtime = "nodejs";

const MAX_CONTENT_LEN = 2000;
const MAX_BODY_BYTES = 10_000;

function corsHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const isDev = process.env.NODE_ENV !== "production";

  // In dev allow any chrome-extension origin. In prod require the specific extension ID.
  // TODO: replace chrome-extension://* with chrome-extension://<EXTENSION_ID> post-submission.
  const allowedOrigin = isDev
    ? (origin.startsWith("chrome-extension://") ? origin : "")
    : (origin === `chrome-extension://${process.env.EXTENSION_ID ?? ""}` ? origin : "");

  if (!allowedOrigin) return {};

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Vary": "Origin",
  };
}

export async function OPTIONS(req: NextRequest) {
  const headers = corsHeaders(req);
  if (!headers["Access-Control-Allow-Origin"]) {
    return new NextResponse(null, { status: 403 });
  }
  return new NextResponse(null, { status: 204, headers });
}

export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireBetaAccess();
  } catch (error) {
    return authErrorJson(error) as NextResponse;
  }

  // Rate-limit: 60 tag-suggest calls per hour per user
  const allowed = await ratelimitUser(session.userId, "tag-suggest", { requests: 60, window: "1h" });
  if (!allowed) {
    return NextResponse.json({ error: "rate-limited" }, { status: 429 });
  }

  const token = session.convexToken;
  if (!token) {
    return NextResponse.json({ error: "missing_convex_token" }, { status: 401 });
  }

  let body: { content?: unknown };
  try {
    body = await readJsonWithLimit<{ content?: unknown }>(req, MAX_BODY_BYTES);
  } catch (error) {
    if (isRequestBodyTooLarge(error)) {
      return NextResponse.json({ error: "payload-too-large" }, { status: 413 });
    }
    return NextResponse.json({ error: "bad-body" }, { status: 400 });
  }

  if (typeof body.content !== "string") {
    return NextResponse.json({ error: "bad-body" }, { status: 400 });
  }

  const content = body.content.slice(0, MAX_CONTENT_LEN);

  let tags: string[];
  try {
    // api.ai.generateTags is a public Convex action
    tags = await fetchAction(
      api.ai.generateTags,
      { content },
      { token },
    ) as string[];
  } catch (e) {
    console.error("[api/tag-suggest]", e);
    return NextResponse.json({ tags: [] });
  }

  const headers = corsHeaders(req);
  return NextResponse.json({ tags: Array.isArray(tags) ? tags : [] }, { headers });
}
