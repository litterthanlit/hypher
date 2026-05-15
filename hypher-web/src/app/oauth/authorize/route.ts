import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "../../../../convex/_generated/api";
import {
  baseUrlFromRequest,
  buildOAuthAuthorizeRedirect,
  generateOpaqueToken,
  sha256Base64url,
  validateOAuthAuthorizeParams,
} from "@/lib/oauthBridge";

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

  const { userId, getToken } = await auth();
  if (!userId) {
    const signIn = new URL("/sign-in", baseUrl);
    signIn.searchParams.set("redirect_url", `${req.nextUrl.pathname}${req.nextUrl.search}`);
    return NextResponse.redirect(signIn);
  }

  const convexToken = await getToken({ template: "convex" });
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
    now: Date.now(),
  }, { token: convexToken });

  return NextResponse.redirect(buildOAuthAuthorizeRedirect({
    redirectUri: validation.redirectUri,
    code,
    state: validation.state,
  }));
}
