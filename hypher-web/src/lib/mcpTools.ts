import type { AgentEvent, AnyObject, Project, ProjectAction, ProjectMemory } from "@/types";
import { buildAgentContextApiResponse } from "./agentContextApi";
import { selectProjectActionQueue } from "./actions";
import { selectPrimaryNextAction } from "./projectMemory";

type JsonObject = Record<string, unknown>;

type SubscriptionLike = {
  status?: string;
  plan?: string;
} | null | undefined;

export interface HypherMcpProjectContext {
  project: Project;
  memory?: ProjectMemory | null;
  captures: AnyObject[];
  actions: ProjectAction[];
  agentEvents: AgentEvent[];
  subscription?: SubscriptionLike;
}

export interface HypherMcpContext {
  projects: Project[];
  projectContexts: Record<string, HypherMcpProjectContext>;
}

export interface HypherMcpToolDescriptor {
  name: string;
  title: string;
  description: string;
  inputSchema: JsonObject;
  annotations: {
    readOnlyHint: true;
    openWorldHint: false;
    destructiveHint: false;
  };
}

export interface HypherMcpToolResult {
  structuredContent: JsonObject;
  content: Array<{ type: "text"; text: string }>;
}

const READ_ONLY = {
  readOnlyHint: true,
  openWorldHint: false,
  destructiveHint: false,
} as const;

const PROJECT_ID_SCHEMA = {
  type: "object",
  properties: {
    projectId: { type: "string", description: "Hypher project id." },
  },
  required: ["projectId"],
  additionalProperties: false,
};

export function getHypherMcpToolDescriptors(): HypherMcpToolDescriptor[] {
  return [
    {
      name: "list_projects",
      title: "List projects",
      description: "List the user's Hypher projects with lightweight metadata.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: READ_ONLY,
    },
    {
      name: "get_project_context",
      title: "Get project context",
      description: "Return the protected Hypher agent context packet for a project.",
      inputSchema: PROJECT_ID_SCHEMA,
      annotations: READ_ONLY,
    },
    {
      name: "get_current_state",
      title: "Get current state",
      description: "Return the project's current direction, recent changes, and open questions.",
      inputSchema: PROJECT_ID_SCHEMA,
      annotations: READ_ONLY,
    },
    {
      name: "get_next_move",
      title: "Get next move",
      description: "Return the best next move Hypher knows for a project.",
      inputSchema: PROJECT_ID_SCHEMA,
      annotations: READ_ONLY,
    },
    {
      name: "prepare_handoff",
      title: "Prepare handoff",
      description: "Prepare a concise read-only handoff for continuing work in ChatGPT.",
      inputSchema: PROJECT_ID_SCHEMA,
      annotations: READ_ONLY,
    },
  ];
}

function getProjectId(args: JsonObject): string {
  const projectId = typeof args.projectId === "string" ? args.projectId.trim() : "";
  if (!projectId) throw new Error("missing-project-id");
  return projectId;
}

function requireProjectContext(args: JsonObject, context: HypherMcpContext): HypherMcpProjectContext {
  const projectId = getProjectId(args);
  const projectContext = context.projectContexts[projectId];
  if (!projectContext) throw new Error("project-not-found");
  return projectContext;
}

function textResult(structuredContent: JsonObject, text: string): HypherMcpToolResult {
  return {
    structuredContent,
    content: [{ type: "text", text }],
  };
}

function normalize(value: string | undefined | null): string {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

function listProjects(context: HypherMcpContext): HypherMcpToolResult {
  const projects = [...context.projects]
    .sort((a, b) => (b.modifiedAt ?? 0) - (a.modifiedAt ?? 0))
    .map((project) => ({
      id: project.id,
      name: project.name,
      status: project.status,
      githubRepo: project.githubRepo,
      modifiedAt: project.modifiedAt,
    }));

  return textResult(
    { projects },
    projects.length
      ? projects.map((project) => `${project.name} (${project.status})`).join("\n")
      : "No Hypher projects found."
  );
}

function projectContextTool(args: JsonObject, context: HypherMcpContext): HypherMcpToolResult {
  const projectContext = requireProjectContext(args, context);
  const response = buildAgentContextApiResponse(projectContext);
  return textResult(response, response.context);
}

function currentStateTool(args: JsonObject, context: HypherMcpContext): HypherMcpToolResult {
  const { project, memory } = requireProjectContext(args, context);
  const currentState = normalize(memory?.currentDirection) || normalize(memory?.summary) || normalize(project.description);
  const recentChanges = (memory?.recentChanges ?? []).map(normalize).filter(Boolean).slice(0, 5);
  const openQuestions = (memory?.openQuestions ?? []).map(normalize).filter(Boolean).slice(0, 5);

  return textResult(
    {
      projectId: project.id,
      projectName: project.name,
      currentState,
      recentChanges,
      openQuestions,
    },
    [`Current state: ${currentState}`, ...recentChanges.map((item) => `Changed: ${item}`)].join("\n")
  );
}

function nextMoveTool(args: JsonObject, context: HypherMcpContext): HypherMcpToolResult {
  const { project, memory, actions } = requireProjectContext(args, context);
  const action = selectProjectActionQueue(actions).find((item) => item.status === "accepted" || item.status === "suggested");
  const memoryAction = selectPrimaryNextAction(memory?.nextActions ?? []);
  const nextMove = normalize(action?.title) || normalize(memoryAction?.title) || "No next move captured yet.";
  const source = action ? "action_queue" : memoryAction ? "project_memory" : "empty";

  return textResult(
    {
      projectId: project.id,
      projectName: project.name,
      nextMove,
      source,
      rationale: action?.rationale ?? memoryAction?.rationale,
    },
    nextMove
  );
}

function handoffTool(args: JsonObject, context: HypherMcpContext): HypherMcpToolResult {
  const projectContext = requireProjectContext(args, context);
  const current = currentStateTool(args, context).structuredContent;
  const next = nextMoveTool(args, context).structuredContent;
  const handoff = [
    `Project: ${projectContext.project.name}`,
    `Current state: ${current.currentState || "No current state captured yet."}`,
    `Next move: ${next.nextMove || "No next move captured yet."}`,
    "Account linking wording: Connect your Hypher account to ChatGPT.",
  ].join("\n");

  return textResult(
    {
      projectId: projectContext.project.id,
      projectName: projectContext.project.name,
      handoff,
    },
    handoff
  );
}

export function buildMcpToolResult(toolName: string, args: JsonObject, context: HypherMcpContext): HypherMcpToolResult {
  switch (toolName) {
    case "list_projects":
      return listProjects(context);
    case "get_project_context":
      return projectContextTool(args, context);
    case "get_current_state":
      return currentStateTool(args, context);
    case "get_next_move":
      return nextMoveTool(args, context);
    case "prepare_handoff":
      return handoffTool(args, context);
    default:
      throw new Error("unknown-tool");
  }
}
