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

  return createClerk(handler, {
    publishableKey,
    ...(keys.secretKey ? { secretKey: keys.secretKey } : {}),
  });
}
