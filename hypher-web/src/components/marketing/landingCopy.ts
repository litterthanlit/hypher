// Public landing copy. Pilot messaging from docs/planning/Launch-Plan.md
// ("Before gate 4"). Do not switch to the launch line ("Pull the plug…")
// until the Baton proof is recorded. Every claim here must hold today.

export const LANDING_HERO = {
  eyebrow: "Pilot · Claude Code, Codex CLI, Cursor",
  headline: "Stop re-explaining your project to every agent.",
  lede: "Hypher carries decisions and next steps between Claude Code and Codex. Join the pilot.",
  hint: "Pilot. The live Codex ↔ Claude Code switch is not recorded yet. We say so until it is.",
  primaryCta: "Join the pilot",
  secondaryCta: "Open Hypher",
  demoCaption: "Illustration of an explicit handoff. Not a recording. No code leaves the machine.",
} as const;

export type SupportCell = {
  label: string;
  mode: "auto" | "manual" | "human" | "none" | "gap";
};

export const LANDING_SUPPORT = {
  eyebrow: "What's automatic",
  heading: "What's automatic, what's manual.",
  lede: "Today, on the pilot path. Tested client versions are listed here once the recording exists.",
  columns: ["Cursor", "Claude Code", "Codex CLI"] as const,
  rows: [
    {
      step: "Load the note at session start",
      cells: [
        { label: "Hook, with a token", mode: "auto" },
        { label: "/hypher-resume", mode: "manual" },
        { label: "$hypher-resume", mode: "manual" },
      ],
    },
    {
      step: "Save the handoff when you stop",
      cells: [
        { label: "Hook, with a token", mode: "auto" },
        { label: "/hypher-save", mode: "manual" },
        { label: "$hypher-save", mode: "manual" },
      ],
    },
    {
      step: "Fold captures and writebacks into the note",
      cells: [
        { label: "Automatic", mode: "auto" },
        { label: "Automatic", mode: "auto" },
        { label: "Automatic", mode: "auto" },
      ],
    },
    {
      step: "Warn on a different branch, commit, or dirty state",
      cells: [
        { label: "Not yet", mode: "gap" },
        { label: "On resume", mode: "auto" },
        { label: "On resume", mode: "auto" },
      ],
    },
    {
      step: "Approve a changed decision",
      cells: [
        { label: "You, one pin", mode: "human" },
        { label: "You, one pin", mode: "human" },
        { label: "You, one pin", mode: "human" },
      ],
    },
    {
      step: "Recap you type",
      cells: [
        { label: "None", mode: "none" },
        { label: "None", mode: "none" },
        { label: "None", mode: "none" },
      ],
    },
  ] satisfies { step: string; cells: SupportCell[] }[],
  footnote:
    "Automatic checkpoints for Claude Code and Codex come with Baton, after the explicit switch is recorded. Cursor hooks do not run on Cursor cloud agents; those load the note through MCP.",
} as const;

export const LANDING_LOOP = {
  eyebrow: "How it works",
  heading: "Capture, the note, writeback.",
  lede: "Hypher sits under your agents. It is not another place to write code.",
  beats: [
    {
      step: "01",
      title: "Capture",
      body: "Paste the mess. Rants, screenshots, chat exports, “don't widen OAuth.” No filing tax. An agent's checkpoint is the same kind of capture.",
    },
    {
      step: "02",
      title: "The note",
      body: "One bounded note per project. Decisions with reasons and who approved them. The current goal, what's done, what's only claimed, and the next action.",
    },
    {
      step: "03",
      title: "Writeback",
      body: "When an agent stops, it writes back why a decision changed and what comes next. The next agent — or the next session — starts from there.",
    },
  ],
} as const;

export const LANDING_HANDOFF = {
  eyebrow: "The handoff",
  heading: "What the next agent reads.",
  lede: "Not the transcript. A bounded brief: constraints first, next action last.",
  items: [
    { title: "Current goal", body: "What this workstream is for." },
    { title: "Constraints", body: "The do-not-dos. An agent report can never relax one you set." },
    { title: "Decisions and why", body: "With provenance. A change names the decision it replaces." },
    { title: "Done versus claimed", body: "A reported test pass is labeled as a report, not a result." },
    { title: "Blockers", body: "What stopped the last agent, in its words." },
    { title: "Next action", body: "One move. The first thing the next agent does." },
    { title: "Sources", body: "Which capture or writeback each line came from." },
    { title: "Tree identity", body: "Repository, branch, commit, and dirty state as metadata." },
  ],
} as const;

export const LANDING_TRUST = {
  eyebrow: "Checked, not trusted",
  heading: "Your code never leaves your machine.",
  lede: "Memory does not move code. The next agent checks the working tree itself and says what differs.",
  leaves: {
    title: "Leaves the machine",
    items: ["Decisions and constraints", "Branch and commit IDs", "File names and dirty state", "The handoff you save"],
  },
  stays: {
    title: "Never leaves",
    items: ["Source code", "Diffs and uncommitted edits", "Transcripts and hidden reasoning", "Secrets"],
  },
} as const;

export const LANDING_DOORS = {
  eyebrow: "Where it works",
  heading: "A way into the note from each agent.",
  lede: "A door is not a sync of your repository. Cursor already has the code; Hypher has what never landed in the files.",
  items: [
    {
      name: "Cursor",
      status: "Supported",
      tone: "live",
      body: "Plugin with sessionStart and sessionEnd hooks, plus MCP. /hypher-brief and /hypher-handoff stay as manual overrides.",
    },
    {
      name: "Claude Code",
      status: "Pilot",
      tone: "pilot",
      body: "Project MCP with /hypher-save and /hypher-resume. Explicit save and resume. Not yet recorded.",
    },
    {
      name: "Codex CLI",
      status: "Pilot",
      tone: "pilot",
      body: "Project MCP with $hypher-save and $hypher-resume. Writes ask for approval. Not yet recorded.",
    },
    {
      name: "Cloud agents",
      status: "MCP only",
      tone: "pilot",
      body: "Load the note once at session start and write one handoff at the end. The container needs network access to Hypher.",
    },
  ],
} as const;

export const LANDING_FAQ = {
  eyebrow: "FAQ",
  heading: "A few honest answers.",
  items: [
    {
      q: "What is Hypher?",
      a: "Project memory under your coding agents. You capture the project as it is; Hypher keeps one note; the next agent reads it and writes back when it stops. Session two starting warm and a switch from Codex to Claude Code are the same job.",
    },
    {
      q: "Does it work today?",
      a: "Cursor works through its plugin and MCP. Claude Code and Codex CLI have an explicit save and resume path in the pilot. The live switch between them has not been recorded, so we do not claim it yet.",
    },
    {
      q: "Do you upload my repository?",
      a: "No. Only decisions, the handoff, and hashes, file names, and commit identity leave the machine. Never code, diffs, or transcripts. GitHub is a signal — CI, stale PRs, labeled blockers — not memory.",
    },
    {
      q: "Is this Baton?",
      a: "Baton is the handoff feature that makes this automatic: checkpoints while an agent works, a seal when it stops, and a check against the files on resume. It follows the recorded explicit switch. It is not shipped.",
    },
    {
      q: "Why not a handoff file in the repo?",
      a: "A file doesn't know which decision replaced which, who approved it, or whether “tests pass” was run or only claimed. And it goes stale the moment someone forgets to update it.",
    },
    {
      q: "Does Hypher run or host my agents?",
      a: "No. Your agents do the work and the reasoning. Hypher stores the note and hands it over. It does not orchestrate, schedule, or supervise anything.",
    },
  ],
} as const;

export const LANDING_CTA = {
  eyebrow: "Pilot",
  heading: "Stop re-explaining your project to every agent.",
  lede: "For builders who switch between Claude Code and Codex on the same repository. Small cohorts, onboarded by hand.",
} as const;

export const LANDING_FOOTER_NOTE = "Capture your project. They read one note. They write back.";
