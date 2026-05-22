import type { AgentEvent, AnyObject, Handoff, Project, ProjectAction, ProjectMemory, ProjectNextAction, TargetTool } from "@/types";
import { selectProjectActionQueue } from "./actions";
import { summarizeHandoffResult } from "./handoffResults";
import { selectPrimaryNextAction } from "./projectMemory";

export interface CompileBuilderBriefParams {
  project: Project;
  memory?: ProjectMemory | null;
  captures: AnyObject[];
  actions: ProjectAction[];
  agentEvents: AgentEvent[];
  handoffs?: Handoff[];
  task?: string;
  role?: string;
  generatedAt?: number;
  targetTool?: TargetTool;
  limits?: {
    captures?: number;
    actions?: number;
    agentEvents?: number;
    handoffs?: number;
    recentChanges?: number;
    openQuestions?: number;
    decisions?: number;
    constraints?: number;
    doNotDo?: number;
    recentProgress?: number;
    openActions?: number;
    agentWarnings?: number;
    acceptanceCriteria?: number;
    handoffNotes?: number;
  };
}

export type CompileProjectContextParams = CompileBuilderBriefParams;

export interface CompiledProjectContext {
  packet: string;
  sourceCaptureIds: string[];
  excludedSourceCaptureIds: string[];
  requestedTask: string;
  targetTool: TargetTool;
  generatedAt: number;
  freshness: string;
}

const DEFAULT_LIMITS = {
  captures: 5,
  actions: 5,
  agentEvents: 5,
  handoffs: 5,
  recentChanges: 5,
  openQuestions: 5,
  decisions: 5,
  constraints: 5,
  doNotDo: 6,
  recentProgress: 5,
  openActions: 6,
  agentWarnings: 6,
  acceptanceCriteria: 6,
  handoffNotes: 6,
};

function clean(value: string | undefined | null): string {
  return (value ?? "").trim();
}

function normalizeText(value: string | undefined | null): string {
  return clean(value).replace(/\s+/g, " ");
}

function truncate(value: string, max = 220): string {
  const text = normalizeText(value);
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}...`;
}

function pushSection(lines: string[], title: string, body: string[]) {
  lines.push("", `## ${title}`, "");
  lines.push(...body);
}

function bulletList(items: string[], empty: string): string[] {
  return items.length ? items.map((item) => `- ${item}`) : [`- ${empty}`];
}

function numberedList(items: string[], empty: string): string[] {
  return items.length ? items.map((item, index) => `${index + 1}. ${item}`) : [`- ${empty}`];
}

function uniqueLines(items: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const normalized = normalizeText(item);
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  return result;
}

function looksLikeDoNotDo(item: string): boolean {
  return /^(do not|don't|dont|avoid|never)\b/i.test(normalizeText(item));
}

function captureLine(item: AnyObject): string {
  if (item.kind === "note") return truncate(item.content);
  if (item.kind === "artifact") return `${truncate(item.name, 160)} (${item.type})`;
  return truncate(item.name);
}

function splitLines(value: string | undefined): string[] {
  return clean(value)
    .split(/\n+/)
    .map((line) => normalizeText(line))
    .filter(Boolean);
}

function inferTargetTool(action: string, role?: string): TargetTool {
  const text = `${action} ${role ?? ""}`.toLowerCase();
  if (/\b(linear|ticket|issue queue|triage)\b/.test(text)) return "Linear";
  if (/\b(github|pull request|pr|repo|issue)\b/.test(text)) return "GitHub";
  if (/\b(cursor|code|implement|build|bug|fix|refactor|test)\b/.test(text)) return "Cursor";
  if (/\b(windsurf)\b/.test(text)) return "Windsurf";
  if (/\b(copilot)\b/.test(text)) return "GitHub Copilot";
  if (/\b(claude)\b/.test(text)) return "Claude";
  if (/\b(manual|check by hand)\b/.test(text)) return "Manual";
  return "ChatGPT";
}

function actionFromQueue(actions: ProjectAction[]): ProjectNextAction | null {
  const action = selectProjectActionQueue(actions).find(
    (item) => item.status !== "dismissed" && item.status !== "completed"
  );
  if (!action) return null;
  return {
    id: action.id,
    title: action.title,
    rationale: action.rationale ?? "This is the highest priority active project action.",
    status: action.status === "accepted" ? "accepted" : "suggested",
    createdAt: action.createdAt,
    updatedAt: action.updatedAt,
  };
}

function sourceUpdatedAt(params: CompileProjectContextParams): number {
  const captureTimes = params.captures.map((item) => item.modifiedAt ?? 0);
  const actionTimes = params.actions.map((item) => item.updatedAt ?? 0);
  const eventTimes = params.agentEvents.map((item) => item.createdAt ?? 0);
  const handoffTimes = (params.handoffs ?? []).map((item) => item.generatedAt ?? 0);
  return Math.max(
    params.project.modifiedAt ?? 0,
    params.project.lastActivity ?? 0,
    ...captureTimes,
    ...actionTimes,
    ...eventTimes,
    ...handoffTimes,
    0
  );
}

function freshnessLabel(params: CompileProjectContextParams): string {
  if (!params.memory) return "No generated memory yet";
  const updatedAt = sourceUpdatedAt(params);
  if (updatedAt > params.memory.generatedAt) {
    return `Stale: sources changed after ${new Date(params.memory.generatedAt).toISOString()}`;
  }
  return `Fresh: memory reflects sources through ${new Date(params.memory.sourceUpdatedAt || params.memory.generatedAt).toISOString()}`;
}

export function compileProjectContextWithMeta(params: CompileProjectContextParams): CompiledProjectContext {
  const limits = { ...DEFAULT_LIMITS, ...params.limits };
  const memory = params.memory ?? null;
  const generatedAt = params.generatedAt ?? Date.now();

  const captureCandidates = params.captures.filter((item) => item.kind !== "project");
  const excludedCaptures = captureCandidates.filter(
    (item) => item.captureStatus === "archived" || item.stale || item.excludeFromPackets
  );
  const includedCaptures = captureCandidates
    .filter((item) => !excludedCaptures.includes(item))
    .sort((a, b) => (b.modifiedAt ?? 0) - (a.modifiedAt ?? 0))
    .slice(0, limits.captures);

  const activeActions = selectProjectActionQueue(params.actions)
    .filter((action) => action.status !== "dismissed" && action.status !== "completed")
    .slice(0, limits.actions);

  const primaryAction =
    selectPrimaryNextAction(memory?.nextActions ?? []) ??
    actionFromQueue(params.actions) ??
    (params.task ? {
      id: "manual-next-action",
      title: normalizeText(params.task),
      rationale: "Hypher needs one concrete next action before handing this project to an agent.",
      status: "suggested" as const,
      createdAt: generatedAt,
      updatedAt: generatedAt,
    } : null);

  const requestedTask = normalizeText(primaryAction?.title) || "No current task captured yet.";
  const targetTool = params.targetTool ?? primaryAction?.suggestedTargetTool ?? inferTargetTool(requestedTask, params.role);
  const freshness = freshnessLabel(params);

  const pinnedDecisionLines = includedCaptures
    .filter((item) => item.pinnedAsDecision)
    .map(captureLine);
  const staleLines = captureCandidates
    .filter((item) => item.stale)
    .map(captureLine)
    .slice(0, limits.openQuestions);

  const recentHandoffLines = (params.handoffs ?? [])
    .slice()
    .sort((a, b) => b.generatedAt - a.generatedAt)
    .slice(0, limits.handoffs)
    .flatMap((handoff) => [
      `Previous ${handoff.targetTool} brief was ${handoff.status}: ${truncate(handoff.requestedTask, 140)}.`,
      ...summarizeHandoffResult(handoff),
    ]);

  const agentHandoffLines = params.agentEvents
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limits.agentEvents)
    .map((event) => {
      const summary = truncate(event.body, 180);
      const actions = event.suggestedActions?.length
        ? ` Suggested actions: ${event.suggestedActions.slice(0, 3).join("; ")}.`
        : "";
      return `${normalizeText(event.source)} / ${event.kind.replace("_", " ")}: ${normalizeText(event.title)}. ${summary}${actions}`;
    });

  const sourceCaptureIds = includedCaptures.map((item) => item.id);
  const excludedSourceCaptureIds = excludedCaptures.map((item) => item.id);

  const projectName = normalizeText(params.project.name) || "Project";
  const mission = normalizeText(memory?.summary || params.project.description) || "No mission captured yet.";
  const currentGoal = normalizeText(memory?.currentGoal);
  const currentDirection = normalizeText(memory?.currentDirection);
  const objective = normalizeText(currentGoal || currentDirection || params.project.description) || "No current objective captured yet.";
  const objectiveBody = currentGoal && currentDirection && currentDirection !== currentGoal
    ? [currentGoal, `Current state: ${currentDirection}`]
    : [objective];
  const task = requestedTask || "No current task captured yet.";
  const activeMemoryActions = (memory?.nextActions ?? [])
    .filter((action) => action.status !== "dismissed")
    .map((action) => `[${action.status}] ${truncate(action.title, 180)}`);
  const planLines = uniqueLines([
    ...activeMemoryActions,
    ...(memory?.activeTasks ?? []).map((item) => truncate(item, 180)),
    ...activeActions.map((action) => `[${action.status}] ${truncate(action.title, 180)}`),
  ]).slice(0, limits.actions);
  const decisionLines = uniqueLines([
    ...(memory?.importantDecisions ?? []),
    ...pinnedDecisionLines,
  ]).map((item) => truncate(item, 180)).slice(0, limits.decisions);
  const constraintLines = uniqueLines(memory?.constraints ?? [])
    .map((item) => truncate(item, 180))
    .slice(0, limits.constraints);
  const doNotDoLines = uniqueLines([
    ...constraintLines.filter(looksLikeDoNotDo),
    ...includedCaptures.map(captureLine).filter(looksLikeDoNotDo),
  ]).slice(0, limits.doNotDo);
  const recentProgressLines = uniqueLines(memory?.recentChanges ?? [])
    .map((item) => truncate(item, 180))
    .slice(0, limits.recentProgress);
  const openActionLines = uniqueLines([
    ...activeActions.map((action) => `[${action.status}] ${truncate(action.title, 180)}`),
    ...(memory?.activeTasks ?? []).map((item) => truncate(item, 180)),
  ]).slice(0, limits.openActions);
  const warningLines = uniqueLines([
    ...(memory?.staleAssumptions ?? []).map((item) => `Stale assumption: ${item}`),
    ...staleLines.map((item) => `Stale capture: ${item}`),
    ...(memory?.blockers ?? []).map((item) => `Blocker: ${item}`),
    ...splitLines(params.project.blockers).map((item) => `Blocker: ${item}`),
  ]).map((item) => truncate(item, 180)).slice(0, limits.agentWarnings);
  const acceptanceLines = task === "No current task captured yet."
    ? []
    : [
        "Current Task is completed or clearly blocked with reasons.",
        "Plan, decisions, constraints, and Do Not Do items are followed.",
        "Relevant tests or checks are run and reported.",
        "Handoff Notes include changes, blockers, and the next move.",
      ].slice(0, limits.acceptanceCriteria);
  const handoffLines = uniqueLines([...recentHandoffLines, ...agentHandoffLines])
    .map((item) => truncate(item, 220))
    .slice(0, limits.handoffNotes);
  const lines = [`# Builder Brief: ${projectName}`];

  pushSection(lines, "Mission", [mission]);
  pushSection(lines, "Current Objective", objectiveBody);
  pushSection(lines, "Current Task", [task]);
  pushSection(lines, "Plan", numberedList(planLines, "No approved plan captured yet."));
  pushSection(lines, "Crystallized Decisions", bulletList(decisionLines, "No crystallized decisions recorded yet."));
  pushSection(lines, "Constraints", bulletList(constraintLines, "No constraints recorded yet."));
  pushSection(lines, "Do Not Do", bulletList(doNotDoLines, "No explicit Do Not Do items recorded yet."));
  pushSection(lines, "Recent Progress", bulletList(recentProgressLines, "No recent progress recorded yet."));
  pushSection(lines, "Open Actions", bulletList(openActionLines, "No open actions recorded yet."));
  pushSection(lines, "Agent Warnings", bulletList(warningLines, "No agent warnings recorded yet."));
  pushSection(lines, "Acceptance Criteria", bulletList(acceptanceLines, "No task-specific acceptance criteria recorded yet."));
  pushSection(lines, "Handoff Notes", bulletList(handoffLines, "No handoff notes recorded yet."));

  return {
    packet: `${lines.join("\n").trim()}\n`,
    sourceCaptureIds,
    excludedSourceCaptureIds,
    requestedTask,
    targetTool,
    generatedAt,
    freshness,
  };
}

export function compileProjectContext(params: CompileProjectContextParams): string {
  return compileProjectContextWithMeta(params).packet;
}

export function compileBuilderBrief(params: CompileBuilderBriefParams): string {
  return compileProjectContextWithMeta(params).packet;
}
