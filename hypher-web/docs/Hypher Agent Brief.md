# Hypher Agent Brief

Last updated: May 25, 2026.

Canonical roadmap:

- `../../docs/product/hypher-product-build-roadmap.md`

## Current Product Direction

Hypher is the **project context layer for builders and their agents**.

The original assistant vision still matters: Hypher should remember project context, track what changed, remind the user about important work, and fit into native workflows. The current product focus is narrower because the context layer is what makes that assistant useful.

In simple terms:

> Hypher captures messy project context, turns it into durable project memory, and gives humans and agents the right brief when work needs to continue.

Do not describe context as a side add-on anymore. Context is the core. Capture, Project Pulse, reminders, native capture, GitHub, and agent writeback are all supporting layers around it.

## Product Thesis

Builders lose context across notes, chats, repos, AI sessions, screenshots, docs, and half-finished thoughts. Each new agent or assistant starts cold unless the builder manually re-explains the project.

Hypher solves this by becoming the shared project memory:

- humans capture raw context quickly
- Hypher organizes it into projects
- Project Pulse shows what matters now
- Builder Briefs give agents clean context
- agents write results back into Hypher
- future reminders and native apps turn that memory into proactive assistance

The assistant vision should be built on top of this memory, not beside it.

## Strategic Positioning

Primary positioning:

> The project context layer for AI builders and agents.

Plain-language version:

> Capture the messy work. Keep the project memory. Hand agents the context.

Assistant-vision version:

> Hypher is an agentic project assistant that remembers what changed, tracks what matters, and helps you resume the right work.

Useful supporting lines:

- Project memory for builders and their agents.
- Builder Briefs for every project.
- Your shared project brain across Codex, Cursor, Claude, ChatGPT, GitHub, and your own notes.
- Capture first. Hypher turns it into context.
- The context layer that makes project assistants useful.

## Product Model

Hypher has four layers.

### 1. Capture Layer

Capture is still the front door. Users should be able to quickly save:

- raw ideas
- project notes
- screenshots and files
- links
- voice notes
- meeting notes
- chat exports
- agent output
- build logs
- GitHub or repo observations
- random thoughts that may become projects

Capture should stay low-friction. Do not force project setup before the user can save a thought.

### 2. Memory Layer

This is the core product layer.

Hypher turns captured and imported material into durable project memory:

- project summary
- current direction
- recent changes
- key decisions
- constraints
- open questions
- blockers
- accepted actions
- agent warnings
- handoff notes
- stale assumptions

This memory must be reviewable. The user stays in control of what becomes durable context.

### 3. Context Layer

This is the main focus and the technical moat.

Hypher packages memory into context that humans and agents can use:

- Builder Briefs
- agent-ready markdown packets
- protected context API
- read-only MCP tools
- agent handoff history
- returned agent output
- future SDK/client integrations

The context layer should be deterministic, bounded, and tool-neutral. It should work with ChatGPT, Claude, Codex, Cursor, Windsurf, GitHub Copilot, OpenClaw, Hermes, and future agents.

### 4. Assistant Layer

This is the long-term product expression.

Once memory and context are reliable, Hypher can become more proactive:

- reminders about stalled projects
- alerts for stale memory or unresolved decisions
- daily or weekly project digest
- "what should I work on next?"
- "what did agents do while I was away?"
- native Mac hotkey capture
- iOS share sheet and action button capture
- GitHub build overseer
- agent-to-Hypher writeback workflows

Do not build the assistant as generic chat first. Build it as project-aware assistance powered by Hypher memory.

## Core Loops

### Human Resume Loop

```txt
capture -> memory -> Project Pulse -> next move -> act -> update memory
```

Goal: the user can open a project cold and know what changed, what matters, and what to do next.

### Agent Context Loop

```txt
capture/update -> Builder Brief -> agent works -> agent writes back -> memory improves
```

Goal: every agent starts with the right project context and returns useful state to Hypher.

### Future Reminder Loop

```txt
memory changes -> Hypher detects drift/stale work/blockers -> user gets a useful reminder
```

Goal: Hypher becomes the assistant that notices projects before the user has to remember them.

## What Is Already Built

The current app already supports a meaningful version of the context loop:

- capture and project sorting
- Project Pulse
- project memory generation
- crystallized suggestions and accepted memory
- action queue
- agent events and Agent Inbox
- agent handoff script
- returned agent output loop
- Builder Brief compiler
- protected agent context API
- read-only MCP route
- API keys and capture tokens
- GitHub PAT/repo connection path
- beta gate, feedback, settings, and launch readiness

Do not tell future agents this is only a note-taking prototype. It is already a context/memory system with agent writeback.

## Current Priorities

P0:

1. Keep the landing/docs aligned around context-first positioning.
2. Dogfood the agent handoff and Builder Brief loop on real work.
3. Tighten Project Pulse as the human resume surface.
4. Make agent writeback useful, not noisy.
5. Run controlled beta with users who have real project context.

P1:

1. Improve inbox review for captures and unmatched agent events.
2. Strengthen action records and source labels.
3. Add better context history and handoff result visibility.
4. Use GitHub context inside Project Pulse and Builder Briefs.
5. Polish API key, capture token, and integration setup flows.

P2:

1. Native capture companion: Mac hotkey/menu bar first.
2. iOS share sheet and action button capture.
3. Proactive reminders and digest improvements.
4. ChatGPT/Claude/Cursor/Codex connector workflows.
5. SDK/MCP packaging after contracts are stable.

## What To Avoid

Avoid making Hypher:

- a generic notes app
- a generic task manager
- a blank Notion-style workspace
- a full agent builder
- a generic MCP marketplace
- a chat app with no durable memory
- a native rewrite before the web/context loop is proven

Avoid language that says:

- context is only an add-on
- agents are only a future idea
- capture is the whole product
- the assistant vision has been abandoned

The correct framing is:

> Capture feeds memory. Memory powers context. Context makes the assistant useful.

## Agent Behavior Guidelines

When helping with Hypher:

1. Treat the context layer as the main focus.
2. Preserve fast capture because it feeds context.
3. Keep Project Pulse as the human-facing resume surface.
4. Keep Builder Briefs as the agent-facing context surface.
5. Prefer bounded, reviewable memory over opaque automation.
6. Build agent writeback as structured updates, not free-form agent chat first.
7. Keep native Mac/iOS work focused on capture and reminders before full workspace parity.
8. Suggest assistant features only when they use Hypher memory to do something concrete.

## Current Strategic Decision

Hypher started as an agentic assistant that remembers projects and reminds the user what matters. That remains the long-term vision.

The current center of gravity is:

> Hypher is the project context layer that makes that assistant possible.

Everything should support this product shape:

```txt
Capture anything -> build project memory -> brief agents -> receive writeback -> remind/resume better
```
