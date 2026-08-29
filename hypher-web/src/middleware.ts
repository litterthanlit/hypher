import { createRouteMatcher } from "@clerk/nextjs/server";
import {
  createHypherClerkMiddleware,
  resolveClerkMiddlewareKeys,
} from "@/lib/hypherClerkMiddleware";

const isPublicRoute = createRouteMatcher([
  "/",
  "/pricing",
  "/beta/request",
  "/capture",
  "/app(.*)",
  "/app/p/(.*)",
  "/share/s/(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/.well-known(.*)",
  "/oauth(.*)",
  "/api/capture(.*)",
  "/api/agent/events(.*)",
  "/api/mcp(.*)",
  "/api/projects(.*)",
  "/api/stripe/checkout(.*)",
  "/api/stripe/webhook(.*)",
  "/api/clerk-webhook(.*)",
]);

// Read env names as static property access so the Edge bundler inlines them.
// @clerk/nextjs 7 only falls back to NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.
const clerkKeys = resolveClerkMiddlewareKeys({
  CLERK_PUBLISHABLE_KEY: process.env.CLERK_PUBLISHABLE_KEY,
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
  CLERK_ENCRYPTION_KEY: process.env.CLERK_ENCRYPTION_KEY,
});

export default createHypherClerkMiddleware(clerkKeys, async (auth, req) => {
  if (!isPublicRoute(req)) await auth.protect();
});

export const config = {
  // Runs on all app routes including /api/* so we can call auth.protect selectively.
  // /api/capture and /api/projects are public via isPublicRoute (no session required).
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
