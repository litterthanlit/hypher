import type { AgentEvent, AnyObject, Handoff, Project, ProjectAction, ProjectMemory, ProjectNextAction, TargetTool } from "@/types";
import { selectProjectActionQueue } from "./actions";
import { selectPrimaryNextAction } from "./projectMemory";

interface CompileProjectContextParams {
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
  };
}

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

function labelList(title: string, items: string[], empty: string): string[] {
  return [
    `${title}:`,
    ...(items.length ? items.map((item) => `- ${item}`) : [`- ${empty}`]),
  ];
}

function sourceLabel(sourceType: ProjectAction["sourceType"]): string {
  switch (sourceType) {
    case "agent_event": return "Agent";
    case "github": return "GitHub";
    case "manual": return "Manual";
    case "project_memory": return "Memory";
  }
}

function captureLine(item: AnyObject): string {
  if (item.kind === "note") return truncate(item.content);
  if (item.kind === "artifact") return `${truncate(item.name, 160)} (${item.type})`;
  return truncate(item.name);
}

function captureText(item: AnyObject): string {
  if (item.kind === "note") return item.content;
  if (item.kind === "artifact") return [item.name, item.fileReference].filter(Boolean).join(" ");
  return item.name;
}

function splitLines(value: string | undefined): string[] {
  return clean(value)
    .split(/\n+/)
    .map((line) => normalizeText(line))
    .filter(Boolean);
}

function extractLinks(items: AnyObject[], limit: number): string[] {
  const links: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const matches = captureText(item).match(/https?:\/\/[^\s)]+/g) ?? [];
    for (const raw of matches) {
      const link = raw.replace(/[.,;]+$/, "");
      if (!seen.has(link)) {
        seen.add(link);
        links.push(link);
      }
      if (links.length >= limit) return links;
    }
  }
  return links;
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

function expectedOutputFor(tool: TargetTool): string {
  switch (tool) {
    case "Cursor":
    case "Windsurf":
    case "GitHub Copilot":
      return "A focused implementation or code review result, with files changed and verification notes.";
    case "GitHub":
      return "A clear issue, PR comment, or repository update grounded in the packet.";
    case "Linear":
      return "One scoped issue or update with acceptance criteria.";
    case "Manual":
      return "A completed manual check with decisions, blockers, and follow-up notes.";
    case "MCP tool":
      return "A tool-ready request plus the exact context needed to execute it.";
    case "Claude":
    case "ChatGPT":
    default:
      return "A concise answer, plan, or draft that uses the included project memory.";
  }
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
    {
      id: "manual-next-action",
      title: params.task ? normalizeText(params.task) : "Clarify the next useful project move",
      rationale: "Hypher needs one concrete next action before handing this project to an agent.",
      status: "suggested" as const,
      createdAt: generatedAt,
      updatedAt: generatedAt,
    };

  const requestedTask = normalizeText(primaryAction.title);
  const targetTool = params.targetTool ?? primaryAction.suggestedTargetTool ?? inferTargetTool(requestedTask, params.role);
  const freshness = freshnessLabel(params);
  const links = extractLinks(includedCaptures, limits.captures);

  const pinnedDecisionLines = includedCaptures
    .filter((item) => item.pinnedAsDecision)
    .map(captureLine);
  const openQuestionLines = includedCaptures
    .filter((item) => item.captureType === "open_question")
    .map(captureLine);
  const staleLines = captureCandidates
    .filter((item) => item.stale)
    .map(captureLine)
    .slice(0, limits.openQuestions);

  const recentHandoffLines = (params.handoffs ?? [])
    .slice()
    .sort((a, b) => b.generatedAt - a.generatedAt)
    .slice(0, limits.handoffs)
    .map((handoff) => `- ${handoff.targetTool} / ${handoff.status}: ${truncate(handoff.requestedTask, 140)} (${new Date(handoff.generatedAt).toISOString()})`);

  const agentHandoffLines = params.agentEvents
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limits.agentEvents)
    .map((event) => {
      const summary = truncate(event.body, 180);
      const actions = event.suggestedActions?.length
        ? ` Suggested actions: ${event.suggestedActions.slice(0, 3).join("; ")}.`
        : "";
      return `- ${normalizeText(event.source)} / ${event.kind.replace("_", " ")}: ${normalizeText(event.title)}. ${summary}${actions}`;
    });

  const sourceCaptureIds = includedCaptures.map((item) => item.id);
  const excludedSourceCaptureIds = excludedCaptures.map((item) => item.id);
  const lines = ["# Agent Context Packet"];

  pushSection(lines, "Project", [
    `Name: ${normalizeText(params.project.name) || "Project"}`,
    `Summary: ${normalizeText(memory?.summary || params.project.description) || "No generated project memory yet."}`,
    `Current goal: ${normalizeText(memory?.currentGoal || params.task || params.project.description) || "No current goal recorded."}`,
    `Current direction: ${normalizeText(memory?.currentDirection) || "No generated project memory yet."}`,
  ]);

  pushSection(lines, "Current State", [
    ...labelList(
      "Recent changes",
      (memory?.recentChanges ?? []).slice(0, limits.recentChanges).map((item) => truncate(item, 180)),
      "No recent changes captured yet."
    ),
    "",
    ...labelList(
      "Important decisions",
      [...(memory?.importantDecisions ?? []), ...pinnedDecisionLines].slice(0, limits.decisions).map((item) => truncate(item, 180)),
      "No decisions pinned yet."
    ),
    "",
    ...labelList(
      "Constraints",
      (memory?.constraints ?? []).slice(0, limits.constraints).map((item) => truncate(item, 180)),
      "No constraints recorded yet."
    ),
    "",
    ...labelList(
      "Known blockers",
      [...(memory?.blockers ?? []), ...splitLines(params.project.blockers)].slice(0, limits.openQuestions).map((item) => truncate(item, 180)),
      "No known blockers."
    ),
    "",
    ...labelList(
      "Active tasks",
      [
        ...(memory?.activeTasks ?? []),
        ...activeActions.map((action) => `${normalizeText(action.title)} (${sourceLabel(action.sourceType)})`),
      ].slice(0, limits.actions),
      "No active tasks recorded."
    ),
    "",
    ...labelList(
      "Stale assumptions",
      [...(memory?.staleAssumptions ?? []), ...staleLines].slice(0, limits.openQuestions).map((item) => truncate(item, 180)),
      "No stale assumptions marked."
    ),
  ]);

  pushSection(lines, "Task For Agent", [
    `Recommended action: ${requestedTask}`,
    `Why it matters: ${normalizeText(primaryAction.rationale) || "It is the clearest next step for the project."}`,
    `Required context: ${(primaryAction.requiredContext?.length ? primaryAction.requiredContext : ["Project summary", "recent changes", "relevant captures"]).join(", ")}`,
    `Suggested target tool: ${targetTool}`,
    `Confidence: ${typeof primaryAction.confidence === "number" ? `${Math.round(primaryAction.confidence * 100)}%` : "medium"}`,
    `Source captures used: ${sourceCaptureIds.length}`,
    `Expected output: ${expectedOutputFor(targetTool)}`,
    "Success criteria:",
    "- Uses the current direction and constraints above.",
    "- Calls out assumptions instead of inventing missing context.",
    "- Leaves a concise return handoff with changes, blockers, and next steps.",
  ]);

  pushSection(lines, "Relevant Context", [
    ...labelList(
      "Captures",
      includedCaptures.map(captureLine),
      "No captures assigned yet."
    ),
    "",
    ...labelList("Links", links, "No links included."),
    "",
    ...labelList(
      "Prior handoffs",
      [...recentHandoffLines, ...agentHandoffLines].map((line) => line.replace(/^- /, "")),
      "No prior handoffs recorded."
    ),
    "",
    ...labelList(
      "Open questions",
      [...(memory?.openQuestions ?? []), ...openQuestionLines].slice(0, limits.openQuestions).map((item) => truncate(item, 180)),
      "No open questions recorded."
    ),
  ]);

  pushSection(lines, "Guardrails", [
    ...labelList("Do not", [
      "Turn this into a generic productivity system.",
      "Assume stale or excluded captures are current.",
      "Change project direction without naming the tradeoff.",
    ], "No guardrails recorded."),
    "",
    ...labelList("Assume", [
      "The builder wants one useful next move, not a long task list.",
      "Hypher is project memory and agent briefing, not an agent runner.",
    ], "No assumptions recorded."),
    "",
    ...labelList("Ask before", [
      "Using missing context as fact.",
      "Expanding scope beyond the recommended action.",
    ], "No ask-before rules recorded."),
  ]);

  pushSection(lines, "Metadata", [
    `Generated at: ${new Date(generatedAt).toISOString()}`,
    `Freshness: ${freshness}`,
    `Sources included: ${sourceCaptureIds.length} captures, ${activeActions.length} actions, ${(params.handoffs ?? []).length + params.agentEvents.length} prior handoffs`,
    `Sources excluded: ${excludedSourceCaptureIds.length} captures`,
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
