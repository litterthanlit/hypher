const FALLBACK_NOTE = "Don't widen OAuth.";

export const PUBLIC_CAPTURE_LABEL = "Capture";
export const PUBLIC_DROP_HINT = "Drop it in";
export const DEMO_BEATS = ["Capture", "The note", "Writeback"] as const;

export function compileDemoBrief(note: string): {
  summary: string;
  direction: string;
  doNot: string;
  next: string;
} {
  const line = note.trim() || FALLBACK_NOTE;
  const first = line.split("\n")[0]?.slice(0, 72) ?? FALLBACK_NOTE;
  return {
    summary: `${first} Compiled into the packet they read once.`,
    direction: "Close the loop. Session two starts warm.",
    doNot: first,
    next: "Load the brief at session start. Write back when you stop.",
  };
}

export const DEMO_CHIPS = [
  "Don't widen OAuth.",
  "Pulse stays three panels.",
  "GitHub is a signal, not memory.",
] as const;

export const DEMO_WRITEBACK = {
  title: "Gate is in.",
  body: "Tokens hashed. Events scoped. Session two already knows.",
} as const;
