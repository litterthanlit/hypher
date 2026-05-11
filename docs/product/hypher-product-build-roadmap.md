# Hypher Product Build Roadmap

Last updated: May 6, 2026

## Source Of Truth

This roadmap merges the current strategic roadmap with the Hypher Agent Brief.

The working product thesis is:

> Hypher is an idea-capture-first, project-aware workspace for builders and agents.

The working motto is:

> Capture first. Projects stay aware.

The deeper promise is:

> Hypher keeps every project aware of what changed, what matters, and what should happen next.

The agent loop is the wedge, but the resume loop is the habit.

## Positioning

Hypher should not feel like infrastructure first. The first user-facing reason to use Hypher is simple:

> I had an idea. I want to capture it before I lose it.

The advanced builder reason is:

> My captured ideas and project updates become reusable context for me and my AI agents.

Simple user-level pitch:

> Hypher helps you capture ideas and turn them into clear projects.

Advanced builder-level pitch:

> Hypher turns your captured ideas and project updates into agent-ready context, so every AI tool you use understands what you are building.

## Product Model

Hypher has three layers.

### 1. Capture Layer

This is the front door and core habit.

Users should be able to quickly capture:

- raw ideas
- product thoughts
- feature concepts
- bugs
- customer feedback
- screenshots and files
- links
- meeting notes
- chat exports
- agent outputs
- random thoughts that may become projects

The capture experience should stay fast, low-friction, and forgiving. Users should not need to pick a project, category, tag, or workflow before saving the thought.

### 2. Clarity Layer

Hypher turns captured material into useful project structure.

It should extract and maintain:

- project summary
- current direction
- last meaningful change
- goals
- key decisions
- open questions
- constraints
- risks
- relevant captures
- next actions
- stale or blocked work

This layer powers Project Pulse, the human-facing resume surface.

### 3. Context Layer

Context is the upgrade and technical moat.

Hypher packages project knowledge into context that agents can use:

- agent-ready context packets
- project handoffs
- agent run summaries
- decision logs
- context exports
- API access
- NPM SDK later
- MCP server later

The context layer should feel like a natural extension of capture, not a separate developer tool bolted on top.

## Core Loops

### Main Habit Loop

```text
capture -> pulse -> resume -> act -> handoff -> pulse
```

Plainly:

1. User captures messy project context.
2. Hypher turns it into project memory and actions.
3. Agents send work updates.
4. Project Pulse shows what changed.
5. User resumes faster.
6. User acts.
7. The next handoff updates the pulse again.

### MVP Context Loop

```text
capture idea -> organize project -> generate agent context
```

This validates the context layer before building SDK or MCP infrastructure.

## Current Validation Point

The current product test is:

> Can an agent send a useful handoff into Hypher, and can the user resume work faster from that handoff?

This is the immediate production dogfood loop.

### P0 Production Smoke

Run the live production loop before building wider:

1. Create a temporary production API key locally.
2. Send matched handoff.
3. Send unmatched handoff.
4. Move unmatched event to the Hypher project.
5. Convert a suggested action to a project action.
6. Save one event as a note.
7. Review or dismiss the event.
8. Revoke the temporary key.

Do not paste the key into chat, docs, commits, or agent logs. Use local env only.

## Project Pulse v1: Resume Surface

Project Pulse is the product experience builders should fall in love with.

Capture is the input. Agents are the differentiator. Actions are the operational layer. Memory is the intelligence. Project Pulse is where the user feels the value.

Pulse should lead with interpretation, not raw panels.

Bad:

```text
Agent updates
Actions
Memory
Recent captures
Inbox
```

Better:

```text
Where the project stands
What needs attention
What to do next
What changed recently
```

### 1. Current State

Top of the page.

Show:

- one-sentence project summary
- current direction
- last meaningful change
- stale memory warning if relevant

Example:

```text
Hypher is in private beta, moving from capture workspace into a project-aware agent layer. Latest work shipped Agent Events, Agent Inbox, and first-class actions.
```

### 2. Next Move

Show one primary next move, not a list of twelve.

Example:

```text
Run production matched/unmatched handoff smoke and confirm actions can be created from agent suggestions.
```

### 3. Needs Review

This is the operational section.

Show:

- new agent events
- unmatched agent events
- unsorted captures
- stale project memory
- blocked actions
- GitHub/build issues later

### 4. Action Queue

Keep actions lightweight:

- suggested
- accepted
- completed
- dismissed

Use source labels:

- Memory
- Agent
- Manual
- GitHub

Do not add due dates, recurrence, priority systems, or full task-manager complexity yet.

### 5. Recent Pulse

A mixed project timeline:

- captures
- memory refreshes
- agent events
- actions created or completed
- notes saved
- GitHub sync events later

### 6. Agent Updates

Dedicated, but not dominant.

It should answer:

> What did agents do since I last checked?

## Copy Agent Context v1

The next context-layer feature should be simple:

> Copy agent context

This should generate a markdown context packet from a project.

Include:

- project summary
- current state
- current goal
- key decisions
- constraints
- open questions
- next actions
- relevant recent ideas
- recent agent handoffs
- instructions for the AI agent
- what the agent should avoid

This validates agent-ready context without needing MCP or SDK first.

## Agent Handoffs

Agent handoffs matter because agents create new context. Resume matters because builders return when Hypher saves them time.

For the next five real build sessions, end with a handoff:

```text
What changed?
What passed?
What failed?
What is blocked?
What should happen next?
```

Then open Project Pulse cold the next day and ask:

> Did this help me resume faster?

If yes, Hypher is becoming valuable. If no, tighten Project Pulse before building wider.

### First Agent Workflow

Build and use one real installed workflow first:

> OpenClaw handoff skill

It should do one thing well:

- summarize work
- include repo, branch, and commit
- include tests and build status
- include blockers
- include suggested next actions
- post to Hypher

Hermes can follow after the shape proves itself.

## Developer Layer Order

Do not build the SDK or MCP before dogfooding the handoff and context-packet loops.

Correct order:

1. Prove the handoff script works.
2. Use it manually.
3. Use it through one agent skill.
4. Build Copy Agent Context.
5. Turn the stable client shape into `@hypher/core` or `@hypher/context`.
6. Add MCP only after the context contract is stable.

Possible future SDK shape:

```ts
const hypher = new HypherClient({ apiKey });

await hypher.capture({
  content: "Need to fix the onboarding empty state",
  project: "Hypher",
});

await hypher.agentEvent({
  source: "openclaw",
  project: "Hypher",
  kind: "handoff",
  title: "Activation rail shipped",
  body: "Implemented and verified.",
  suggestedActions: ["Run production smoke"],
});

await hypher.handoff({
  source: "openclaw",
  project: "Hypher",
  changed: ["Added Agent Inbox"],
  passed: ["npm test", "npm run build"],
  blocked: [],
  next: ["Smoke test production"],
});
```

`handoff(...)` can be a nicer wrapper around `agentEvent(...)`.

## Recommended Next 7 Days

### Day 1

Run production handoff smoke tests.

### Day 2-3

Use `hypher-handoff` after real work sessions.

Log what feels useful and what feels noisy.

### Day 4-5

Tighten Project Pulse v1:

- Current State
- Next Move
- Needs Review
- Action Queue
- Recent Pulse
- Agent Updates

### Day 6

Install and use one real OpenClaw handoff workflow.

### Day 7

Open Hypher cold and see whether it tells you exactly where to resume.

If it does, the product is moving in the right direction. If it does not, fix Pulse before building wider.

## Build Priority

### P0

- Production handoff smoke.
- Five-session handoff dogfood.
- Project Pulse v1 resume surface.
- Copy Agent Context v1.

### P1

- OpenClaw handoff skill.
- Better inbox review for unmatched agent events and unsorted captures.
- First-class action records with source labels.
- Save agent event as note.
- Review, dismiss, and move agent event flows.

### P2

- `@hypher/core` or `@hypher/context`.
- More polished browser capture.
- GitHub/build context in Project Pulse.
- Context export history.
- Beta request funnel if launch flow needs it.

### Later

- MCP server.
- Project Agent chat.
- Mac app.
- Voice capture.
- Notion import polish.
- Graph view.
- Full task manager.
- Public launch.
- Product Hunt.

## What Not To Build Yet

Avoid:

- full MCP
- Project Agent chat
- Mac app
- voice capture
- Notion import polish
- graph view
- full task manager
- public launch
- Product Hunt

These are not wrong. They are early.

Right now the product gets stronger by making the existing loop indispensable.

## Product Bar

"Builders can't live without it" does not mean users like the UI.

It means:

> They trust Hypher as the place to resume a project.

After using Hypher for a week, a builder should feel:

- I know what changed.
- I know what the agent did.
- I know what still needs review.
- I know the next move.
- I do not have to reconstruct context from chats, commits, notes, and memory.

That is the bar.
