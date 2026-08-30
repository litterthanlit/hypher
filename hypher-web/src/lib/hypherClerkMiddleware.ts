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
  CLERK_ENCRYPTION_KEY?: string;
};

export type ClerkMiddlewareKeys = {
  publishableKey?: string;
  secretKey?: string;
  encryptionKey?: string;
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
    encryptionKey: firstPresent(env.CLERK_ENCRYPTION_KEY),
  };
}

/**
 * Builds the Next middleware Clerk should run.
 *
 * clerkMiddleware throws before any route matcher when publishableKey is
 * missing, and again when secretKey is passed as a dynamic option without
 * CLERK_ENCRYPTION_KEY (`encryption_key_missing`). Public pages must still
 * render, so we pass through without Clerk when publishableKey is absent,
 * and we only propagate secretKey when the encryption key is also present.
 * Clerk still reads CLERK_SECRET_KEY from the environment for auth.
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

  // Clerk docs: CLERK_ENCRYPTION_KEY is mandatory only when providing secretKey
  // as a middleware option. If it is missing, omit secretKey instead of 500ing.
  const secretKey = keys.secretKey && keys.encryptionKey ? keys.secretKey : undefined;

  return createClerk(handler, {
    publishableKey,
    ...(secretKey ? { secretKey } : {}),
  });
}
