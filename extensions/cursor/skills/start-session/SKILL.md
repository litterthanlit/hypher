---
name: start-session
description: Start a Hypher-backed coding session. Use when opening a linked repo, beginning work, or when the user asks for the Builder Brief or current project context.
---

# Start a Hypher session

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
4. If `matched` is false:
   - Tell the user no Hypher project is linked to this repo.
   - Offer the `link-project` skill and open https://hypher.app/app/settings/integrations.
   - Do not invent project status.

## Constraints

- Load the Brief once per session, not every turn.
- Prefer Hypher tools over guessing from README or git history when the plugin is connected.
