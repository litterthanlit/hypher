# Copy Agent Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first context-layer proof: a Project Pulse button that copies a clean markdown agent context packet.

**Architecture:** Build a pure context compiler in `src/lib/projectContext.ts` so the packet format is testable and can later power `@hypher/context` or MCP. Wire it into `ProjectPulse` using existing project memory, captures, action queue, and agent events.

**Tech Stack:** Next.js, React, TypeScript, Convex, Vitest.

---

## Packet Contract

Output must be deterministic markdown with a fixed section order:

```md
# Agent Context: {project name}

Task: {optional task}
Role: {optional role}
Repository: {optional owner/repo}
Project status: {status}

## Project Summary
...

## Current Direction
...

## Recent Changes
...

## Open Questions
...

## Action Queue
...

## Suggested Next Moves
...

## Relevant Recent Captures
...

## Recent Agent Handoffs
...

## Instructions For The Agent
...
```

`compileProjectContext` receives:

```ts
type CompileProjectContextParams = {
  project: Project;
  memory?: ProjectMemory | null;
  captures: AnyObject[];
  actions: ProjectAction[];
  agentEvents: AgentEvent[];
  task?: string;
  role?: string;
  limits?: {
    captures?: number;
    actions?: number;
    agentEvents?: number;
    recentChanges?: number;
    openQuestions?: number;
  };
};
```

Packet rules:

- Deterministic markdown only.
- No React, Convex hooks, browser APIs, or runtime side effects in the compiler.
- Captures sort newest first by `modifiedAt`.
- Agent events sort newest first by `createdAt`.
- Actions use the existing action queue ordering and exclude completed/dismissed items.
- Missing data uses clear empty-state text.
- Content is whitespace-normalized so pasted notes, headings, code fences, and long text do not break the packet shape.
- Do not include auth/session data, hidden metadata, user ids, raw internal ids, or full unbounded logs.

### Task 1: Context Compiler

**Files:**
- Create: `hypher-web/src/lib/projectContext.ts`
- Create: `hypher-web/src/lib/projectContext.test.ts`

- [x] Write failing tests for markdown packet sections, ordering, limits, and empty-state fallbacks.
- [x] Run `npm test -- src/lib/projectContext.test.ts` and verify the tests fail because the compiler does not exist.
- [x] Implement `compileProjectContext(params)` with project, memory, captures, actions, agent events, optional task, role, and max item limits.
- [x] Run `npm test -- src/lib/projectContext.test.ts` and verify the compiler tests pass.
- [x] Add tests for markdown safety, privacy exclusions, and deterministic section ordering.

### Task 2: Project Pulse Copy Button

**Files:**
- Modify: `hypher-web/src/components/ProjectPulse.tsx`
- Modify: `hypher-web/src/lib/projectPulse.ts`
- Modify: `hypher-web/src/lib/projectPulse.test.ts`

- [x] Import `compileProjectContext`.
- [x] Add `handleCopyAgentContext`.
- [x] Add a `Copy agent context` button to the Project Pulse hero actions.
- [x] Use the existing toast pattern for copied/error states.
- [x] Extract a testable `buildProjectContextInput` helper from Project Pulse data.
- [x] Test that the helper passes memory, latest captures, actions, and agent events into the compiler without browser APIs.
- [x] Keep clipboard failure behavior as an error toast; no fallback UI in v1.

### Task 3: Verification

**Files:**
- Modify only if needed: `hypher-web/src/app/globals.css`

- [x] Run `npm test -- src/lib/projectContext.test.ts src/lib/projectPulse.test.ts src/lib/actions.test.ts src/lib/agentEvents.test.ts`.
- [x] Run `npm run build` if the focused tests pass.
- [x] Report exactly what passed or failed.

Final verification:

- `npm test -- src/lib/projectContext.test.ts src/lib/projectPulse.test.ts src/lib/actions.test.ts src/lib/agentEvents.test.ts`: 4 files passed, 17 tests passed.
- `npm run build`: passed.

Previous verification before this tightening pass:

- `npm test -- src/lib/projectContext.test.ts src/lib/projectPulse.test.ts src/lib/actions.test.ts src/lib/agentEvents.test.ts`: 4 files passed, 14 tests passed.
- `npm run build`: passed.
