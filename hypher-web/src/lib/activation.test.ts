import { describe, expect, it } from "vitest";
import {
  asQueryList,
  getAppAccessState,
  getAppGateQueryArgs,
  getUnsignedAppSignInHref,
  shouldSkipAuthedConvexQuery,
} from "./activation";

describe("app access state", () => {
  it("waits only for Clerk before deciding a signed-out /app visit", () => {
    expect(
      getAppAccessState({
        clerkLoaded: false,
        isSignedIn: false,
      })
    ).toBe("loading");
  });

  it("sends unsigned /app to sign-in without waiting on Convex gateState", () => {
    expect(
      getAppAccessState({
        clerkLoaded: true,
        isSignedIn: false,
      })
    ).toBe("sign_in_required");
    expect(
      getAppAccessState({
        clerkLoaded: true,
        isSignedIn: false,
        gateState: undefined,
      })
    ).toBe("sign_in_required");
  });

  it("requires sign-in even when beta access is open", () => {
    expect(
      getAppAccessState({
        clerkLoaded: true,
        isSignedIn: false,
        gateState: { hasAccess: true, isAuthenticated: false },
      })
    ).toBe("sign_in_required");
  });

  it("still waits for Convex after Clerk confirms a signed-in session", () => {
    expect(
      getAppAccessState({
        clerkLoaded: true,
        isSignedIn: true,
      })
    ).toBe("loading");
  });

  it("keeps a signed-in user on loading until Convex auth is ready", () => {
    expect(
      getAppAccessState({
        clerkLoaded: true,
        isSignedIn: true,
        convexAuthLoading: true,
        gateState: { hasAccess: true, isAuthenticated: true },
      })
    ).toBe("loading");
  });

  it("does not treat a Clerk session as enough to open /app before Convex JWT exists", () => {
    expect(
      getAppAccessState({
        clerkLoaded: true,
        isSignedIn: true,
        convexAuthLoading: false,
        gateState: undefined,
      })
    ).toBe("loading");
  });

  it("opens the workspace once a signed-in user has beta access", () => {
    expect(
      getAppAccessState({
        clerkLoaded: true,
        isSignedIn: true,
        gateState: { hasAccess: true, isAuthenticated: true },
      })
    ).toBe("app");
  });

  it("keeps signed-in users without beta on the invite gate", () => {
    expect(
      getAppAccessState({
        clerkLoaded: true,
        isSignedIn: true,
        gateState: { hasAccess: false, isAuthenticated: true },
      })
    ).toBe("beta_gate");
  });
});

describe("unsigned /app gate", () => {
  it("skips the Convex beta gate query until Clerk reports a signed-in user", () => {
    expect(getAppGateQueryArgs({ clerkLoaded: false, isSignedIn: false })).toBe("skip");
    expect(getAppGateQueryArgs({ clerkLoaded: true, isSignedIn: false })).toBe("skip");
    expect(getAppGateQueryArgs({ clerkLoaded: true, isSignedIn: true })).toEqual({});
  });

  it("skips requireBetaAccess queries while Convex auth is still loading", () => {
    expect(
      getAppGateQueryArgs({
        clerkLoaded: true,
        isSignedIn: true,
        convexAuthLoading: true,
      })
    ).toBe("skip");
    expect(
      shouldSkipAuthedConvexQuery({
        clerkLoaded: true,
        isSignedIn: true,
        convexAuthenticated: false,
      })
    ).toBe(true);
    expect(
      shouldSkipAuthedConvexQuery({
        clerkLoaded: true,
        isSignedIn: true,
        convexAuthenticated: true,
      })
    ).toBe(false);
  });

  it("sends unsigned /app to the existing sign-in flow", () => {
    expect(getUnsignedAppSignInHref("/app")).toBe("/sign-in?redirect_url=%2Fapp");
    expect(getUnsignedAppSignInHref("/app?project=p1")).toBe(
      "/sign-in?redirect_url=%2Fapp%3Fproject%3Dp1"
    );
  });
});

describe("empty workspace query results", () => {
  it("treats null or undefined Convex lists as empty instead of crashing .map", () => {
    expect(asQueryList(undefined)).toEqual([]);
    expect(asQueryList(null)).toEqual([]);
    expect(asQueryList([])).toEqual([]);
    expect(asQueryList([{ id: "p1" }])).toEqual([{ id: "p1" }]);
  });
});
