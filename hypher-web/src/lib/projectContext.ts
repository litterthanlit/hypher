import type {
  AcceptedCrystallizedSuggestion,
  ActivityEntry,
  AgentEvent,
  AnyObject,
  CrystallizedSuggestionKind,
  Handoff,
  Project,
  ProjectAction,
  ProjectMemory,
  ProjectNextAction,
  TargetTool,
} from "@/types";
import { selectProjectActionQueue } from "./actions";
import { summarizeHandoffResult } from "./handoffResults";
import { selectPrimaryNextAction } from "./projectMemory";
import {
  expandConstraintLines,
  isContinueDumpEcho,
  isDumpPrefixEcho,
  looksLikeConstraint,
  looksLikeDoNotDo,
  splitSentences,
} from "../../shared/projectMemoryGenerate";

export interface CompileBuilderBriefParams {
  project: Project;
  memory?: ProjectMemory | null;
  captures: AnyObject[];
  actions: ProjectAction[];
  agentEvents: AgentEvent[];
  handoffs?: Handoff[];
  activity?: ActivityEntry[];
  task?: string;
  role?: string;
  generatedAt?: number;
  targetTool?: TargetTool;
  limits?: {
    captures?: number;
    actions?: number;
    agentEvents?: number;
    handoffs?: number;
    recentActivity?: number;
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

export const BUILDER_BRIEF_DEFAULT_LIMITS = {
  captures: 5,
  actions: 5,
  agentEvents: 5,
  handoffs: 5,
  recentActivity: 5,
  recentChanges: 5,
  openQuestions: 5,
  decisions: 5,
  constraints: 8,
  doNotDo: 8,
  recentProgress: 5,
  openActions: 6,
  agentWarnings: 6,
  acceptanceCriteria: 6,
  handoffNotes: 6,
};

const DEFAULT_LIMITS = BUILDER_BRIEF_DEFAULT_LIMITS;
const PACKET_LINE_LIMIT = 280;
const CONSTRAINT_LINE_MAX = 500;

function clean(value: string | undefined | null): string {
  return (value ?? "").trim();
}

function normalizeText(value: string | undefined | null): string {
  return clean(value).replace(/\s+/g, " ");
}

function truncate(value: string, max = PACKET_LINE_LIMIT, ellipsis = true): string {
  const text = normalizeText(value);
  if (text.length <= max) return text;
  if (!ellipsis) return text;
  const budget = Math.max(1, max - 3);
  let slice = text.slice(0, budget).trimEnd();
  const nextChar = text[slice.length];
  if (slice && nextChar && !/\s/.test(nextChar)) {
    const broken = slice.lastIndexOf(" ");
    if (broken >= Math.floor(budget * 0.5)) {
      slice = slice.slice(0, broken).trimEnd();
    }
  }
  return `${slice}...`;
}

function pushSection(lines: string[], title: string, body: string[]) {
  lines.push("", `## ${title}`, "");
  lines.push(...body);
}

function bulletList(items: string[], empty: string): string[] {
  return items.length ? items.map((item) => `- ${item}`) : [`- ${empty}`];
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

type AcceptedMemoryKind = Exclude<CrystallizedSuggestionKind, "current_task" | "open_action">;

function acceptedMemoryStatus(item: AcceptedCrystallizedSuggestion): "active" | "stale" | "excluded" {
  return item.status ?? "active";
}

function activeAcceptedMemoryTexts(memory: ProjectMemory | null, kinds: AcceptedMemoryKind[]): string[] {
  return (memory?.acceptedCrystallizedSuggestions ?? [])
    .filter((item) => kinds.includes(item.kind as AcceptedMemoryKind))
    .filter((item) => acceptedMemoryStatus(item) === "active")
    .map((item) => item.text);
}

function activeAcceptedMemoryItems(
  memory: ProjectMemory | null,
  kinds: AcceptedMemoryKind[]
): AcceptedCrystallizedSuggestion[] {
  return (memory?.acceptedCrystallizedSuggestions ?? [])
    .filter((item) => kinds.includes(item.kind as AcceptedMemoryKind))
    .filter((item) => acceptedMemoryStatus(item) === "active");
}

function activeAcceptedSuggestions(memory: ProjectMemory | null): AcceptedCrystallizedSuggestion[] {
  return (memory?.acceptedCrystallizedSuggestions ?? [])
    .filter((item) => acceptedMemoryStatus(item) === "active");
}

function inactiveAcceptedMemoryKeys(memory: ProjectMemory | null, kinds: AcceptedMemoryKind[]): Set<string> {
  return new Set(
    (memory?.acceptedCrystallizedSuggestions ?? [])
      .filter((item) => kinds.includes(item.kind as AcceptedMemoryKind))
      .filter((item) => acceptedMemoryStatus(item) !== "active")
      .map((item) => normalizeText(item.text).toLowerCase())
      .filter(Boolean)
  );
}

function withoutInactiveAcceptedMemory(
  memory: ProjectMemory | null,
  kinds: AcceptedMemoryKind[],
  items: string[]
): string[] {
  const inactive = inactiveAcceptedMemoryKeys(memory, kinds);
  if (!inactive.size) return items;
  return items.filter((item) => !inactive.has(normalizeText(item).toLowerCase()));
}

function captureLine(item: AnyObject): string {
  if (item.kind === "note") return truncate(item.content, PACKET_LINE_LIMIT);
  if (item.kind === "artifact") return `${truncate(item.name, 160)} (${item.type})`;
  return truncate(item.name);
}

function captureSourceLabel(item: AnyObject): string {
  if (item.kind === "note") return `capture:${item.captureType ?? "note"}`;
  if (item.kind === "artifact") return `capture:${item.type}`;
  return "capture:project";
}

function acceptedMemorySourceLabel(item: AcceptedCrystallizedSuggestion): string {
  return `accepted memory:${item.kind}`;
}

function labeledLine(label: string, value: string, max = PACKET_LINE_LIMIT, ellipsis = true): string {
  return `[${label}] ${truncate(value, max, ellipsis)}`;
}

function constraintLabeledLine(label: string, value: string): string {
  return labeledLine(label, value, CONSTRAINT_LINE_MAX, false);
}

function splitLines(value: string | undefined): string[] {
  return clean(value)
    .split(/\n+/)
    .map((line) => normalizeText(line))
    .filter(Boolean);
}

function findLabeledValue(items: string[], labels: string[]): string {
  for (const item of items) {
    const normalized = normalizeText(item);
    for (const label of labels) {
      const match = normalized.match(new RegExp(`^${label}\\s*:\\s*(.+)$`, "i"));
      if (match?.[1]) return normalizeText(match[1]);
    }
  }
  return "";
}

function isMilestoneLine(item: string): boolean {
  return /^(active\s+)?milestone\s*:/i.test(normalizeText(item));
}

function activityLine(entry: ActivityEntry): string {
  const summary = normalizeText(entry.summary);
  if (summary) return summary;
  const target = normalizeText(entry.targetName);
  const objectName = normalizeText(entry.objectName) || "project item";
  return target
    ? `${entry.action} ${objectName} -> ${target}`
    : `${entry.action} ${objectName}`;
}

function isCompactMode(limits: typeof DEFAULT_LIMITS): boolean {
  return (Object.keys(DEFAULT_LIMITS) as Array<keyof typeof DEFAULT_LIMITS>)
    .some((key) => limits[key] < DEFAULT_LIMITS[key]);
}

function inferTargetTool(action: string, role?: string): TargetTool {
  const text = `${action} ${role ?? ""}`.toLowerCase();
  if (/\b(linear|ticket|issue queue|triage)\b/.test(text)) return "Linear";
  if (/\b(github|pull request|pr|repo|issue)\b/.test(text)) return "GitHub";
  if (/\b(cursor|code|implement|build|bug|fix|refactor|test)\b/.test(text)) return "Cursor";
  if (/\b(windsurf)\b/.test(text)) return "Windsurf";
  if (/\b(copilot)\b/.test(text)) return "GitHub Copilot";
  if (/\b(claude)\b/.test(text)) return "Claude";
  if (/\b(chatgpt|gpt)\b/.test(text)) return "ChatGPT";
  if (/\b(manual|check by hand)\b/.test(text)) return "Manual";
  return "Cursor";
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
  const activityTimes = (params.activity ?? []).map((item) => item.timestamp ?? 0);
  return Math.max(
    params.project.modifiedAt ?? 0,
    params.project.lastActivity ?? 0,
    ...captureTimes,
    ...actionTimes,
    ...eventTimes,
    ...handoffTimes,
    ...activityTimes,
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
  const generatedAt = params.generatedAt ?? sourceUpdatedAt(params);

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

  const dumpTexts = [
    normalizeText(memory?.summary),
    ...includedCaptures.map((item) => (item.kind === "note" ? normalizeText(item.content) : "")),
  ].filter(Boolean);

  const sourceCaptureIds = includedCaptures.map((item) => item.id);
  const excludedSourceCaptureIds = excludedCaptures.map((item) => item.id);

  const usableMemoryActions = (memory?.nextActions ?? []).filter((action) => (
    action.status !== "dismissed"
    && !isContinueDumpEcho(action.title, dumpTexts)
    && !isDumpPrefixEcho(action.title, dumpTexts)
  ));

  const primaryAction =
    selectPrimaryNextAction(usableMemoryActions) ??
    actionFromQueue(params.actions) ??
    (params.task && !isContinueDumpEcho(params.task, dumpTexts) && !isDumpPrefixEcho(params.task, dumpTexts) ? {
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
    .map((item) => labeledLine(captureSourceLabel(item), captureLine(item), PACKET_LINE_LIMIT));
  const recentHandoffLines = (params.handoffs ?? [])
    .slice()
    .sort((a, b) => b.generatedAt - a.generatedAt)
    .slice(0, limits.handoffs)
    .flatMap((handoff) => [
      labeledLine(`handoff:${handoff.targetTool}/${handoff.status}`, `Previous ${handoff.targetTool} brief was ${handoff.status}: ${truncate(handoff.requestedTask, 140)}.`, PACKET_LINE_LIMIT),
      ...summarizeHandoffResult(handoff).map((line) => labeledLine(`handoff:${handoff.targetTool}/result`, line, PACKET_LINE_LIMIT)),
    ]);

  const agentHandoffLines = params.agentEvents
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limits.agentEvents)
    .map((event) => {
      const summary = truncate(event.body, PACKET_LINE_LIMIT);
      const actions = event.suggestedActions?.length
        ? ` Suggested actions: ${event.suggestedActions.slice(0, 3).join("; ")}.`
        : "";
      return labeledLine(`agent:${normalizeText(event.source)}/${event.kind}`, `${normalizeText(event.title)}. ${summary}${actions}`, PACKET_LINE_LIMIT);
    });

  const projectName = normalizeText(params.project.name) || "Project";
  const shortSummary = normalizeText(memory?.summary || params.project.description) || "No short summary captured yet.";
  const rawGoal = normalizeText(memory?.currentGoal);
  const rawDirection = normalizeText(memory?.currentDirection);
  const currentGoal = rawGoal && !isDumpPrefixEcho(rawGoal, dumpTexts) ? rawGoal : "";
  const currentDirection = rawDirection && !isDumpPrefixEcho(rawDirection, dumpTexts) ? rawDirection : "";
  const currentState = currentDirection
    ? `${params.project.status} - ${currentDirection}`
    : params.project.status;
  const tryingToBecome = currentGoal || "No goal captured yet.";
  const productDirection = currentDirection
    || (normalizeText(params.project.description) && !isDumpPrefixEcho(params.project.description, dumpTexts)
      ? normalizeText(params.project.description)
      : "")
    || "No product direction captured yet.";
  const activeMilestone = findLabeledValue([
    ...(memory?.activeTasks ?? []),
    ...(memory?.recentChanges ?? []),
    currentGoal,
    currentDirection,
  ], ["active milestone", "milestone"]);
  const task = requestedTask || "No current task captured yet.";
  const activeMemoryActions = usableMemoryActions
    .map((action) => labeledLine(`next:${action.status}`, action.title, PACKET_LINE_LIMIT));
  const activeAcceptedActionLines = activeAcceptedSuggestions(memory)
    .filter((item) => item.kind === "current_task" || item.kind === "open_action")
    .map((item) => labeledLine(acceptedMemorySourceLabel(item), item.text, PACKET_LINE_LIMIT));
  const activeTaskLines = uniqueLines([
    ...activeActions.map((action) => labeledLine(`action:${action.status}`, action.title, PACKET_LINE_LIMIT)),
    ...activeMemoryActions,
    ...activeAcceptedActionLines,
    ...(memory?.activeTasks ?? [])
      .filter((item) => !isMilestoneLine(item) && !isContinueDumpEcho(item, dumpTexts) && !isDumpPrefixEcho(item, dumpTexts))
      .map((item) => labeledLine("memory:task", item, PACKET_LINE_LIMIT)),
  ]).slice(0, limits.actions);
  const rawDecisionTexts = withoutInactiveAcceptedMemory(memory, ["decision"], uniqueLines([
    ...(memory?.importantDecisions ?? []),
  ]));
  const decisionLines = uniqueLines([
    ...rawDecisionTexts.map((item) => labeledLine("memory:decision", item, PACKET_LINE_LIMIT)),
    ...activeAcceptedMemoryItems(memory, ["decision"]).map((item) => labeledLine(acceptedMemorySourceLabel(item), item.text, PACKET_LINE_LIMIT)),
    ...pinnedDecisionLines,
  ]).slice(0, limits.decisions);
  const rawConstraintTexts = withoutInactiveAcceptedMemory(memory, ["constraint", "do_not_do"], uniqueLines(
    expandConstraintLines(memory?.constraints ?? [])
  ));
  const captureConstraintLines = includedCaptures.flatMap((item) => {
    const content = item.kind === "note" ? normalizeText(item.content) : captureLine(item);
    return expandConstraintLines(splitSentences(content).filter((line) => looksLikeDoNotDo(line) || looksLikeConstraint(line)))
      .map((line) => constraintLabeledLine(captureSourceLabel(item), line));
  });
  const constraintLines = uniqueLines([
    ...rawConstraintTexts.map((item) => constraintLabeledLine("memory:constraint", item)),
    ...activeAcceptedMemoryItems(memory, ["constraint", "do_not_do"]).map((item) => constraintLabeledLine(acceptedMemorySourceLabel(item), item.text)),
    ...captureConstraintLines,
  ]).slice(0, limits.constraints);
  const doNotDoLines = uniqueLines([
    ...rawConstraintTexts.filter(looksLikeDoNotDo).map((item) => constraintLabeledLine("memory:constraint", item)),
    ...activeAcceptedMemoryItems(memory, ["do_not_do"]).map((item) => constraintLabeledLine(acceptedMemorySourceLabel(item), item.text)),
    ...captureConstraintLines,
  ]).slice(0, limits.doNotDo);
  const recentProgressLines = uniqueLines(memory?.recentChanges ?? [])
    .map((item) => labeledLine("memory:recent_change", item, PACKET_LINE_LIMIT))
    .slice(0, limits.recentProgress);
  const recentActivityLines = (params.activity ?? [])
    .slice()
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limits.recentActivity)
    .map((entry) => labeledLine(`activity:${entry.action}`, activityLine(entry), PACKET_LINE_LIMIT));
  const recentCaptureLines = includedCaptures
    .map((item) => labeledLine(captureSourceLabel(item), captureLine(item), PACKET_LINE_LIMIT))
    .slice(0, limits.captures);
  const recentAcceptedMemoryLines = activeAcceptedSuggestions(memory)
    .slice()
    .sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt))
    .slice(0, limits.recentChanges)
    .map((item) => labeledLine(acceptedMemorySourceLabel(item), item.text, PACKET_LINE_LIMIT));
  const recentChangeLines = uniqueLines([
    ...recentActivityLines,
    ...recentProgressLines,
    ...recentCaptureLines,
    ...recentAcceptedMemoryLines,
    ...agentHandoffLines,
    ...recentHandoffLines,
  ]).slice(0, limits.recentChanges + limits.captures + limits.agentEvents + limits.handoffs);
  const agentQuestionLines = params.agentEvents
    .filter((event) => (
      event.kind === "question"
      && event.status !== "accepted"
      && event.status !== "dismissed"
    ))
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((event) => labeledLine(
      `agent:${normalizeText(event.source)}/question`,
      truncate(event.title, PACKET_LINE_LIMIT),
      PACKET_LINE_LIMIT
    ));
  const openQuestionLines = uniqueLines([
    ...(memory?.openQuestions ?? []).map((item) => labeledLine("memory:question", item, PACKET_LINE_LIMIT)),
    ...agentQuestionLines,
  ]).slice(0, limits.openQuestions);
  const blockerLines = uniqueLines([
    ...(memory?.blockers ?? []).map((item) => labeledLine("memory:blocker", item, PACKET_LINE_LIMIT)),
    ...splitLines(params.project.blockers).map((item) => labeledLine("project:blocker", item, PACKET_LINE_LIMIT)),
  ]).slice(0, limits.openQuestions);
  const needsReviewLines = params.agentEvents
    .filter((event) => event.status === "new")
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limits.agentEvents)
    .map((event) => labeledLine(`agent:${normalizeText(event.source)}/needs-review`, event.title, PACKET_LINE_LIMIT));
  const ambiguityLines = uniqueLines([
    ...(memory?.staleAssumptions ?? []).map((item) => labeledLine("memory:stale_assumption", `Do not assume: ${item}`, PACKET_LINE_LIMIT)),
  ]).slice(0, limits.agentWarnings);
  const warningLines = uniqueLines([
    ...withoutInactiveAcceptedMemory(memory, ["agent_warning"], uniqueLines([
      ...(memory?.agentWarnings ?? []),
    ])).map((item) => labeledLine("memory:agent_warning", item, PACKET_LINE_LIMIT)),
    ...activeAcceptedMemoryItems(memory, ["agent_warning"]).map((item) => labeledLine(acceptedMemorySourceLabel(item), item.text, PACKET_LINE_LIMIT)),
  ]).slice(0, limits.agentWarnings);
  const defaultAcceptanceLines = task === "No current task captured yet."
    ? []
    : [
        "Current Task is completed or clearly blocked with reasons.",
        "Project direction, active decisions, constraints, and Do Not Do items are followed.",
        "Relevant tests or checks are run and reported.",
        "Handoff Notes include changes, blockers, and the next move.",
      ];
  const rawAcceptanceTexts = withoutInactiveAcceptedMemory(memory, ["acceptance_criterion"], uniqueLines([
    ...(memory?.acceptanceCriteria ?? []),
  ]));
  const acceptanceLines = uniqueLines([
    ...rawAcceptanceTexts.map((item) => labeledLine("memory:acceptance_criterion", item, PACKET_LINE_LIMIT)),
    ...activeAcceptedMemoryItems(memory, ["acceptance_criterion"]).map((item) => labeledLine(acceptedMemorySourceLabel(item), item.text, PACKET_LINE_LIMIT)),
    ...defaultAcceptanceLines.map((item) => labeledLine("criteria", item, PACKET_LINE_LIMIT)),
  ]).slice(0, limits.acceptanceCriteria);
  const handoffLines = uniqueLines([
    ...withoutInactiveAcceptedMemory(memory, ["handoff_note"], uniqueLines([
      ...(memory?.handoffNotes ?? []),
    ])).map((item) => labeledLine("memory:handoff_note", item, PACKET_LINE_LIMIT)),
    ...activeAcceptedMemoryItems(memory, ["handoff_note"]).map((item) => labeledLine(acceptedMemorySourceLabel(item), item.text, PACKET_LINE_LIMIT)),
    ...recentHandoffLines,
    ...agentHandoffLines,
  ]).slice(0, limits.handoffNotes);
  const nextActionLine = primaryAction
    ? labeledLine(`next:${primaryAction.status}`, primaryAction.title, PACKET_LINE_LIMIT)
    : "No next action captured yet.";
  const suggestedNextMove = normalizeText(primaryAction?.rationale)
    || (primaryAction ? `Start with ${primaryAction.title}.` : "No suggested next move captured yet.");
  const compactMode = isCompactMode(limits) ? "on" : "off";
  const lines = [`# Builder Brief: ${projectName}`];

  pushSection(lines, "Project identity", [
    `- Project name: ${projectName}`,
    `- Short summary: ${shortSummary}`,
    `- Current state: ${currentState}`,
  ]);
  pushSection(lines, "Goal / direction", [
    `- Trying to become: ${tryingToBecome}`,
    `- Product direction: ${productDirection}`,
    `- Active milestone: ${activeMilestone || "No active milestone captured yet."}`,
  ]);
  pushSection(lines, "Recent changes", bulletList(recentChangeLines, "No recent changes captured yet."));
  pushSection(lines, "Active decisions", [
    "### Pinned decisions",
    ...bulletList(pinnedDecisionLines, "No pinned decisions captured yet."),
    "",
    "### Accepted memory",
    ...bulletList(decisionLines.filter((line) => !pinnedDecisionLines.includes(line)), "No accepted decisions captured yet."),
    "",
    "### Important constraints",
    ...bulletList(constraintLines, "No constraints recorded yet."),
  ]);
  pushSection(lines, "Open questions / blockers", [
    "### Unresolved questions",
    ...bulletList(openQuestionLines, "No unresolved questions captured yet."),
    "",
    "### Needs review",
    ...bulletList(needsReviewLines, "No needs-review agent items captured yet."),
    "",
    "### Blockers",
    ...bulletList(blockerLines, "No blockers captured yet."),
    "",
    "### Ambiguity the agent should not assume",
    ...bulletList(ambiguityLines, "No stale assumptions captured yet."),
    "",
    "### Agent warnings",
    ...bulletList(warningLines, "No agent warnings recorded yet."),
  ]);
  pushSection(lines, "Action queue", [
    `- Next action: ${nextActionLine}`,
    "",
    "### Active tasks",
    ...bulletList(activeTaskLines, "No active tasks recorded yet."),
    "",
    `- Suggested next move: ${suggestedNextMove}`,
  ]);
  pushSection(lines, "Agent instructions", [
    "### What to do",
    `- Work on: ${task}`,
    "- Use Project identity, Goal / direction, Active decisions, and Open questions / blockers as the project memory before acting.",
    "- If blocked, report the blocker and the missing context instead of guessing.",
    "",
    "### What not to do",
    "- Do not invent answers for unresolved questions, blockers, or missing milestones.",
    "- Do not use stale, archived, excluded, or packet-excluded memory as guidance.",
    ...bulletList(doNotDoLines, "No explicit Do Not Do items recorded yet."),
    "",
    "### Acceptance criteria",
    ...bulletList(acceptanceLines, "No task-specific acceptance criteria recorded yet."),
    "",
    "### Output format",
    "- Summary",
    "- Changes made",
    "- Verification run",
    "- Blockers or next action",
  ]);
  pushSection(lines, "Source/context hygiene", [
    `- Freshness timestamp: ${new Date(generatedAt).toISOString()}`,
    `- Memory freshness: ${freshness}`,
    `- Compact mode: ${compactMode}`,
    `- Target tool: ${targetTool}`,
    `- Included source captures: ${sourceCaptureIds.length}`,
    `- Excluded stale/archived/packet-excluded captures: ${excludedSourceCaptureIds.length}`,
    "- Source labels: [memory:*], [accepted memory:*], [capture:*], [activity:*], [agent:*], [handoff:*], [action:*], [next:*].",
    "",
    "### Handoff notes",
    ...bulletList(handoffLines, "No handoff notes recorded yet."),
  ]);

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
