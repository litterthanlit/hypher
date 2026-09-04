/** Silent dump/writeback memory. No UI. GitHub is a signal, not a receipt. */

export const GITHUB_SIGNAL_SOURCE = "github";

const SUMMARY_LIMIT = 280;
const LINE_LIMIT = 180;
const ARRAY_LIMIT = 8;
const NEXT_ACTION_LIMIT = 3;

export type SilentMemoryActionStatus = "suggested" | "accepted" | "dismissed";

export interface SilentMemoryAction {
  id?: string;
  title: string;
  rationale: string;
  status?: SilentMemoryActionStatus;
  requiredContext?: string[];
  suggestedTargetTool?: string;
  confidence?: number;
  sourceCaptureIds?: string[];
  createdAt?: number;
  updatedAt?: number;
}

export interface SilentCrystallizedSuggestion {
  kind: string;
  text: string;
  sourceType: string;
  sourceId?: string;
  suggestionId?: string;
  createdAt: number;
  status?: string;
  updatedAt?: number;
}

export interface SilentMemorySnapshot {
  summary: string;
  currentGoal?: string;
  currentDirection: string;
  recentChanges: string[];
  importantDecisions: string[];
  constraints: string[];
  openQuestions: string[];
  activeTasks: string[];
  blockers: string[];
  handoffNotes: string[];
  nextActions: SilentMemoryAction[];
  acceptedCrystallizedSuggestions: SilentCrystallizedSuggestion[];
}

export interface SilentMemorySourceItem {
  id?: string;
  name?: string;
  content: string;
}

export interface SilentMemorySourceEvent {
  id?: string;
  kind: string;
  source: string;
  title: string;
  body: string;
  suggestedActions?: string[];
}

export type ExistingSilentMemory = Partial<SilentMemorySnapshot> | null | undefined;

function clean(value: string | undefined | null): string {
  return (value ?? "").trim();
}

function normalize(value: string | undefined | null): string {
  return clean(value).replace(/\s+/g, " ");
}

function truncate(value: string, max: number): string {
  const text = normalize(value);
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}...`;
}

export function uniqueLines(items: string[], limit = ARRAY_LIMIT): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const normalized = normalize(item);
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) continue;
    seen.add(key);
    result.push(truncate(normalized, LINE_LIMIT));
    if (result.length >= limit) break;
  }
  return result;
}

export function isSkeletonSummary(value: string | undefined | null): boolean {
  const text = normalize(value);
  if (!text) return true;
  return (
    /no (short )?summary captured yet/i.test(text)
    || /has \d+ recent captures\.?$/i.test(text)
    || /^accepted from agent writeback\.?$/i.test(text)
  );
}

export function looksLikeDoNotDo(item: string): boolean {
  const text = normalize(item);
  if (/^(do not|don't|dont|avoid|never)\b/i.test(text)) return true;
  return /\b(do not|don't|dont|never) (widen|build|rebuild|ingest|add|compete|auto-mint)\b/i.test(text);
}

export function looksLikeQuestion(item: string): boolean {
  const text = normalize(item);
  return /\?$/.test(text) || /^(who|what|when|where|why|how|should|can we)\b/i.test(text);
}

export function looksLikeDecision(item: string): boolean {
  return /\b(decision|decided|we will|we chose|choose|chosen|lock|locked)\b/i.test(normalize(item));
}

export function isWorkReceipt(kind: string, source: string): boolean {
  if (normalize(source).toLowerCase() === GITHUB_SIGNAL_SOURCE) return false;
  return kind === "handoff" || kind === "build_log";
}

export function agentEventNeedsHumanAccept(kind: string, source: string): boolean {
  if (isWorkReceipt(kind, source)) return false;
  return (
    kind === "question"
    || kind === "suggestion"
    || kind === "next_action"
    || kind === "artifact"
    || normalize(source).toLowerCase() === GITHUB_SIGNAL_SOURCE
  );
}

export function splitSentences(text: string): string[] {
  return clean(text)
    .replace(/\r\n/g, "\n")
    .split(/\n+|(?<=[.!?])\s+/)
    .map((line) => normalize(line).replace(/^[-*•]\s+/, ""))
    .filter(Boolean);
}

export function summarizeEvent(title: string, body: string): string {
  const heading = normalize(title);
  const details = truncate(body, LINE_LIMIT);
  if (!details || details.toLowerCase() === heading.toLowerCase()) {
    return truncate(heading, LINE_LIMIT);
  }
  return truncate(`${heading}. ${details}`, LINE_LIMIT);
}

function existingLines(existing: ExistingSilentMemory, key: keyof SilentMemorySnapshot): string[] {
  const value = existing?.[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function sourceTexts(items: SilentMemorySourceItem[]): string[] {
  return items
    .map((item) => clean(item.content) || clean(item.name))
    .filter(Boolean);
}

function extractNextMove(event: SilentMemorySourceEvent): string | undefined {
  if (event.suggestedActions?.[0]) return normalize(event.suggestedActions[0]);
  for (const line of splitSentences(`${event.title}. ${event.body}`)) {
    const match = line.match(/^(?:next(?:\s+move|\s+action|\s+step)?|todo)\s*[:\-]\s*(.+)$/i);
    if (match?.[1]) return normalize(match[1]);
  }
  return undefined;
}

export function compileHeuristicMemory(input: {
  projectName: string;
  projectDescription?: string;
  projectBlockers?: string;
  items: SilentMemorySourceItem[];
  events?: SilentMemorySourceEvent[];
  existing?: ExistingSilentMemory;
  now: number;
}): SilentMemorySnapshot {
  const existing = input.existing ?? null;
  const itemTexts = sourceTexts(input.items);
  const sentences = itemTexts.flatMap(splitSentences);
  const eventReceipts = (input.events ?? [])
    .filter((event) => isWorkReceipt(event.kind, event.source))
    .map((event) => summarizeEvent(event.title, event.body));
  const eventQuestions = (input.events ?? [])
    .filter((event) => event.kind === "question")
    .map((event) => summarizeEvent(event.title, event.body));

  const constraints = uniqueLines([
    ...existingLines(existing, "constraints"),
    ...sentences.filter(looksLikeDoNotDo),
  ]);
  const decisions = uniqueLines([
    ...existingLines(existing, "importantDecisions"),
    ...sentences.filter((line) => looksLikeDecision(line) && !looksLikeDoNotDo(line)),
  ]);
  const questions = uniqueLines([
    ...existingLines(existing, "openQuestions"),
    ...sentences.filter(looksLikeQuestion),
    ...eventQuestions,
  ]);
  const recentFromDump = sentences.filter((line) =>
    /^(shipped|landed|fixed|merged|closed|added|implemented|wrote|updated|finished|dumped)\b/i.test(line)
  );
  const recentChanges = uniqueLines([
    ...eventReceipts,
    ...recentFromDump,
    ...itemTexts.map((text) => truncate(text, LINE_LIMIT)),
    ...existingLines(existing, "recentChanges"),
  ]);
  const directionParts = sentences.filter((line) => (
    !looksLikeDoNotDo(line)
    && !looksLikeQuestion(line)
    && !/^(shipped|landed|fixed|merged|closed|added|implemented|wrote|updated|finished|dumped)\b/i.test(line)
  ));
  const dumpSummary = itemTexts[0]
    ? truncate(itemTexts[0], SUMMARY_LIMIT)
    : eventReceipts[0] ?? "";
  const existingSummary = normalize(existing?.summary);
  const summary = !isSkeletonSummary(existingSummary) && !dumpSummary
    ? existingSummary
    : dumpSummary || existingSummary || `${input.projectName} is in progress.`;
  const currentDirection = normalize(existing?.currentDirection)
    && !isSkeletonSummary(existing?.currentDirection)
    && directionParts.length === 0
    ? normalize(existing?.currentDirection)
    : truncate(directionParts[0] || normalize(input.projectDescription) || summary, SUMMARY_LIMIT);
  const currentGoal = normalize(existing?.currentGoal)
    || truncate(directionParts[0] || summary, SUMMARY_LIMIT);
  const nextFromEvents = (input.events ?? [])
    .flatMap((event) => event.suggestedActions ?? [])
    .map(normalize)
    .filter(Boolean);
  const taskLines = sentences.filter((line) =>
    /\b(next step|next move|todo|need to|verify|follow up|fix|continue)\b/i.test(line)
    && !looksLikeDoNotDo(line)
  );
  const nextTitles = uniqueLines([
    ...nextFromEvents,
    ...taskLines,
    ...(directionParts[0] ? [`Continue: ${directionParts[0]}`] : []),
    ...(existing?.nextActions ?? [])
      .filter((action) => action.status !== "dismissed")
      .map((action) => action.title),
  ], NEXT_ACTION_LIMIT);
  const nextActions: SilentMemoryAction[] = nextTitles.map((title) => ({
    title: truncate(title, 100),
    rationale: "Compiled from the latest dump or writeback.",
    status: "suggested",
    createdAt: input.now,
    updatedAt: input.now,
  }));
  if (nextActions.length === 0) {
    nextActions.push({
      title: `Review the latest context for ${input.projectName}.`,
      rationale: "Compiled from the latest dump or writeback.",
      status: "suggested",
      createdAt: input.now,
      updatedAt: input.now,
    });
  }

  const handoffNotes = uniqueLines([
    ...eventReceipts,
    ...existingLines(existing, "handoffNotes"),
  ]);

  return {
    summary: truncate(summary, SUMMARY_LIMIT),
    currentGoal: truncate(currentGoal, 220),
    currentDirection: truncate(currentDirection || summary, SUMMARY_LIMIT),
    recentChanges,
    importantDecisions: decisions,
    constraints,
    openQuestions: questions,
    activeTasks: uniqueLines([
      ...nextTitles,
      ...existingLines(existing, "activeTasks"),
    ]),
    blockers: uniqueLines([
      ...existingLines(existing, "blockers"),
      ...(input.projectBlockers ? splitSentences(input.projectBlockers) : []),
    ]),
    handoffNotes,
    nextActions,
    acceptedCrystallizedSuggestions: existing?.acceptedCrystallizedSuggestions ?? [],
  };
}

export function applyReceiptToMemory(input: {
  existing?: ExistingSilentMemory;
  event: SilentMemorySourceEvent;
  now: number;
}): { applied: false } | { applied: true; memory: SilentMemorySnapshot } {
  if (!isWorkReceipt(input.event.kind, input.event.source)) {
    return { applied: false };
  }
  const summary = summarizeEvent(input.event.title, input.event.body);
  if (!summary) return { applied: false };

  const compiled = compileHeuristicMemory({
    projectName: "Project",
    items: [],
    events: [input.event],
    existing: input.existing,
    now: input.now,
  });
  const nextMove = extractNextMove(input.event);
  const nextActions = nextMove
    ? uniqueLines([nextMove, ...compiled.nextActions.map((action) => action.title)], NEXT_ACTION_LIMIT)
      .map((title) => ({
        title: truncate(title, 100),
        rationale: "Receipt of agent work.",
        status: "suggested" as const,
        createdAt: input.now,
        updatedAt: input.now,
      }))
    : compiled.nextActions;

  const already = (input.existing?.acceptedCrystallizedSuggestions ?? [])
    .some((item) => item.sourceId && item.sourceId === input.event.id && item.kind === "handoff_note");
  const crystallized = already
    ? [...(input.existing?.acceptedCrystallizedSuggestions ?? [])]
    : [
        ...(input.existing?.acceptedCrystallizedSuggestions ?? []),
        {
          kind: "handoff_note",
          text: summary,
          sourceType: "handoff",
          sourceId: input.event.id,
          suggestionId: input.event.id ? `receipt-${input.event.id}` : undefined,
          createdAt: input.now,
          status: "active",
          updatedAt: input.now,
        },
      ];

  const existingSummary = normalize(input.existing?.summary);
  return {
    applied: true,
    memory: {
      ...compiled,
      summary: isSkeletonSummary(existingSummary) ? truncate(summary, SUMMARY_LIMIT) : compiled.summary,
      currentDirection: isSkeletonSummary(input.existing?.currentDirection)
        ? truncate(summary, SUMMARY_LIMIT)
        : compiled.currentDirection,
      recentChanges: uniqueLines([summary, ...compiled.recentChanges]),
      handoffNotes: uniqueLines([summary, ...compiled.handoffNotes]),
      nextActions,
      acceptedCrystallizedSuggestions: crystallized,
    },
  };
}

export function mergeAcceptedNextActions(
  existing: SilentMemoryAction[] | undefined,
  generated: SilentMemoryAction[],
  now: number
): SilentMemoryAction[] {
  const accepted = (existing ?? []).filter((action) => action.status === "accepted");
  const acceptedKeys = new Set(accepted.map((action) => normalize(action.title).toLowerCase()));
  const generatedUnique = generated.filter((action) => {
    const key = normalize(action.title).toLowerCase();
    return key && !acceptedKeys.has(key);
  });
  return [...accepted, ...generatedUnique.map((action) => ({
    ...action,
    status: "suggested" as const,
    updatedAt: now,
    createdAt: action.createdAt ?? now,
  }))].slice(0, 8);
}
