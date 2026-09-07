export const LANDING_HERO = {
  headline: "The context they never find in git.",
  lede: "Cursor already has the code. Hypher holds the decisions, the don'ts, and the next move — so session two starts warm.",
  hint: "Private beta. Invite-gated while the loop gets quieter.",
  primaryCta: "Request beta",
  secondaryCta: "Open Hypher",
  demoCaption: "Nothing is sent.",
} as const;

export const LANDING_LOOP = {
  eyebrow: "How it works",
  heading: "Capture. One note. Writeback.",
  lede: "Stop re-explaining the project every session. Hypher sits under your agents — not another place to write code.",
  beats: [
    {
      step: "01",
      title: "Capture",
      body: "Paste the mess. Rants, screenshots, chat exports, “don't widen OAuth.” No filing tax. Messy is the correct input.",
    },
    {
      step: "02",
      title: "The note",
      body: "Hypher compiles one Builder Brief: direction, decisions, do-not-do, next move. Bounded. The note they read once at session start.",
    },
    {
      step: "03",
      title: "Writeback",
      body: "When they stop, they post what changed. Receipts thicken memory. The next chat already knows.",
    },
  ],
} as const;

export const LANDING_CURSOR = {
  eyebrow: "Cursor",
  heading: "Sits under Cursor. The repo stays untouched.",
  lede: "Nothing is rearchitected. Agents keep their tools. Hypher is the memory underneath — the context that never landed in the files.",
} as const;

export const LANDING_FAQ = {
  eyebrow: "FAQ",
  heading: "A few honest answers.",
  items: [
    {
      q: "What is Hypher?",
      a: "Project memory under your agents. Cursor already has the code. Hypher holds the decisions that never made it in, so the next session starts warm.",
    },
    {
      q: "Do you ingest my repository?",
      a: "No. GitHub is a signal — CI, stale PRs, labeled blockers. The valuable context is exactly what is not in git.",
    },
    {
      q: "What do agents actually read?",
      a: "One Builder Brief. Direction, decisions, do-not-do, open questions, next move. Bounded. Not a wiki, not a chat log.",
    },
    {
      q: "Why not a README?",
      a: "READMEs do not catch “don't widen OAuth” from a rant at 1am, or the handoff the last agent forgot to write. Hypher compiles that into the note they read once.",
    },
  ],
} as const;

export const LANDING_CTA = {
  eyebrow: "Private beta",
  heading: "Stop re-explaining the project every session.",
  lede: "Built for people drowning in agent sessions. Invite-gated while the loop gets quieter.",
} as const;
