---
name: hypher-brief
description: Load the Hypher Builder Brief for the current repo
---

Run the Hypher `start-session` skill.

Resolve the workspace git remote with `resolve_project_for_repo`, then call `get_project_context` for the matched project. If nothing matches, follow `link-project`.
