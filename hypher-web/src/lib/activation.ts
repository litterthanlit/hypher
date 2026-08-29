export type WorkspaceContentMode = "pulse" | "canvas" | "list" | "dashboard" | "inbox" | "agent-inbox";

export type ActivationAction = "capture" | "manual_project";
export type FirstUseActivationAction = ActivationAction | "open_project";
export type AppAccessState = "loading" | "sign_in_required" | "beta_gate" | "app";

export interface ActivationEmptyState {
  title: string;
  body: string;
  primaryAction: ActivationAction;
  secondaryAction?: ActivationAction;
}

export interface FirstUseActivationStep {
  label: string;
  complete: boolean;
  current: boolean;
  meta?: string;
}

export interface FirstUseActivationRail {
  title: string;
  body: string;
  primaryAction: FirstUseActivationAction;
  primaryLabel: string;
  isComplete: boolean;
  steps: FirstUseActivationStep[];
}

export function getAppGateQueryArgs(params: {
  clerkLoaded: boolean;
  isSignedIn: boolean;
}): Record<string, never> | "skip" {
  if (!params.clerkLoaded || !params.isSignedIn) return "skip";
  return {};
}

export function getUnsignedAppSignInHref(redirectPath = "/app"): string {
  const path = redirectPath.startsWith("/") ? redirectPath : `/${redirectPath}`;
  return `/sign-in?redirect_url=${encodeURIComponent(path)}`;
}

export function getAppAccessState(params: {
  clerkLoaded: boolean;
  isSignedIn: boolean;
  gateState?: { hasAccess: boolean; isAuthenticated?: boolean };
}): AppAccessState {
  if (!params.clerkLoaded) return "loading";
  // Clerk already knows the session. Do not wait on Convex — unsigned
  // clients never resolve beta.getGateState, so /app would spin forever.
  if (!params.isSignedIn) return "sign_in_required";
  if (params.gateState === undefined) return "loading";
  if (params.gateState.isAuthenticated === false) return "sign_in_required";
  if (!params.gateState.hasAccess) return "beta_gate";
  return "app";
}

export function getFirstUseActivationRail(params: {
  captureCount: number;
  projectCount: number;
  sortedCaptureCount: number;
  memoryCount: number;
  reviewedNextActionCount: number;
}): FirstUseActivationRail {
  const captureProgress = Math.min(Math.max(params.captureCount, 0), 3);
  const capturedThree = params.captureCount >= 3;
  const sortedIntoProject = params.projectCount > 0 && params.sortedCaptureCount > 0;
  const generatedMemory = params.memoryCount > 0;
  const reviewedNextAction = params.reviewedNextActionCount > 0;

  const rawSteps: Array<Omit<FirstUseActivationStep, "current">> = [
    {
      label: "Capture 3 real fragments",
      complete: capturedThree,
      meta: `${captureProgress}/3`,
    },
    {
      label: "Sort them into a project",
      complete: sortedIntoProject,
    },
    {
      label: "Generate project memory",
      complete: generatedMemory,
    },
    {
      label: "Review a next action",
      complete: reviewedNextAction,
    },
  ];
  const currentIndex = rawSteps.findIndex((step) => !step.complete);
  const steps = rawSteps.map((step, index) => ({
    ...step,
    current: index === currentIndex,
  }));
  const isComplete = currentIndex === -1;

  let primaryAction: FirstUseActivationAction = "capture";
  let primaryLabel = "Capture fragment";
  if (capturedThree && !sortedIntoProject) {
    primaryAction = "manual_project";
    primaryLabel = "Create project";
  } else if (sortedIntoProject && (!generatedMemory || !reviewedNextAction)) {
    primaryAction = "open_project";
    primaryLabel = generatedMemory ? "Review next action" : "Open project pulse";
  }

  return {
    title: "First project pulse",
    body: "Capture a few real fragments, sort them into a project, then let Hypher create memory and a next move.",
    primaryAction,
    primaryLabel,
    isComplete,
    steps,
  };
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
  if (params.projectCount === 0 && params.contentMode !== "inbox" && params.contentMode !== "agent-inbox") {
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
  if (params.projectCount === 0 && params.contentMode !== "inbox" && params.contentMode !== "agent-inbox") {
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
