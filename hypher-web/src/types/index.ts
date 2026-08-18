export type ProjectStatus = "active" | "paused" | "shipped" | "archived";
export type NoteMaturity = "fleeting" | "developing" | "structured" | "reference";
export type ArtifactType = "image" | "video" | "code" | "document" | "font" | "audio" | "other";
export type ConnectionType = "manual" | "ai_suggested" | "ai_confirmed" | "dismissed";
export type ObjectKind = "project" | "note" | "artifact";
export type CaptureType =
  | "thought"
  | "decision"
  | "bug"
  | "task"
  | "design_note"
  | "code_note"
  | "meeting_note"
  | "user_insight"
  | "agent_output"
  | "link_reference"
  | "open_question";
export type CaptureStatus = "unsorted" | "sorted" | "archived";
export type ProjectMemoryStatus = "fresh" | "stale" | "empty" | "generating" | "error";
export type ProjectNextActionStatus = "suggested" | "accepted" | "dismissed";
export type TargetTool = "ChatGPT" | "Claude" | "Cursor" | "Windsurf" | "Linear" | "GitHub" | "GitHub Copilot" | "MCP tool" | "Manual";
export type AgentEventKind = "handoff" | "build_log" | "question" | "suggestion" | "artifact" | "next_action";
export type AgentEventStatus = "new" | "reviewed" | "accepted" | "dismissed";
export type ProjectActionStatus = "suggested" | "accepted" | "completed" | "dismissed";
export type ProjectActionSourceType = "project_memory" | "agent_event" | "manual" | "github";
export type HandoffStatus = "pending" | "used" | "completed" | "discarded";
export type CrystallizedSuggestionKind =
  | "decision"
  | "constraint"
  | "do_not_do"
  | "current_task"
  | "open_action"
  | "acceptance_criterion"
  | "agent_warning"
  | "handoff_note";
export type CrystallizedSuggestionSourceType =
  | "capture"
  | "handoff"
  | "returned_agent_output"
  | "user_note";
export type AcceptedCrystallizedSuggestionStatus = "active" | "stale" | "excluded";

export interface CanvasPosition {
  x: number;
  y: number;
}

export interface HypherObject {
  id: string;
  kind: ObjectKind;
  createdAt: number;
  modifiedAt: number;
  embedding?: number[];
  embeddingText?: string;
  tags?: string[];
  canvasPosition?: CanvasPosition;
  projectId?: string | null;
  source?: string;
  captureType?: CaptureType;
  suggestedProjectId?: string | null;
  confirmedProjectId?: string | null;
  confidence?: number;
  captureStatus?: CaptureStatus;
  linkedHandoffId?: string;
  excludeFromPackets?: boolean;
  pinnedAsDecision?: boolean;
  convertedToTask?: boolean;
  stale?: boolean;
  lastSurfacedAt?: number;
  reviewedAt?: number;
  canvasColor?: string;
  canvasSize?: { w: number; h: number };
}

export type ProjectPriority = 1 | 2 | 3 | 4 | 5;

export interface Project extends HypherObject {
  kind: "project";
  name: string;
  description: string;
  status: ProjectStatus;
  priority?: ProjectPriority;
  blockers?: string;
  lastActivity?: number;
  githubRepo?: string;       // "owner/repo"
  githubLastSync?: number;
}

export interface Note extends HypherObject {
  kind: "note";
  content: string;
  maturity: NoteMaturity;
}

export interface Artifact extends HypherObject {
  kind: "artifact";
  name: string;
  type: ArtifactType;
  fileReference?: string;
  thumbnailDataUrl?: string;
}

export interface Connection {
  id: string;
  sourceId: string;
  targetId: string;
  sourceKind: ObjectKind;
  targetKind: ObjectKind;
  type: ConnectionType;
  confidence: number;
  reason: string;
  createdAt: number;
}

export type ActivityAction = "created" | "updated" | "deleted" | "connected" | "suggested" | "dismissed";

export interface ActivityEntry {
  id: string;
  action: ActivityAction;
  objectId: string;
  objectKind: ObjectKind;
  objectName: string;
  targetId?: string;
  targetKind?: ObjectKind;
  targetName?: string;
  timestamp: number;
  projectId?: string;
  activityType?: string;
  summary?: string;
}

export type AnyObject = Project | Note | Artifact;

export interface ProjectNextAction {
  id: string;
  title: string;
  rationale: string;
  requiredContext?: string[];
  suggestedTargetTool?: TargetTool;
  confidence?: number;
  sourceCaptureIds?: string[];
  status: ProjectNextActionStatus;
  createdAt: number;
  updatedAt: number;
}

export interface AcceptedCrystallizedSuggestion {
  kind: CrystallizedSuggestionKind;
  text: string;
  sourceType: CrystallizedSuggestionSourceType;
  sourceId?: string;
  suggestionId?: string;
  createdAt: number;
  status?: AcceptedCrystallizedSuggestionStatus;
  updatedAt?: number;
}

export interface ProjectMemory {
  id?: string;
  projectId: string;
  summary: string;
  currentGoal?: string;
  currentDirection: string;
  recentChanges: string[];
  importantDecisions?: string[];
  constraints?: string[];
  openQuestions: string[];
  activeTasks?: string[];
  blockers?: string[];
  staleAssumptions?: string[];
  acceptanceCriteria?: string[];
  agentWarnings?: string[];
  handoffNotes?: string[];
  acceptedCrystallizedSuggestions?: AcceptedCrystallizedSuggestion[];
  nextActions: ProjectNextAction[];
  generatedAt: number;
  sourceUpdatedAt: number;
  lastUpdatedAt?: number;
  model: string;
  error?: string;
}

export interface Handoff {
  id: string;
  userId: string;
  projectId: string;
  generatedAt: number;
  targetTool: TargetTool;
  packetContent: string;
  sourceCaptures: string[];
  requestedTask: string;
  status: HandoffStatus;
  userNotes?: string;
  returnedAgentOutput?: string;
}

export interface AgentEvent {
  id: string;
  userId: string;
  projectId?: string;
  source: string;
  kind: AgentEventKind;
  title: string;
  body: string;
  suggestedActions?: string[];
  repo?: string;
  branch?: string;
  commitSha?: string;
  artifactUrl?: string;
  externalKey?: string;
  autoResolved?: boolean;
  status: AgentEventStatus;
  createdAt: number;
  reviewedAt?: number;
}

export interface ProjectAction {
  id: string;
  userId: string;
  projectId: string;
  title: string;
  status: ProjectActionStatus;
  sourceType: ProjectActionSourceType;
  sourceId?: string;
  rationale?: string;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}

export interface ProjectSuggestion {
  projectId: string;
  projectName: string;
  confidence: number;
  reason: string;
}

export interface CaptureResult {
  noteId: string;
  suggestions: ProjectSuggestion[];
}

export function getDisplayName(obj: AnyObject): string {
  switch (obj.kind) {
    case "project": return obj.name;
    case "note": {
      const trimmed = (obj.content ?? "").trim();
      return trimmed.length <= 40 ? trimmed : trimmed.slice(0, 40) + "\u2026";
    }
    case "artifact": return obj.name;
  }
}

export function getEmbeddingText(obj: AnyObject): string {
  switch (obj.kind) {
    case "project": return [obj.name, obj.description].filter(Boolean).join(". ");
    case "note": return (obj.content ?? "").trim();
    case "artifact": return `${obj.name} — ${obj.type}`;
  }
}
