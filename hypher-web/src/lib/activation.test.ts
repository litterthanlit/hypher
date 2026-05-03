import { describe, expect, it } from "vitest";
import {
  getAppAccessState,
  getCaptureEmptyState,
  getFirstUseActivationRail,
  getWorkspaceChromeState,
  getWorkspaceEmptyState,
  type WorkspaceContentMode,
} from "./activation";

describe("app access state", () => {
  it("requires sign-in even when beta access is open", () => {
    expect(
      getAppAccessState({
        clerkLoaded: true,
        isSignedIn: false,
        gateState: { hasAccess: true, isAuthenticated: false },
      })
    ).toBe("sign_in_required");
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
