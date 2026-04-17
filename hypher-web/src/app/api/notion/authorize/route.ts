/**
 * GET /api/notion/authorize — start the Notion OAuth flow for the signed-in user.
 *
 * Generates a CSRF state, stashes it in an httpOnly cookie, and redirects to
 * Notion's consent screen. The callback route verifies the state before exchanging
 * the code for an access token.
 *
 * Required env: NOTION_CLIENT_ID, NOTION_REDIRECT_URI.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export const runtime = "nodejs";

const STATE_COOKIE = "notion_oauth_state";
const STATE_TTL_SECONDS = 600;

export async function GET(_req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauth" }, { status: 401 });
  }

  const clientId = process.env.NOTION_CLIENT_ID;
  const redirectUri = process.env.NOTION_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: "not_configured", message: "Notion integration not configured" },
      { status: 500 }
    );
  }

  const state = crypto.randomUUID();
  const authorizeUrl = new URL("https://api.notion.com/v1/oauth/authorize");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("owner", "user");
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("state", state);

  const res = NextResponse.redirect(authorizeUrl.toString());
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: STATE_TTL_SECONDS,
  });
  return res;
}
