import type { ActivityEntry, AnyObject, Project, ProjectMemory } from "@/types";
import type { AgentEvent, ProjectAction } from "@/types";
import { selectPrimaryNextAction } from "./projectMemory";
import {
  agentEventNeedsHumanAccept,
  isSkeletonSummary,
} from "../../shared/projectMemoryGenerate";

export { agentEventNeedsHumanAccept };

export const BUILDER_BRIEF_COPY_LABEL = "Copy brief";
export const BUILDER_BRIEF_COPY_SUCCESS_TOAST = "Brief copied";
export const BUILDER_BRIEF_COPY_ERROR_TOAST = "Could not copy brief";

export function isEmptyBuilderBrief(memory: ProjectMemory | null | undefined): boolean {
  if (!memory) return true;
  return isSkeletonSummary(memory.summary);
}

export function builderBriefFields(memory: ProjectMemory | null | undefined) {
  const next = selectPrimaryNextAction(memory?.nextActions ?? []);
  return {
    empty: isEmptyBuilderBrief(memory),
    summary: memory?.summary ?? "",
    direction: memory?.currentDirection ?? "",
    decisions: memory?.importantDecisions ?? [],
    constraints: memory?.constraints ?? [],
    questions: memory?.openQuestions ?? [],
    nextMove: next?.title ?? "",
  };
}

export function buildProjectPulseModel(params: {
  project: Project;
  allObjects: AnyObject[];
  activity: ActivityEntry[];
  memories?: ProjectMemory[];
}) {
  const latestCaptures = params.allObjects
    .filter((obj) => obj.kind !== "project" && obj.projectId === params.project.id && obj.captureStatus !== "archived")
    .sort((a, b) => (b.modifiedAt ?? 0) - (a.modifiedAt ?? 0))
    .slice(0, 5);

  const recentActivity = params.activity
    .filter((entry) => entry.projectId === params.project.id)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 5);

  const memory = params.memories?.find((item) => item.projectId === params.project.id) ?? null;

  return {
    latestCaptures,
    recentActivity,
    memory,
    primaryNextAction: selectPrimaryNextAction(memory?.nextActions ?? []),
  };
}

export function buildProjectContextInput(params: {
  project: Project;
  model: ReturnType<typeof buildProjectPulseModel>;
  actionQueue: ProjectAction[];
  agentEvents: AgentEvent[];
}) {
  return {
    project: params.project,
    memory: params.model.memory,
    captures: params.model.latestCaptures,
    activity: params.model.recentActivity,
    actions: params.actionQueue,
    agentEvents: params.agentEvents,
  };
}
