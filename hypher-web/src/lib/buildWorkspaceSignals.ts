import { getFirstUseActivationRail } from "./activation";
import type { AnyObject, Project } from "@/types";
import type { WorkspaceSignals } from "./workspaceLayout";

export function buildWorkspaceSignals(params: {
  projects: Project[];
  allObjects: AnyObject[];
  inboxCount: number;
  agentInboxCount: number;
  selectedProjectId: string | null;
  projectHealthScore: number | null;
  memoryCount: number;
  reviewedNextActionCount: number;
}): WorkspaceSignals {
  const projectIds = new Set(params.projects.map((p) => p.id));
  const captureCount = params.allObjects.filter((o) => o.kind !== "project").length;
  const sortedCaptureCount = params.allObjects.filter(
    (o) => o.kind !== "project" && o.projectId && projectIds.has(o.projectId)
  ).length;
  const activationRail = getFirstUseActivationRail({
    captureCount,
    projectCount: params.projects.length,
    sortedCaptureCount,
    memoryCount: params.memoryCount,
    reviewedNextActionCount: params.reviewedNextActionCount,
  });

  return {
    inboxCount: params.inboxCount,
    agentInboxCount: params.agentInboxCount,
    activationIncomplete: !activationRail.isComplete,
    projectHealthScore: params.projectHealthScore,
    memoryStale: false,
    hasSelectedProject: params.selectedProjectId != null,
  };
}
