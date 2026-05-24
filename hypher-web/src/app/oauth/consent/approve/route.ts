import { NextRequest, NextResponse } from "next/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "../../../../../convex/_generated/api";
import {
  buildOAuthAuthorizeRedirect,
  generateOpaqueToken,
  oauthConsentServerSecret,
  parseOAuthConsentRequestParams,
  sha256Base64url,
} from "@/lib/oauthBridge";
import { requireBetaAccess, ServerAuthError } from "@/lib/serverAuth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const parsed = parseOAuthConsentRequestParams(req.nextUrl.searchParams);
  if (!parsed.ok) {
    return NextResponse.json({ error: "invalid_request", error_description: parsed.errorDescription }, { status: 400 });
  }

  let session;
  try {
    session = await requireBetaAccess();
  } catch (error) {
    if (error instanceof ServerAuthError && error.status === 403) {
      return NextResponse.json({ error: "access_denied", error_description: "Beta access is required." }, { status: 403 });
    }
    const signIn = new URL("/sign-in", req.nextUrl.origin);
    signIn.searchParams.set("redirect_url", `${req.nextUrl.pathname}${req.nextUrl.search}`);
    return NextResponse.redirect(signIn);
  }

  const convexToken = session.convexToken;
  if (!convexToken) {
    return NextResponse.json({ error: "server_error", error_description: "Missing Hypher auth token." }, { status: 500 });
  }

  const serverSecret = oauthConsentServerSecret();
  if (!serverSecret) {
    return NextResponse.json({ error: "server_error", error_description: "OAuth consent is not configured." }, { status: 500 });
  }

  const code = generateOpaqueToken("hyc");
  const issued = await fetchMutation((api as any).oauth.createAuthorizationCode, {
    codeHash: sha256Base64url(code),
    consentId: parsed.consentId as any,
    csrfTokenHash: sha256Base64url(parsed.csrfToken),
    now: Date.now(),
    serverSecret,
  }, { token: convexToken });

  if (!issued) {
    return NextResponse.json({ error: "invalid_request", error_description: "Consent transaction is invalid or expired." }, { status: 400 });
  }

  return NextResponse.redirect(buildOAuthAuthorizeRedirect({
    redirectUri: issued.redirectUri,
    code,
    state: issued.state,
  }));
}
