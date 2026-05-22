export type ProjectActionStatus = "suggested" | "accepted" | "completed" | "dismissed";
export type ProjectActionSourceType = "project_memory" | "agent_event" | "manual" | "github";

export interface ProjectAction {
  id: string;
  userId: string;
  projectId: string;
  title: string;
  status: ProjectActionStatus;
  sourceType: ProjectActionSourceType;
  sourceId?: string;
  rationale?: string;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}

export function buildActionFromAgentSuggestion(params: {
  userId: string;
  projectId: string;
  eventId: string;
  title: string;
  now: number;
}): Omit<ProjectAction, "id"> {
  return {
    userId: params.userId,
    projectId: params.projectId,
    title: params.title.trim(),
    status: "suggested",
    sourceType: "agent_event",
    sourceId: params.eventId,
    createdAt: params.now,
    updatedAt: params.now,
  };
}

export function buildActionFromMemoryAction(params: {
  userId: string;
  projectId: string;
  memoryActionId: string;
  title: string;
  rationale?: string;
  status: "suggested" | "accepted" | "dismissed";
  now: number;
}): Omit<ProjectAction, "id"> {
  return {
    userId: params.userId,
    projectId: params.projectId,
    title: params.title.trim(),
    status: params.status,
    sourceType: "project_memory",
    sourceId: params.memoryActionId,
    rationale: params.rationale?.trim() || undefined,
    createdAt: params.now,
    updatedAt: params.now,
  };
}

function normalizedActionTitle(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function findDuplicateAction(actions: ProjectAction[], title: string): ProjectAction | null {
  const key = normalizedActionTitle(title);
  if (!key) return null;
  return actions.find((action) => (
    action.status !== "completed"
    && action.status !== "dismissed"
    && normalizedActionTitle(action.title) === key
  )) ?? null;
}

const statusRank: Record<ProjectActionStatus, number> = {
  accepted: 0,
  suggested: 1,
  completed: 2,
  dismissed: 3,
};

export function selectProjectActionQueue(actions: ProjectAction[]): ProjectAction[] {
  return [...actions].sort((a, b) => {
    const rank = statusRank[a.status] - statusRank[b.status];
    if (rank !== 0) return rank;
    return b.updatedAt - a.updatedAt;
  });
}
