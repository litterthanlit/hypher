import { NextRequest, NextResponse } from "next/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "../../../../convex/_generated/api";
import {
  HYPHER_MCP_SCOPE,
  baseUrlFromRequest,
  codeChallengeS256,
  generateOpaqueToken,
  sha256Base64url,
} from "@/lib/oauthBridge";

export const runtime = "nodejs";

function oauthError(error: string, description: string, status = 400) {
  return NextResponse.json({ error, error_description: description }, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";
  const params = new URLSearchParams();
  if (contentType.includes("application/json")) {
    const body = await req.json() as Record<string, string>;
    for (const [key, value] of Object.entries(body)) {
      if (typeof value === "string") params.set(key, value);
    }
  } else {
    const body = await req.text();
    for (const [key, value] of new URLSearchParams(body)) {
      params.set(key, value);
    }
  }

  const grantType = params.get("grant_type");
  const code = params.get("code") ?? "";
  const redirectUri = params.get("redirect_uri") ?? "";
  const clientId = params.get("client_id") ?? "";
  const codeVerifier = params.get("code_verifier") ?? "";
  const resource = params.get("resource") || baseUrlFromRequest(req.url);

  if (grantType !== "authorization_code") {
    return oauthError("unsupported_grant_type", "Hypher only supports authorization_code.");
  }
  if (!code || !redirectUri || !clientId || !codeVerifier) {
    return oauthError("invalid_request", "Missing code, redirect_uri, client_id, or code_verifier.");
  }

  const accessToken = generateOpaqueToken("hya");
  const exchanged = await fetchMutation((api as any).oauth.exchangeAuthorizationCode, {
    codeHash: sha256Base64url(code),
    clientId,
    redirectUri,
    codeChallenge: codeChallengeS256(codeVerifier),
    resource,
    accessTokenHash: sha256Base64url(accessToken),
    now: Date.now(),
  });

  if (!exchanged) {
    return oauthError("invalid_grant", "Authorization code is invalid, expired, already used, or not bound to this client.");
  }

  return NextResponse.json({
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: exchanged.expiresIn,
    scope: exchanged.scope || HYPHER_MCP_SCOPE,
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}
