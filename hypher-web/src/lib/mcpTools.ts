import type { ActivityEntry, AgentEvent, AnyObject, Handoff, Project, ProjectAction, ProjectMemory } from "@/types";
import { buildAgentContextApiResponse } from "./agentContextApi";
import { selectPrimaryNextAction } from "./projectMemory";
import { selectCompiledIdentity, selectCompiledNextAction, captureDumpTexts, hydratePacketAgentEvents } from "./projectContext";
import {
  buildSynthesisInput,
  dropBriefSelfTalkWhenProductStateExists,
  isContinueDumpEcho,
  isDumpPrefixEcho,
  isProductWorkReceipt,
  PROJECT_MEMORY_COMPILED_JSON_MAX,
  splitSentences,
  unwrapProjectMemoryJson,
  type ExistingSilentMemory,
} from "../../shared/projectMemoryGenerate";
import {
  AGENT_EVENT_KINDS,
  matchProjectForAgentEvent,
  validateAgentEventPayload,
  type AgentEventPayload,
} from "./agentEvents";
import { normalizeGitHubRepo } from "../../shared/githubRepo";

type JsonObject = Record<string, unknown>;

type SubscriptionLike = {
  status?: string;
  plan?: string;
} | null | undefined;

export interface HypherMcpProjectContext {
  project: Project;
  memory?: ProjectMemory | null;
  captures: AnyObject[];
  activity?: ActivityEntry[];
  actions: ProjectAction[];
  agentEvents: AgentEvent[];
  handoffs?: Handoff[];
  subscription?: SubscriptionLike;
}

export interface HypherMcpContext {
  projects: Project[];
  projectContexts: Record<string, HypherMcpProjectContext>;
}

export interface HypherMcpToolAnnotations {
  readOnlyHint: boolean;
  openWorldHint: boolean;
  destructiveHint: boolean;
}

export interface HypherMcpToolDescriptor {
  name: string;
  title: string;
  description: string;
  inputSchema: JsonObject;
  annotations: HypherMcpToolAnnotations;
}

export interface HypherMcpToolResult {
  structuredContent: JsonObject;
  content: Array<{ type: "text"; text: string }>;
}

const READ_ONLY: HypherMcpToolAnnotations = {
  readOnlyHint: true,
  openWorldHint: false,
  destructiveHint: false,
};

const WRITE: HypherMcpToolAnnotations = {
  readOnlyHint: false,
  openWorldHint: false,
  destructiveHint: false,
};

const PROJECT_ID_SCHEMA = {
  type: "object",
  properties: {
    projectId: { type: "string", description: "Hypher project id." },
  },
  required: ["projectId"],
  additionalProperties: false,
};

const WRITE_TOOLS = new Set(["post_agent_event", "write_project_memory"]);
const PROJECT_CONTEXT_TOOLS = new Set([
  "get_project_context",
  "get_current_state",
  "get_next_move",
  "prepare_handoff",
  "get_synthesis_input",
]);

export function isMcpWriteTool(toolName: string): boolean {
  return WRITE_TOOLS.has(toolName);
}

export function mcpToolNeedsProjectContext(toolName: string): boolean {
  return PROJECT_CONTEXT_TOOLS.has(toolName);
}

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
      title: "Get Builder Brief",
      description: "Return the protected Hypher Builder Brief for a project.",
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
      title: "Prepare handoff notes",
      description: "Prepare concise read-only handoff notes for continuing work in Cursor.",
      inputSchema: PROJECT_ID_SCHEMA,
      annotations: READ_ONLY,
    },
    {
      name: "resolve_project_for_repo",
      title: "Resolve project for repo",
      description: "Map a GitHub owner/repo (or remote URL) to a linked Hypher project.",
      inputSchema: {
        type: "object",
        properties: {
          repo: { type: "string", description: "GitHub owner/repo, remote URL, or SSH remote." },
          branch: { type: "string", description: "Optional git branch for context only." },
        },
        required: ["repo"],
        additionalProperties: false,
      },
      annotations: READ_ONLY,
    },
    {
      name: "get_synthesis_input",
      title: "Get synthesis input",
      description:
        "Return raw captures, current memory, the heuristic snapshot, and buildProjectMemoryPrompt(...) so this agent can compile project identity JSON on its own model. Hypher stores the note; it does not host the model. If needsSynthesis is true, compile the prompt to strict JSON then call write_project_memory once. Skip when needsSynthesis is false. Do not use MCP sampling.",
      inputSchema: PROJECT_ID_SCHEMA,
      annotations: READ_ONLY,
    },
    {
      name: "write_project_memory",
      title: "Write project memory",
      description:
        "Store agent-compiled project identity JSON. Hypher validates with parseProjectMemoryJson, merges with the heuristic snapshot (same path as Anthropic generate), and upserts durable memory. Does not call Anthropic. Pass projectId plus memory (object) or memoryJson (string).",
      inputSchema: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "Hypher project id from resolve_project_for_repo." },
          memoryJson: {
            type: "string",
            description: "Strict JSON string of the compiled identity from get_synthesis_input.",
          },
          memory: {
            type: "object",
            description: "Compiled identity object (same shape as memoryJson).",
          },
          source: { type: "string", description: "Defaults to cursor." },
        },
        required: ["projectId"],
        additionalProperties: false,
      },
      annotations: WRITE,
    },
    {
      name: "post_agent_event",
      title: "Post agent event",
      description: "Write a structured session event (handoff, build_log, question, next_action) to Hypher Agent Inbox / Project Pulse.",
      inputSchema: {
        type: "object",
        properties: {
          kind: {
            type: "string",
            enum: [...AGENT_EVENT_KINDS],
            description: "Agent event kind. Default for session end is handoff.",
          },
          title: { type: "string", description: "Short event title." },
          body: { type: "string", description: "What changed, decisions, and open questions." },
          projectId: { type: "string", description: "Hypher project id from resolve_project_for_repo." },
          project: { type: "string", description: "Project name fallback if projectId is unknown." },
          repo: { type: "string", description: "GitHub owner/repo for matching." },
          branch: { type: "string" },
          commitSha: { type: "string" },
          artifactUrl: { type: "string" },
          suggestedActions: {
            type: "array",
            items: { type: "string" },
            description: "Optional next actions for Hypher to review.",
          },
          source: { type: "string", description: "Defaults to cursor." },
        },
        required: ["kind", "title", "body"],
        additionalProperties: false,
      },
      annotations: WRITE,
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

function recentChangeLeads(params: {
  memory?: ProjectMemory | null;
  captures: AnyObject[];
  agentEvents: AgentEvent[];
}): string[] {
  const agentEvents = hydratePacketAgentEvents(params.agentEvents, params.memory, params.captures);
  const dumpTexts = captureDumpTexts(params.captures);
  const hasProductHandoffs = agentEvents.some((event) => isProductWorkReceipt(event));
  const fromEvents = dropBriefSelfTalkWhenProductStateExists(
    agentEvents
      .filter((event) => isProductWorkReceipt(event))
      .slice()
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((event) => {
        const title = normalize(event.title);
        if (!title) return "";
        return /[.!?]$/.test(title) ? title : `${title}.`;
      })
      .filter(Boolean),
    (title) => title,
  );
  const fromMemory = (params.memory?.recentChanges ?? [])
    .map((item) => {
      const text = normalize(item);
      return splitSentences(text)[0] ?? text;
    })
    .filter((item) => (
      !hasProductHandoffs
      || (!isContinueDumpEcho(item, dumpTexts) && !isDumpPrefixEcho(item, dumpTexts))
    ))
    .filter(Boolean);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of dropBriefSelfTalkWhenProductStateExists(
    [...fromEvents, ...fromMemory],
    (title) => title,
  )) {
    const key = (splitSentences(item)[0] ?? item).replace(/[.!?]+$/, "").toLowerCase().slice(0, 140);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
    if (result.length >= 5) break;
  }
  return result;
}

function currentStateTool(args: JsonObject, context: HypherMcpContext): HypherMcpToolResult {
  const { project, memory, captures, agentEvents } = requireProjectContext(args, context);
  const identity = selectCompiledIdentity({
    memory,
    captures,
    agentEvents,
    projectDescription: project.description,
  });
  const currentState = identity.summary || identity.currentDirection || normalize(project.description);
  const recentChanges = recentChangeLeads({ memory, captures, agentEvents });
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
  const { project, memory, actions, captures, agentEvents } = requireProjectContext(args, context);
  const compiled = selectCompiledNextAction({
    memory,
    actions,
    captures,
    agentEvents,
  });
  const memoryAction = selectPrimaryNextAction(memory?.nextActions ?? []);
  const nextMove = normalize(compiled?.title) || "No next move captured yet.";
  const source = compiled?.id && compiled.id === memoryAction?.id
    ? "project_memory"
    : compiled
      ? "compiled_brief"
      : "empty";

  return textResult(
    {
      projectId: project.id,
      projectName: project.name,
      nextMove,
      source,
      rationale: compiled?.rationale ?? memoryAction?.rationale,
    },
    nextMove
  );
}

function resolveProjectForRepo(args: JsonObject, context: HypherMcpContext): HypherMcpToolResult {
  const repoInput = typeof args.repo === "string" ? args.repo.trim() : "";
  if (!repoInput) throw new Error("missing-repo");
  const matched = matchProjectForAgentEvent(
    context.projects.map((project) => ({
      id: project.id,
      name: project.name,
      githubRepo: project.githubRepo,
    })),
    { repo: repoInput }
  );
  const branch = typeof args.branch === "string" ? args.branch.trim() : undefined;
  if (!matched) {
    return textResult(
      {
        matched: false,
        repo: repoInput,
        branch: branch || undefined,
        projectId: null,
        integrationsUrl: "https://hypher.app/app/settings/integrations",
      },
      `No Hypher project is linked to ${repoInput}. Link the repo in Settings → Integrations.`
    );
  }
  return textResult(
    {
      matched: true,
      repo: repoInput,
      branch: branch || undefined,
      projectId: matched.id,
      projectName: matched.name,
    },
    `Resolved ${repoInput} to ${matched.name} (${matched.id}).`
  );
}

export function parsePostAgentEventArgs(args: JsonObject): {
  payload: AgentEventPayload;
  projectId?: string;
} {
  const projectId = typeof args.projectId === "string" ? args.projectId.trim() : "";
  const parsed = validateAgentEventPayload({
    ...args,
    source: typeof args.source === "string" && args.source.trim() ? args.source : "cursor",
  });
  if (!parsed.ok) throw new Error(parsed.error);
  return {
    payload: parsed.value,
    projectId: projectId || undefined,
  };
}

export function formatAgentEventWriteResult(result: {
  ok: boolean;
  error?: string;
  eventId?: string;
  matchedProjectId?: string | null;
  matchedProjectName?: string;
  needsReview?: boolean;
}): HypherMcpToolResult {
  if (!result.ok) {
    return textResult(
      { ok: false, error: result.error ?? "write-failed" },
      result.error ?? "Could not write the Hypher agent event."
    );
  }
  const destination = result.matchedProjectName
    ? `Logged to Hypher → Project Pulse (${result.matchedProjectName}) / Agent Inbox.`
    : "Logged to Hypher → Agent Inbox. No project matched — review it in Inbox.";
  return textResult(
    {
      ok: true,
      eventId: result.eventId,
      matchedProjectId: result.matchedProjectId ?? null,
      matchedProjectName: result.matchedProjectName,
      needsReview: result.needsReview ?? false,
    },
    destination
  );
}

function captureItemContent(item: AnyObject): string {
  if (item.kind === "note") return item.content ?? "";
  if (item.kind === "artifact") return item.name ?? "";
  return item.name ?? item.description ?? "";
}

function existingFromProjectMemory(memory?: ProjectMemory | null): ExistingSilentMemory {
  if (!memory) return null;
  return {
    summary: memory.summary,
    currentGoal: memory.currentGoal,
    currentDirection: memory.currentDirection,
    recentChanges: memory.recentChanges ?? [],
    importantDecisions: memory.importantDecisions ?? [],
    constraints: memory.constraints ?? [],
    openQuestions: memory.openQuestions ?? [],
    activeTasks: memory.activeTasks ?? [],
    blockers: memory.blockers ?? [],
    staleAssumptions: memory.staleAssumptions ?? [],
    handoffNotes: memory.handoffNotes ?? [],
    nextActions: memory.nextActions,
    acceptedCrystallizedSuggestions: memory.acceptedCrystallizedSuggestions,
  };
}

function synthesisInputTool(args: JsonObject, context: HypherMcpContext): HypherMcpToolResult {
  const projectContext = requireProjectContext(args, context);
  const { project, memory, captures, agentEvents } = projectContext;
  const items = captures
    .filter((item) => item.kind !== "project")
    .slice()
    .sort((a, b) => (b.modifiedAt ?? 0) - (a.modifiedAt ?? 0))
    .slice(0, 24)
    .map((item) => ({
      id: item.id,
      name: item.kind === "note" ? (item.content ?? "").slice(0, 80) : item.name,
      content: captureItemContent(item),
      modifiedAt: item.modifiedAt,
    }));
  const built = buildSynthesisInput({
    project: {
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
      blockers: project.blockers,
    },
    items,
    events: agentEvents.map((event) => ({
      id: event.id,
      kind: event.kind,
      source: event.source,
      title: event.title,
      body: event.body,
      suggestedActions: event.suggestedActions,
      createdAt: event.createdAt,
    })),
    existing: existingFromProjectMemory(memory),
    identityMemory: memory ? { summary: memory.summary, model: memory.model } : null,
    now: memory?.generatedAt ?? project.modifiedAt ?? 0,
  });
  const instruction = built.needsSynthesis
    ? "Compile this into strict project-memory JSON on your model, then call write_project_memory with projectId and that JSON. Hypher stores the note and does not host the model. Do not use MCP sampling."
    : "Identity is already compiled. Skip write_project_memory unless the builder asked to rebuild.";
  return textResult(
    {
      projectId: project.id,
      identityKind: built.identityKind,
      needsSynthesis: built.needsSynthesis,
      generationInput: built.generationInput,
      prompt: built.prompt,
    },
    `${instruction}\n\n${built.prompt}`
  );
}

export function parseWriteProjectMemoryArgs(args: JsonObject): {
  projectId: string;
  compiledJson: string;
  source: string;
} {
  const projectId = getProjectId(args);
  const source = typeof args.source === "string" && args.source.trim() ? args.source.trim() : "cursor";
  let compiledJson = "";
  if (args.memory && typeof args.memory === "object") {
    compiledJson = JSON.stringify(args.memory);
  } else if (typeof args.memoryJson === "string") {
    compiledJson = unwrapProjectMemoryJson(args.memoryJson);
  }
  if (!compiledJson) throw new Error("missing-compiled-memory");
  if (compiledJson.length > PROJECT_MEMORY_COMPILED_JSON_MAX) {
    throw new Error("compiled-json-too-large");
  }
  return { projectId, compiledJson, source };
}

export function formatWriteProjectMemoryResult(result: {
  ok: boolean;
  error?: string;
  projectId?: string;
  identityKind?: string;
  model?: string;
}): HypherMcpToolResult {
  if (!result.ok) {
    return textResult(
      { ok: false, error: result.error ?? "write-failed" },
      result.error ?? "Could not store project memory."
    );
  }
  return textResult(
    {
      ok: true,
      projectId: result.projectId,
      identityKind: result.identityKind ?? "compiled",
      model: result.model,
    },
    "Stored agent-compiled project memory. Next get_project_context will be warmer."
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
    "Account linking wording: Connect your Hypher account to Cursor.",
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
    case "resolve_project_for_repo":
      return resolveProjectForRepo(args, context);
    case "get_synthesis_input":
      return synthesisInputTool(args, context);
    default:
      throw new Error("unknown-tool");
  }
}
