import type { AgentEventKind, AgentEventStatus, TargetTool } from "@/types";

export const START_AGENT_SESSION_LABEL = "Start agent session";
export const START_AGENT_SESSION_SUCCESS_TOAST = "Builder Brief copied. Session started.";
export const START_AGENT_SESSION_ERROR_TOAST = "Could not start agent session";

export interface AgentSessionStub {
  source: string;
  kind: Extract<AgentEventKind, "handoff">;
  title: string;
  body: string;
  status: Extract<AgentEventStatus, "reviewed">;
  repo?: string;
  branch?: string;
  createdAt: number;
}

function normalize(value: string | undefined): string {
  return (value ?? "").trim();
}

export function sessionStubSource(targetTool: TargetTool): string {
  return targetTool.trim().toLowerCase().replace(/\s+/g, "_");
}

export function buildAgentSessionStub(params: {
  targetTool: TargetTool;
  requestedTask: string;
  repo?: string;
  branch?: string;
  createdAt: number;
}): AgentSessionStub {
  const tool = params.targetTool;
  const task = normalize(params.requestedTask) || "No current task captured yet.";
  const repo = normalize(params.repo) || undefined;
  const branch = normalize(params.branch) || undefined;
  return {
    source: sessionStubSource(tool),
    kind: "handoff",
    title: "Session started",
    body: `Requested task: ${task}\nPaste this Builder Brief into ${tool}.`,
    status: "reviewed",
    ...(repo ? { repo } : {}),
    ...(branch ? { branch } : {}),
    createdAt: params.createdAt,
  };
}
