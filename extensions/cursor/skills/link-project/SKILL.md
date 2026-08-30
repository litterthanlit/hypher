---
name: link-project
description: Help link the current git repo to a Hypher project when resolve_project_for_repo returns no match.
---

# Link this repo to Hypher

Use when `resolve_project_for_repo` does not match the workspace remote.

## Steps

1. Read `git remote get-url origin` and normalize it to `owner/repo`.
2. Tell the user Hypher has no project linked to that repo.
3. Send them to https://hypher.app/app/settings/integrations to:
   - save a GitHub token if needed
   - connect `owner/repo` to the right Hypher project
4. After they confirm the link, call `resolve_project_for_repo` again.
5. If it matches, continue with the `start-session` skill and load `get_project_context`.

Do not create a fake project in Cursor or proceed as if Hypher context exists.
