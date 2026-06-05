import type {
  AnyObject,
  CaptureType,
  Connection,
  Note,
  ProjectSuggestion,
} from "../src/types";

export const DEFAULT_MAX_CAPTURE_CONTENT = 10_000;
export const DEFAULT_MAX_CAPTURE_TAGS = 10;
export const PROJECT_ID_RE = /^[a-zA-Z0-9_-]{6,64}$/;

export type CaptureInputError =
  | "content_required"
  | "content_too_long"
  | "invalid_project"
  | "too_many_tags";

export type NormalizedCaptureInput =
  | {
      ok: true;
      content: string;
      projectId: string | null;
      tags: string[] | undefined;
    }
  | { ok: false; error: CaptureInputError };

export type CaptureTagMode = "strict" | "api";

export interface NormalizeCaptureInputArgs {
  content?: unknown;
  text?: unknown;
  q?: unknown;
  project?: unknown;
  projectId?: unknown;
  tags?: unknown;
  maxContent?: number;
  maxTags?: number;
  validateProjectId?: boolean;
  tagMode?: CaptureTagMode;
}

export interface BuildCaptureMetadataArgs {
  content: string;
  projectId?: string | null;
  now: number;
  tags?: string[];
  includeClientFields?: boolean;
  markReviewedOnProject?: boolean;
}

export type PreparedCaptureObject = Omit<Note, "id"> & { id?: string };

export interface PrepareCaptureObjectArgs extends BuildCaptureMetadataArgs {
  id?: string;
}

export interface SuggestProjectForCaptureArgs {
  capture: Note;
  allObjects: AnyObject[];
  projectId?: string | null;
  suggestProjects: (capture: Note, allObjects: AnyObject[]) => ProjectSuggestion[];
}

export interface EnrichCaptureArgs {
  capture: Note;
  allObjects: AnyObject[];
  connections: Connection[];
  projectId?: string | null;
  minTagContentLength?: number;
  embedCapture: (capture: Note) => Promise<AnyObject>;
  generateTags?: (content: string) => Promise<string[]>;
  suggestProjects: (capture: Note, allObjects: AnyObject[]) => ProjectSuggestion[];
  computeConnections: (
    changedObject: AnyObject,
    candidateObjects: AnyObject[],
    connections: Connection[]
  ) => Omit<Connection, "id">[];
}

export interface CaptureEnrichmentResult {
  enriched: boolean;
  capture?: Note;
  suggestions: ProjectSuggestion[];
  connectionsToCreate: Omit<Connection, "id">[];
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string") return value;
  }
  return "";
}

function normalizeTags(
  value: unknown,
  mode: CaptureTagMode,
  maxTags: number
): string[] | CaptureInputError | undefined {
  if (value == null || value === "") return undefined;

  if (mode === "api") {
    if (!Array.isArray(value)) {
      if (typeof value !== "string") return undefined;
      const tags = value.split(",").map((tag) => tag.trim()).filter(Boolean);
      return tags.slice(0, maxTags);
    }
    return value
      .filter((tag): tag is string => typeof tag === "string")
      .slice(0, maxTags);
  }

  const raw = Array.isArray(value)
    ? value.map((tag) => String(tag)).join(",")
    : typeof value === "string"
      ? value
      : "";
  const tags = raw.split(",").map((tag) => tag.trim()).filter(Boolean);
  if (tags.length > maxTags) return "too_many_tags";
  return tags.length > 0 ? tags : undefined;
}

export function normalizeCaptureInput(args: NormalizeCaptureInputArgs): NormalizedCaptureInput {
  const maxContent = args.maxContent ?? DEFAULT_MAX_CAPTURE_CONTENT;
  const maxTags = args.maxTags ?? DEFAULT_MAX_CAPTURE_TAGS;
  const validateProjectId = args.validateProjectId ?? true;
  const tagMode = args.tagMode ?? "strict";
  const content = firstString(args.content, args.text, args.q).trim();

  if (!content) return { ok: false, error: "content_required" };
  if (content.length > maxContent) return { ok: false, error: "content_too_long" };

  let projectId: string | null = null;
  const projectRaw = firstString(args.project, args.projectId).trim();
  if (projectRaw) {
    if (validateProjectId && !PROJECT_ID_RE.test(projectRaw)) {
      return { ok: false, error: "invalid_project" };
    }
    projectId = projectRaw;
  }

  const tags = normalizeTags(args.tags, tagMode, maxTags);
  if (typeof tags === "string") return { ok: false, error: tags };

  return {
    ok: true,
    content,
    projectId,
    tags,
  };
}

export function inferCaptureType(text: string): CaptureType {
  const lower = text.toLowerCase();
  if (/\b(decided|decision|we will|ship|choose|chosen)\b/.test(lower)) return "decision";
  if (/\b(bug|broken|error|fails|regression|crash)\b/.test(lower)) return "bug";
  if (/\b(todo|task|need to|follow up|fix|implement)\b/.test(lower)) return "task";
  if (/\b(design|ux|ui|mock|visual)\b/.test(lower)) return "design_note";
  if (/\b(code|api|component|schema|route|function)\b/.test(lower)) return "code_note";
  if (/\b(meeting|call|standup|sync)\b/.test(lower)) return "meeting_note";
  if (/\b(user|customer|feedback|insight)\b/.test(lower)) return "user_insight";
  if (/\b(agent|claude|chatgpt|cursor|windsurf|copilot)\b/.test(lower)) return "agent_output";
  if (/https?:\/\//.test(lower)) return "link_reference";
  if (text.trim().endsWith("?")) return "open_question";
  return "thought";
}

export function inferCaptureTitle(content: string, maxLength = 40): string {
  const firstLine = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean) ?? "";
  return firstLine.length <= maxLength
    ? firstLine
    : `${firstLine.slice(0, maxLength)}\u2026`;
}

export function buildCaptureMetadata(args: BuildCaptureMetadataArgs): Omit<Note, "id" | "kind" | "content"> {
  const projectId = args.projectId ?? null;
  const markReviewedOnProject = args.markReviewedOnProject ?? true;
  const base: Omit<Note, "id" | "kind" | "content"> = {
    maturity: "fleeting",
    createdAt: args.now,
    modifiedAt: args.now,
    projectId,
    ...(projectId && markReviewedOnProject ? { reviewedAt: args.now } : {}),
    ...(args.tags?.length ? { tags: args.tags } : {}),
  };

  if (!args.includeClientFields) return base;

  return {
    ...base,
    source: "manual",
    captureType: inferCaptureType(args.content),
    captureStatus: projectId ? "sorted" : "unsorted",
    confirmedProjectId: projectId,
  };
}

export function prepareCaptureObject(args: PrepareCaptureObjectArgs): PreparedCaptureObject {
  return {
    ...(args.id ? { id: args.id } : {}),
    kind: "note",
    content: args.content,
    ...buildCaptureMetadata(args),
  };
}

export function suggestProjectForCapture(args: SuggestProjectForCaptureArgs): ProjectSuggestion[] {
  if (args.projectId || !args.capture.embedding) return [];
  return args.suggestProjects(args.capture, args.allObjects);
}

function mergeCaptureObject(allObjects: AnyObject[], capture: Note): AnyObject[] {
  let replaced = false;
  const merged = allObjects.map((object) => {
    if (object.id !== capture.id) return object;
    replaced = true;
    return capture;
  });
  return replaced ? merged : [...merged, capture];
}

export async function enrichCapture(args: EnrichCaptureArgs): Promise<CaptureEnrichmentResult> {
  const embeddedPromise = args.embedCapture(args.capture);
  const shouldGenerateTags =
    !args.capture.tags?.length &&
    args.capture.content.length >= (args.minTagContentLength ?? 10) &&
    Boolean(args.generateTags);
  const tagsPromise = shouldGenerateTags
    ? args.generateTags!(args.capture.content)
    : Promise.resolve([] as string[]);
  const [embeddedObject, generatedTags] = await Promise.all([embeddedPromise, tagsPromise]);
  const embedded = embeddedObject as Note;
  const tags = embedded.tags?.length
    ? embedded.tags
    : generatedTags.length > 0
      ? generatedTags
      : undefined;
  const capture = tags ? { ...embedded, tags } : embedded;
  const allObjects = mergeCaptureObject(args.allObjects, capture);
  const candidateObjects = allObjects.filter((object) => object.id !== capture.id);

  return {
    enriched: true,
    capture,
    suggestions: suggestProjectForCapture({
      capture,
      allObjects,
      projectId: args.projectId ?? capture.projectId ?? null,
      suggestProjects: args.suggestProjects,
    }),
    connectionsToCreate: args.computeConnections(capture, candidateObjects, args.connections),
  };
}

export async function safeEnrichCapture(
  run: () => Promise<CaptureEnrichmentResult> | CaptureEnrichmentResult,
  onError?: (error: unknown) => void
): Promise<CaptureEnrichmentResult> {
  try {
    return await run();
  } catch (error) {
    onError?.(error);
    return {
      enriched: false,
      suggestions: [],
      connectionsToCreate: [],
    };
  }
}
