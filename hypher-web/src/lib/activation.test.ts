import { describe, expect, it } from "vitest";
import {
  getAppAccessState,
  getCaptureEmptyState,
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
