# Hypher Product Build Roadmap

Last updated: May 25, 2026.

## Source Of Truth

This roadmap is the canonical product direction for Hypher. The agent-specific brief mirrors it here:

- `../../hypher-web/docs/Hypher Agent Brief.md`

## Current Thesis

Hypher is the **project context layer for AI builders and agents**.

The original vision was an agentic assistant that remembers projects, keeps track of work, and reminds the user what matters. That vision is still correct. The context layer is now the main focus because it is the foundation that makes the assistant useful.

The working promise:

> Hypher captures messy project context, turns it into durable memory, and gives humans and agents the right brief when work needs to continue.

The simple loop:

```txt
Capture anything -> build project memory -> brief agents -> receive writeback -> remind/resume better
```

## Positioning

Primary:

> The project context layer for AI builders and agents.

Plain:

> Capture the messy work. Keep the project memory. Hand agents the context.

Long-term:

> Hypher becomes an agentic project assistant that remembers what changed, tracks what matters, and helps you resume the right work.

Do not position Hypher as only a capture app anymore. Capture is the input. Context is the product. Assistance is the long-term expression.

## Product Model

Hypher has four layers.

### 1. Capture Layer

Capture is the front door and habit loop.

Users should be able to save:

- raw ideas
- product thoughts
- bugs
- screenshots and files
- links
- meeting notes
- chat exports
- agent output
- build logs
- GitHub/repo observations
- random project fragments

Capture should stay fast and forgiving. Users should not need to pick a project or workflow before saving the thought.

### 2. Memory Layer

Memory is the core data product.

Hypher turns captured and imported material into:

- project summary
- current direction
- recent changes
- key decisions
- constraints
- open questions
- active tasks
- blockers
- accepted actions
- agent warnings
- handoff notes
- stale assumptions

The memory layer must stay reviewable. Hypher can suggest, but the user controls what becomes durable context.

### 3. Context Layer

Context is the current main focus and technical moat.

Hypher packages memory into:

- Builder Briefs
- agent-ready markdown packets
- protected context API
- read-only MCP tools
- agent handoffs
- returned agent output
- context history
- future SDK/client integrations

This layer should be deterministic, bounded, and tool-neutral.

### 4. Assistant Layer

The assistant layer is the long-term destination.

Once memory and context are reliable, Hypher can proactively help:

- remind users about stalled projects
- flag stale assumptions or unresolved decisions
- surface projects that need review
- summarize what agents did
- suggest the next best move
- watch GitHub/build state
- capture from Mac hotkey, iOS share sheet, and action button
- coordinate agent writebacks through Hypher

The assistant should not be generic chat first. It should be project-aware assistance powered by Hypher memory.

## Core Loops

### Human Resume Loop

```txt
capture -> memory -> Project Pulse -> next move -> act -> memory updates
```

Success means the user can open a project cold and know:

- what changed
- what matters
- what still needs review
- what the next move is

### Agent Context Loop

```txt
memory -> Builder Brief -> agent works -> agent writes back -> memory improves
```

Success means Codex, Cursor, Claude, ChatGPT, OpenClaw, Hermes, or another agent can start with useful project context and return useful state to Hypher.

### Reminder Loop

```txt
memory changes -> Hypher detects drift/stale work/blockers -> user gets a useful reminder
```

This is not the first build target, but it is part of the original product vision and should stay in the roadmap.

## Current Validation Point

The current product test is:

> Can Hypher become the trusted source of project context for both the builder and their agents?

Near-term validation:

1. Use Hypher for real project captures.
2. Generate or inspect Project Pulse.
3. Copy or call a Builder Brief.
4. Use that context in an agent.
5. Send the agent result back into Hypher.
6. Open the project later and resume faster.

## Project Pulse

Project Pulse is the human-facing resume surface.

It should answer:

- where the project stands
- what changed recently
- what needs review
- what agents did
- what is blocked or stale
- what to do next

Pulse should lead with interpretation, not raw panels.

Bad:

```txt
Agent updates
Actions
Memory
Recent captures
Inbox
```

Better:

```txt
Where the project stands
What needs attention
What to do next
What changed recently
```

## Builder Briefs

Builder Briefs are the agent-facing context surface.

A brief should include:

- project summary
- current direction
- current goal
- recent changes
- key decisions
- constraints
- open questions
- action queue
- relevant captures
- recent agent handoffs
- returned agent output
- instructions for the next agent
- what the agent should avoid

The brief must be bounded and deterministic. Do not dump raw unbounded logs.

## Agent Writeback

Agents should not "chat" with each other in an open room first. They should coordinate through structured writeback into Hypher.

Useful event types:

- handoff
- build log
- question
- suggestion
- artifact
- next action

The product goal is:

```txt
Agent A does work -> posts structured update -> Hypher updates memory/Pulse -> Agent B reads the next brief
```

This is the clean version of "agents talking to each other using Hypher."

## Native And Reminder Roadmap

The assistant vision should return through practical workflow surfaces:

1. Mac menu bar capture and global hotkey.
2. iOS share sheet and action button capture.
3. Native inbox review.
4. Read-only Project Pulse and daily digest on native.
5. Useful reminders for stale projects, unresolved decisions, and missed agent results.
6. Full native workspace/canvas only after the capture and reminder use cases prove themselves.

Do not rewrite the web app in Swift now. The web app is the command center and contract proving ground. Native apps should start as capture/reminder companions.

## Developer Layer Order

The developer layer exists to move context in and out of Hypher.

Correct order:

1. Keep Builder Brief and agent event contracts stable.
2. Dogfood the handoff script on real sessions.
3. Improve Agent Inbox and Project Pulse review flows.
4. Package stable APIs into SDK/client helpers.
5. Expand MCP/connector workflows after the context contract is trusted.

Possible client shape:

```ts
await hypher.capture({
  content: "Need to fix the onboarding empty state",
  project: "Hypher",
});

await hypher.agentEvent({
  source: "codex",
  project: "Hypher",
  kind: "handoff",
  title: "Project Pulse tightened",
  body: "Updated the resume surface and verified tests.",
  suggestedActions: ["Run production smoke"],
});

const brief = await hypher.context.forProject({ project: "Hypher" });
```

## Build Priority

### P0

- Align all docs and landing copy around context-first positioning.
- Controlled beta with users who have real messy project context.
- Dogfood Builder Briefs and agent writeback on real work.
- Tighten Project Pulse as the human resume surface.
- Keep capture fast because it feeds memory.

### P1

- Better inbox review for captures and unmatched agent events.
- Clear action records with source labels.
- Save/review/dismiss/move agent events.
- Handoff result visibility.
- GitHub context inside Pulse and briefs.
- Context history.

### P2

- Mac hotkey/menu bar capture.
- iOS share sheet/action button capture.
- Proactive reminders and digest improvements.
- ChatGPT/Claude/Cursor/Codex connector workflows.
- SDK/MCP packaging.

### Later

- Full project assistant chat.
- Native workspace/canvas.
- Advanced graph view.
- Full task manager.
- Public team collaboration.

## What Not To Build Yet

Avoid:

- generic assistant chat before memory is trusted
- full native rewrite
- full MCP marketplace
- heavy task management
- complex graph UI
- public team workspace
- agent orchestration that creates noise

These are not wrong. They are early.

## Product Bar

"Builders can't live without it" means:

> They trust Hypher as the place to resume a project and brief an agent.

After using Hypher for a week, a builder should feel:

- I know what changed.
- I know what the agent did.
- I know what still needs review.
- I know the next move.
- I can hand this project to an agent without reconstructing context.
- I do not have to remember every project manually.

That is the bar.
