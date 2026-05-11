import type { AgentEvent, AnyObject, Project, ProjectAction, ProjectMemory } from "@/types";
import { getDisplayName } from "@/types";
import { selectProjectActionQueue } from "./actions";

interface CompileProjectContextParams {
  project: Project;
  memory?: ProjectMemory | null;
  captures: AnyObject[];
  actions: ProjectAction[];
  agentEvents: AgentEvent[];
  task?: string;
  role?: string;
  limits?: {
    captures?: number;
    actions?: number;
    agentEvents?: number;
    recentChanges?: number;
    openQuestions?: number;
  };
}

const DEFAULT_LIMITS = {
  captures: 5,
  actions: 5,
  agentEvents: 5,
  recentChanges: 5,
  openQuestions: 5,
};

function clean(value: string | undefined | null): string {
  return (value ?? "").trim();
}

function truncate(value: string, max = 220): string {
  const text = normalizeText(value);
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}...`;
}

function normalizeText(value: string | undefined | null): string {
  return clean(value).replace(/\s+/g, " ");
}

function pushSection(lines: string[], title: string, body: string[]) {
  lines.push("", `## ${title}`, "");
  lines.push(...body);
}

function bulletList(items: string[], empty: string): string[] {
  return items.length ? items.map((item) => `- ${item}`) : [empty];
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
  if (item.kind === "artifact") return `${item.name} (${item.type})`;
  return item.name;
}

export function compileProjectContext(params: CompileProjectContextParams): string {
  const limits = { ...DEFAULT_LIMITS, ...params.limits };
  const memory = params.memory ?? null;
  const lines = [`# Agent Context: ${params.project.name}`];

  const meta = [
    params.task ? `Task: ${params.task}` : null,
    params.role ? `Role: ${params.role}` : null,
    params.project.githubRepo ? `Repository: ${params.project.githubRepo}` : null,
    `Project status: ${params.project.status}`,
  ].filter((item): item is string => Boolean(item));
  lines.push("", ...meta);

  pushSection(lines, "Project Summary", [
    normalizeText(memory?.summary || params.project.description) || "No generated project memory yet.",
  ]);

  pushSection(lines, "Current Direction", [
    normalizeText(memory?.currentDirection) || "No generated project memory yet.",
  ]);

  pushSection(
    lines,
    "Recent Changes",
    bulletList((memory?.recentChanges ?? []).slice(0, limits.recentChanges).map(normalizeText), "No recent changes captured yet.")
  );

  pushSection(
    lines,
    "Open Questions",
    bulletList((memory?.openQuestions ?? []).slice(0, limits.openQuestions).map(normalizeText), "No open questions captured yet.")
  );

  const actionLines = selectProjectActionQueue(params.actions)
    .filter((action) => action.status !== "dismissed" && action.status !== "completed")
    .slice(0, limits.actions)
    .map((action) => `- [${action.status}] ${normalizeText(action.title)} (${sourceLabel(action.sourceType)})`);
  pushSection(lines, "Action Queue", actionLines.length ? actionLines : ["No accepted or suggested actions."]);

  const memoryActionLines = (memory?.nextActions ?? [])
    .filter((action) => action.status !== "dismissed")
    .slice(0, limits.actions)
    .map((action) => `- [${action.status}] ${normalizeText(action.title)}${action.rationale ? ` - ${normalizeText(action.rationale)}` : ""}`);
  pushSection(lines, "Suggested Next Moves", memoryActionLines.length ? memoryActionLines : ["No memory suggestions yet."]);

  const captureLines = params.captures
    .filter((item) => item.kind !== "project")
    .sort((a, b) => (b.modifiedAt ?? 0) - (a.modifiedAt ?? 0))
    .slice(0, limits.captures)
    .map((item) => `- ${captureLine(item)}`);
  pushSection(lines, "Relevant Recent Captures", captureLines.length ? captureLines : ["No captures assigned yet."]);

  const agentLines = params.agentEvents
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limits.agentEvents)
    .map((event) => {
      const summary = truncate(event.body, 180);
      const actions = event.suggestedActions?.length
        ? ` Suggested actions: ${event.suggestedActions.slice(0, 3).join("; ")}.`
        : "";
      return `- ${normalizeText(event.source)} ${event.kind.replace("_", " ")}: ${normalizeText(event.title)}. ${summary}${actions}`;
    });
  pushSection(lines, "Recent Agent Handoffs", agentLines.length ? agentLines : ["No agent handoffs captured yet."]);

  pushSection(lines, "Instructions For The Agent", [
    "- Use this packet as project context before acting.",
    "- Prefer the current direction, decisions, open questions, and active actions over older notes.",
    "- If you change project state, leave a concise handoff with what changed, what passed, what failed, blockers, and next steps.",
    "- Do not treat this packet as a full task manager or agent builder spec.",
  ]);

  return `${lines.join("\n").trim()}\n`;
}
