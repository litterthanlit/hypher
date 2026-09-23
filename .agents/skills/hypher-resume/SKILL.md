---
name: hypher-resume
description: Resume the latest Hypher structured handoff at the start of a Codex session. Compare branch, commit, and dirty state, then continue without a manual recap. Use when another agent saved a handoff. Does not checkout.
---

# Resume a Hypher handoff

Memory stores the note. It does not checkout, copy, or sync files.

1. From the repository root, run `node hypher-web/tools/codex-claude-handoff.mjs resume --destination codex`. The script does not call Hypher and does not launch Claude Code.
2. If you do not already have the Hypher project id, call `resolve_project_for_repo` with this repository's `owner/repo` from `git remote`.
3. Call `prepare_handoff` with the printed arguments. Set `projectId` and `destinationProjectId` to that same project id. Keep `destination` as `codex` and pass the fresh `currentRepo` metadata.
4. Read `repoMatch` and `warning`. Stop on a named repository, branch, commit, path, or dirty-state difference. If only dirty file contents are unverified, inspect them locally before continuing. Do not checkout or copy files to force a match.
5. Read the returned proposal and its decision status labels. Acknowledge the prepared receipt with `acknowledge_handoff` using its `receiptId`, `revision`, `destination`, and `projectId`; then continue without a manual recap.

`ranAgents` from the script stays false.
