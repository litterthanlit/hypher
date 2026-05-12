# ChatGPT Connector Context API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose the existing Project Pulse agent context packet through a protected server API route so a future ChatGPT OAuth/MCP connector has a real context source.

**Architecture:** Add a small pure helper that builds the API response and plan-tier limits, then add `GET /api/projects/[projectId]/agent-context` using Clerk session auth plus Convex reads. Keep OAuth/MCP out of this milestone.

**Tech Stack:** Next.js App Router, Clerk, Convex, TypeScript, Vitest.

---

### Task 1: Agent Context API Helper

**Files:**
- Create: `hypher-web/src/lib/agentContextApi.ts`
- Create: `hypher-web/src/lib/agentContextApi.test.ts`

- [x] Write failing tests for free vs paid context limits and response shape.
- [x] Run `npm test -- src/lib/agentContextApi.test.ts` and verify it fails because the helper does not exist.
- [x] Implement `getAgentContextLimits` and `buildAgentContextApiResponse`.
- [x] Run `npm test -- src/lib/agentContextApi.test.ts` and verify it passes.

### Task 2: Protected Route

**Files:**
- Create: `hypher-web/src/app/api/projects/[projectId]/agent-context/route.ts`

- [x] Add Clerk session auth and Convex token checks.
- [x] Fetch project/items through `projectMemories.generationInput`.
- [x] Fetch memory, action queue, agent events, and subscription state through existing Convex queries.
- [x] Compile the markdown packet with plan-based limits.
- [x] Return JSON: `{ ok, projectId, plan, limits, context }`.

### Task 3: Verification

**Files:**
- None unless tests reveal an issue.

- [x] Run `npm test -- src/lib/agentContextApi.test.ts src/lib/projectContext.test.ts src/lib/projectPulse.test.ts src/lib/actions.test.ts src/lib/agentEvents.test.ts`.
- [x] Run `npm run build`.
- [x] Report exact pass/fail output.

Final verification:

- `npm test -- src/lib/agentContextApi.test.ts src/lib/projectContext.test.ts src/lib/projectPulse.test.ts src/lib/actions.test.ts src/lib/agentEvents.test.ts`: 5 files passed, 20 tests passed.
- `npm run build`: passed and included `/api/projects/[projectId]/agent-context`.
