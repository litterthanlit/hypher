---
name: end-session
description: End a Hypher-backed coding session. Use when wrapping up, creating a handoff, or when the user runs /hypher-handoff.
---

# End a Hypher session

Write one structured handoff back to Hypher so the next session starts warmer.

## Steps

1. Summarize what changed: files, decisions, leftover questions, and the best next move.
2. Detect repo metadata if not already known:

   ```bash
   git remote get-url origin
   git branch --show-current
   git rev-parse HEAD
   ```

3. Resolve `projectId` with `resolve_project_for_repo` unless the session already has one.
4. Call `post_agent_event` once with:
   - `kind`: `handoff`
   - `source`: `cursor` (default)
   - `title`: short session title
   - `body`: the summary
   - `projectId` when known
   - `repo`, `branch`, and `commitSha` when available
   - optional `suggestedActions` for concrete next moves
5. Confirm to the user with the tool result, which should look like: "Logged to Hypher → Project Pulse / Agent Inbox."

## Constraints

- Default to one `handoff` per session.
- Add `question` or `next_action` events only when the user asks, or when a blocker must be reviewed in Hypher.
- Do not dump raw diffs into the body. Keep it bounded and useful for the next Builder Brief.
