---
name: link-project
description: Help link the current git repo to a Hypher project when resolve_project_for_repo returns no match.
---

# Link this repo to Hypher

Use when `resolve_project_for_repo` does not match the workspace remote.

Hypher will not invent a project from this git repo. Bind is required so writebacks land on the right note.

## Detect the repo

Read `git remote get-url origin` and normalize it to `owner/repo`.

Tell the user in plain language:

- No Hypher project is linked to `owner/repo`.
- Hypher will not mint a project from this repo.
- Bind is required so writebacks match the right note.

## What the user does (you do not mint)

The agent does not create a Hypher project. The user does this in the app:

1. Open https://hypher.app/app/settings/integrations
2. If no Hypher project exists yet for this work, create one in the Hypher app first (Capture / new project). The agent does not create it.
3. Bind / link `owner/repo` to that project.
4. Come back and say linked (or run `/hypher-brief`).

## After they confirm the link

1. Call `resolve_project_for_repo` again with the same remote.
2. If it matches, continue with the `start-session` skill and load `get_project_context`.

## Do not

- Do not create a fake project in Cursor.
- Do not proceed as if Hypher context exists.
- Do not auto-create a project via API or any MCP tool that mints from a repo.
- Do not invent project status from the repository.
