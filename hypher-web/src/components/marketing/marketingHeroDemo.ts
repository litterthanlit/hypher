const FALLBACK_NOTE = "Don't widen OAuth.";

export function compileDemoBrief(dump: string): {
  summary: string;
  direction: string;
  doNot: string;
  next: string;
} {
  const line = dump.trim() || FALLBACK_NOTE;
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
  "Don't rebuild the canvas.",
] as const;

export const DEMO_WRITEBACK = {
  title: "Gate is in.",
  body: "Tokens hashed. Events scoped. Session two already knows.",
} as const;
