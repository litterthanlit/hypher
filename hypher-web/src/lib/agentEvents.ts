import { normalizeGitHubRepo } from "../../shared/githubRepo";

export const AGENT_EVENT_KINDS = [
  "handoff",
  "build_log",
  "question",
  "suggestion",
  "artifact",
  "next_action",
] as const;

export const AGENT_EVENT_STATUSES = ["new", "reviewed", "accepted", "dismissed"] as const;

export type AgentEventKind = (typeof AGENT_EVENT_KINDS)[number];
export type AgentEventStatus = (typeof AGENT_EVENT_STATUSES)[number];

export interface AgentEventPayload {
  source: string;
  project?: string;
  kind: AgentEventKind;
  title: string;
  body: string;
  suggestedActions?: string[];
  repo?: string;
  branch?: string;
  commitSha?: string;
  artifactUrl?: string;
}

export interface NormalizedAgentEvent extends AgentEventPayload {
  status: AgentEventStatus;
  createdAt: number;
}

export interface AgentEventProjectCandidate {
  id: string;
  name?: string;
  githubRepo?: string;
}

export { normalizeGitHubRepo };

type ValidationResult =
  | { ok: true; value: AgentEventPayload }
  | { ok: false; error: string };

function cleanString(value: unknown): string | undefined {
  return typeof value === "string" ? value.trim() : undefined;
}

function cleanStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const cleaned = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
  return cleaned.length > 0 ? cleaned : undefined;
}

export function validateAgentEventPayload(input: unknown): ValidationResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "payload must be an object" };
  }
  const data = input as Record<string, unknown>;
  const source = cleanString(data.source);
  if (!source) return { ok: false, error: "source is required" };

  const title = cleanString(data.title);
  if (!title) return { ok: false, error: "title is required" };

  const body = cleanString(data.body);
  if (!body) return { ok: false, error: "body is required" };

  const kind = cleanString(data.kind);
  if (!AGENT_EVENT_KINDS.includes(kind as AgentEventKind)) {
    return { ok: false, error: `kind must be one of ${AGENT_EVENT_KINDS.join(", ")}` };
  }

  return {
    ok: true,
    value: {
      source,
      project: cleanString(data.project),
      kind: kind as AgentEventKind,
      title,
      body,
      suggestedActions: cleanStringArray(data.suggestedActions),
      repo: cleanString(data.repo),
      branch: cleanString(data.branch),
      commitSha: cleanString(data.commitSha),
      artifactUrl: cleanString(data.artifactUrl),
    },
  };
}

export function normalizeAgentEventPayload(payload: AgentEventPayload, now: number): NormalizedAgentEvent {
  return {
    ...payload,
    suggestedActions: cleanStringArray(payload.suggestedActions),
    status: "new",
    createdAt: now,
  };
}

function lower(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function matchProjectForAgentEvent(
  projects: AgentEventProjectCandidate[],
  event: { repo?: string; project?: string }
): { id: string; name: string } | null {
  const repo = lower(normalizeGitHubRepo(event.repo) ?? event.repo);
  if (repo) {
    const byRepo = projects.find((project) => lower(project.githubRepo) === repo);
    if (byRepo) return { id: byRepo.id, name: byRepo.name ?? "Project" };
  }

  const projectName = lower(event.project);
  if (!projectName) return null;

  const exact = projects.find((project) => lower(project.name) === projectName);
  if (exact) return { id: exact.id, name: exact.name ?? "Project" };

  const contains = projects.find((project) => {
    const name = lower(project.name);
    return name.length > 0 && (projectName.includes(name) || name.includes(projectName));
  });
  return contains ? { id: contains.id, name: contains.name ?? "Project" } : null;
}

export function buildAgentEventNoteContent(event: {
  source: string;
  kind: string;
  title: string;
  body: string;
  suggestedActions?: string[];
  repo?: string;
  branch?: string;
  commitSha?: string;
  artifactUrl?: string;
}): string {
  const lines = [
    `${event.title}`,
    "",
    event.body,
    "",
    `Source: ${event.source} (${event.kind})`,
  ];
  if (event.repo) lines.push(`Repo: ${event.repo}`);
  if (event.branch) lines.push(`Branch: ${event.branch}`);
  if (event.commitSha) lines.push(`Commit: ${event.commitSha}`);
  if (event.artifactUrl) lines.push(`Artifact: ${event.artifactUrl}`);
  if (event.suggestedActions?.length) {
    lines.push("", "Suggested actions:", ...event.suggestedActions.map((action) => `- ${action}`));
  }
  return lines.join("\n");
}
