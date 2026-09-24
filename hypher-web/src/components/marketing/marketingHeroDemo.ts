// Scripted illustration for the landing hero. It is not a recording of either
// CLI, and nothing on this page talks to Hypher.

const FALLBACK_NOTE = "Don't widen OAuth.";

export const PUBLIC_CAPTURE_LABEL = "Capture";
export const PUBLIC_DROP_HINT = "Drop it in";
export const DEMO_BEATS = ["Capture", "The note", "Writeback"] as const;

export type AgentId = "claude-code" | "codex";

export const AGENTS: Record<AgentId, { name: string; short: string; save: string; resume: string }> = {
  "claude-code": { name: "Claude Code", short: "Claude Code", save: "/hypher-save", resume: "/hypher-resume" },
  codex: { name: "Codex CLI", short: "Codex", save: "$hypher-save", resume: "$hypher-resume" },
};

export const DEMO_DIRECTIONS: { from: AgentId; to: AgentId }[] = [
  { from: "claude-code", to: "codex" },
  { from: "codex", to: "claude-code" },
];

export const DEMO_SOURCE_LOG = [
  "Reading src/lib/handoff.ts",
  "Swapped the session cookie for a hashed token",
  "Wrote tests for the stale-revision path",
  "3 of 4 passing · 1 not run",
] as const;

export const DEMO_TREE = {
  repository: "acme/checkout",
  branch: "token-gate",
  commit: "3f2a91c",
  dirty: "2 files",
} as const;

export const DEMO_CHIPS = [
  "Don't widen OAuth.",
  "Pulse stays three panels.",
  "GitHub is a signal, not memory.",
] as const;

export type DemoNote = {
  goal: string;
  constraints: string[];
  decision: { now: string; replaces: string };
  done: string;
  unverified: string;
  next: string;
};

export function compileDemoNote(captured: string): DemoNote {
  const constraint = firstLine(captured);
  return {
    goal: "Gate agent writes behind a hashed token.",
    constraints: [constraint, "No code or diffs leave the machine."],
    decision: {
      now: "Hash tokens at rest.",
      replaces: "Keep the session cookie.",
    },
    done: "Token swap and three tests.",
    unverified: "Stale-revision test was never run.",
    next: "Run the stale-revision test, then open the PR.",
  };
}

// Kept for the three-beat capture summary used in tests and small screens.
export function compileDemoBrief(note: string): {
  summary: string;
  direction: string;
  doNot: string;
  next: string;
} {
  const first = firstLine(note);
  return {
    summary: `${first} Compiled into the note the next agent reads.`,
    direction: "Close the loop. The next agent starts warm.",
    doNot: first,
    next: "Load the note at session start. Write back when you stop.",
  };
}

function firstLine(note: string): string {
  const line = note.trim() || FALLBACK_NOTE;
  return line.split("\n")[0]?.slice(0, 72) ?? FALLBACK_NOTE;
}

export const DEMO_WRITEBACK = {
  title: "Handoff saved.",
  body: "Decision changed, one test unverified, next action set. The next agent already knows.",
} as const;
