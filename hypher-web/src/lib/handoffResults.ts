import type { Handoff } from "@/types";

export const HANDOFF_RESULT_EMPTY_ERROR = "Paste agent result or notes first.";
const HANDOFF_RESULT_SUMMARY_LIMIT = 180;

export type HandoffResultUpdate =
  | {
      ok: true;
      args: {
        handoffId: string;
        returnedAgentOutput?: string;
        userNotes?: string;
      };
    }
  | { ok: false; error: string };

function normalizeText(value: string | undefined | null): string {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

function truncate(value: string, max = HANDOFF_RESULT_SUMMARY_LIMIT): string {
  const text = normalizeText(value);
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}...`;
}

function summarizeText(value: string | undefined | null): string {
  const text = normalizeText(value);
  const sentence = text.match(/^.{20,}?[.!?](?:\s|$)/)?.[0]?.trim();
  return truncate(sentence || text);
}

export function buildHandoffResultUpdate(
  handoff: Pick<Handoff, "id">,
  input: {
    returnedAgentOutput?: string;
    userNotes?: string;
  }
): HandoffResultUpdate {
  const returnedAgentOutput = normalizeText(input.returnedAgentOutput);
  const userNotes = normalizeText(input.userNotes);
  if (!returnedAgentOutput && !userNotes) {
    return { ok: false, error: HANDOFF_RESULT_EMPTY_ERROR };
  }
  return {
    ok: true,
    args: {
      handoffId: handoff.id,
      ...(returnedAgentOutput ? { returnedAgentOutput } : {}),
      ...(userNotes ? { userNotes } : {}),
    },
  };
}

export function summarizeHandoffResult(
  handoff: Pick<Handoff, "targetTool" | "returnedAgentOutput" | "userNotes">
): string[] {
  const lines: string[] = [];
  const returnedAgentOutput = summarizeText(handoff.returnedAgentOutput ?? "");
  const userNotes = summarizeText(handoff.userNotes ?? "");

  if (returnedAgentOutput) {
    lines.push(`Agent result from previous ${handoff.targetTool} brief: ${returnedAgentOutput}`);
  }
  if (userNotes) {
    lines.push(`User note on previous ${handoff.targetTool} brief: ${userNotes}`);
  }

  return lines;
}
