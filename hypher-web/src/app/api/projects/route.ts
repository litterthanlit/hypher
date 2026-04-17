/**
 * GET /api/projects — session-authed project list for the Chrome extension popup.
 *
 * Authenticates via Clerk session cookie (credentials:"include" from the extension).
 * Returns [{ id, title }] shaped for the popup project picker.
 *
 * CORS: echoes chrome-extension://* in dev, or the specific EXTENSION_ID in prod.
 * TODO: tighten EXTENSION_ID after Chrome Web Store submission — replace the broad
 *       chrome-extension://* with chrome-extension://<EXTENSION_ID>.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "../../../../convex/_generated/api";

export const runtime = "nodejs";

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
    "Access-Control-Allow-Methods": "GET, OPTIONS",
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

export async function GET(req: NextRequest) {
  const { userId, getToken } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauth" }, { status: 401 });
  }

  const token = await getToken({ template: "convex" });
  if (!token) {
    return NextResponse.json({ error: "missing_convex_token" }, { status: 401 });
  }

  let objects: Array<{ _id: string; kind: string; name?: string; content?: string }>;
  try {
    // api.objects.list returns all user objects; filter to kind==="project"
    objects = await fetchQuery(api.objects.list, {}, { token }) as typeof objects;
  } catch (e) {
    console.error("[api/projects]", e);
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }

  const projects = objects
    .filter((o) => o.kind === "project")
    .map((o) => ({
      id: String(o._id),
      title: o.name ?? o.content?.slice(0, 60) ?? "Untitled project",
    }));

  const headers = corsHeaders(req);
  return NextResponse.json(projects, { headers });
}
