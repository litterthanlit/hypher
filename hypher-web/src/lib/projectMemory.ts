import type {
  ActivityEntry,
  AnyObject,
  Project,
  ProjectMemory,
  ProjectMemoryStatus,
  ProjectNextAction,
  ProjectNextActionStatus,
} from "@/types";
import {
  compileHeuristicMemory,
  snapshotToAiShape,
  type ProjectMemoryAiShape,
} from "../../shared/projectMemoryGenerate";

export {
  buildProjectMemoryPrompt,
  parseProjectMemoryJson,
} from "../../shared/projectMemoryGenerate";
export type { ProjectMemoryAiShape, ProjectMemoryParseResult } from "../../shared/projectMemoryGenerate";

export const PROJECT_MEMORY_ITEM_LIMIT = 12;
export const PROJECT_MEMORY_ACTIVITY_LIMIT = 8;
export const PROJECT_MEMORY_CONTENT_LIMIT = 700;
export const PROJECT_MEMORY_BLOCKER_LIMIT = 500;
export const PROJECT_MEMORY_GITHUB_LIMIT = 500;

export interface ProjectMemorySourceInput {
  project: Project;
  items: AnyObject[];
  activities?: Pick<ActivityEntry, "timestamp">[];
}

export interface PreparedProjectMemoryItem {
  id: string;
  kind: "note" | "artifact";
  name: string;
  content: string;
  modifiedAt: number;
  maturity?: string;
}

export interface PreparedProjectMemoryActivity {
  action: string;
  objectName: string;
  timestamp: number;
  summary?: string;
}

export interface PreparedProjectMemoryInput {
  project: {
    id: string;
    name: string;
    description: string;
    status: Project["status"];
    priority?: Project["priority"];
    blockers?: string;
    lastActivity?: number;
    githubRepo?: string;
    githubSummary?: string;
  };
  items: PreparedProjectMemoryItem[];
  activities: PreparedProjectMemoryActivity[];
  health?: {
    score: number;
    reasons: string[];
  };
  sourceUpdatedAt: number;
}

function truncate(value: string | undefined, max: number): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, Math.max(0, max - 3)).trimEnd()}...`;
}

function getItemName(item: AnyObject): string {
  if (item.kind === "note") {
    return truncate(item.content, 80) || "Untitled note";
  }
  if (item.kind === "artifact") return item.name;
  return item.name;
}

function getItemContent(item: AnyObject): string {
  if (item.kind === "note") return truncate(item.content, PROJECT_MEMORY_CONTENT_LIMIT);
  if (item.kind === "artifact") {
    return truncate([item.name, item.type, item.fileReference].filter(Boolean).join(" | "), PROJECT_MEMORY_CONTENT_LIMIT);
  }
  return truncate([item.name, item.description].filter(Boolean).join(" | "), PROJECT_MEMORY_CONTENT_LIMIT);
}

export function computeProjectMemorySourceUpdatedAt({
  project,
  items,
  activities = [],
}: ProjectMemorySourceInput): number {
  const itemTimes = items.map((item) => item.modifiedAt ?? 0);
  const activityTimes = activities.map((activity) => activity.timestamp ?? 0);
  return Math.max(
    project.modifiedAt ?? 0,
    project.lastActivity ?? 0,
    ...itemTimes,
    ...activityTimes,
    0
  );
}

export function getProjectMemoryStatus(params: {
  memory?: ProjectMemory | null;
  sourceUpdatedAt: number;
  generating?: boolean;
}): ProjectMemoryStatus {
  if (params.generating) return "generating";
  if (!params.memory) return "empty";
  if (params.memory.error && !params.memory.summary) return "error";
  return params.sourceUpdatedAt > params.memory.generatedAt ? "stale" : "fresh";
}

export function canGenerateProjectMemory(project: Project): boolean {
  return project.status === "active" || project.status === "paused";
}

export function selectPrimaryNextAction(
  actions: ProjectNextAction[] = []
): ProjectNextAction | null {
  return actions.find((action) => action.status === "accepted")
    ?? actions.find((action) => action.status === "suggested")
    ?? null;
}

export function updateNextActionStatus(
  actions: ProjectNextAction[],
  actionId: string,
  status: Extract<ProjectNextActionStatus, "accepted" | "dismissed">,
  now: number
): ProjectNextAction[] {
  return actions.map((action) => (
    action.id === actionId ? { ...action, status, updatedAt: now } : action
  ));
}

export function prepareProjectMemoryInput(params: {
  project: Project;
  items: AnyObject[];
  activities?: ActivityEntry[];
  health?: { score: number; reasons: string[] };
  githubSummary?: string;
}): PreparedProjectMemoryInput {
  const projectItems = params.items
    .filter((item) => item.kind !== "project")
    .sort((a, b) => (b.modifiedAt ?? 0) - (a.modifiedAt ?? 0))
    .slice(0, PROJECT_MEMORY_ITEM_LIMIT)
    .map((item): PreparedProjectMemoryItem => ({
      id: item.id,
      kind: item.kind as "note" | "artifact",
      name: getItemName(item),
      content: getItemContent(item),
      modifiedAt: item.modifiedAt,
      maturity: item.kind === "note" ? item.maturity : undefined,
    }));

  const activities = (params.activities ?? [])
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, PROJECT_MEMORY_ACTIVITY_LIMIT)
    .map((activity): PreparedProjectMemoryActivity => ({
      action: activity.activityType ?? activity.action,
      objectName: truncate(activity.objectName, 90),
      timestamp: activity.timestamp,
      summary: activity.summary ? truncate(activity.summary, 240) : undefined,
    }));

  const sourceUpdatedAt = computeProjectMemorySourceUpdatedAt({
    project: params.project,
    items: params.items,
    activities: params.activities ?? [],
  });

  return {
    project: {
      id: params.project.id,
      name: truncate(params.project.name, 100),
      description: truncate(params.project.description, PROJECT_MEMORY_CONTENT_LIMIT),
      status: params.project.status,
      priority: params.project.priority,
      blockers: truncate(params.project.blockers, PROJECT_MEMORY_BLOCKER_LIMIT) || undefined,
      lastActivity: params.project.lastActivity,
      githubRepo: params.project.githubRepo,
      githubSummary: truncate(params.githubSummary, PROJECT_MEMORY_GITHUB_LIMIT) || undefined,
    },
    items: projectItems,
    activities,
    health: params.health,
    sourceUpdatedAt,
  };
}

export function fallbackProjectMemory(input: PreparedProjectMemoryInput): ProjectMemoryAiShape {
  return snapshotToAiShape(compileHeuristicMemory({
    projectName: input.project.name,
    projectDescription: input.project.description,
    projectBlockers: input.project.blockers,
    items: input.items.map((item) => ({
      id: item.id,
      name: item.name,
      content: item.content,
    })),
    now: input.sourceUpdatedAt,
  }));
}
