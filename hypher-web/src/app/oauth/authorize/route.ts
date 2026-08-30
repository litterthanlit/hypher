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

type AuthorizeFailureLog = {
  error: string;
  errorDescription: string;
  clientId: string | null;
  redirectUri: string | null;
  clerkSessionExisted: boolean;
};

function oauthAuthorizeRedirectUriHost(redirectUri: string | null): string | null {
  if (!redirectUri) return null;
  try {
    return new URL(redirectUri).host || null;
  } catch {
    return null;
  }
}

function logOAuthAuthorizeFailure(
  destination: "error_redirect" | "sign_in",
  fields: AuthorizeFailureLog
): void {
  console.warn("[oauth/authorize]", {
    destination,
    error: fields.error,
    error_description: fields.errorDescription,
    client_id: fields.clientId,
    redirect_uri_host: oauthAuthorizeRedirectUriHost(fields.redirectUri),
    clerk_session_existed: fields.clerkSessionExisted,
  });
}

function isMissingConvexTokenError(error: unknown): boolean {
  return (
    error instanceof ServerAuthError &&
    error.status === 401 &&
    error.message === "missing_convex_token"
  );
}

function errorRedirect(
  redirectUri: string | null,
  error: string,
  description: string,
  state: string | undefined,
  log: { clientId: string | null; clerkSessionExisted: boolean }
) {
  logOAuthAuthorizeFailure("error_redirect", {
    error,
    errorDescription: description,
    clientId: log.clientId,
    redirectUri,
    clerkSessionExisted: log.clerkSessionExisted,
  });
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
  const requestedClientId = req.nextUrl.searchParams.get("client_id");
  const requestedRedirectUri = req.nextUrl.searchParams.get("redirect_uri");
  const requestedState = req.nextUrl.searchParams.get("state") ?? undefined;
  const validation = validateOAuthAuthorizeParams(req.nextUrl.searchParams, baseUrl);
  if (!validation.ok) {
    return errorRedirect(
      requestedRedirectUri,
      validation.error,
      validation.errorDescription,
      requestedState,
      { clientId: requestedClientId, clerkSessionExisted: false }
    );
  }

  let session;
  try {
    session = await requireBetaAccess();
  } catch (error) {
    if (error instanceof ServerAuthError && error.status === 403) {
      return errorRedirect(
        validation.redirectUri,
        "access_denied",
        "Beta access is required.",
        validation.state,
        { clientId: validation.clientId, clerkSessionExisted: true }
      );
    }
    if (isMissingConvexTokenError(error)) {
      return errorRedirect(
        validation.redirectUri,
        "server_error",
        "Missing Hypher auth token.",
        validation.state,
        { clientId: validation.clientId, clerkSessionExisted: true }
      );
    }
    const signIn = new URL("/sign-in", baseUrl);
    signIn.searchParams.set("redirect_url", `${req.nextUrl.pathname}${req.nextUrl.search}`);
    logOAuthAuthorizeFailure("sign_in", {
      error: error instanceof ServerAuthError ? error.message : "unauth",
      errorDescription: "Sign-in required.",
      clientId: validation.clientId,
      redirectUri: validation.redirectUri,
      clerkSessionExisted: false,
    });
    return NextResponse.redirect(signIn);
  }

  const convexToken = session.convexToken;
  if (!convexToken) {
    return errorRedirect(
      validation.redirectUri,
      "server_error",
      "Missing Hypher auth token.",
      validation.state,
      { clientId: validation.clientId, clerkSessionExisted: true }
    );
  }

  const serverSecret = oauthConsentServerSecret();
  if (!serverSecret) {
    console.error("[oauth/authorize] HYPHER_OAUTH_CONSENT_SECRET missing");
    return errorRedirect(
      validation.redirectUri,
      "server_error",
      "OAuth consent is not configured.",
      validation.state,
      { clientId: validation.clientId, clerkSessionExisted: true }
    );
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
