/**
 * GET /api/notion/callback — Notion OAuth redirect target.
 *
 * Validates the state cookie, exchanges the code for an access token, persists
 * the token via fetchMutation to api.notion.storeToken, then redirects the user
 * back to /app with a query flag the WelcomeDialog picks up.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "../../../../../convex/_generated/api";

export const runtime = "nodejs";

const STATE_COOKIE = "notion_oauth_state";
const NOTION_TOKEN_URL = "https://api.notion.com/v1/oauth/token";

function appRedirect(req: NextRequest, params: Record<string, string>): NextResponse {
  const url = new URL("/app", req.nextUrl.origin);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = NextResponse.redirect(url.toString());
  res.cookies.delete(STATE_COOKIE);
  return res;
}

export async function GET(req: NextRequest) {
  const { userId, getToken } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauth" }, { status: 401 });
  }

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const cookieState = req.cookies.get(STATE_COOKIE)?.value;

  if (!code || !state || !cookieState || state !== cookieState) {
    return appRedirect(req, { notion: "error", reason: "state" });
  }

  const clientId = process.env.NOTION_CLIENT_ID;
  const clientSecret = process.env.NOTION_CLIENT_SECRET;
  const redirectUri = process.env.NOTION_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    return appRedirect(req, { notion: "error", reason: "not_configured" });
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  let tokenData: {
    access_token?: string;
    workspace_id?: string;
    workspace_name?: string;
    bot_id?: string;
  };
  try {
    const tokenRes = await fetch(NOTION_TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });
    if (!tokenRes.ok) {
      const body = await tokenRes.text().catch(() => "");
      console.error("[notion/callback] token exchange failed", tokenRes.status, body.slice(0, 200));
      return appRedirect(req, { notion: "error", reason: "exchange" });
    }
    tokenData = await tokenRes.json();
  } catch (e) {
    console.error("[notion/callback]", e);
    return appRedirect(req, { notion: "error", reason: "network" });
  }

  if (!tokenData.access_token) {
    return appRedirect(req, { notion: "error", reason: "no_token" });
  }

  const convexToken = await getToken({ template: "convex" });
  if (!convexToken) {
    return appRedirect(req, { notion: "error", reason: "missing_convex_token" });
  }

  try {
    await fetchMutation(
      api.notion.storeToken,
      {
        accessToken: tokenData.access_token,
        workspaceId: tokenData.workspace_id,
        workspaceName: tokenData.workspace_name,
        botId: tokenData.bot_id,
      },
      { token: convexToken }
    );
  } catch (e) {
    console.error("[notion/callback] storeToken failed", e);
    return appRedirect(req, { notion: "error", reason: "store" });
  }

  return appRedirect(req, { notion: "connected" });
}
