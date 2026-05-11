# Hypher Agent Brief

Merged with the current product roadmap on May 6, 2026.

Canonical roadmap:

- `../../docs/product/hypher-product-build-roadmap.md`

Current operating priority:

1. Run production matched/unmatched handoff smoke.
2. Dogfood handoffs for five real build sessions.
3. Tighten Project Pulse v1 as the resume surface.
4. Build Copy Agent Context v1.
5. Install one real OpenClaw handoff workflow.
6. Defer SDK/MCP until the handoff and context-packet contracts are stable.

## Product Direction

Hypher is primarily an **idea capture and project clarity product** for builders.

The core product should stay focused on helping users capture messy ideas, organize them, and turn them into clear project direction. The context layer should be positioned as a powerful add-on and selling point, not as a replacement for idea capture.

In simple terms:

> Hypher helps builders capture ideas, shape them into projects, and give their agents the context they need to help build.

## Core Thesis

Builders do not only need another note-taking app or another agent builder. They need a place where raw ideas can become durable project context.

Most AI builders lose context across tools. They brainstorm in ChatGPT, code in Cursor, organize in Notion, manage tasks elsewhere, and then have to keep re-explaining the project to every new agent or assistant.

Hypher solves this by starting with the natural behavior — capturing ideas — and then turning those ideas into reusable project context.

## Strategic Positioning

Hypher should be positioned as:

> The idea capture layer that becomes your project context layer.

Alternative positioning lines:

- Capture ideas. Build with context.
- Turn messy ideas into agent-ready project context.
- The project brain for builders and their AI agents.
- Capture the thought. Keep the context.
- Give every project a memory your agents can use.

## Important Product Decision

Do not make Hypher feel like infrastructure first.

The user-facing entry point should be simple and emotional:

> “I had an idea. I want to capture it before I lose it.”

The advanced value is:

> “Now that idea becomes structured context that my agents can use later.”

This keeps Hypher approachable for creators, founders, indie builders, and product teams while still creating a strong technical moat.

## Product Model

Hypher should have three layers:

### 1. Capture Layer

This is the core experience.

Users can quickly capture:

- Raw ideas
- Voice notes
- Product thoughts
- Feature concepts
- Bugs
- Customer feedback
- Screenshots
- Links
- Meeting notes
- Chat exports
- Agent outputs
- Random thoughts that might become projects

The capture experience should be fast, low-friction, and forgiving. The user should not need to decide where everything belongs up front.

### 2. Clarity Layer

Hypher turns captured material into useful project structure.

It should extract and maintain:

- Project summary
- Goals
- Key decisions
- Open questions
- Tasks
- Constraints
- Risks
- User personas
- Feature ideas
- Next actions
- Important context

This layer powers the human-facing product experience, including Project Pulse.

### 3. Context Layer

This is the add-on and developer-facing selling point.

Hypher packages the project’s structured knowledge into context that agents can use.

This can eventually include:

- Agent-ready context packets
- MCP server
- NPM SDK
- API access
- Context graph
- Agent run summaries
- Project handoffs
- Decision logs
- Context exports

The context layer should feel like a natural extension of idea capture, not a separate product bolted on randomly.

## Core User Journey

1. User captures a messy idea.
2. Hypher summarizes and organizes it.
3. Hypher detects whether it belongs to an existing project or should become a new project.
4. Hypher updates the project’s current state.
5. Hypher suggests next actions.
6. When the user works with an AI agent, Hypher can provide the right context for that task.

Example:

```txt
User captures:
“I think Hypher should still be about ideas, but maybe the context layer is the dev-facing add-on.”

Hypher extracts:
- Product decision: Idea capture remains core.
- Strategic direction: Context layer becomes add-on/selling point.
- Positioning: Capture ideas, convert them into agent-ready context.
- Next action: Update product brief and landing page messaging.
```

## What the Agent Should Help Build

The agent should help build Hypher as an idea-first product with an optional context layer.

Prioritize features in this order:

1. Fast idea capture
2. Project organization
3. Project Pulse / current state
4. Structured extraction from captured ideas
5. Context packets for agents
6. Context export
7. MCP / SDK integrations
8. Advanced automation

## Product Principles

### Capture First

The first user action should always be easy capture. Do not force setup, categories, tags, or project structure before the user can save an idea.

### Structure After Capture

Hypher should organize after the user captures. The system should do the work of turning messy thoughts into useful project knowledge.

### Context Is the Upgrade

Context should be the feature that makes Hypher uniquely valuable to AI builders. The product should not lead with technical infrastructure unless targeting developers specifically.

### Do Not Become Another Agent Builder

Hypher should help agents work better, but it should not try to replace OpenAI, Claude, Cursor, LangChain, CrewAI, or other agent frameworks.

Hypher’s role is to provide the project brain.

### Do Not Become Another Notion

Hypher should not become a blank workspace where users manually organize everything. It should be capture-native and AI-organized.

### Make Project State Obvious

At any point, a user should be able to open a project and understand:

- What this project is
- What changed recently
- What decisions have been made
- What still needs attention
- What to do next
- What context an agent would need

## Feature Set

### Idea Capture

Required capabilities:

- Text capture
- Voice capture
- Link capture
- Screenshot or file capture
- Quick capture from anywhere
- Inbox for uncategorized ideas
- Ability to attach capture to a project
- AI-generated title and summary
- AI-detected project relevance

### Project Pulse

Project Pulse should show:

- Current state
- Recent updates
- Key decisions
- Open questions
- Action queue
- Needs review
- Suggested next move
- Relevant captured ideas

### Context Add-On

The Context add-on should eventually allow users to generate an agent-ready context packet.

A context packet should include:

- Project summary
- Current goal
- Relevant decisions
- Constraints
- Recent changes
- Open questions
- Task-specific instructions
- Files or artifacts to consider
- What the agent should avoid

Example context packet:

```txt
Project: Hypher
Task: Improve landing page messaging

Current direction:
Hypher is an idea capture product for builders. The context layer is an add-on that turns captured ideas into reusable project context for agents.

Important decisions:
- Keep idea capture as the core product.
- Position context as the advanced selling point.
- Avoid sounding like generic project management.
- Avoid becoming a full agent builder.

Suggested messaging:
Capture ideas. Build with context.

Open questions:
- Should the context add-on be part of Pro pricing?
- Should developers get an npm package first or an MCP server first?
```

## NPM / MCP Direction

The developer-facing layer can be introduced later through:

```bash
npm install @hypher/context
```

Potential SDK usage:

```ts
import { Hypher } from "@hypher/context";

const hypher = new Hypher({
  apiKey: process.env.HYPHER_API_KEY,
  projectId: "project_id"
});

const context = await hypher.context.forTask({
  task: "Write the landing page hero copy",
  maxTokens: 4000
});
```

Potential MCP command:

```bash
npx @hypher/mcp
```

The SDK and MCP server should not be the first user experience unless the target user is a developer. They should be the technical extension of the capture product.

## Recommended MVP

The MVP should include:

### Capture Inbox

A simple place where users can dump ideas quickly.

### Project Creation From Ideas

Hypher should be able to turn one or more captured ideas into a project.

### Project Pulse

Each project should have a generated pulse that summarizes the project’s current state.

### Decision Extraction

Hypher should identify important product or project decisions from captured ideas.

### Open Questions

Hypher should maintain unresolved questions that need the user’s attention.

### Context Export

The first version of the context add-on can simply be a button:

> Copy agent context

This produces a clean markdown context packet that the user can paste into ChatGPT, Claude, Cursor, or another agent.

This is simpler than building the full SDK immediately and validates the context-layer value quickly.

## Suggested MVP Flow

```txt
1. User captures an idea.
2. Hypher saves it to the inbox.
3. Hypher summarizes it.
4. Hypher suggests a project or creates a new one.
5. Hypher updates Project Pulse.
6. User clicks “Copy agent context.”
7. Hypher generates a markdown context packet for the user’s agent.
```

## Landing Page Direction

Hero message:

```txt
Capture ideas. Build with context.
```

Supporting copy:

```txt
Hypher turns raw ideas, notes, and project updates into a living project brain — so you and your AI agents always know what matters, what changed, and what to do next.
```

Value props:

- Capture messy ideas before they disappear.
- Turn notes into project summaries, decisions, and next actions.
- Give your AI agents the context they need to help you build.

## Pricing Direction

Possible pricing structure:

### Free

- Capture ideas
- Basic project organization
- Limited Project Pulse

### Pro

- Unlimited projects
- Advanced Project Pulse
- Context export
- Decision tracking
- Open questions
- More captures

### Builder / Team

- Shared projects
- Agent context packets
- MCP server
- NPM SDK
- Integrations
- Agent run history

The Context layer can become the main reason users upgrade.

## What to Avoid

Avoid positioning Hypher as:

- A generic notes app
- A generic task manager
- A generic project management dashboard
- A full agent-building framework
- A memory API with no clear user experience
- A developer tool only

Avoid adding too much complexity too early:

- Complex graph UI
- Heavy integrations before capture works
- Multi-agent orchestration
- Custom agent builder
- Overly technical onboarding
- Required setup before first capture

## Agent Behavior Guidelines

When helping with Hypher, the agent should:

1. Preserve the idea-capture-first strategy.
2. Treat context as the differentiating add-on.
3. Keep UX simple and capture-native.
4. Suggest MVP paths before complex infrastructure.
5. Translate vague ideas into product decisions, user stories, and build tasks.
6. Maintain a clear distinction between human-facing Project Pulse and agent-facing Context Packets.
7. Avoid turning Hypher into an overly broad productivity suite.
8. Prefer practical implementation steps over abstract strategy.

## Current Strategic Decision

The current product decision is:

> Hypher remains an idea capture product, but its strongest selling point is that captured ideas become reusable context for builders and their AI agents.

This means the product should be explained in two levels:

### Simple User-Level Pitch

```txt
Hypher helps you capture ideas and turn them into clear projects.
```

### Advanced Builder-Level Pitch

```txt
Hypher turns your captured ideas and project updates into agent-ready context, so every AI tool you use understands what you are building.
```

## Next Recommended Build Step

Build the first version of **Copy Agent Context**.

This feature should let a user open a project and generate a markdown context packet containing:

- Project summary
- Current state
- Decisions
- Open questions
- Next actions
- Relevant recent ideas
- Instructions for an AI agent

This validates the context-layer concept without requiring a full SDK or MCP server immediately.

## Working Summary For The Agent

Hypher is not just a place to save ideas. It is a system that turns ideas into project clarity.

The product starts with capture because that is the user’s natural behavior. The context layer becomes the premium capability because it makes those captured ideas useful to AI agents.

The simplest version is:

```txt
Capture idea → Organize project → Generate agent context
```

Everything built for Hypher should support that loop.
