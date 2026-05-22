import type {
  AcceptedCrystallizedSuggestion,
  AcceptedCrystallizedSuggestionStatus,
  AnyObject,
  CrystallizedSuggestionKind,
  CrystallizedSuggestionSourceType,
  Handoff,
  ProjectAction,
  ProjectMemory,
} from "@/types";

export interface CrystallizedSuggestion {
  id: string;
  kind: CrystallizedSuggestionKind;
  text: string;
  sourceType: CrystallizedSuggestionSourceType;
  sourceId?: string;
  confidence?: "low" | "medium" | "high";
  reason?: string;
}

export interface SuggestCrystallizedUpdatesParams {
  captures?: AnyObject[];
  handoffs?: Handoff[];
  existingSuggestions?: unknown[];
  existingMemory?: ProjectMemory | null;
  existingActions?: ProjectAction[];
  limits?: {
    maxSuggestions?: number;
    maxSourceLength?: number;
  };
}

export type AcceptedCrystallizedMemoryPatch = Partial<Pick<
  ProjectMemory,
  | "importantDecisions"
  | "constraints"
  | "acceptanceCriteria"
  | "agentWarnings"
  | "handoffNotes"
  | "acceptedCrystallizedSuggestions"
>>;

export function acceptedCrystallizedSuggestionStatus(
  suggestion: AcceptedCrystallizedSuggestion
): AcceptedCrystallizedSuggestionStatus {
  return suggestion.status ?? "active";
}

type ClassifiedSuggestion = Pick<CrystallizedSuggestion, "kind" | "confidence" | "reason">;

const DEFAULT_MAX_SUGGESTIONS = 8;
const DEFAULT_MAX_SOURCE_LENGTH = 700;

const RULES: Array<{ kind: CrystallizedSuggestionKind; confidence: "medium" | "high"; reason: string; pattern: RegExp }> = [
  {
    kind: "do_not_do",
    confidence: "high",
    reason: "Contains explicit Do Not Do language.",
    pattern: /\b(do not|don't|dont|avoid|not yet|defer|should not|never)\b/i,
  },
  {
    kind: "acceptance_criterion",
    confidence: "high",
    reason: "Describes a completion or success condition.",
    pattern: /\b(done when|complete when|acceptance criteria|passes when|success means)\b/i,
  },
  {
    kind: "agent_warning",
    confidence: "medium",
    reason: "Flags agent drift or execution risk.",
    pattern: /\b(agent drift|don't let the agent|dont let the agent|the agent skipped|it may|risk|watch out)\b/i,
  },
  {
    kind: "current_task",
    confidence: "medium",
    reason: "Names current work or focus.",
    pattern: /\b(current task|current focus|working on|focus is)\b/i,
  },
  {
    kind: "decision",
    confidence: "high",
    reason: "Uses decision-like language.",
    pattern: /\b(we decided|decision:?|the rule is|source of truth|should remain|use .+ instead of)\b/i,
  },
  {
    kind: "constraint",
    confidence: "high",
    reason: "Uses constraint language.",
    pattern: /\b(must|must not|cannot|required|limited to|source of truth)\b/i,
  },
  {
    kind: "open_action",
    confidence: "medium",
    reason: "Looks like a next action.",
    pattern: /\b(next|need to|todo|should build|implement|add|fix|verify)\b/i,
  },
];

const PROGRESS_PATTERN = /\b(implemented|changed|added|verified|tests passed|build passed)\b/i;

function normalizeText(value: string | undefined | null): string {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

function truncate(value: string, max: number): string {
  const text = normalizeText(value);
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 3)).trimEnd()}...`;
}

function ensurePunctuation(value: string): string {
  const text = normalizeText(value);
  if (!text) return "";
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function chunkText(value: string, maxSourceLength: number): string[] {
  const text = truncate(value, maxSourceLength);
  const chunks = text.match(/[^.!?]+[.!?]?/g) ?? [text];
  return chunks
    .map((chunk) => ensurePunctuation(chunk))
    .filter((chunk) => chunk.length > 3);
}

function classify(text: string): ClassifiedSuggestion | null {
  for (const rule of RULES) {
    if (rule.pattern.test(text)) {
      return {
        kind: rule.kind,
        confidence: rule.confidence,
        reason: rule.reason,
      };
    }
  }
  return null;
}

function classifyReturnedOutput(text: string): ClassifiedSuggestion | null {
  if (PROGRESS_PATTERN.test(text)) {
    return {
      kind: "handoff_note",
      confidence: "medium",
      reason: "Summarizes returned agent progress.",
    };
  }
  return classify(text);
}

function canonicalKey(value: string): string {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function hashKey(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}

function captureText(item: AnyObject): string {
  if (item.kind === "note") return item.content;
  if (item.kind === "artifact") return [item.name, item.type].filter(Boolean).join(" ");
  return "";
}

function acceptedMemoryField(kind: CrystallizedSuggestionKind): keyof AcceptedCrystallizedMemoryPatch | null {
  switch (kind) {
    case "decision": return "importantDecisions";
    case "constraint":
    case "do_not_do":
      return "constraints";
    case "acceptance_criterion": return "acceptanceCriteria";
    case "agent_warning": return "agentWarnings";
    case "handoff_note": return "handoffNotes";
    case "current_task":
    case "open_action":
      return null;
  }
}

function isIgnoredCapture(item: AnyObject): boolean {
  return item.kind === "project" || item.captureStatus === "archived" || Boolean(item.stale) || Boolean(item.excludeFromPackets);
}

function existingTexts(params: SuggestCrystallizedUpdatesParams): string[] {
  const memory = params.existingMemory;
  const suggestions = (params.existingSuggestions ?? []).flatMap((item) => {
    if (typeof item === "string") return [item];
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    return typeof record.text === "string" ? [record.text] : typeof record.title === "string" ? [record.title] : [];
  });

  return [
    ...suggestions,
    ...(params.existingActions ?? []).map((action) => action.title),
    ...(params.captures ?? [])
      .filter((item) => item.pinnedAsDecision || item.convertedToTask)
      .map(captureText),
    memory?.summary,
    memory?.currentGoal,
    memory?.currentDirection,
    ...(memory?.recentChanges ?? []),
    ...(memory?.importantDecisions ?? []),
    ...(memory?.constraints ?? []),
    ...(memory?.acceptanceCriteria ?? []),
    ...(memory?.agentWarnings ?? []),
    ...(memory?.handoffNotes ?? []),
    ...(memory?.acceptedCrystallizedSuggestions ?? []).map((item) => item.text),
    ...(memory?.activeTasks ?? []),
    ...(memory?.blockers ?? []),
    ...(memory?.staleAssumptions ?? []),
    ...(memory?.nextActions ?? []).flatMap((action) => [action.title, action.rationale]),
  ].filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

export function buildAcceptedCrystallizedMemoryPatch(params: {
  memory: ProjectMemory;
  suggestion: CrystallizedSuggestion;
  acceptedAt: number;
}): AcceptedCrystallizedMemoryPatch {
  const field = acceptedMemoryField(params.suggestion.kind);
  if (!field) return {};

  const text = ensurePunctuation(params.suggestion.text);
  const textKey = canonicalKey(text);
  if (!textKey) return {};

  const existingValues = (params.memory[field] ?? []) as string[];
  const hasText = existingValues.some((item) => canonicalKey(item) === textKey);

  const accepted = params.memory.acceptedCrystallizedSuggestions ?? [];
  const hasAcceptedSource = accepted.some((item) => {
    if (item.suggestionId && item.suggestionId === params.suggestion.id) return true;
    return item.kind === params.suggestion.kind
      && canonicalKey(item.text) === textKey
      && item.sourceType === params.suggestion.sourceType
      && item.sourceId === params.suggestion.sourceId;
  });

  const patch: AcceptedCrystallizedMemoryPatch = {};
  if (!hasText) {
    patch[field] = [...existingValues, text] as any;
  }
  if (!hasAcceptedSource) {
    const source: AcceptedCrystallizedSuggestion = {
      kind: params.suggestion.kind,
      text,
      sourceType: params.suggestion.sourceType,
      sourceId: params.suggestion.sourceId,
      suggestionId: params.suggestion.id,
      createdAt: params.acceptedAt,
      status: "active",
      updatedAt: params.acceptedAt,
    };
    patch.acceptedCrystallizedSuggestions = [...accepted, source];
  }

  return patch;
}

function sameAcceptedSuggestion(
  item: AcceptedCrystallizedSuggestion,
  target: AcceptedCrystallizedSuggestion
): boolean {
  if (item.suggestionId && target.suggestionId && item.suggestionId === target.suggestionId) {
    return true;
  }
  return item.kind === target.kind
    && canonicalKey(item.text) === canonicalKey(target.text)
    && item.sourceType === target.sourceType
    && item.sourceId === target.sourceId;
}

export function buildCrystallizedMemoryStatusPatch(params: {
  memory: ProjectMemory;
  target: AcceptedCrystallizedSuggestion;
  status: AcceptedCrystallizedSuggestionStatus;
  updatedAt: number;
}): AcceptedCrystallizedMemoryPatch {
  const accepted = params.memory.acceptedCrystallizedSuggestions ?? [];
  let changed = false;
  const updated = accepted.map((item) => {
    if (!sameAcceptedSuggestion(item, params.target)) return item;
    if (acceptedCrystallizedSuggestionStatus(item) === params.status && item.updatedAt === params.updatedAt) {
      return item;
    }
    changed = true;
    return {
      ...item,
      status: params.status,
      updatedAt: params.updatedAt,
    };
  });

  return changed ? { acceptedCrystallizedSuggestions: updated } : {};
}

export function suggestCrystallizedUpdates(params: SuggestCrystallizedUpdatesParams): CrystallizedSuggestion[] {
  const maxSuggestions = params.limits?.maxSuggestions ?? DEFAULT_MAX_SUGGESTIONS;
  const maxSourceLength = params.limits?.maxSourceLength ?? DEFAULT_MAX_SOURCE_LENGTH;
  const suggestions: CrystallizedSuggestion[] = [];
  const seen = new Set(existingTexts(params).map(canonicalKey).filter(Boolean));

  function pushSuggestion(
    source: Pick<CrystallizedSuggestion, "sourceType" | "sourceId">,
    text: string,
    classification: ClassifiedSuggestion | null
  ) {
    if (!classification || suggestions.length >= maxSuggestions) return;
    const boundedText = truncate(ensurePunctuation(text), maxSourceLength);
    const key = canonicalKey(boundedText);
    if (!key || seen.has(key)) return;
    seen.add(key);
    suggestions.push({
      id: `crystal-${classification.kind}-${source.sourceType}-${source.sourceId ?? "unknown"}-${hashKey(key)}`,
      kind: classification.kind,
      text: boundedText,
      sourceType: source.sourceType,
      sourceId: source.sourceId,
      confidence: classification.confidence,
      reason: classification.reason,
    });
  }

  const captures = (params.captures ?? [])
    .filter((item) => !isIgnoredCapture(item))
    .sort((a, b) => (b.modifiedAt ?? 0) - (a.modifiedAt ?? 0));

  for (const capture of captures) {
    for (const chunk of chunkText(captureText(capture), maxSourceLength)) {
      pushSuggestion({ sourceType: "capture", sourceId: capture.id }, chunk, classify(chunk));
      if (suggestions.length >= maxSuggestions) return suggestions;
    }
  }

  const handoffs = (params.handoffs ?? [])
    .slice()
    .sort((a, b) => b.generatedAt - a.generatedAt);

  for (const handoff of handoffs) {
    const returnedOutput = chunkText(handoff.returnedAgentOutput ?? "", maxSourceLength)[0];
    if (returnedOutput) {
      pushSuggestion(
        { sourceType: "returned_agent_output", sourceId: handoff.id },
        returnedOutput,
        classifyReturnedOutput(returnedOutput)
      );
      if (suggestions.length >= maxSuggestions) return suggestions;
    }

    for (const chunk of chunkText(handoff.userNotes ?? "", maxSourceLength)) {
      pushSuggestion(
        { sourceType: "user_note", sourceId: handoff.id },
        chunk,
        classify(chunk) ?? { kind: "handoff_note", confidence: "low", reason: "Preserves user handoff notes." }
      );
      if (suggestions.length >= maxSuggestions) return suggestions;
    }
  }

  return suggestions;
}
