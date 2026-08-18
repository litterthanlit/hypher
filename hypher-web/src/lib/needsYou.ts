import type { AgentEvent } from "@/types";

export interface NeedsYouCounts {
  questions: number;
  nextActions: number;
  unmatched: number;
}

export function countProjectNeedsYou(events: AgentEvent[]): Pick<NeedsYouCounts, "questions" | "nextActions"> {
  let questions = 0;
  let nextActions = 0;
  for (const event of events) {
    if (event.status !== "new") continue;
    if (event.kind === "question") questions += 1;
    if (event.kind === "next_action") nextActions += 1;
  }
  return { questions, nextActions };
}

export function needsYouTotal(counts: NeedsYouCounts): number {
  return counts.questions + counts.nextActions + counts.unmatched;
}

export function formatNeedsYouLabel(counts: NeedsYouCounts): string | null {
  if (needsYouTotal(counts) === 0) return null;
  const parts: string[] = [];
  if (counts.questions > 0) {
    parts.push(`${counts.questions} question${counts.questions === 1 ? "" : "s"}`);
  }
  if (counts.nextActions > 0) {
    parts.push(`${counts.nextActions} next action${counts.nextActions === 1 ? "" : "s"}`);
  }
  if (counts.unmatched > 0) {
    parts.push(`${counts.unmatched} unmatched`);
  }
  return parts.join(" · ");
}

export function prioritizeAgentEventsForPulse<T extends { status: string; kind: string; createdAt: number }>(
  events: T[],
  limit: number
): T[] {
  const rank = (event: T): number => {
    if (event.status === "dismissed") return 99;
    if (event.status === "new" && event.kind === "question") return 0;
    if (event.status === "new" && event.kind === "next_action") return 1;
    if (event.status === "new") return 2;
    if (event.kind === "question") return 3;
    return 4;
  };
  return events
    .filter((event) => event.status !== "dismissed")
    .slice()
    .sort((a, b) => {
      const delta = rank(a) - rank(b);
      if (delta !== 0) return delta;
      return b.createdAt - a.createdAt;
    })
    .slice(0, limit);
}
