---
name: hypher-resume
description: Resume the latest Hypher structured handoff at the start of a Codex session. Compare branch, commit, and dirty state, then continue without a manual recap. Use when another agent saved a handoff. Does not checkout.
---

# Resume a Hypher handoff

Memory stores the note. It does not checkout, copy, or sync files.

1. From the repository root, run `node hypher-web/tools/codex-claude-handoff.mjs resume --destination codex`. The script does not call Hypher and does not launch Claude Code.
2. If you do not already have the Hypher project id, call `resolve_project_for_repo` with `litterthanlit/hypher`.
3. Call `prepare_handoff` with the printed arguments. Set `projectId` and `destinationProjectId` to that same project id. Keep `destination` as `codex`. Keep `currentRepo` as the printed branch, commit, and dirty flag.
4. Continue from the returned proposal: goal, constraints, decisions and reasons, completed work, unverified work, blockers, and next action. Do not ask for a recap.
5. Read `repoMatch` and `warning`. If the working tree differs, say which of branch, commit, and dirty differ before treating the note as ready. Do not checkout or copy files to make them match.

`ranAgents` from the script stays false.
