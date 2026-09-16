---
name: start-session
description: Start a Hypher-backed coding session. Use when opening a linked repo, beginning work, or when the user asks for the Builder Brief or current project context.
---

# Start a Hypher session

The plugin `sessionStart` hook is the default path in the Cursor IDE. Use this skill when the user runs `/hypher-brief`, when the brief was not injected this session, or when hooks do not fire at all.

**Cloud / background agents and other MCP clients have no hooks.** In those environments this skill is not optional — run it automatically at the first action of the session so the next agent starts warm. The builder should never have to paste the brief from the Hypher app.

Load project memory once, then work in Cursor.

## Steps

1. Detect the workspace git remote and current revision:

   ```bash
   git remote get-url origin
   git branch --show-current
   git rev-parse --short HEAD
   ```

2. Call `resolve_project_for_repo` with the origin URL (and branch if available).
3. If `matched` is true:
   - Call `get_project_context` with the returned `projectId`.
   - Treat that Builder Brief as working context for the rest of the session.
   - Optionally call `get_next_move` if the user has not already named a task.
   - If the brief is still a skeleton or heuristic dump echo, follow the `thicken-note` skill (thin note → compile on your model → write back once).
4. If `matched` is false, say this (then follow `link-project`; do not invent status):
   - Name the exact `owner/repo`.
   - One sentence: bind is required so writebacks land on the right note — Hypher will not invent a project from this repo.
   - Point at https://hypher.app/app/settings/integrations. If no project exists yet, the user creates one in the Hypher app first (Capture / new project), then binds `owner/repo`. The agent does not mint.
   - Follow the `link-project` skill. After they confirm the link, retry `resolve_project_for_repo`.

## Constraints

- Load the Brief once per session, not every turn.
- Prefer Hypher tools over guessing from README or git history when the plugin is connected.
