export type AppAccessState = "loading" | "sign_in_required" | "beta_gate" | "app";

export function getAppGateQueryArgs(params: {
  clerkLoaded: boolean;
  isSignedIn: boolean;
  convexAuthLoading?: boolean;
}): Record<string, never> | "skip" {
  if (!params.clerkLoaded || !params.isSignedIn || params.convexAuthLoading) return "skip";
  return {};
}

/** Skip queries that call requireBetaAccess until both Clerk and Convex JWT are ready. */
export function shouldSkipAuthedConvexQuery(params: {
  clerkLoaded: boolean;
  isSignedIn: boolean;
  convexAuthenticated: boolean;
}): boolean {
  return !params.clerkLoaded || !params.isSignedIn || !params.convexAuthenticated;
}

/** Convex useQuery is undefined while loading; never treat a null list as iterable. */
export function asQueryList<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

export function getUnsignedAppSignInHref(redirectPath = "/app"): string {
  const path = redirectPath.startsWith("/") ? redirectPath : `/${redirectPath}`;
  return `/sign-in?redirect_url=${encodeURIComponent(path)}`;
}

export function getAppAccessState(params: {
  clerkLoaded: boolean;
  isSignedIn: boolean;
  convexAuthLoading?: boolean;
  gateState?: { hasAccess: boolean; isAuthenticated?: boolean };
}): AppAccessState {
  if (!params.clerkLoaded) return "loading";
  // Clerk already knows the session. Do not wait on Convex — unsigned
  // clients never resolve beta.getGateState, so /app would spin forever.
  if (!params.isSignedIn) return "sign_in_required";
  // Clerk is signed in, but Convex JWT may still be missing. Queries that
  // call requireBetaAccess throw; Next.js then shows "This page couldn't load".
  if (params.convexAuthLoading) return "loading";
  if (params.gateState === undefined) return "loading";
  if (params.gateState.isAuthenticated === false) return "sign_in_required";
  if (!params.gateState.hasAccess) return "beta_gate";
  return "app";
}
