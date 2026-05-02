export type WorkspaceContentMode = "pulse" | "canvas" | "list" | "dashboard" | "inbox";

export type ActivationAction = "capture" | "manual_project";
export type AppAccessState = "loading" | "sign_in_required" | "beta_gate" | "app";

export interface ActivationEmptyState {
  title: string;
  body: string;
  primaryAction: ActivationAction;
  secondaryAction?: ActivationAction;
}

export function getAppAccessState(params: {
  clerkLoaded: boolean;
  isSignedIn: boolean;
  gateState?: { hasAccess: boolean; isAuthenticated?: boolean };
}): AppAccessState {
  if (!params.clerkLoaded || params.gateState === undefined) return "loading";
  if (!params.isSignedIn || params.gateState.isAuthenticated === false) return "sign_in_required";
  if (!params.gateState.hasAccess) return "beta_gate";
  return "app";
}

export function getCaptureEmptyState(projectCount: number): ActivationEmptyState | null {
  if (projectCount > 0) return null;
  return {
    title: "Start with 3 fragments",
    body: "Paste a note, bug, idea, link, decision, or half-formed thought from something you are building. Hypher will help turn them into your first project memory.",
    primaryAction: "capture",
    secondaryAction: "manual_project",
  };
}

export function getWorkspaceChromeState(params: {
  projectCount: number;
  selectedProjectId: string | null;
  contentMode: WorkspaceContentMode;
}): { showProjectViewTabs: boolean; currentLabel: string } {
  if (params.projectCount === 0 && params.contentMode !== "inbox") {
    return { showProjectViewTabs: false, currentLabel: "first project" };
  }

  if (params.selectedProjectId) {
    return {
      showProjectViewTabs: true,
      currentLabel: params.contentMode === "pulse" ? "project pulse" : params.contentMode,
    };
  }

  return {
    showProjectViewTabs: false,
    currentLabel: params.contentMode === "dashboard" ? "projects" : params.contentMode,
  };
}

export function getWorkspaceEmptyState(params: {
  projectCount: number;
  selectedProjectId: string | null;
  contentMode: WorkspaceContentMode;
}): ActivationEmptyState | null {
  if (params.projectCount === 0) {
    return {
      title: "No project pulse yet",
      body: "Capture a few real fragments first. Hypher will help group them into a project and create memory around it.",
      primaryAction: "capture",
      secondaryAction: "manual_project",
    };
  }

  if (!params.selectedProjectId && (params.contentMode === "canvas" || params.contentMode === "list" || params.contentMode === "pulse")) {
    return {
      title: "Pick a project to see its pulse",
      body: "Each project pulse shows memory, latest captures, open questions, and the next move.",
      primaryAction: "capture",
    };
  }

  return null;
}
