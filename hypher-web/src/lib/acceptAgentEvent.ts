import type {
  AgentEvent,
  Handoff,
  ProjectMemory,
} from "@/types";
import {
  buildAcceptedCrystallizedMemoryPatch,
  type AcceptedCrystallizedMemoryPatch,
  type CrystallizedSuggestion,
} from "./crystallizeRecentActivity";
import { summarizeEvent } from "../../shared/projectMemoryGenerate";

export interface AcceptAgentEventPlan {
  actionTitles: string[];
  openQuestion?: string;
  memoryPatch: AcceptedCrystallizedMemoryPatch;
  handoffUpdate: {
    handoffId: string;
    returnedAgentOutput: string;
    status?: "used";
  } | null;
}

function normalize(value: string | undefined | null): string {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

function receiptOutput(event: Pick<AgentEvent, "title" | "body">): string {
  const title = normalize(event.title);
  const body = normalize(event.body);
  if (!body || body.toLowerCase() === title.toLowerCase()) return title;
  return `${title}. ${body}`;
}

function uniqueTitles(titles: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const title of titles) {
    const cleaned = normalize(title);
    const key = cleaned.toLowerCase();
    if (!cleaned || seen.has(key)) continue;
    seen.add(key);
    result.push(cleaned);
  }
  return result;
}

export function acceptActionTitles(event: AgentEvent): string[] {
  const suggested = event.suggestedActions ?? [];
  if (suggested.length > 0) return uniqueTitles(suggested);
  if (event.kind === "next_action" || event.kind === "suggestion") {
    return uniqueTitles([event.title]);
  }
  return [];
}

export function buildAcceptAgentEventPlan(params: {
  event: AgentEvent;
  memory: ProjectMemory | null;
  pendingHandoff: Handoff | null;
  acceptedAt: number;
}): AcceptAgentEventPlan {
  const { event, memory, pendingHandoff, acceptedAt } = params;
  const actionTitles = acceptActionTitles(event);
  const summary = summarizeEvent(event.title, event.body);
  let openQuestion: string | undefined;
  let memoryPatch: AcceptedCrystallizedMemoryPatch = {};

  if (event.kind === "question") {
    openQuestion = summary;
  }

  if (event.kind === "handoff" || event.kind === "build_log" || event.kind === "artifact") {
    if (memory) {
      const suggestion: CrystallizedSuggestion = {
        id: `accept-${event.id}`,
        kind: "handoff_note",
        text: summary,
        sourceType: "handoff",
        sourceId: event.id,
        confidence: "medium",
        reason: "Accepted agent writeback.",
      };
      memoryPatch = buildAcceptedCrystallizedMemoryPatch({
        memory,
        suggestion,
        acceptedAt,
      });
    }
  }

  if (event.kind === "next_action" || event.kind === "suggestion") {
    if (memory && summary) {
      const suggestion: CrystallizedSuggestion = {
        id: `accept-${event.id}`,
        kind: "open_action",
        text: summary,
        sourceType: "handoff",
        sourceId: event.id,
      };
      memoryPatch = buildAcceptedCrystallizedMemoryPatch({
        memory,
        suggestion,
        acceptedAt,
      });
    }
  }

  let handoffUpdate: AcceptAgentEventPlan["handoffUpdate"] = null;
  if (pendingHandoff && summary) {
    handoffUpdate = {
      handoffId: pendingHandoff.id,
      returnedAgentOutput: receiptOutput(event),
      ...(event.kind === "handoff" ? { status: "used" as const } : {}),
    };
  }

  return { actionTitles, openQuestion, memoryPatch, handoffUpdate };
}
