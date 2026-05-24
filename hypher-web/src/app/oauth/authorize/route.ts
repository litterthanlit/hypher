import { NextRequest, NextResponse } from "next/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "../../../../convex/_generated/api";
import {
  baseUrlFromRequest,
  buildOAuthConsentUrl,
  buildOAuthAuthorizeRedirect,
  generateOpaqueToken,
  hasOAuthConsentApproval,
  sha256Base64url,
  validateOAuthAuthorizeParams,
} from "@/lib/oauthBridge";
import { requireBetaAccess, ServerAuthError } from "@/lib/serverAuth";

export const runtime = "nodejs";

function errorRedirect(redirectUri: string | null, error: string, description: string, state?: string) {
  if (!redirectUri) {
    return NextResponse.json({ error, error_description: description }, { status: 400 });
  }
  const redirect = new URL(redirectUri);
  redirect.searchParams.set("error", error);
  redirect.searchParams.set("error_description", description);
  if (state) redirect.searchParams.set("state", state);
  return NextResponse.redirect(redirect);
}

export async function GET(req: NextRequest) {
  const baseUrl = baseUrlFromRequest(req.url);
  const validation = validateOAuthAuthorizeParams(req.nextUrl.searchParams, baseUrl);
  if (!validation.ok) {
    return errorRedirect(
      req.nextUrl.searchParams.get("redirect_uri"),
      validation.error,
      validation.errorDescription,
      req.nextUrl.searchParams.get("state") ?? undefined
    );
  }

  let session;
  try {
    session = await requireBetaAccess();
  } catch (error) {
    if (error instanceof ServerAuthError && error.status === 403) {
      return errorRedirect(validation.redirectUri, "access_denied", "Beta access is required.", validation.state);
    }
    const signIn = new URL("/sign-in", baseUrl);
    signIn.searchParams.set("redirect_url", `${req.nextUrl.pathname}${req.nextUrl.search}`);
    return NextResponse.redirect(signIn);
  }

  if (!hasOAuthConsentApproval(req.nextUrl.searchParams)) {
    return NextResponse.redirect(buildOAuthConsentUrl(baseUrl, validation));
  }

  const convexToken = session.convexToken;
  if (!convexToken) {
    return errorRedirect(validation.redirectUri, "server_error", "Missing Hypher auth token.", validation.state);
  }

  const code = generateOpaqueToken("hyc");
  await fetchMutation((api as any).oauth.createAuthorizationCode, {
    codeHash: sha256Base64url(code),
    clientId: validation.clientId,
    redirectUri: validation.redirectUri,
    codeChallenge: validation.codeChallenge,
    resource: validation.resource,
    scope: validation.scope,
    consentedAt: Date.now(),
    now: Date.now(),
  }, { token: convexToken });

  return NextResponse.redirect(buildOAuthAuthorizeRedirect({
    redirectUri: validation.redirectUri,
    code,
    state: validation.state,
  }));
}
