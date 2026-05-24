import { NextRequest, NextResponse } from "next/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "../../../../convex/_generated/api";
import {
  baseUrlFromRequest,
  buildOAuthConsentUrl,
  generateOpaqueToken,
  oauthConsentServerSecret,
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

  const convexToken = session.convexToken;
  if (!convexToken) {
    return errorRedirect(validation.redirectUri, "server_error", "Missing Hypher auth token.", validation.state);
  }

  const serverSecret = oauthConsentServerSecret();
  if (!serverSecret) {
    return errorRedirect(validation.redirectUri, "server_error", "OAuth consent is not configured.", validation.state);
  }

  const csrfToken = generateOpaqueToken("hycsrf");
  const pending = await fetchMutation((api as any).oauth.createPendingConsent, {
    clientId: validation.clientId,
    redirectUri: validation.redirectUri,
    codeChallenge: validation.codeChallenge,
    resource: validation.resource,
    scope: validation.scope,
    state: validation.state,
    csrfTokenHash: sha256Base64url(csrfToken),
    now: Date.now(),
    serverSecret,
  }, { token: convexToken });

  return NextResponse.redirect(buildOAuthConsentUrl(baseUrl, {
    consentId: String(pending.consentId),
    csrfToken,
  }));
}
