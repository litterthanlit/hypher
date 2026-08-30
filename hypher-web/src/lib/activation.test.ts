import { describe, expect, it } from "vitest";
import {
  asQueryList,
  getAppAccessState,
  getAppGateQueryArgs,
  getCaptureEmptyState,
  getFirstUseActivationRail,
  getUnsignedAppSignInHref,
  getWorkspaceChromeState,
  getWorkspaceEmptyState,
  shouldSkipAuthedConvexQuery,
  type WorkspaceContentMode,
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

describe("capture activation copy", () => {
  it("starts empty users with capture instead of sending them to workspace", () => {
    expect(getCaptureEmptyState(0)).toEqual({
      title: "Start with 3 fragments",
      body: "Paste a note, bug, idea, link, decision, or half-formed thought from something you are building. Hypher will help turn them into your first project memory.",
      primaryAction: "capture",
      secondaryAction: "manual_project",
    });
  });
});

describe("first-use activation rail", () => {
  it("starts new users with a 3-fragment capture goal", () => {
    expect(
      getFirstUseActivationRail({
        captureCount: 0,
        projectCount: 0,
        sortedCaptureCount: 0,
        memoryCount: 0,
        reviewedNextActionCount: 0,
      })
    ).toMatchObject({
      title: "First project pulse",
      primaryAction: "capture",
      isComplete: false,
      steps: [
        { label: "Capture 3 real fragments", complete: false, current: true, meta: "0/3" },
        { label: "Sort them into a project", complete: false, current: false },
        { label: "Generate project memory", complete: false, current: false },
        { label: "Review a next action", complete: false, current: false },
      ],
    });
  });

  it("moves users to project creation after three captures", () => {
    const rail = getFirstUseActivationRail({
      captureCount: 3,
      projectCount: 0,
      sortedCaptureCount: 0,
      memoryCount: 0,
      reviewedNextActionCount: 0,
    });

    expect(rail?.primaryAction).toBe("manual_project");
    expect(rail?.steps[0]).toMatchObject({ complete: true, meta: "3/3" });
    expect(rail?.steps[1]).toMatchObject({ complete: false, current: true });
  });

  it("marks the rail complete after memory and next action review", () => {
    const rail = getFirstUseActivationRail({
      captureCount: 4,
      projectCount: 1,
      sortedCaptureCount: 3,
      memoryCount: 1,
      reviewedNextActionCount: 1,
    });

    expect(rail?.isComplete).toBe(true);
    expect(rail?.steps.every((step) => step.complete)).toBe(true);
  });
});

describe("workspace activation state", () => {
  it("hides project view tabs when no project exists", () => {
    expect(
      getWorkspaceChromeState({
        projectCount: 0,
        selectedProjectId: null,
        contentMode: "canvas",
      })
    ).toEqual({
      showProjectViewTabs: false,
      currentLabel: "first project",
    });
  });

  it("shows project view tabs only after a project is selected", () => {
    expect(
      getWorkspaceChromeState({
        projectCount: 1,
        selectedProjectId: "p1",
        contentMode: "pulse",
      })
    ).toMatchObject({
      showProjectViewTabs: true,
      currentLabel: "project pulse",
    });
  });

  it("replaces blank workspace with first-run activation", () => {
    expect(
      getWorkspaceEmptyState({
        projectCount: 0,
        selectedProjectId: null,
        contentMode: "canvas" as WorkspaceContentMode,
      })
    ).toEqual({
      title: "No project pulse yet",
      body: "Capture a few real fragments first. Hypher will help group them into a project and create memory around it.",
      primaryAction: "capture",
      secondaryAction: "manual_project",
    });
  });
});
