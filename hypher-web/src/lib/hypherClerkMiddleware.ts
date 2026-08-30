import {
  clerkMiddleware,
  type ClerkMiddlewareAuth,
  type ClerkMiddlewareOptions,
} from "@clerk/nextjs/server";
import {
  NextResponse,
  type NextFetchEvent,
  type NextMiddleware,
  type NextRequest,
} from "next/server";

export type ClerkMiddlewareEnv = {
  CLERK_PUBLISHABLE_KEY?: string;
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?: string;
  CLERK_SECRET_KEY?: string;
};

export type ClerkMiddlewareKeys = {
  publishableKey?: string;
  secretKey?: string;
};

type HypherClerkHandler = (
  auth: ClerkMiddlewareAuth,
  request: NextRequest,
  event: NextFetchEvent
) => ReturnType<NextMiddleware> | void | Promise<void>;

type HypherClerkFactory = (
  handler: HypherClerkHandler,
  options?: ClerkMiddlewareOptions
) => NextMiddleware;

function firstPresent(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}

export function resolveClerkMiddlewareKeys(env: ClerkMiddlewareEnv): ClerkMiddlewareKeys {
  return {
    publishableKey: firstPresent(env.CLERK_PUBLISHABLE_KEY, env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY),
    secretKey: firstPresent(env.CLERK_SECRET_KEY),
  };
}

/**
 * OAuth protocol and discovery routes that must reach the App Router even if
 * Clerk middleware returns 4xx. Consent still goes through Clerk so sessions
 * stay intact. Other app routes keep full Clerk protection.
 */
export function isClerkOptionalOAuthProtocolPath(pathname: string): boolean {
  return (
    pathname === "/oauth/authorize" ||
    pathname === "/oauth/token" ||
    pathname.startsWith("/.well-known/")
  );
}

export function shouldBypassFailedClerkForOAuthProtocol(
  pathname: string,
  status: number
): boolean {
  return status >= 400 && isClerkOptionalOAuthProtocolPath(pathname);
}

/**
 * Builds the Next middleware Clerk should run. When the publishable key is
 * missing, clerkMiddleware throws before any route matcher — including `/` —
 * so we pass through instead of 500ing public pages.
 */
export function createHypherClerkMiddleware(
  keys: ClerkMiddlewareKeys,
  handler: HypherClerkHandler,
  createClerk: HypherClerkFactory = clerkMiddleware
): NextMiddleware {
  const publishableKey = keys.publishableKey;
  if (!publishableKey) {
    return function passthroughClerkMiddleware() {
      return NextResponse.next();
    };
  }

  const clerk = createClerk(handler, {
    publishableKey,
    ...(keys.secretKey ? { secretKey: keys.secretKey } : {}),
  });

  return async function hypherClerkMiddleware(req, event) {
    try {
      const result = await clerk(req, event);
      if (
        result &&
        shouldBypassFailedClerkForOAuthProtocol(req.nextUrl.pathname, result.status)
      ) {
        return NextResponse.next();
      }
      return result;
    } catch (error) {
      if (isClerkOptionalOAuthProtocolPath(req.nextUrl.pathname)) {
        return NextResponse.next();
      }
      throw error;
    }
  };
}
