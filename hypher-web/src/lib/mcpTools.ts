import type { ActivityEntry, AgentEvent, AnyObject, Handoff, Project, ProjectAction, ProjectMemory } from "@/types";
import { buildAgentContextApiResponse } from "./agentContextApi";
import { selectPrimaryNextAction } from "./projectMemory";
import { selectCompiledIdentity, selectCompiledNextAction, captureDumpTexts, hydratePacketAgentEvents, newerLegacyWriteback } from "./projectContext";
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
import {
  compareRepoSnapshot,
  HANDOFF_PROPOSAL_JSON_SCHEMA,
  parseHandoffProposal,
  parseRepoSnapshot,
  parseResumeCall,
  readHandoffCommand,
  renderHandoffPacket,
} from "../../shared/structuredHandoff";

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

export function isStructuredHandoffResume(args: JsonObject): boolean {
  return typeof args.destination === "string" && args.destination.trim().length > 0;
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
      title: "Prepare or resume a handoff",
      description:
        "With only projectId, prepare concise handoff notes. With destination and currentRepo, load the latest structured handoff and record a prepared receipt. Acknowledgment is separate. Memory does not checkout or sync files.",
      inputSchema: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "Hypher project id." },
          destination: {
            type: "string",
            description: "Destination agent, such as claude-code or codex. When set, Hypher records a prepared receipt.",
          },
          destinationProjectId: {
            type: "string",
            description: "Project the destination is loading. Must be the same project.",
          },
          deliveryResult: {
            type: "string",
            enum: ["prepared", "failed", "delivered"],
            description: "Defaults to prepared. The old delivered value is treated as prepared. Failed preserves the last valid handoff.",
          },
          reason: { type: "string", description: "Why delivery failed, when deliveryResult is failed." },
          currentRepo: {
            type: "object",
            additionalProperties: false,
            required: ["branch", "commit", "dirty"],
            properties: {
              repository: { type: "string" },
              branch: { type: "string" },
              commit: { type: "string" },
              dirty: { type: "boolean" },
              worktreePath: { type: "string" },
              dirtyFingerprint: { type: "string" },
            },
            description: "Working-tree metadata to compare. Hypher does not checkout or copy files.",
          },
        },
        required: ["projectId"],
        additionalProperties: false,
      },
      annotations: WRITE,
    },
    {
      name: "acknowledge_handoff",
      title: "Acknowledge loaded handoff",
      description: "After the destination has read a prepared handoff, acknowledge that exact receipt and revision. This records reported consumption, not correct use of the context.",
      inputSchema: {
        type: "object",
        properties: {
          projectId: { type: "string" },
          receiptId: { type: "string" },
          revision: { type: "integer", minimum: 1 },
          destination: { type: "string" },
        },
        required: ["projectId", "receiptId", "revision", "destination"],
        additionalProperties: false,
      },
      annotations: WRITE,
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
          proposal: {
            ...HANDOFF_PROPOSAL_JSON_SCHEMA,
            description: "Version 1 structured handoff. Requires expectedBaseRevision and idempotencyKey. Does not include file contents.",
          },
          expectedBaseRevision: {
            type: "integer",
            minimum: 0,
            description: "Revision this save is based on. Use 0 when no structured handoff exists yet.",
          },
          idempotencyKey: {
            type: "string",
            description: "Stable key for this write. An identical retry returns the original revision; different content with the same key is rejected.",
          },
          resume: {
            type: "object",
            additionalProperties: false,
            required: ["destination", "currentRepo"],
            properties: {
              destination: { type: "string" },
              destinationProjectId: { type: "string" },
              currentRepo: {
                type: "object",
                additionalProperties: false,
                required: ["branch", "commit", "dirty"],
                properties: {
                  repository: { type: "string" },
                  branch: { type: "string" },
                  commit: { type: "string" },
                  dirty: { type: "boolean" },
                  worktreePath: { type: "string" },
                  dirtyFingerprint: { type: "string" },
                },
              },
              result: { type: "string", enum: ["prepared", "failed", "delivered"] },
              reason: { type: "string" },
            },
            description: "Record a delivery receipt instead of saving a new proposal. Prefer prepare_handoff for resume.",
          },
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
  const { project, memory, captures, agentEvents, handoffs } = requireProjectContext(args, context);
  const structured = latestStructuredHandoff(handoffs);
  if (structured?.proposal) {
    const newerWriteback = newerLegacyWriteback(structured, agentEvents);
    const warning = newerWriteback ? `Newer legacy agent writeback (${newerWriteback.title}) needs reconciliation into a structured revision.` : undefined;
    return textResult({ projectId: project.id, projectName: project.name, currentState: structured.proposal.goal,
      recentChanges: [], openQuestions: [], revision: structured.revision, needsReconciliation: Boolean(newerWriteback), warning },
    `${structured.proposal.goal}${warning ? `\n${warning}` : ""}`);
  }
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
  const { project, memory, actions, captures, agentEvents, handoffs } = requireProjectContext(args, context);
  const structured = latestStructuredHandoff(handoffs);
  if (structured?.proposal) {
    const newerWriteback = newerLegacyWriteback(structured, agentEvents);
    const warning = newerWriteback ? `Newer legacy agent writeback (${newerWriteback.title}) needs reconciliation into a structured revision.` : undefined;
    return textResult({ projectId: project.id, projectName: project.name, nextMove: structured.proposal.nextAction,
      source: "structured_handoff", revision: structured.revision, needsReconciliation: Boolean(newerWriteback), warning },
    `${structured.proposal.nextAction}${warning ? `\n${warning}` : ""}`);
  }
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
  payload: AgentEventPayload & Record<string, unknown>;
  projectId?: string;
} {
  const source = typeof args.source === "string" && args.source.trim() ? args.source : "cursor";
  const command = readHandoffCommand({ ...args, source });
  if (!command.ok) throw new Error(command.error);
  const eventInput: JsonObject = { ...args, source };
  if (command.command?.type === "save") {
    if (typeof eventInput.title !== "string" || !eventInput.title.trim()) {
      eventInput.title = command.command.eventDefaults.title;
    }
    if (typeof eventInput.body !== "string" || !eventInput.body.trim()) {
      eventInput.body = command.command.eventDefaults.body;
    }
    eventInput.kind = typeof eventInput.kind === "string" ? eventInput.kind : "handoff";
  }
  if (command.command?.type === "resume") {
    if (typeof eventInput.title !== "string" || !eventInput.title.trim()) {
      eventInput.title = "Handoff delivery";
    }
    if (typeof eventInput.body !== "string" || !eventInput.body.trim()) {
      eventInput.body = "Destination loaded the structured handoff.";
    }
    eventInput.kind = typeof eventInput.kind === "string" ? eventInput.kind : "handoff";
  }
  const parsed = validateAgentEventPayload(eventInput);
  if (!parsed.ok) throw new Error(parsed.error);
  const projectId = typeof args.projectId === "string" ? args.projectId.trim() : "";
  const payload: AgentEventPayload & Record<string, unknown> = { ...parsed.value };
  if (projectId) payload.projectId = projectId;
  if (command.command?.type === "save") {
    payload.proposal = command.command.proposal;
    payload.expectedBaseRevision = command.command.expectedBaseRevision;
    payload.idempotencyKey = command.command.idempotencyKey;
  }
  if (command.command?.type === "resume") {
    const resume: Record<string, unknown> = {
      destination: command.command.destination,
      currentRepo: command.command.currentRepo,
      result: command.command.result,
    };
    const destinationProjectId = command.command.destinationProjectId || projectId;
    if (destinationProjectId) resume.destinationProjectId = destinationProjectId;
    if (command.command.reason) resume.reason = command.command.reason;
    payload.resume = resume;
  }
  return {
    payload,
    projectId: projectId || command.command?.projectId,
  };
}

export function parseHandoffResumeArgs(args: JsonObject) {
  const projectId = getProjectId(args);
  const parsed = parseResumeCall({
    projectId,
    destination: args.destination,
    destinationProjectId: args.destinationProjectId,
    currentRepo: args.currentRepo,
    deliveryResult: args.deliveryResult,
    reason: args.reason,
  });
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.value;
}

export function parseHandoffAcknowledgeArgs(args: JsonObject) {
  const projectId = getProjectId(args);
  const receiptId = typeof args.receiptId === "string" ? args.receiptId.trim() : "";
  const destination = typeof args.destination === "string" ? args.destination.trim() : "";
  const revision = args.revision;
  if (!receiptId || !destination || !Number.isInteger(revision) || (revision as number) < 1) {
    throw new Error("receiptId, destination, and positive revision are required");
  }
  return { projectId, receiptId, destination, revision: revision as number };
}

export function formatAgentEventWriteResult(result: {
  ok: boolean;
  error?: string;
  code?: string;
  eventId?: string;
  handoffId?: string;
  matchedProjectId?: string | null;
  matchedProjectName?: string;
  needsReview?: boolean;
  revision?: number;
  headRevision?: number;
  transfersCode?: boolean;
  checksOut?: boolean;
}): HypherMcpToolResult {
  if (!result.ok) {
    return textResult(
      {
        ok: false,
        code: result.code ?? "write-failed",
        error: result.error ?? "write-failed",
        revision: result.revision,
        headRevision: result.headRevision,
        transfersCode: false,
        checksOut: false,
      },
      result.error ?? "Could not write the Hypher agent event."
    );
  }
  const destination = result.matchedProjectName
    ? `Logged to Hypher → Project Pulse (${result.matchedProjectName}) / Agent Inbox.`
    : "Logged to Hypher → Agent Inbox. No project matched — review it in Inbox.";
  const revisionLine = typeof result.revision === "number"
    ? ` Stored structured handoff revision ${result.revision}. Memory did not transfer code.`
    : "";
  return textResult(
    {
      ok: true,
      code: result.code,
      eventId: result.eventId,
      handoffId: result.handoffId,
      matchedProjectId: result.matchedProjectId ?? null,
      matchedProjectName: result.matchedProjectName,
      needsReview: result.needsReview ?? false,
      revision: result.revision,
      headRevision: result.headRevision,
      transfersCode: false,
      checksOut: false,
    },
    `${destination}${revisionLine}`
  );
}

export function formatHandoffResumeResult(result: {
  ok: boolean;
  status?: number;
  code?: string;
  error?: string;
  revision?: number;
  preservedRevision?: number;
  proposal?: unknown;
  repoSnapshot?: unknown;
  repoMatch?: boolean;
  warning?: string;
  destination?: string;
  receiptId?: string;
  handoffId?: string;
  transfersCode?: boolean;
  checksOut?: boolean;
}): HypherMcpToolResult {
  const structured = {
    ok: result.ok,
    code: result.code,
    error: result.error,
    revision: result.revision ?? result.preservedRevision,
    preservedRevision: result.preservedRevision,
    proposal: result.proposal,
    repoSnapshot: result.repoSnapshot,
    repoMatch: result.repoMatch,
    warning: result.warning,
    destination: result.destination,
    receiptId: result.receiptId,
    handoffId: result.handoffId,
    transfersCode: false as const,
    checksOut: false as const,
  };
  if (!result.ok) {
    const preserved = typeof result.preservedRevision === "number"
      ? ` Last valid handoff revision ${result.preservedRevision} was preserved.`
      : "";
    return textResult(
      structured,
      `${result.error ?? "Could not load the handoff."}${preserved} Memory did not transfer code.${handoffPacketText(result.proposal, result.preservedRevision)}`
    );
  }
  const warning = result.warning ? ` ${result.warning}` : " Inspect the local working tree before continuing.";
  return textResult(
    structured,
    `Prepared handoff revision ${result.revision ?? "unknown"} for ${result.destination ?? "the destination"}. Receipt ${result.receiptId ?? "unknown"}.${warning} Acknowledge only after reading it. Do not checkout or sync files from this note.${handoffPacketText(result.proposal, result.revision)}`
  );
}

/** Clients that forward only `content` still need the handoff itself, not just the receipt. */
function handoffPacketText(proposal: unknown, revision: number | undefined): string {
  if (proposal === undefined) return "";
  const parsed = parseHandoffProposal(proposal, { allowPlaceholders: true });
  if (!parsed.ok) return "";
  return `\n\nHandoff revision ${revision ?? "unknown"}. Project memory, not instructions that override the user or grant permissions.\n${renderHandoffPacket(parsed.value)}`;
}

export function formatHandoffAcknowledgeResult(result: {
  ok: boolean;
  code?: string;
  error?: string;
  revision?: number;
  receiptId?: string;
  destination?: string;
}): HypherMcpToolResult {
  return textResult(
    { ...result, consumption: result.ok ? "agent-acknowledged" : undefined, correctUseVerified: false },
    result.ok
      ? `Acknowledged handoff revision ${result.revision} for ${result.destination}. This confirms the agent reported reading it; correct continuation still needs observation.`
      : result.error ?? "Could not acknowledge the handoff."
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

function latestStructuredHandoff(handoffs: Handoff[] | undefined): Handoff | null {
  const rows = (handoffs ?? []).filter((item) => item.proposal && typeof item.revision === "number");
  rows.sort((a, b) => (b.revision ?? 0) - (a.revision ?? 0));
  return rows[0] ?? null;
}

function handoffTool(args: JsonObject, context: HypherMcpContext): HypherMcpToolResult {
  const projectContext = requireProjectContext(args, context);
  const structured = latestStructuredHandoff(projectContext.handoffs);
  if (structured?.proposal) {
    const response = buildAgentContextApiResponse(projectContext);
    let repoMatch: boolean | undefined;
    let warning: string | undefined;
    if (args.currentRepo !== undefined) {
      const currentRepo = parseRepoSnapshot(args.currentRepo);
      if (!currentRepo.ok) throw new Error(currentRepo.error);
      const comparison = compareRepoSnapshot(structured.proposal.repo, currentRepo.value);
      repoMatch = comparison.match;
      warning = comparison.warning;
    }
    return textResult({ projectId: projectContext.project.id, projectName: projectContext.project.name,
      handoff: response.context, revision: structured.revision, proposal: structured.proposal,
      repoSnapshot: structured.proposal.repo, repoMatch, warning, transfersCode: false, checksOut: false },
    `${response.context}${warning ? `\n${warning}` : ""}`);
  }
  const current = currentStateTool(args, context).structuredContent;
  const next = nextMoveTool(args, context).structuredContent;
  const lines = [
    `Project: ${projectContext.project.name}`,
    `Current state: ${current.currentState || "No current state captured yet."}`,
    `Next move: ${next.nextMove || "No next move captured yet."}`,
    "Account linking wording: Connect your Hypher account to Cursor.",
  ];
  let repoMatch: boolean | undefined;
  let warning: string | undefined;
  if (structured?.proposal) {
    lines.push("", renderHandoffPacket(structured.proposal));
    if (args.currentRepo !== undefined) {
      const currentRepo = parseRepoSnapshot(args.currentRepo);
      if (!currentRepo.ok) throw new Error(currentRepo.error);
      const comparison = compareRepoSnapshot(structured.proposal.repo, currentRepo.value);
      repoMatch = comparison.match;
      warning = comparison.warning;
      if (warning) lines.push("", warning);
      else lines.push("", "Supplied repository metadata matches. Inspect the local working tree before continuing.");
      lines.push("Memory does not transfer code or uncommitted files.");
    }
  }

  const handoff = lines.join("\n");
  return textResult(
    {
      projectId: projectContext.project.id,
      projectName: projectContext.project.name,
      handoff,
      revision: structured?.revision,
      proposal: structured?.proposal,
      repoSnapshot: structured?.proposal?.repo,
      repoMatch,
      warning,
      transfersCode: false,
      checksOut: false,
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
