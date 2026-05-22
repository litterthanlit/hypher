import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

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

export default clerkMiddleware(async (auth, req) => {
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
